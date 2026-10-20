import assert from "node:assert/strict";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { directoryFixture, digest, imageTag, tar } from "./fixtures.mjs";

async function implementation() {
  try { return await import("./archive.mjs"); }
  catch (error) { if (error.code === "ERR_MODULE_NOT_FOUND") assert.fail("MONO archive verifier is not implemented"); throw error; }
}

// A changed config, descriptor size/hash, layer order, tar header or unsafe member must fail verification.
test("reads raw OCI config, target manifest and ordered layer identities without extracting the image", async (t) => {
  const value = await directoryFixture(t);
  const { inspectDockerArchive } = await implementation();
  const result = await inspectDockerArchive(value.directory, "mono-image.tar", imageTag);
  assert.equal(result.format, "docker-save+oci");
  assert.equal(result.config.digest, value.configDigest);
  assert.equal(result.config.rawBase64, value.configBytes.toString("base64"));
  assert.equal(result.manifest.digest, value.manifestDigest);
  assert.equal(result.target.digest, value.manifestDigest);
  assert.equal(result.manifest.rawBase64, value.manifestBytes.toString("base64"));
  assert.deepEqual(result.layers.map(({ digest: hash, diffId, sizeBytes }) => ({ digest: hash, diffId, sizeBytes })),
    value.layerBytes.map((bytes) => ({ digest: digest(bytes), diffId: digest(bytes), sizeBytes: bytes.length })));
  assert.deepEqual(await readdir(value.directory), ["mono-image.tar"]);
});

test("supports a Docker legacy save without inventing an OCI target manifest", async (t) => {
  const value = await directoryFixture(t, { legacy: true });
  const { inspectDockerArchive } = await implementation();
  const result = await inspectDockerArchive(value.directory, "mono-image.tar", imageTag);
  assert.equal(result.format, "docker-save");
  assert.equal(result.config.digest, value.configDigest);
  assert.equal(result.target, null);
  assert.equal(result.manifest, null);
  assert.equal(result.dockerManifest.rawBase64, value.dockerManifest.toString("base64"));
});

test("keeps compressed OCI layer digests distinct from checked uncompressed diff IDs", async (t) => {
  const value = await directoryFixture(t, { compression: "gzip" });
  const { inspectDockerArchive } = await implementation();
  const result = await inspectDockerArchive(value.directory, "mono-image.tar", imageTag);
  assert.equal(result.layers[0].digest, digest(value.storedLayers[0]));
  assert.equal(result.layers[0].sizeBytes, value.storedLayers[0].length);
  assert.equal(result.layers[0].diffId, digest(value.layerBytes[0]));
  assert.notEqual(result.layers[0].digest, result.layers[0].diffId);
});

test("preserves Moby's extra content-addressed legacy config blobs without treating them as the image config", async (t) => {
  const bytes = Buffer.from(JSON.stringify({ id: "9".repeat(64), os: "linux", created: "2026-10-20T12:00:00Z" }));
  const file = `blobs/sha256/${digest(bytes).slice(7)}`;
  const value = await directoryFixture(t, { extraEntries: [[file, bytes]] });
  const { inspectDockerArchive } = await implementation();
  const result = await inspectDockerArchive(value.directory, "mono-image.tar", imageTag);
  assert.equal(result.config.digest, value.configDigest);
  assert.deepEqual(result.legacyConfigs, [{ file, digest: digest(bytes), sizeBytes: bytes.length, rawBase64: bytes.toString("base64") }]);
});

for (const [name, options, error] of [
  ["wrong OCI config checksum", { alterManifest: (m) => { m.config.digest = `sha256:${"0".repeat(64)}`; } }, /config|descriptor/],
  ["wrong OCI layer byte count", { alterManifest: (m) => { m.layers[0].size++; } }, /layer|descriptor/],
  ["reordered OCI layers", { alterManifest: (m) => { m.layers.reverse(); } }, /layer/],
  ["wrong uncompressed diff ID", { alterConfig: (c) => { c.rootfs.diff_ids[0] = `sha256:${"0".repeat(64)}`; } }, /diff|layer/],
  ["non-Linux config", { alterConfig: (c) => { c.os = "windows"; } }, /platform/],
  ["extra archive file", { extraEntries: [["unexpected.txt", "keep"]] }, /unexpected|unreferenced/],
  ["duplicate tar member", { extraEntries: [["manifest.json", "[]"]] }, /duplicate/],
  ["tar path escape", { extraEntries: [["../escape", "bad"]] }, /path/],
  ["tar symlink", { extraEntries: [["linked", "", "2"]] }, /type/],
]) {
  test(`rejects ${name} without changing the payload`, async (t) => {
    const value = await directoryFixture(t, options);
    const { inspectDockerArchive } = await implementation();
    await assert.rejects(inspectDockerArchive(value.directory, "mono-image.tar", imageTag), error);
    assert.deepEqual(await readFile(path.join(value.directory, "mono-image.tar")), value.bytes);
    assert.deepEqual(await readdir(value.directory), ["mono-image.tar"]);
  });
}

test("rejects a tar header checksum change even when its payload remains readable", async (t) => {
  const value = await directoryFixture(t);
  const { inspectDockerArchive } = await implementation();
  value.bytes[100] ^= 1;
  await writeFile(path.join(value.directory, "mono-image.tar"), value.bytes);
  await assert.rejects(inspectDockerArchive(value.directory, "mono-image.tar", imageTag), /header checksum/);
});

test("rejects a truncated tar instead of accepting partial evidence", async (t) => {
  const value = await directoryFixture(t);
  const { inspectDockerArchive } = await implementation();
  await writeFile(path.join(value.directory, "mono-image.tar"), tar([["manifest.json", "[]"]]).subarray(0, 700));
  await assert.rejects(inspectDockerArchive(value.directory, "mono-image.tar", imageTag), /truncated|terminator/);
});

test("rejects a save for a different image tag", async (t) => {
  const value = await directoryFixture(t);
  const { inspectDockerArchive } = await implementation();
  await assert.rejects(inspectDockerArchive(value.directory, "mono-image.tar", "novex-mono:other"), /tag/);
});
