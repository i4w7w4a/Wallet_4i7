import assert from "node:assert/strict";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { build, ci, containerFixture, directoryFixture, digest, imageTag, releaseId, smokeFixture, source, sourceArchiveSha256 } from "./fixtures.mjs";

async function implementation() {
  try { return await import("./artifact.mjs"); }
  catch (error) { if (error.code === "ERR_MODULE_NOT_FOUND") assert.fail("MONO artifact helper is not implemented"); throw error; }
}
async function staging(t) {
  const value = await directoryFixture(t);
  await writeFile(path.join(value.directory, "ci-smoke.json"), JSON.stringify(smokeFixture()));
  return { ...value, inputs: { image: value.image, container: containerFixture(value.image), ci, sourceArchiveSha256 } };
}
async function refreshChecksums(directory) {
  const lines = [];
  for (const file of ["mono-image.tar", "artifact-ready.json", "ci-smoke.json"]) lines.push(`${digest(await readFile(path.join(directory, file))).slice(7)}  ${file}\n`);
  await writeFile(path.join(directory, "SHA256SUMS"), lines.join(""));
}
async function changeJson(directory, file, change) {
  const value = JSON.parse(await readFile(path.join(directory, file), "utf8"));
  change(value);
  await writeFile(path.join(directory, file), JSON.stringify(value));
}

// Losing source/recipe separation, checksum/scope guards, raw identities or final-container proof must break these cases.
test("embeds actual BUILD with accepted source and separate CI recipe provenance after the build", async (t) => {
  const value = await directoryFixture(t);
  const { writeEmbeddedManifest } = await implementation();
  await mkdir(path.join(value.directory, ".next-mono-public"));
  await writeFile(path.join(value.directory, ".next-mono-public/BUILD_ID"), "Linux-Build-123\n");
  await writeEmbeddedManifest(value.directory, { build, ci, sourceArchiveSha256, imageTag, releaseId });
  const embedded = JSON.parse(await readFile(path.join(value.directory, "public/source-manifest.json"), "utf8"));
  assert.equal(embedded.gitHead, source);
  assert.equal(embedded.ciCommit, ci.commit);
  assert.deepEqual(embedded.ci, ci);
  assert.equal(embedded.linuxBuildId, "Linux-Build-123");
  assert.equal(embedded.archiveSha256, sourceArchiveSha256);
  assert.equal(embedded.imageId, undefined);
  assert.equal(embedded.imageArchiveSha256, undefined);
});

test("cannot overwrite an existing public source manifest", async (t) => {
  const value = await directoryFixture(t);
  const { writeEmbeddedManifest } = await implementation();
  await mkdir(path.join(value.directory, ".next-mono-public"));
  await mkdir(path.join(value.directory, "public"));
  await writeFile(path.join(value.directory, ".next-mono-public/BUILD_ID"), "Linux-Build-123");
  await writeFile(path.join(value.directory, "public/source-manifest.json"), "retain");
  await assert.rejects(writeEmbeddedManifest(value.directory, { build, ci, sourceArchiveSha256, imageTag, releaseId }), /exist/i);
  assert.equal(await readFile(path.join(value.directory, "public/source-manifest.json"), "utf8"), "retain");
});

