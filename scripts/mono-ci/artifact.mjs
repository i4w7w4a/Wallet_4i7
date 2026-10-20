import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createReadStream } from "node:fs";
import { lstat, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { isDeepStrictEqual as same } from "node:util";
import { inspectDockerArchive } from "./archive.mjs";

export const APP_SOURCE = "7dbf2b80086abe7ccb25b9df9d989d36e04230a1";
export const BASE_DIGEST = "sha256:ec857ea6bb60cb3d0fa4d97495590c5fe7d51be8572c307b55957eeb06569cf7";
export const DIST_DIR = ".next-mono-public";
export const PUBLIC_MANIFEST = "/source-manifest.json";
export const MONO_ENV = { NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1", NOVEX_NEXT_DIST_DIR: DIST_DIR };
const repository = "i4w7w4a/Wallet_4i7";
const ref = "refs/heads/codex/compact-workbench-20261020";
const workflowPath = ".github/workflows/mono-ci-release.yml";
const namespace = "/_next/static/";
const runtimeCmd = ["node", "./node_modules/next/dist/bin/next", "start", "-p", "3000", "-H", "0.0.0.0"];
const buildCmd = ["node", "./node_modules/next/dist/bin/next", "build"];
const payloadFiles = ["mono-image.tar", "artifact-ready.json", "ci-smoke.json"];
const hashPattern = /^[a-f0-9]{64}$/;
const commitPattern = /^[a-f0-9]{40}$/;
const buildPattern = /^[A-Za-z0-9_-]{1,100}$/;
const positive = (value) => Number.isSafeInteger(value) && value > 0;
export const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
function check(value, message) { if (!value) throw new Error(message); }

async function regularFile(directory, file, maxBytes = Number.MAX_SAFE_INTEGER) {
  check(typeof file === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(file), "invalid artifact filename");
  const target = path.resolve(directory, file);
  const stat = await lstat(target);
  check(stat.isFile() && !stat.isSymbolicLink() && stat.size <= maxBytes, "invalid artifact file type or size");
  return { path: target, sizeBytes: stat.size };
}
async function hashFile(directory, file) {
  const target = await regularFile(directory, file);
  const hash = createHash("sha256");
  let sizeBytes = 0;
  for await (const bytes of createReadStream(target.path)) { hash.update(bytes); sizeBytes += bytes.length; }
  check(sizeBytes === target.sizeBytes, "archive size mismatch during read");
  return { ...target, sha256: hash.digest("hex") };
}
async function readJson(directory, file) {
  const target = await regularFile(directory, file, 8 * 1024 * 1024);
  return JSON.parse(await readFile(target.path, "utf8"));
}

export async function verifyArchive(directory, archive) {
  check(archive?.file === "mono-image.tar", "invalid archive filename");
  check(hashPattern.test(archive.sha256) && positive(archive.sizeBytes), "invalid archive checksum or size");
  const target = await regularFile(directory, archive.file);
  check(target.sizeBytes === archive.sizeBytes, "archive size mismatch");
  const actual = await hashFile(directory, archive.file);
  check(actual.sha256 === archive.sha256, "archive checksum mismatch");
  return actual;
}

function checkCi(ci, expected) {
  check(ci && expected && ci.repository === repository && ci.ref === ref && ci.workflowPath === workflowPath
    && commitPattern.test(ci.commit) && ci.commit !== APP_SOURCE && /^[1-9]\d*$/.test(ci.runId) && /^[1-9]\d*$/.test(ci.runAttempt)
    && ci.commit === expected.commit && ci.runId === expected.runId && ci.runAttempt === expected.runAttempt
    && ["repository", "ref", "workflowPath"].every((key) => expected[key] === undefined || expected[key] === ci[key])
    && ci.runUrl === `https://github.com/${repository}/actions/runs/${ci.runId}`
    && ci.artifactName === `mono-${ci.commit}-${ci.runId}-${ci.runAttempt}`, "invalid or mismatched CI provenance");
}
function checkBuild(build) {
  check(build && same(build.command, buildCmd) && build.compiler === "Turbopack" && build.exitCode === 0
    && build.buildInvocationCount === 1 && build.actualNextCompileCount === 1
    && /^v24\.\d+\.\d+$/.test(build.nodeVersion) && build.pnpmVersion === "10.33.2" && build.nextVersion === "16.3.5"
    && build.baseImageDigest === BASE_DIGEST && build.distDir === DIST_DIR && build.assetPrefix === "" && build.basePath === "", "invalid Linux build contract");
}
function runtimeFromConfig(config) {
  check(Array.isArray(config?.Env), "invalid image runtime environment");
  const environment = {};
  for (const entry of config.Env) {
    const at = typeof entry === "string" ? entry.indexOf("=") : -1;
    check(at > 0 && !Object.hasOwn(environment, entry.slice(0, at)), "invalid duplicate runtime environment key");
    environment[entry.slice(0, at)] = entry.slice(at + 1);
  }
  const runtime = { user: config.User, workingDir: config.WorkingDir, entrypoint: config.Entrypoint, cmd: config.Cmd,
    environment, declaredVolumes: Object.keys(config.Volumes ?? {}) };
  checkRuntime(runtime);
  return runtime;
}
function checkRuntime(runtime) {
  check(runtime && runtime.user === "node" && runtime.workingDir === "/workspace/apps/miniapp"
    && same(runtime.entrypoint, ["docker-entrypoint.sh"]) && same(runtime.cmd, runtimeCmd) && same(runtime.declaredVolumes, []), "invalid image runtime contract");
  const allowed = [...Object.keys(MONO_ENV), "PATH", "NODE_VERSION", "YARN_VERSION"];
  check(runtime.environment && Object.entries(MONO_ENV).every(([key, value]) => runtime.environment[key] === value)
    && Object.keys(runtime.environment).every((key) => allowed.includes(key)), "invalid image runtime environment");
}
function checkContainer(container, imageId, runtime) {
  const host = container?.HostConfig;
  check(container && /^[a-f0-9]{64}$/.test(container.Id) && container.Image === imageId
    && container.State?.Running === true && container.State.ExitCode === 0 && container.State.OOMKilled === false
    && container.State.Error === "" && Number.isFinite(Date.parse(container.State.StartedAt)) && same(container.Mounts, [])
    && host?.NanoCpus === 1000000000 && host.Memory === 536870912 && host.MemorySwap === 536870912
    && Object.keys(host.PortBindings ?? {}).length === 0 && host.NetworkMode === "none"
    && host.CapDrop?.includes("ALL") && host.SecurityOpt?.some((entry) => /^no-new-privileges(?::true)?$/.test(entry)), "invalid container runtime limits or state");
  check(same(runtimeFromConfig(container.Config), runtime), "container runtime override mismatch");
}
export function frameworkPath(value) {
  check(typeof value === "string" && value.startsWith(namespace) && value.length <= 2048 && !/[\s\\#]/.test(value), "invalid MONO framework namespace");
  const url = new URL(value, "http://127.0.0.1");
  const decoded = decodeURIComponent(url.pathname);
  check(url.origin === "http://127.0.0.1" && url.pathname.startsWith(namespace) && decoded.startsWith(namespace)
    && !decoded.includes("\\") && !decoded.split("/").includes(".."), "invalid MONO framework namespace");
  return value;
}
function checkSmoke(smoke, manifest) {
  check(smoke?.schemaVersion === 1 && smoke.status === "PASS" && smoke.source === APP_SOURCE
    && smoke.imageTag === manifest.imageTag && smoke.releaseId === manifest.releaseId && smoke.ciCommit === manifest.ci.commit
    && smoke.sourceArchiveSha256 === manifest.sourceArchiveSha256 && smoke.linuxBuildId === manifest.linuxBuildId
    && smoke.publicSourceManifestSha256 === manifest.publicSourceManifestSha256 && same(smoke.build, manifest.build), "smoke identity mismatch");
  const http = smoke.http;
  check(http?.monoStatus === 200 && http.root?.status === 307 && http.root.location === "/mono"
    && http.portableStatus === 200 && http.published?.configStatus === 503 && http.published.slotStatus === 503
    && http.published.pageStatus === 500 && http.published.error === "Публикация не настроена."
    && http.manifestStatus === 200 && http.lazyRuntimeBase === "/_next/"
    && Array.isArray(http.assets) && http.assets.length > 0 && http.assets.length <= 64
    && http.assets.some((asset) => /\.css(?:\?|$)/.test(asset.path)) && http.assets.some((asset) => /\.js(?:\?|$)/.test(asset.path)), "invalid MONO HTTP smoke");
  for (const asset of http.assets) {
    frameworkPath(asset.path);
    check(asset.status === 200 && positive(asset.sizeBytes) && hashPattern.test(asset.sha256)
      && (/\.css(?:\?|$)/.test(asset.path) ? /^text\/css(?:;|$)/.test(asset.contentType)
        : /^(?:text|application)\/javascript(?:;|$)/.test(asset.contentType)), "invalid MONO asset smoke");
  }
  check(http.rsc?.status === 200 && /^text\/x-component(?:;|$)/.test(http.rsc.contentType)
    && Array.isArray(http.rsc.chunks) && http.rsc.chunks.length > 0 && http.rsc.chunks.length <= 128, "invalid MONO RSC smoke");
  http.rsc.chunks.forEach(frameworkPath);
  checkContainer(smoke.container, manifest.imageId, manifest.runtime);
}
function imageIdKind(imageId, proof) {
  if (imageId === proof.config.digest) return "config";
  if (imageId === proof.target?.digest) return "oci-target";
  if (imageId === proof.manifest?.digest) return "oci-manifest";
  throw new Error("invalid producer image ID: no archive config/OCI identity matches");
}
function checkRawConfig(proof, manifest) {
  check(proof?.config && Array.isArray(proof.layers), "invalid raw archive identities");
  const bytes = Buffer.from(proof.config.rawBase64, "base64");
  check(`sha256:${sha256(bytes)}` === proof.config.digest && bytes.length === proof.config.sizeBytes, "raw archive config identity mismatch");
  const config = JSON.parse(bytes.toString("utf8"));
  check(config.os === "linux" && config.architecture === "amd64"
    && config.config?.Labels?.["org.opencontainers.image.revision"] === APP_SOURCE
    && config.config.Labels["io.novex.ci.commit"] === manifest.ci.commit
    && same(runtimeFromConfig(config.config), manifest.runtime)
    && same(config.rootfs?.diff_ids, proof.layers.map((layer) => layer.diffId)), "invalid raw config runtime, labels or layers");
  check(manifest.imageIdKind === imageIdKind(manifest.imageId, proof), "image ID kind mismatch");
}
function validateManifest(manifest, expected) {
  check(manifest?.schemaVersion === 1 && manifest.status === "ARTIFACT_READY" && manifest.source === APP_SOURCE, "invalid artifact schema or app source");
  checkCi(manifest.ci, expected);
  check(hashPattern.test(manifest.sourceArchiveSha256) && manifest.platform === "linux/amd64"
    && manifest.imageTag === `novex-mono:ci-7dbf2b8-${manifest.ci.runId}-${manifest.ci.runAttempt}`
    && manifest.releaseId === `ci-7dbf2b8-${manifest.ci.runId}-${manifest.ci.runAttempt}`
    && /^sha256:[a-f0-9]{64}$/.test(manifest.imageId) && positive(manifest.imageSizeBytes) && buildPattern.test(manifest.linuxBuildId), "invalid image or source identity");
  check(manifest.archive?.file === "mono-image.tar" && hashPattern.test(manifest.archive.sha256) && positive(manifest.archive.sizeBytes), "invalid archive descriptor");
  check(manifest.namespace === namespace && manifest.lazyRuntimeBase === "/_next/" && manifest.publicSourceManifestPath === PUBLIC_MANIFEST, "invalid MONO namespace or manifest path");
  checkBuild(manifest.build);
  checkRuntime(manifest.runtime);
  checkRawConfig(manifest.dockerArchive, manifest);
  check(hashPattern.test(manifest.publicSourceManifestSha256) && manifest.smoke?.file === "ci-smoke.json"
    && manifest.smoke.status === "PASS" && hashPattern.test(manifest.smoke.sha256), "invalid smoke descriptor");
  return manifest;
}

export async function writeEmbeddedManifest(directory, inputs) {
  check(hashPattern.test(inputs.sourceArchiveSha256), "invalid source archive SHA256");
  checkCi(inputs.ci, inputs.ci);
  check(inputs.imageTag === `novex-mono:ci-7dbf2b8-${inputs.ci.runId}-${inputs.ci.runAttempt}`
    && inputs.releaseId === inputs.imageTag.slice("novex-mono:".length), "invalid embedded CI identity");
  checkBuild(inputs.build);
  const linuxBuildId = (await readFile(path.join(directory, DIST_DIR, "BUILD_ID"), "utf8")).trim();
  check(buildPattern.test(linuxBuildId), "invalid Linux BUILD_ID");
  const manifest = { schema: 1, gitHead: APP_SOURCE, archiveSha256: inputs.sourceArchiveSha256, ciCommit: inputs.ci.commit,
    ci: inputs.ci, imageTag: inputs.imageTag, releaseId: inputs.releaseId, linuxBuildId, build: inputs.build };
  await mkdir(path.join(directory, "public"), { recursive: true });
  await writeFile(path.join(directory, `public${PUBLIC_MANIFEST}`), `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
  return manifest;
}

export async function emitArtifact(directory, { image, container, ci, sourceArchiveSha256 }) {
  check(same((await readdir(directory)).sort(), ["ci-smoke.json", "mono-image.tar"]), "invalid staging filenames or already emitted delivery");
  checkCi(ci, ci);
  const imageTag = `novex-mono:ci-7dbf2b8-${ci.runId}-${ci.runAttempt}`;
  check(image?.Os === "linux" && image.Architecture === "amd64" && same(image.RepoTags, [imageTag])
    && image.Config?.Labels?.["org.opencontainers.image.revision"] === APP_SOURCE
    && image.Config.Labels["io.novex.ci.commit"] === ci.commit, "invalid producer image platform, tag or labels");
  const runtime = runtimeFromConfig(image.Config);
  checkContainer(container, image.Id, runtime);
  const smoke = await readJson(directory, "ci-smoke.json");
  const archive = await hashFile(directory, "mono-image.tar");
  const dockerArchive = await inspectDockerArchive(directory, "mono-image.tar", imageTag);
  check(same(image.RootFS?.Layers, dockerArchive.layers.map((layer) => layer.diffId)), "producer image RootFS layer mismatch");
  const evidence = { ...smoke, container: { Id: container.Id, Image: container.Image, Config: Object.fromEntries(
    ["User", "WorkingDir", "Entrypoint", "Cmd", "Env", "Volumes"].map((key) => [key, container.Config[key] ?? null])),
    State: Object.fromEntries(["Running", "ExitCode", "OOMKilled", "Error", "StartedAt"].map((key) => [key, container.State[key]])),
    HostConfig: Object.fromEntries(["NanoCpus", "Memory", "MemorySwap", "PortBindings", "NetworkMode", "CapDrop", "SecurityOpt"].map((key) => [key, container.HostConfig[key]])), Mounts: container.Mounts } };
  const smokeBytes = `${JSON.stringify(evidence, null, 2)}\n`;
  const manifest = { schemaVersion: 1, status: "ARTIFACT_READY", source: APP_SOURCE, sourceArchiveSha256, ci,
    platform: "linux/amd64", imageTag, imageId: image.Id, imageIdKind: imageIdKind(image.Id, dockerArchive), imageSizeBytes: image.Size,
    archive: { file: "mono-image.tar", sha256: archive.sha256, sizeBytes: archive.sizeBytes }, dockerArchive,
    linuxBuildId: smoke.linuxBuildId, releaseId: `ci-7dbf2b8-${ci.runId}-${ci.runAttempt}`,
    namespace, lazyRuntimeBase: "/_next/", publicSourceManifestPath: PUBLIC_MANIFEST,
    build: smoke.build, runtime, publicSourceManifestSha256: smoke.publicSourceManifestSha256,
    smoke: { file: "ci-smoke.json", status: "PASS", sha256: sha256(smokeBytes) } };
  validateManifest(manifest, ci);
  checkSmoke(evidence, manifest);
  const manifestBytes = `${JSON.stringify(manifest, null, 2)}\n`;
  const sums = `${archive.sha256}  mono-image.tar\n${sha256(manifestBytes)}  artifact-ready.json\n${sha256(smokeBytes)}  ci-smoke.json\n`;
  await writeFile(path.join(directory, "ci-smoke.json"), smokeBytes);
  await writeFile(path.join(directory, "artifact-ready.json"), manifestBytes, { flag: "wx" });
  await writeFile(path.join(directory, "SHA256SUMS"), sums, { flag: "wx" });
  return manifest;
}

export async function verifyArtifact(directory, expected) {
  check(same((await readdir(directory)).sort(), [...payloadFiles, "SHA256SUMS"].sort()), "invalid artifact filenames");
  const manifest = validateManifest(await readJson(directory, "artifact-ready.json"), expected);
  const sumsFile = await regularFile(directory, "SHA256SUMS", 1024);
  const lines = (await readFile(sumsFile.path, "utf8")).trim().split("\n");
  check(lines.length === 3, "invalid SHA256SUMS entry count");
  const sums = new Map();
  for (const line of lines) {
    const match = /^([a-f0-9]{64})  (mono-image\.tar|artifact-ready\.json|ci-smoke\.json)$/.exec(line);
    check(match && !sums.has(match[2]), "invalid SHA256SUMS filename or duplicate");
    sums.set(match[2], match[1]);
  }
  const archive = await verifyArchive(directory, manifest.archive);
  check(archive.sha256 === sums.get("mono-image.tar"), "archive SHA256SUMS mismatch");
  for (const file of ["artifact-ready.json", "ci-smoke.json"]) check((await hashFile(directory, file)).sha256 === sums.get(file), `${file} checksum mismatch`);
  check(sums.get("ci-smoke.json") === manifest.smoke.sha256, "smoke checksum mismatch");
  checkSmoke(await readJson(directory, "ci-smoke.json"), manifest);
  const actual = await inspectDockerArchive(directory, "mono-image.tar", manifest.imageTag);
  check(same(actual, manifest.dockerArchive), "raw archive identity mismatch");
  return manifest;
}

export function ciIdentity(commit, runId, runAttempt) {
  const ci = { repository, ref, workflowPath, commit, runId, runAttempt,
    runUrl: `https://github.com/${repository}/actions/runs/${runId}`, artifactName: `mono-${commit}-${runId}-${runAttempt}` };
  checkCi(ci, ci);
  return ci;
}
async function main() {
  const [command, directory, ...args] = process.argv.slice(2);
  if (command === "embed") {
    check(process.platform === "linux" && process.arch === "x64", "Linux amd64 build required");
    const next = JSON.parse(await readFile(path.join(directory, "node_modules/next/package.json"), "utf8"));
    await writeEmbeddedManifest(directory, {
      sourceArchiveSha256: process.env.MONO_SOURCE_ARCHIVE_SHA256, imageTag: process.env.MONO_IMAGE_TAG, releaseId: process.env.MONO_RELEASE_ID,
      ci: ciIdentity(process.env.MONO_CI_COMMIT, process.env.MONO_CI_RUN_ID, process.env.MONO_CI_RUN_ATTEMPT),
      build: { command: buildCmd, compiler: "Turbopack", exitCode: 0, buildInvocationCount: 1, actualNextCompileCount: 1,
        nodeVersion: process.version, pnpmVersion: execFileSync("pnpm", ["--version"], { encoding: "utf8" }).trim(), nextVersion: next.version,
        baseImageDigest: BASE_DIGEST, distDir: DIST_DIR, assetPrefix: "", basePath: "" },
    });
  } else if (command === "ready") {
    check(process.env.GITHUB_REPOSITORY === repository && process.env.GITHUB_REF === ref, "invalid CI execution scope");
    const [images, containers] = await Promise.all(args.map(async (file) => JSON.parse(await readFile(file, "utf8"))));
    check(images?.length === 1 && containers?.length === 1, "invalid inspect input scope");
    const manifest = await emitArtifact(directory, { image: images[0], container: containers[0],
      ci: ciIdentity(process.env.GITHUB_SHA, process.env.GITHUB_RUN_ID, process.env.GITHUB_RUN_ATTEMPT), sourceArchiveSha256: process.env.MONO_SOURCE_ARCHIVE_SHA256 });
    process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
  } else if (command === "verify") {
    const manifest = await verifyArtifact(directory, { commit: args[0], runId: args[1], runAttempt: args[2] });
    process.stdout.write(`VERIFIED app=${manifest.source} ci=${manifest.ci.commit} BUILD=${manifest.linuxBuildId} producer=${manifest.imageId} kind=${manifest.imageIdKind} config=${manifest.dockerArchive.config.digest} target=${manifest.dockerArchive.target?.digest ?? "none"}\n`);
  } else throw new Error("Usage: artifact.mjs embed APP_DIR | ready DIR IMAGE_INSPECT CONTAINER_INSPECT | verify DIR CI_COMMIT RUN_ID RUN_ATTEMPT");
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
