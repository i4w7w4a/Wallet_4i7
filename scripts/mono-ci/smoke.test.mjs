import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { build, ci, digest, imageTag, releaseId, source, sourceArchiveSha256 } from "./fixtures.mjs";

async function implementation() {
  try { return await import("./smoke.mjs"); }
  catch (error) { if (error.code === "ERR_MODULE_NOT_FOUND") assert.fail("MONO HTTP smoke helper is not implemented"); throw error; }
}

async function fixture(t, change = {}) {
  const directory = await mkdtemp(path.join(tmpdir(), "novex-mono-http-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(path.join(directory, ".next-mono-public"));
  await writeFile(path.join(directory, ".next-mono-public/BUILD_ID"), "Linux-Build-123\n");
  const expected = { sourceArchiveSha256, imageTag, releaseId, ci };
  const manifest = { schema: 1, gitHead: source, archiveSha256: sourceArchiveSha256, ciCommit: ci.commit, ci,
    imageTag, releaseId, linuxBuildId: "Linux-Build-123", build, ...change.manifest };
  const runtime = `let x=typeof TURBOPACK_CHUNK_BASE_PATH==="string"?TURBOPACK_CHUNK_BASE_PATH:"${change.runtimeBase ?? "/_next/"}";`;
  const requests = [];
  const server = createServer((request, response) => {
    requests.push({ method: request.method, path: request.url, rsc: request.headers.rsc });
    const url = new URL(request.url, "http://127.0.0.1");
    if (change.resetAt && url.pathname === change.resetAt) { request.socket.destroy(); return; }
    if (url.pathname === "/mono" && request.headers.rsc === "1") {
      if (!url.searchParams.has("_rsc") || url.searchParams.get("_rsc") !== "" || change.rscRedirect) {
        response.writeHead(307, { Location: change.rscRedirect ?? "/mono?_rsc" }); response.end(); return;
      }
      response.setHeader("Content-Type", change.rscContentType ?? "text/x-component");
      response.end(`3:I[69977,["${change.rscChunk ?? "/_next/static/chunks/lazy.js"}"],"default"]\n`);
    } else if (request.url === "/") {
      response.writeHead(change.rootStatus ?? 307, { Location: change.rootLocation ?? "/mono" }); response.end();
    } else if (request.url === "/mono") {
      response.setHeader("Content-Type", "text/html");
      response.end(`<html><script src="${change.htmlAsset ?? "/_next/static/chunks/turbopack-test.js"}"></script><link rel="stylesheet" href="/_next/static/chunks/app.css"><script>self.__next_f.push([1,'{"b":"${change.htmlBuild ?? "Linux-Build-123"}"}'])</script></html>`);
    } else if (request.url === "/mono/view") {
      response.writeHead(change.portableStatus ?? 200, { "Content-Type": "text/html" }); response.end("<html>Portable viewer</html>");
    } else if (request.url === "/source-manifest.json") {
      response.setHeader("Content-Type", "application/json"); response.end(change.malformedJson ? "{" : JSON.stringify(manifest));
    } else if (request.url === "/_next/static/chunks/turbopack-test.js") {
      response.writeHead(change.assetStatus ?? 200, { "Content-Type": change.jsContentType ?? "text/javascript" }); response.end(runtime);
    } else if (request.url === "/_next/static/chunks/app.css") {
      response.setHeader("Content-Type", change.cssContentType ?? "text/css"); response.end("body{color:#fff}");
    } else if (request.url === "/api/mono-published/config" || request.url === "/api/mono-published/2") {
      response.writeHead((request.url.endsWith("config") ? change.configStatus : change.slotStatus) ?? 503, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: change.publishedError ?? "Публикация не настроена." }));
    } else if (request.url === "/p/2") {
      response.writeHead(change.pageStatus ?? 500, { "Content-Type": "text/html" }); response.end("<html>Unavailable without runtime configuration</html>");
    } else { response.statusCode = 404; response.end("missing"); }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => { server.closeAllConnections(); server.close(resolve); }));
  return { directory, expected, origin: `http://127.0.0.1:${server.address().port}`, requests, runtime };
}

