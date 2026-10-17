import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const APP_SOURCE = "7d097c9cc6e1286297315c78520f341a364b35f0";
export const BASE_DIGEST = "sha256:ec857ea6bb60cb3d0fa4d97495590c5fe7d51be8572c307b55957eeb06569cf7";
export const GOLD_ENV = {
  NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1",
  NOVEX_GOLD_ASSET_PREFIX: "/gold", NOVEX_NEXT_DIST_DIR: ".next-gold-public",
};
const repository = "i4w7w4a/Wallet_4i7";
const ref = "refs/heads/codex/gold-ci-release-20261018";
const workflowPath = ".github/workflows/gold-ci-release.yml";
const namespace = "/gold/_next/static/";
const runtimeCmd = ["node", "./node_modules/next/dist/bin/next", "start", "-p", "3000", "-H", "0.0.0.0"];
const buildCmd = ["node", "./node_modules/next/dist/bin/next", "build"];
const payloadFiles = ["gold-image.tar", "artifact-ready.json", "ci-smoke.json"];
const hashPattern = /^[a-f0-9]{64}$/;
const commitPattern = /^[a-f0-9]{40}$/;
const buildPattern = /^[A-Za-z0-9_-]{1,100}$/;
const positiveInteger = (value) => Number.isSafeInteger(value) && value > 0;
const equal = (left, right) => JSON.stringify(left) === JSON.stringify(right);
export const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
function check(condition, message) { if (!condition) throw new Error(message); }

async function regularFile(directory, file, maxBytes = Number.MAX_SAFE_INTEGER) {
  check(typeof file === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(file), "invalid archive filename");
  const target = path.resolve(directory, file);
  const stat = await lstat(target);
  check(stat.isFile() && !stat.isSymbolicLink() && stat.size <= maxBytes, "invalid artifact file type or size");
  return { path: target, sizeBytes: stat.size };
}

async function hashFile(directory, file) {
  const target = await regularFile(directory, file);
  const hash = createHash("sha256");
  let sizeBytes = 0;
  for await (const chunk of createReadStream(target.path)) { hash.update(chunk); sizeBytes += chunk.length; }
  check(sizeBytes === target.sizeBytes, "archive size mismatch during read");
  return { ...target, sha256: hash.digest("hex") };
}

export async function verifyArchive(directory, archive) {
  check(archive && typeof archive.file === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]*\.tar$/.test(archive.file), "invalid archive filename");
  check(hashPattern.test(archive.sha256), "invalid archive sha256");
  check(positiveInteger(archive.sizeBytes), "invalid archive size");
  const file = await regularFile(directory, archive.file);
  check(file.sizeBytes === archive.sizeBytes, "archive size mismatch");
  const actual = await hashFile(directory, archive.file);
  check(actual.sha256 === archive.sha256, "archive checksum mismatch");
  return actual;
}

function checkBuild(build) {
  check(build && equal(build.command, buildCmd) && build.compiler === "Turbopack" && build.exitCode === 0
    && build.buildInvocationCount === 1 && build.actualNextCompileCount === 1
    && /^v24\.\d+\.\d+$/.test(build.nodeVersion) && build.pnpmVersion === "10.33.2"
    && build.nextVersion === "16.3.5" && build.baseImageDigest === BASE_DIGEST
    && build.distDir === ".next-gold-public" && build.assetPrefix === "/gold" && build.basePath === "", "invalid Linux build contract");
}

function checkCi(ci, expected) {
  check(ci && expected && ci.repository === repository && ci.ref === ref && ci.workflowPath === workflowPath
    && commitPattern.test(ci.commit) && /^[1-9]\d*$/.test(ci.runId) && /^[1-9]\d*$/.test(ci.runAttempt)
    && ci.commit === expected.commit && ci.runId === expected.runId && ci.runAttempt === expected.runAttempt
    && ci.runUrl === `https://github.com/${repository}/actions/runs/${ci.runId}`
    && ci.artifactName === `gold-${ci.commit}-${ci.runId}-${ci.runAttempt}`, "invalid or mismatched CI provenance");
}

