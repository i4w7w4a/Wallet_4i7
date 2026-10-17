import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { contextualFailure, runSmoke } from "./smoke.mjs";

// Dropping full-path requests, identity checks or lazy/RSC checks must fail here.
async function fixture(t, change = {}) {
  const directory = await mkdtemp(path.join(tmpdir(), "novex-gold-smoke-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(path.join(directory, ".next-gold-public"));
  await writeFile(path.join(directory, ".next-gold-public/BUILD_ID"), "Linux-Build-123\n");
  const expected = {
    sourceArchiveSha256: "a".repeat(64), imageTag: "novex-gold:ci-7d097c9-1234-1",
    releaseId: "ci-7d097c9-1234-1", ciCommit: "b".repeat(40),
  };
  const manifest = {
    schema: 1, gitHead: "7d097c9cc6e1286297315c78520f341a364b35f0", linuxBuildId: "Linux-Build-123",
    archiveSha256: expected.sourceArchiveSha256, imageTag: expected.imageTag, releaseId: expected.releaseId,
    ciCommit: expected.ciCommit, build: { compiler: "Turbopack", nodeVersion: "v24.21.0" },
    ...change.manifest,
  };
  const runtime = `let x=typeof TURBOPACK_CHUNK_BASE_PATH==="string"?TURBOPACK_CHUNK_BASE_PATH:"${change.runtimeBase ?? "/gold/_next/"}";`;
  const requests = [];
  const server = createServer((request, response) => {
    requests.push({ path: request.url, rsc: request.headers.rsc });
    const resetPath = change.resetAt === "source-manifest" ? "/gold/source-manifest.json"
      : change.resetAt === "asset" ? "/gold/_next/static/chunks/turbopack-test.js" : "/gold";
    if (change.resetAt && request.url.split("?")[0] === resetPath
      && (change.resetAt !== "rsc" || request.headers.rsc === "1")) {
      request.socket.destroy();
      return;
    }
    if (request.url === "/gold" && request.headers.rsc === "1") {
      response.setHeader("Content-Type", change.rscContentType ?? "text/x-component");
      response.end(`3:I[69977,["${change.rscChunk ?? "/gold/_next/static/chunks/lazy.js"}"],"default"]\n`);
    } else if (request.url === "/gold") {
      response.setHeader("Content-Type", "text/html");
      response.end(`<html><script src="${change.htmlAsset ?? "/gold/_next/static/chunks/turbopack-test.js"}"></script><link rel="stylesheet" href="/gold/_next/static/chunks/app.css"><script>self.__next_f.push([1,'{"b":"${change.htmlBuild ?? "Linux-Build-123"}"}'])</script></html>`);
    } else if (request.url === "/gold/source-manifest.json") {
      response.setHeader("Content-Type", "application/json");
      response.end(change.malformedJson ? "{" : JSON.stringify(manifest));
    } else if (request.url === "/gold/_next/static/chunks/turbopack-test.js") {
      response.statusCode = change.assetStatus ?? 200;
      response.setHeader("Content-Type", change.jsContentType ?? "text/javascript");
      response.end(runtime);
    } else if (request.url === "/gold/_next/static/chunks/app.css") {
      response.setHeader("Content-Type", change.cssContentType ?? "text/css");
      response.end("body{color:#fff}");
    } else { response.statusCode = 404; response.end("missing"); }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return { directory, expected, requests, origin: `http://127.0.0.1:${server.address().port}`, runtime };
}

test("checks complete Gold URLs against a pass-through proxy and hashes actual asset bytes", async (t) => {
  const value = await fixture(t);
  const result = await runSmoke(value);
  assert.equal(result?.status, "PASS");
  assert.equal(result.linuxBuildId, "Linux-Build-123");
  assert.equal(result.http.assets.length, 2);
  assert.equal(result.http.assets.find((a) => a.path.endsWith(".js")).sha256, createHash("sha256").update(value.runtime).digest("hex"));
  assert.deepEqual(result.http.rsc.chunks, ["/gold/_next/static/chunks/lazy.js"]);
  assert.equal(result.http.lazyRuntimeBase, "/gold/_next/");
  assert.ok(value.requests.some((r) => r.path === "/gold/_next/static/chunks/turbopack-test.js"));
  assert.ok(value.requests.some((r) => r.path === "/gold/source-manifest.json"));
  assert.ok(value.requests.some((r) => r.path === "/gold" && r.rsc === "1"));
  assert.ok(value.requests.every((r) => r.path.startsWith("/gold")));
});

for (const [name, change, error] of [
  ["root framework URL leak", { htmlAsset: "/_next/static/chunks/bad.js" }, /namespace/],
  ["cross-origin framework asset", { htmlAsset: "https://example.invalid/gold/_next/static/chunks/bad.js" }, /namespace/],
  ["initial asset failure", { assetStatus: 404 }, /asset HTTP/],
  ["HTML served as JavaScript", { jsContentType: "text/html" }, /asset content type/],
  ["HTML served as CSS", { cssContentType: "text/html" }, /asset content type/],
  ["HTML BUILD mismatch", { htmlBuild: "wrong-build" }, /BUILD/],
  ["manifest BUILD mismatch", { manifest: { linuxBuildId: "wrong-build" } }, /identity/],
  ["manifest app SOURCE mismatch", { manifest: { gitHead: "0".repeat(40) } }, /identity/],
  ["manifest CI SOURCE mismatch", { manifest: { ciCommit: "0".repeat(40) } }, /identity/],
  ["malformed public manifest", { malformedJson: true }, /JSON/],
  ["HTML response to RSC", { rscContentType: "text/html" }, /RSC/],
  ["root RSC client chunk", { rscChunk: "/_next/static/chunks/lazy.js" }, /RSC/],
  ["root lazy runtime base", { runtimeBase: "/_next/" }, /lazy runtime/],
]) {
  test(`rejects ${name} without writing local runtime files`, async (t) => {
    const value = await fixture(t, change);
    await assert.rejects(runSmoke(value), error);
    assert.deepEqual(await readdir(value.directory), [".next-gold-public"]);
  });
}

for (const [phase, pathname] of [
  ["source-manifest", "/gold/source-manifest.json"],
  ["asset", "/gold/_next/static/chunks/turbopack-test.js"],
  ["rsc", "/gold"],
]) {
  test(`reports ${phase} and local URL with the real loopback-reset cause`, async (t) => {
    const value = await fixture(t, { resetAt: phase });
    await assert.rejects(runSmoke(value), (error) => {
      assert.equal(error.diagnostic?.phase, phase);
      assert.equal(error.diagnostic.url, value.origin + pathname);
      assert.equal(error.diagnostic.error.type, "TypeError");
      assert.equal(error.diagnostic.error.message, "fetch failed");
      assert.equal(error.diagnostic.cause.type, "SocketError");
      assert.equal(error.diagnostic.cause.code, "UND_ERR_SOCKET");
      assert.ok(error.diagnostic.cause.message.length > 0 && error.diagnostic.cause.message.length <= 256);
      return true;
    });
  });
}

test("reports a missing disk BUILD_ID without exposing an absolute host path", async (t) => {
  const value = await fixture(t);
  await rm(path.join(value.directory, ".next-gold-public/BUILD_ID"));
  await assert.rejects(runSmoke(value), (error) => {
    assert.equal(error.diagnostic?.phase, "disk-build-id");
    assert.equal(error.diagnostic.path, ".next-gold-public/BUILD_ID");
    assert.equal(error.diagnostic.error.code, "ENOENT");
    assert.ok(!error.message.includes(value.directory));
    return true;
  });
});

test("bounds and redacts selected real transport-error fields and strips URL query credentials", async (t) => {
  const value = await fixture(t, { resetAt: "asset" });
  let transport;
  try { await fetch(value.origin + "/gold/_next/static/chunks/turbopack-test.js"); } catch (error) { transport = error; }
  assert.equal(transport?.cause?.code, "UND_ERR_SOCKET");
  transport.cause.message = "Authorization: Bearer DIAG_SECRET_TOKEN " + "x".repeat(2000);
  transport.cause.headers = { authorization: "DIAG_HEADER_SECRET" };
  const error = contextualFailure("asset", value.origin + "/gold/_next/static/chunks/turbopack-test.js?token=DIAG_URL_SECRET", transport);
  assert.equal(error?.diagnostic?.url, value.origin + "/gold/_next/static/chunks/turbopack-test.js");
  assert.ok(error.diagnostic.cause.message.length <= 256);
  assert.deepEqual(Object.keys(error.diagnostic.cause).sort(), ["code", "message", "type"]);
  assert.ok(!error.message.includes("DIAG_SECRET_TOKEN"));
  assert.ok(!error.message.includes("DIAG_HEADER_SECRET"));
  assert.ok(!error.message.includes("DIAG_URL_SECRET"));
});
