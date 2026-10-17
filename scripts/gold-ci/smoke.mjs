import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { APP_SOURCE, sha256 } from "./artifact.mjs";

const namespace = "/gold/_next/static/";
function check(condition, message) { if (!condition) throw new Error(message); }
export function contextualFailure(phase, location, error) {
  const text = (value, limit = 256) => String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\b(?:Bearer|Basic)\s+[^\s;,]+/gi, "[redacted auth]")
    .replace(/\b(authorization|cookie|token|secret|password)\s*[:=]\s*[^\s;,]+/gi, "$1=[redacted]")
    .replace(/https?:\/\/[^\s'"<>]+/gi, "[URL]")
    .replace(/(?:[A-Za-z]:[\\/]|\/)[^\s'"<>]*/g, "[path]")
    .slice(0, limit);
  const fields = (value) => ({
    type: text(value?.name ?? typeof value, 64),
    ...(value?.code === undefined ? {} : { code: text(value.code, 64) }),
    message: text(value?.message ?? value),
  });
  const diagnostic = { phase, error: fields(error), ...(error?.cause ? { cause: fields(error.cause) } : {}) };
  if (/^https?:\/\//.test(location)) {
    const url = new URL(location);
    diagnostic.url = ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)
      ? `${url.origin}${url.pathname}` : "[non-local URL]";
  } else {
    diagnostic.path = ".next-gold-public/BUILD_ID";
  }
  const failure = new Error(`Gold smoke failure ${JSON.stringify(diagnostic)}`);
  failure.diagnostic = diagnostic;
  return failure;
}

async function atPhase(phase, location, operation) {
  try { return await operation(); } catch (error) { throw contextualFailure(phase, location, error); }
}

async function bytes(response) {
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    check(size <= 8 * 1024 * 1024, "HTTP response exceeds smoke byte bound");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function goldPath(value) {
  check(value.startsWith(namespace) && !value.includes("\\")
    && new URL(value, "http://127.0.0.1").pathname.startsWith(namespace), "invalid Gold framework namespace");
  return value.replaceAll("&amp;", "&");
}

async function waitForGold(origin) {
  let lastFailure;
  for (let attempt = 1; attempt <= 40; attempt++) {
    try {
      const response = await fetch(`${origin}/gold`, { signal: AbortSignal.timeout(2000), redirect: "error" });
      if (response.status === 200) return response;
      await response.body.cancel();
    } catch (error) { lastFailure = error; /* Existing startup polling; retain only the final cause. */ }
    if (attempt < 40) await delay(1000);
  }
  throw new Error("Gold startup HTTP200 timeout", { cause: lastFailure });
}

export async function runSmoke({ directory, expected, origin = "http://127.0.0.1:3000" }) {
  const started = performance.now();
  const linuxBuildId = (await atPhase("disk-build-id", ".next-gold-public/BUILD_ID",
    () => readFile(path.join(directory, ".next-gold-public/BUILD_ID"), "utf8"))).trim();
  check(/^[A-Za-z0-9_-]{1,100}$/.test(linuxBuildId), "invalid disk BUILD_ID");
  const gold = await atPhase("gold-html", `${origin}/gold`, () => waitForGold(origin));
  check(/^text\/html(?:;|$)/.test(gold.headers.get("content-type")), "Gold did not serve HTML");
  const html = (await atPhase("gold-html", `${origin}/gold`, () => bytes(gold))).toString("utf8");
  check(html.includes(linuxBuildId), "HTML BUILD_ID mismatch");
  check(!/["'\s(=]\/_next\//.test(html), "root framework namespace leak");
  const paths = [...new Set([...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
    .map((match) => match[1]).filter((value) => value.includes("/_next/")))].map(goldPath);
  check(paths.length > 0 && paths.length <= 64 && paths.some((value) => /\.js(?:\?|$)/.test(value))
    && paths.some((value) => /\.css(?:\?|$)/.test(value)), "missing initial CSS/JS namespace references");

  const publicResponse = await atPhase("source-manifest", `${origin}/gold/source-manifest.json`,
    () => fetch(`${origin}/gold/source-manifest.json`, { signal: AbortSignal.timeout(5000), redirect: "error" }));
  check(publicResponse.status === 200, "public manifest HTTP failure");
  const publicBytes = await atPhase("source-manifest", `${origin}/gold/source-manifest.json`, () => bytes(publicResponse));
  const manifest = JSON.parse(publicBytes.toString("utf8"));
  check(manifest.schema === 1 && manifest.gitHead === APP_SOURCE && manifest.linuxBuildId === linuxBuildId
    && manifest.archiveSha256 === expected.sourceArchiveSha256 && manifest.imageTag === expected.imageTag
    && manifest.releaseId === expected.releaseId && manifest.ciCommit === expected.ciCommit, "public manifest identity mismatch");

  const assets = [];
  let lazyRuntimeBase;
  for (const assetPath of paths) {
    const response = await atPhase("asset", `${origin}${assetPath}`,
      () => fetch(`${origin}${assetPath}`, { signal: AbortSignal.timeout(5000), redirect: "error" }));
    check(response.status === 200, `asset HTTP ${response.status}: ${assetPath}`);
    const assetType = response.headers.get("content-type") ?? "";
    check(/\.css(?:\?|$)/.test(assetPath) ? /^text\/css(?:;|$)/.test(assetType)
      : /^(?:text|application)\/javascript(?:;|$)/.test(assetType), `invalid asset content type: ${assetPath}`);
    const content = await atPhase("asset", `${origin}${assetPath}`, () => bytes(response));
    check(content.length > 0, `empty asset: ${assetPath}`);
    if (assetPath.includes("/turbopack-") && /\.js(?:\?|$)/.test(assetPath)) {
      const match = /TURBOPACK_CHUNK_BASE_PATH[\s\S]{0,180}?["'](\/[^"']*_next\/)["']/.exec(content.toString("utf8"));
      if (match) lazyRuntimeBase = match[1];
    }
    assets.push({ path: assetPath, status: response.status, sizeBytes: content.length, sha256: sha256(content) });
  }
  check(lazyRuntimeBase === "/gold/_next/", "invalid generated lazy runtime base");
  // Fixed RSC headers require Next's present, empty cache-busting query.
  const rscUrl = `${origin}/gold?_rsc`;
  const rscResponse = await atPhase("rsc", rscUrl,
    () => fetch(rscUrl, { headers: { RSC: "1" }, signal: AbortSignal.timeout(5000), redirect: "error" }));
  const contentType = rscResponse.headers.get("content-type") ?? "";
  check(rscResponse.status === 200 && /^text\/x-component(?:;|$)/.test(contentType), "invalid RSC response");
  const rsc = (await atPhase("rsc", rscUrl, () => bytes(rscResponse))).toString("utf8");
  check(!/["']\/_next\//.test(rsc), "root RSC client namespace leak");
  const chunks = [...new Set([...rsc.matchAll(/["']([^"']*\/_next\/static\/[^"']+\.js)["']/g)].map((match) => match[1]))];
  check(chunks.length > 0 && chunks.length <= 128, "missing RSC client chunks");
  for (const chunk of chunks) {
    try { goldPath(chunk); } catch { throw new Error("invalid RSC client namespace"); }
  }
  return {
    schemaVersion: 1, status: "PASS", source: APP_SOURCE, sourceArchiveSha256: expected.sourceArchiveSha256,
    imageTag: expected.imageTag, releaseId: expected.releaseId, linuxBuildId,
    publicSourceManifestSha256: sha256(publicBytes), build: manifest.build,
    startupAndChecksMs: Math.round(performance.now() - started),
    http: { goldStatus: gold.status, manifestStatus: publicResponse.status, assets,
      rsc: { status: rscResponse.status, contentType, chunks }, lazyRuntimeBase },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [sourceArchiveSha256, imageTag, releaseId, ciCommit] = process.argv.slice(2);
  Promise.resolve().then(async () => {
    check(process.platform === "linux" && process.arch === "x64" && process.getuid() === 1000 && process.getgid() === 1000, "smoke requires Linux amd64 node1000:1000");
    const evidence = await runSmoke({ directory: "/workspace/apps/miniapp", expected: { sourceArchiveSha256, imageTag, releaseId, ciCommit } });
    process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
  }).catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