function checkRuntime(runtime) {
  check(runtime && runtime.user === "node" && runtime.workingDir === "/workspace/apps/miniapp"
    && equal(runtime.entrypoint, ["docker-entrypoint.sh"]) && equal(runtime.cmd, runtimeCmd)
    && equal(runtime.declaredVolumes, []), "invalid image runtime contract");
  check(Object.entries(GOLD_ENV).every(([key, value]) => runtime.environment?.[key] === value)
    && !Object.keys(runtime.environment).some((key) => /TOKEN|PASSWORD|SECRET|^NOVEX_LOCAL_|^NOVEX_PREVIEW_/.test(key)), "invalid image runtime environment");
}

function validateManifest(manifest, expected) {
  check(manifest?.schemaVersion === 1 && manifest.status === "ARTIFACT_READY" && manifest.source === APP_SOURCE, "invalid artifact schema or app source");
  checkCi(manifest.ci, expected);
  check(hashPattern.test(manifest.sourceArchiveSha256) && manifest.platform === "linux/amd64"
    && manifest.imageTag === `novex-gold:ci-7d097c9-${manifest.ci.runId}-${manifest.ci.runAttempt}`
    && manifest.releaseId === `ci-7d097c9-${manifest.ci.runId}-${manifest.ci.runAttempt}`
    && /^sha256:[a-f0-9]{64}$/.test(manifest.imageId) && positiveInteger(manifest.imageSizeBytes)
    && buildPattern.test(manifest.linuxBuildId), "invalid image or source identity");
  check(manifest.archive?.file === "gold-image.tar" && hashPattern.test(manifest.archive.sha256)
    && positiveInteger(manifest.archive.sizeBytes), "invalid archive descriptor");
  check(manifest.namespace === namespace && manifest.lazyRuntimeBase === "/gold/_next/", "invalid Gold namespace");
  checkBuild(manifest.build);
  checkRuntime(manifest.runtime);
  check(hashPattern.test(manifest.publicSourceManifestSha256) && manifest.smoke?.file === "ci-smoke.json"
    && manifest.smoke.status === "PASS" && hashPattern.test(manifest.smoke.sha256), "invalid smoke descriptor");
  return manifest;
}

function checkContainer(container, imageId) {
  const host = container?.HostConfig;
  check(container?.Image === imageId && container.State?.Running === true && container.State.ExitCode === 0
    && container.State.OOMKilled === false && !container.State.Error && equal(container.Mounts, [])
    && host?.NanoCpus === 1000000000 && host.Memory === 536870912 && host.MemorySwap === 536870912
    && Object.keys(host.PortBindings ?? {}).length === 0 && host.NetworkMode === "none"
    && host.CapDrop?.includes("ALL") && host.SecurityOpt?.some((value) => /^no-new-privileges(?::true)?$/.test(value)), "invalid container runtime limits or state");
}

function checkSmoke(smoke, manifest) {
  check(smoke?.schemaVersion === 1 && smoke.status === "PASS" && smoke.source === manifest.source
    && smoke.imageTag === manifest.imageTag && smoke.releaseId === manifest.releaseId
    && smoke.sourceArchiveSha256 === manifest.sourceArchiveSha256 && smoke.linuxBuildId === manifest.linuxBuildId
    && smoke.publicSourceManifestSha256 === manifest.publicSourceManifestSha256 && equal(smoke.build, manifest.build), "smoke identity mismatch");
  const http = smoke.http;
  check(http?.goldStatus === 200 && http.manifestStatus === 200 && http.lazyRuntimeBase === "/gold/_next/"
    && Array.isArray(http.assets) && http.assets.some((asset) => /\.css(?:\?|$)/.test(asset.path))
    && http.assets.some((asset) => /\.js(?:\?|$)/.test(asset.path))
    && http.assets.every((asset) => asset.path.startsWith(namespace) && asset.status === 200 && positiveInteger(asset.sizeBytes) && hashPattern.test(asset.sha256))
    && http.rsc?.status === 200 && /^text\/x-component(?:;|$)/.test(http.rsc.contentType)
    && Array.isArray(http.rsc.chunks) && http.rsc.chunks.length > 0
    && http.rsc.chunks.every((chunk) => chunk.startsWith(namespace)), "invalid Gold HTTP/assets/RSC smoke");
  checkContainer(smoke.container, manifest.imageId);
}

