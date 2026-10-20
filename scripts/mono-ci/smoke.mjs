import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { isDeepStrictEqual as same } from "node:util";
import { APP_SOURCE, DIST_DIR, PUBLIC_MANIFEST, ciIdentity, frameworkPath, sha256 } from "./artifact.mjs";

function check(value, message) { if (!value) throw new Error(message); }
export function contextualFailure(phase, location, error) {
  const text = (value, limit = 256) => String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\b(?:Bearer|Basic)\s+[^\s;,]+/gi, "[redacted auth]")
    .replace(/\b(authorization|cookie|token|secret|password)\s*[:=]\s*[^\s;,]+/gi, "$1=[redacted]")
    .replace(/https?:\/\/[^\s'"<>]+/gi, "[URL]")
    .replace(/(?:[A-Za-z]:[\\/]|\/)[^\s'"<>]*/g, "[path]").slice(0, limit);
  const fields = (value) => ({ type: text(value?.name ?? typeof value, 64),
    ...(value?.code === undefined ? {} : { code: text(value.code, 64) }), message: text(value?.message ?? value) });
  const diagnostic = { phase, error: fields(error), ...(error?.cause ? { cause: fields(error.cause) } : {}) };
  if (/^https?:\/\//.test(location)) {
    const url = new URL(location);
    diagnostic.url = ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ? `${url.origin}${url.pathname}` : "[non-local URL]";
  } else diagnostic.path = `${DIST_DIR}/BUILD_ID`;
  const failure = new Error(`MONO smoke failure ${JSON.stringify(diagnostic)}`);
  failure.diagnostic = diagnostic;
  return failure;
}
async function atPhase(phase, location, operation) {
  try { return await operation(); } catch (error) { throw contextualFailure(phase, location, error); }
}
async function bytes(response) {
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body ?? []) {
    size += chunk.length;
    check(size <= 8 * 1024 * 1024, "HTTP response exceeds smoke byte bound");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
async function waitForMono(origin) {
  let cause;
  for (let attempt = 1; attempt <= 40; attempt++) {
    try {
      const response = await fetch(`${origin}/mono`, { signal: AbortSignal.timeout(2000), redirect: "error" });
      if (response.status === 200) return response;
      await response.body?.cancel();
    } catch (error) { cause = error; }
    if (attempt < 40) await delay(1000);
  }
  throw new Error("MONO startup HTTP200 timeout", { cause });
}

export async function runSmoke({ directory, expected, origin = "http://127.0.0.1:3000" }) {
  const url = new URL(origin);
  check(url.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)
    && url.origin === origin && !url.username && !url.password, "smoke requires exact loopback origin");
  const started = performance.now();
  async function request(phase, pathname, options = {}) {
    return atPhase(phase, origin + pathname, () => fetch(origin + pathname,
      { signal: AbortSignal.timeout(5000), redirect: "error", ...options }));
  }
  async function responseBytes(phase, pathname, response) { return atPhase(phase, origin + pathname, () => bytes(response)); }
  const linuxBuildId = (await atPhase("disk-build-id", `${DIST_DIR}/BUILD_ID`,
    () => readFile(path.join(directory, DIST_DIR, "BUILD_ID"), "utf8"))).trim();
  check(/^[A-Za-z0-9_-]{1,100}$/.test(linuxBuildId), "invalid disk BUILD_ID");
  const mono = await atPhase("mono-html", `${origin}/mono`, () => waitForMono(origin));
  check(/^text\/html(?:;|$)/.test(mono.headers.get("content-type") ?? ""), "MONO did not serve HTML");
  const html = (await responseBytes("mono-html", "/mono", mono)).toString("utf8");
  check(html.includes(linuxBuildId), "HTML BUILD_ID mismatch");
  const frameworkReferences = [...new Set([...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
    .map((match) => match[1].replaceAll("&amp;", "&")).filter((value) => value.includes("/_next/")))];
  check(frameworkReferences.length > 0 && frameworkReferences.length <= 128, "missing framework namespace references");
  frameworkReferences.forEach(frameworkPath);
  const paths = frameworkReferences.filter((value) => /\.(?:js|css)(?:\?|$)/.test(value));
  check(paths.length <= 64 && paths.some((value) => /\.js(?:\?|$)/.test(value))
    && paths.some((value) => /\.css(?:\?|$)/.test(value)), "missing initial CSS/JS references");

  const root = await request("root", "/", { redirect: "manual" });
  const rootProof = { status: root.status, location: root.headers.get("location") };
  await root.body?.cancel();
  check(rootProof.status === 307 && rootProof.location === "/mono", "invalid root redirect");
  const portable = await request("portable", "/mono/view");
  check(portable.status === 200 && /^text\/html(?:;|$)/.test(portable.headers.get("content-type") ?? ""), "invalid portable viewer response");
  check((await responseBytes("portable", "/mono/view", portable)).length > 0, "empty portable viewer");

  const unavailable = [];
  for (const pathname of ["/api/mono-published/config", "/api/mono-published/2"]) {
    const response = await request("publication", pathname);
    check(response.status === 503 && /^application\/json(?:;|$)/.test(response.headers.get("content-type") ?? ""), "invalid publication unavailable status");
    const value = JSON.parse((await responseBytes("publication", pathname, response)).toString("utf8"));
    check(same(value, { error: "Публикация не настроена." }), "invalid publication unavailable reason");
    unavailable.push(response.status);
  }
  const published = await request("published-page", "/p/2");
  check(published.status === 500 && /^text\/html(?:;|$)/.test(published.headers.get("content-type") ?? ""), "invalid published page without runtime config");
  await responseBytes("published-page", "/p/2", published);

  const publicResponse = await request("source-manifest", PUBLIC_MANIFEST);
  check(publicResponse.status === 200 && /^application\/json(?:;|$)/.test(publicResponse.headers.get("content-type") ?? ""), "public manifest HTTP failure");
  const publicBytes = await responseBytes("source-manifest", PUBLIC_MANIFEST, publicResponse);
  const manifest = JSON.parse(publicBytes.toString("utf8"));
  check(manifest.schema === 1 && manifest.gitHead === APP_SOURCE && manifest.linuxBuildId === linuxBuildId
    && manifest.archiveSha256 === expected.sourceArchiveSha256 && manifest.imageTag === expected.imageTag
    && manifest.releaseId === expected.releaseId && manifest.ciCommit === expected.ci.commit && same(manifest.ci, expected.ci), "public manifest identity mismatch");

  const assets = [];
  let lazyRuntimeBase;
  for (const assetPath of paths) {
    const response = await request("asset", assetPath);
    check(response.status === 200, `asset HTTP ${response.status}: ${assetPath}`);
    const contentType = response.headers.get("content-type") ?? "";
    check(/\.css(?:\?|$)/.test(assetPath) ? /^text\/css(?:;|$)/.test(contentType)
      : /^(?:text|application)\/javascript(?:;|$)/.test(contentType), `invalid asset content type: ${assetPath}`);
    const content = await responseBytes("asset", assetPath, response);
    check(content.length > 0, `empty asset: ${assetPath}`);
    if (assetPath.includes("/turbopack-") && /\.js(?:\?|$)/.test(assetPath)) {
      const match = /TURBOPACK_CHUNK_BASE_PATH[\s\S]{0,180}?["'](\/[^"']*_next\/)["']/.exec(content.toString("utf8"));
      if (match) lazyRuntimeBase = match[1];
    }
    assets.push({ path: assetPath, status: response.status, contentType, sizeBytes: content.length, sha256: sha256(content) });
  }
  check(lazyRuntimeBase === "/_next/", "invalid generated lazy runtime base");
  // Fixed RSC headers require Next's present, empty cache-busting query.
  const rscPath = "/mono?_rsc";
  const rscResponse = await request("rsc", rscPath, { headers: { RSC: "1" } });
  const contentType = rscResponse.headers.get("content-type") ?? "";
  check(rscResponse.status === 200 && /^text\/x-component(?:;|$)/.test(contentType), "invalid RSC response");
  const rsc = (await responseBytes("rsc", rscPath, rscResponse)).toString("utf8");
  const chunks = [...new Set([...rsc.matchAll(/["']([^"']*\/_next\/static\/[^"']+\.js)["']/g)].map((match) => match[1]))];
  check(chunks.length > 0 && chunks.length <= 128, "missing RSC client chunks");
  chunks.forEach(frameworkPath);
  return {
    schemaVersion: 1, status: "PASS", source: APP_SOURCE, sourceArchiveSha256: expected.sourceArchiveSha256,
    imageTag: expected.imageTag, releaseId: expected.releaseId, ciCommit: expected.ci.commit, linuxBuildId,
    publicSourceManifestSha256: sha256(publicBytes), build: manifest.build, startupAndChecksMs: Math.round(performance.now() - started),
    http: { monoStatus: mono.status, root: rootProof, portableStatus: portable.status,
      published: { configStatus: unavailable[0], slotStatus: unavailable[1], pageStatus: published.status, error: "Публикация не настроена." },
      manifestStatus: publicResponse.status, assets, rsc: { status: rscResponse.status, contentType, chunks }, lazyRuntimeBase },
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [sourceArchiveSha256, imageTag, releaseId, commit, runId, runAttempt] = process.argv.slice(2);
  Promise.resolve().then(async () => {
    check(process.platform === "linux" && process.arch === "x64" && process.getuid() === 1000 && process.getgid() === 1000, "smoke requires Linux amd64 node1000:1000");
    const evidence = await runSmoke({ directory: "/workspace/apps/miniapp", expected: { sourceArchiveSha256, imageTag, releaseId, ci: ciIdentity(commit, runId, runAttempt) } });
    process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
  }).catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