test("creates four immutable delivery files binding exact image bytes, raw identities, BUILD and CI run", async (t) => {
  const value = await staging(t);
  const { emitArtifact, verifyArtifact } = await implementation();
  const emitted = await emitArtifact(value.directory, value.inputs);
  const verified = await verifyArtifact(value.directory, ci);
  assert.deepEqual(verified, emitted);
  assert.deepEqual((await readdir(value.directory)).sort(), ["SHA256SUMS", "artifact-ready.json", "ci-smoke.json", "mono-image.tar"]);
  assert.equal(verified.source, source);
  assert.equal(verified.imageId, value.configDigest);
  assert.equal(verified.imageIdKind, "config");
  assert.equal(verified.imageSizeBytes, 5000);
  assert.equal(verified.archive.sha256, digest(value.bytes).slice(7));
  assert.equal(verified.dockerArchive.target.digest, value.manifestDigest);
  assert.equal(verified.dockerArchive.config.rawBase64, value.configBytes.toString("base64"));
  assert.deepEqual(verified.dockerArchive.layers.map((layer) => layer.diffId), value.layerBytes.map(digest));
  assert.equal(verified.linuxBuildId, "Linux-Build-123");
  assert.equal(verified.ci.commit, ci.commit);
  assert.equal(verified.ci.artifactName, `mono-${ci.commit}-1234-1`);
  assert.equal(verified.ci.artifactId, undefined);
  assert.equal(verified.actionsEnvelopeSha256, undefined);
});

test("retains an OCI target producer ID without relabeling it as the config ID", async (t) => {
  const value = await staging(t);
  const { emitArtifact, verifyArtifact } = await implementation();
  value.inputs.image.Id = value.manifestDigest;
  value.inputs.container.Image = value.manifestDigest;
  await emitArtifact(value.directory, value.inputs);
  const verified = await verifyArtifact(value.directory, ci);
  assert.equal(verified.imageId, value.manifestDigest);
  assert.equal(verified.imageIdKind, "oci-target");
  assert.equal(verified.dockerArchive.config.digest, value.configDigest);
});

for (const [name, mutate] of [
  ["app label drift", (v) => { v.image.Config.Labels["org.opencontainers.image.revision"] = "0".repeat(40); }],
  ["CI label drift", (v) => { v.image.Config.Labels["io.novex.ci.commit"] = "0".repeat(40); }],
  ["unknown image ID", (v) => { v.image.Id = `sha256:${"0".repeat(64)}`; v.container.Image = v.image.Id; }],
  ["image architecture drift", (v) => { v.image.Architecture = "arm64"; }],
  ["root user", (v) => { v.image.Config.User = "root"; }],
  ["different start command", (v) => { v.image.Config.Cmd = ["sh"]; }],
  ["baked publication origin", (v) => { v.image.Config.Env.push("MONO_PUBLISH_ORIGIN=https://example.invalid"); }],
  ["baked local flag", (v) => { v.image.Config.Env.push("NOVEX_LOCAL_PREVIEW=1"); }],
  ["Gold asset prefix", (v) => { v.image.Config.Env.push("NOVEX_GOLD_ASSET_PREFIX=/gold"); }],
  ["duplicate environment key", (v) => { v.image.Config.Env.push("NODE_ENV=development"); }],
  ["container start override", (v) => { v.container.Config.Cmd = ["sh"]; }],
  ["host port", (v) => { v.container.HostConfig.PortBindings = { "3000/tcp": [{ HostPort: "3000" }] }; }],
  ["network", (v) => { v.container.HostConfig.NetworkMode = "bridge"; }],
  ["mount", (v) => { v.container.Mounts = [{ Source: "/tmp", Destination: "/data" }]; }],
  ["resource limit drift", (v) => { v.container.HostConfig.Memory = 1073741824; }],
  ["OOM state", (v) => { v.container.State.OOMKilled = true; }],
  ["foreign repository", (v) => { v.ci = { ...ci, repository: "foreign/repository" }; }],
]) {
  test(`rejects ${name} before writing final artifact evidence`, async (t) => {
    const value = await staging(t);
    const { emitArtifact } = await implementation();
    const before = await readFile(path.join(value.directory, "ci-smoke.json"));
    mutate(value.inputs);
    await assert.rejects(emitArtifact(value.directory, value.inputs), /invalid|mismatch/);
    assert.deepEqual((await readdir(value.directory)).sort(), ["ci-smoke.json", "mono-image.tar"]);
    assert.deepEqual(await readFile(path.join(value.directory, "ci-smoke.json")), before);
  });
}