export async function writeEmbeddedManifest(directory, inputs) {
  check(hashPattern.test(inputs.sourceArchiveSha256), "invalid source archive sha256");
  check(commitPattern.test(inputs.ciCommit) && /^novex-gold:ci-7d097c9-[1-9]\d*-[1-9]\d*$/.test(inputs.imageTag)
    && inputs.releaseId === inputs.imageTag.slice("novex-gold:".length), "invalid embedded CI identity");
  checkBuild(inputs.build);
  const linuxBuildId = (await readFile(path.join(directory, ".next-gold-public/BUILD_ID"), "utf8")).trim();
  check(buildPattern.test(linuxBuildId), "invalid Linux BUILD_ID");
  const manifest = { schema: 1, gitHead: APP_SOURCE, archiveSha256: inputs.sourceArchiveSha256,
    imageTag: inputs.imageTag, releaseId: inputs.releaseId, ciCommit: inputs.ciCommit, linuxBuildId, build: inputs.build };
  await mkdir(path.join(directory, "public/gold"), { recursive: true });
  await writeFile(path.join(directory, "public/gold/source-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
  return manifest;
}

async function readJson(directory, file) {
  const target = await regularFile(directory, file, 1024 * 1024);
  return JSON.parse(await readFile(target.path, "utf8"));
}

export async function emitArtifact(directory, { image, container, ci, sourceArchiveSha256 }) {
  check(equal((await readdir(directory)).sort(), ["ci-smoke.json", "gold-image.tar"]), "invalid artifact staging filenames or already emitted delivery");
  checkCi(ci, ci);
  check(image?.Os === "linux" && image.Architecture === "amd64" && image.RepoTags?.includes(`novex-gold:ci-7d097c9-${ci.runId}-${ci.runAttempt}`)
    && image.Config?.Labels?.["org.opencontainers.image.revision"] === APP_SOURCE
    && image.Config.Labels["io.novex.ci.commit"] === ci.commit, "invalid image platform, tag or labels");
  checkContainer(container, image.Id);
  const runtime = { user: image.Config.User, workingDir: image.Config.WorkingDir,
    entrypoint: image.Config.Entrypoint, cmd: image.Config.Cmd,
    environment: Object.fromEntries(image.Config.Env.map((value) => { const at = value.indexOf("="); return [value.slice(0, at), value.slice(at + 1)]; })),
    declaredVolumes: Object.keys(image.Config.Volumes ?? {}) };
  checkRuntime(runtime);
  const smoke = await readJson(directory, "ci-smoke.json");
  const archive = await hashFile(directory, "gold-image.tar");
  const evidence = { ...smoke, container: { Id: container.Id, Image: container.Image, State: container.State,
    HostConfig: Object.fromEntries(["NanoCpus", "Memory", "MemorySwap", "PortBindings", "NetworkMode", "CapDrop", "SecurityOpt"].map((key) => [key, container.HostConfig[key]])), Mounts: container.Mounts } };
  const smokeBytes = `${JSON.stringify(evidence, null, 2)}\n`;
  const manifest = { schemaVersion: 1, status: "ARTIFACT_READY", source: APP_SOURCE, sourceArchiveSha256, ci,
    platform: `${image.Os}/${image.Architecture}`, imageTag: `novex-gold:ci-7d097c9-${ci.runId}-${ci.runAttempt}`,
    imageId: image.Id, imageSizeBytes: image.Size,
    archive: { file: "gold-image.tar", sha256: archive.sha256, sizeBytes: archive.sizeBytes },
    linuxBuildId: smoke.linuxBuildId, releaseId: `ci-7d097c9-${ci.runId}-${ci.runAttempt}`,
    namespace, lazyRuntimeBase: "/gold/_next/", build: smoke.build, runtime,
    publicSourceManifestSha256: smoke.publicSourceManifestSha256,
    smoke: { file: "ci-smoke.json", status: "PASS", sha256: sha256(smokeBytes) } };
  validateManifest(manifest, ci);
  checkSmoke(evidence, manifest);
  const manifestBytes = `${JSON.stringify(manifest, null, 2)}\n`;
  const sums = `${archive.sha256}  gold-image.tar\n${sha256(manifestBytes)}  artifact-ready.json\n${sha256(smokeBytes)}  ci-smoke.json\n`;
  await writeFile(path.join(directory, "ci-smoke.json"), smokeBytes);
  await writeFile(path.join(directory, "artifact-ready.json"), manifestBytes, { flag: "wx" });
  await writeFile(path.join(directory, "SHA256SUMS"), sums, { flag: "wx" });
  return manifest;
}

export async function verifyArtifact(directory, expected) {
  check(equal((await readdir(directory)).sort(), [...payloadFiles, "SHA256SUMS"].sort()), "invalid artifact filenames");
  const manifest = validateManifest(await readJson(directory, "artifact-ready.json"), expected);
  const target = await regularFile(directory, "SHA256SUMS", 1024);
  const lines = (await readFile(target.path, "utf8")).trim().split("\n");
  check(lines.length === 3, "invalid SHA256SUMS entry count");
  const sums = new Map();
  for (const line of lines) {
    const match = /^([a-f0-9]{64})  (gold-image\.tar|artifact-ready\.json|ci-smoke\.json)$/.exec(line);
    check(match && !sums.has(match[2]), "invalid SHA256SUMS filename or duplicate");
    sums.set(match[2], match[1]);
  }
  const archive = await verifyArchive(directory, manifest.archive);
  check(archive.sha256 === sums.get("gold-image.tar"), "archive SHA256SUMS mismatch");
  for (const file of ["artifact-ready.json", "ci-smoke.json"]) {
    check((await hashFile(directory, file)).sha256 === sums.get(file), `${file} checksum mismatch`);
  }
  check(sums.get("ci-smoke.json") === manifest.smoke.sha256, "smoke checksum mismatch");
  checkSmoke(await readJson(directory, "ci-smoke.json"), manifest);
  return manifest;
}

function ciFromEnvironment(env) {
  const ci = { repository: env.GITHUB_REPOSITORY, ref: env.GITHUB_REF, commit: env.GITHUB_SHA,
    workflowPath, runId: env.GITHUB_RUN_ID, runAttempt: env.GITHUB_RUN_ATTEMPT,
    runUrl: `https://github.com/${repository}/actions/runs/${env.GITHUB_RUN_ID}`,
    artifactName: `gold-${env.GITHUB_SHA}-${env.GITHUB_RUN_ID}-${env.GITHUB_RUN_ATTEMPT}` };
  checkCi(ci, ci);
  return ci;
}

async function main() {
  const [command, directory, ...args] = process.argv.slice(2);
  if (command === "embed") {
    check(process.platform === "linux" && process.arch === "x64", "Linux amd64 build required");
    const next = JSON.parse(await readFile(path.join(directory, "node_modules/next/package.json"), "utf8"));
    await writeEmbeddedManifest(directory, {
      sourceArchiveSha256: process.env.GOLD_SOURCE_ARCHIVE_SHA256, imageTag: process.env.GOLD_IMAGE_TAG,
      releaseId: process.env.GOLD_RELEASE_ID, ciCommit: process.env.GOLD_CI_COMMIT,
      build: { command: buildCmd, compiler: "Turbopack", exitCode: 0, buildInvocationCount: 1, actualNextCompileCount: 1,
        nodeVersion: process.version, pnpmVersion: execFileSync("pnpm", ["--version"], { encoding: "utf8" }).trim(), nextVersion: next.version,
        baseImageDigest: BASE_DIGEST, distDir: ".next-gold-public", assetPrefix: "/gold", basePath: "" },
    });
  } else if (command === "ready") {
    const image = JSON.parse(await readFile(args[0], "utf8"))[0];
    const container = JSON.parse(await readFile(args[1], "utf8"))[0];
    const manifest = await emitArtifact(directory, { image, container, ci: ciFromEnvironment(process.env), sourceArchiveSha256: process.env.GOLD_SOURCE_ARCHIVE_SHA256 });
    process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
  } else if (command === "verify") {
    const manifest = await verifyArtifact(directory, { commit: args[0], runId: args[1], runAttempt: args[2] });
    process.stdout.write(`VERIFIED ${manifest.source} ${manifest.ci.commit} ${manifest.imageId} ${manifest.linuxBuildId}\n`);
  } else {
    throw new Error("Usage: artifact.mjs embed APP_DIR | ready DIR IMAGE_INSPECT CONTAINER_INSPECT | verify DIR CI_COMMIT RUN_ID RUN_ATTEMPT");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