// A wrong canonical URL, response state/MIME, source/CI/BUILD or lazy namespace must fail real HTTP checks.
test("checks root MONO routes, unavailable publication and real CSS/JS bytes using GET only", async (t) => {
  const value = await fixture(t);
  const { runSmoke } = await implementation();
  const result = await runSmoke(value);
  assert.equal(result.status, "PASS");
  assert.equal(result.source, source);
  assert.equal(result.ciCommit, ci.commit);
  assert.deepEqual(result.http.root, { status: 307, location: "/mono" });
  assert.deepEqual(result.http.published, { configStatus: 503, slotStatus: 503, pageStatus: 500, error: "Публикация не настроена." });
  assert.equal(result.http.assets.find((asset) => asset.path.endsWith(".js")).sha256, digest(value.runtime).slice(7));
  assert.equal(result.http.assets.find((asset) => asset.path.endsWith(".css")).contentType, "text/css");
  assert.equal(result.http.lazyRuntimeBase, "/_next/");
  assert.deepEqual(result.http.rsc.chunks, ["/_next/static/chunks/lazy.js"]);
  assert.deepEqual(value.requests.filter((r) => r.rsc === "1"), [{ method: "GET", path: "/mono?_rsc", rsc: "1" }]);
  assert.ok(value.requests.some((r) => r.path === "/mono/view"));
  assert.ok(value.requests.some((r) => r.path === "/api/mono-published/2"));
  assert.ok(value.requests.every((r) => r.method === "GET" && !r.path.startsWith("/gold")));
  assert.deepEqual(await readdir(value.directory), [".next-mono-public"]);
});

for (const [name, change, error] of [
  ["Gold asset namespace", { htmlAsset: "/gold/_next/static/chunks/test.js" }, /namespace/],
  ["cross-origin asset", { htmlAsset: "https://example.invalid/_next/static/chunks/test.js" }, /namespace/],
  ["encoded traversal", { htmlAsset: "/_next/static/%2e%2e/test.js" }, /namespace/],
  ["asset HTTP failure", { assetStatus: 404 }, /asset HTTP/],
  ["HTML as JavaScript", { jsContentType: "text/html" }, /content type/],
  ["HTML as CSS", { cssContentType: "text/html" }, /content type/],
  ["HTML BUILD mismatch", { htmlBuild: "wrong-build" }, /BUILD/],
  ["manifest BUILD mismatch", { manifest: { linuxBuildId: "wrong-build" } }, /identity/],
  ["manifest source mismatch", { manifest: { gitHead: "0".repeat(40) } }, /identity/],
  ["manifest CI mismatch", { manifest: { ciCommit: "0".repeat(40) } }, /identity/],
  ["manifest CI workflow mismatch", { manifest: { ci: { ...ci, workflowPath: "other.yml" } } }, /identity/],
  ["wrong root redirect", { rootLocation: "/gold" }, /root redirect/],
  ["wrong root status", { rootStatus: 302 }, /root redirect/],
  ["portable viewer failure", { portableStatus: 500 }, /portable/],
  ["configured publication", { configStatus: 200 }, /publication/],
  ["available slot", { slotStatus: 200 }, /publication/],
  ["available published page", { pageStatus: 200 }, /published/],
  ["unexpected unavailable reason", { publishedError: "other failure" }, /publication/],
  ["RSC HTML response", { rscContentType: "text/html" }, /RSC/],
  ["RSC Gold namespace", { rscChunk: "/gold/_next/static/chunks/lazy.js" }, /namespace/],
  ["Gold lazy base", { runtimeBase: "/gold/_next/" }, /lazy runtime/],
  ["malformed public manifest", { malformedJson: true }, /JSON/],
]) {
  test(`rejects ${name} without writing local runtime files`, async (t) => {
    const value = await fixture(t, change);
    const { runSmoke } = await implementation();
    await assert.rejects(runSmoke(value), error);
    assert.deepEqual(await readdir(value.directory), [".next-mono-public"]);
  });
}

test("refuses canonical RSC redirects instead of following a different route", async (t) => {
  const value = await fixture(t, { rscRedirect: "/gold" });
  const { runSmoke } = await implementation();
  await assert.rejects(runSmoke(value), /rsc.*unexpected redirect/i);
  assert.ok(value.requests.every((r) => r.path !== "/gold"));
});

test("rejects a non-loopback origin before any HTTP request", async (t) => {
  const value = await fixture(t);
  const { runSmoke } = await implementation();
  await assert.rejects(runSmoke({ ...value, origin: "https://example.invalid" }), /loopback/);
  assert.equal(value.requests.length, 0);
});

test("reports the transport phase and strips absolute paths, query credentials and auth fields", async (t) => {
  const value = await fixture(t, { resetAt: "/source-manifest.json" });
  const { runSmoke, contextualFailure } = await implementation();
  await assert.rejects(runSmoke(value), (error) => {
    assert.equal(error.diagnostic?.phase, "source-manifest");
    assert.equal(error.diagnostic?.url, value.origin + "/source-manifest.json");
    assert.equal(error.diagnostic?.cause?.code, "UND_ERR_SOCKET");
    return true;
  });
  const error = contextualFailure("asset", value.origin + "/_next/a.js?token=URL_SECRET", new Error("Authorization: Bearer BODY_SECRET /private/key.pem"));
  assert.equal(error.diagnostic.url, value.origin + "/_next/a.js");
  assert.ok(!error.message.includes("URL_SECRET") && !error.message.includes("BODY_SECRET") && !error.message.includes("/private/key.pem"));
});