for (const [name, mutate] of [
  ["app source", (v) => { v.source = "0".repeat(40); }],
  ["CI ref", (v) => { v.ci.ref = "refs/heads/main"; }],
  ["workflow", (v) => { v.ci.workflowPath = ".github/workflows/gold-ci-release.yml"; }],
  ["CI attempt", (v) => { v.ci.runAttempt = "2"; }],
  ["archive path", (v) => { v.archive.file = "../mono-image.tar"; }],
  ["BUILD", (v) => { v.linuxBuildId = "other-build"; }],
  ["runtime namespace", (v) => { v.namespace = "/gold/_next/static/"; }],
  ["compiler", (v) => { v.build.compiler = "webpack"; }],
  ["compile count", (v) => { v.build.actualNextCompileCount = 2; }],
  ["raw config identity", (v) => { v.dockerArchive.config.digest = `sha256:${"0".repeat(64)}`; }],
  ["layer order", (v) => { v.dockerArchive.layers.reverse(); }],
]) {
  test(`rejects rechecksummed ${name} mismatch without rewriting downloaded evidence`, async (t) => {
    const value = await staging(t);
    const { emitArtifact, verifyArtifact } = await implementation();
    await emitArtifact(value.directory, value.inputs);
    await changeJson(value.directory, "artifact-ready.json", mutate);
    await refreshChecksums(value.directory);
    const before = await readFile(path.join(value.directory, "artifact-ready.json"));
    await assert.rejects(verifyArtifact(value.directory, ci), /invalid|mismatch/);
    assert.deepEqual(await readFile(path.join(value.directory, "artifact-ready.json")), before);
  });
}

test("rejects same-size image corruption before trusting an imported image", async (t) => {
  const value = await staging(t);
  const { emitArtifact, verifyArtifact } = await implementation();
  await emitArtifact(value.directory, value.inputs);
  value.bytes[512] ^= 1;
  await writeFile(path.join(value.directory, "mono-image.tar"), value.bytes);
  await assert.rejects(verifyArtifact(value.directory, ci), /checksum/);
});

test("rejects missing final-container evidence even when JSON checksums were recomputed", async (t) => {
  const value = await staging(t);
  const { emitArtifact, verifyArtifact } = await implementation();
  await emitArtifact(value.directory, value.inputs);
  await changeJson(value.directory, "ci-smoke.json", (v) => { delete v.container; });
  const hash = digest(await readFile(path.join(value.directory, "ci-smoke.json"))).slice(7);
  await changeJson(value.directory, "artifact-ready.json", (v) => { v.smoke.sha256 = hash; });
  await refreshChecksums(value.directory);
  await assert.rejects(verifyArtifact(value.directory, ci), /container/);
});

test("rejects extra delivery files without deleting them", async (t) => {
  const value = await staging(t);
  const { emitArtifact, verifyArtifact } = await implementation();
  await emitArtifact(value.directory, value.inputs);
  await writeFile(path.join(value.directory, "unexpected.txt"), "retain");
  await assert.rejects(verifyArtifact(value.directory, ci), /filenames/);
  assert.equal(await readFile(path.join(value.directory, "unexpected.txt"), "utf8"), "retain");
});

test("requires the caller's expected immutable CI identity and refuses re-emission", async (t) => {
  const value = await staging(t);
  const { emitArtifact, verifyArtifact } = await implementation();
  await emitArtifact(value.directory, value.inputs);
  await assert.rejects(verifyArtifact(value.directory, { ...ci, commit: "0".repeat(40) }), /CI/);
  await assert.rejects(verifyArtifact(value.directory, {}), /CI/);
  const before = await readFile(path.join(value.directory, "ci-smoke.json"));
  await assert.rejects(emitArtifact(value.directory, value.inputs), /filenames|emitted/);
  assert.deepEqual(await readFile(path.join(value.directory, "ci-smoke.json")), before);
});
