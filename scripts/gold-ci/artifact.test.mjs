import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { mkdir } from "node:fs/promises";
import { emitArtifact, verifyArchive, verifyArtifact, writeEmbeddedManifest } from "./artifact.mjs";

// Removing checksum, byte-count, or filename validation must break these tests.
async function fixture(t) {
  const directory = await mkdtemp(path.join(tmpdir(), "novex-gold-artifact-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const bytes = Buffer.from("gold image test fixture\n");
  const file = "gold-image.tar";
  await writeFile(path.join(directory, file), bytes);
  return {
    directory,
    archive: {
      file,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      sizeBytes: bytes.length,
    },
  };
}

test("accepts only the exact file bytes named by the archive descriptor", async (t) => {
  const { directory, archive } = await fixture(t);
  assert.deepEqual(await verifyArchive(directory, archive), {
    path: path.join(directory, "gold-image.tar"),
    sha256: archive.sha256,
    sizeBytes: archive.sizeBytes,
  });
});

test("rejects a changed archive before any artifact-directory writes", async (t) => {
  const { directory, archive } = await fixture(t);
  await writeFile(path.join(directory, archive.file), "changed bytes");
  const before = await readdir(directory);
  await assert.rejects(verifyArchive(directory, archive), /archive (size|checksum) mismatch/);
  assert.deepEqual(await readdir(directory), before);
  assert.equal(await readFile(path.join(directory, archive.file), "utf8"), "changed bytes");
});

for (const file of ["../escape.tar", "sub/image.tar", "sub\\image.tar", "/tmp/image.tar", "C:\\image.tar", "image.tar\0other"]) {
  test(`rejects escaping or non-flat archive path ${JSON.stringify(file)}`, async (t) => {
    const { directory, archive } = await fixture(t);
    await assert.rejects(verifyArchive(directory, { ...archive, file }), /invalid archive filename/);
    assert.deepEqual(await readdir(directory), ["gold-image.tar"]);
  });
}

for (const change of [{ sha256: "bad" }, { sizeBytes: -1 }, { sizeBytes: 0 }, { sizeBytes: 1.5 }]) {
  test(`rejects malformed archive metadata ${JSON.stringify(change)}`, async (t) => {
    const { directory, archive } = await fixture(t);
    await assert.rejects(verifyArchive(directory, { ...archive, ...change }), /invalid archive (sha256|size)/);
    assert.deepEqual(await readdir(directory), ["gold-image.tar"]);
  });
}

test("rejects a checksum mismatch even when archive length still matches", async (t) => {
  const { directory, archive } = await fixture(t);
  await assert.rejects(verifyArchive(directory, { ...archive, sha256: "0".repeat(64) }), /archive checksum mismatch/);
});

const appSource = "7d097c9cc6e1286297315c78520f341a364b35f0";
const ci = {
  repository: "i4w7w4a/Wallet_4i7",
  ref: "refs/heads/codex/gold-ci-release-20261018",
  commit: "b".repeat(40),
  workflowPath: ".github/workflows/gold-ci-release.yml",
  runId: "1234",
  runAttempt: "1",
  runUrl: "https://github.com/i4w7w4a/Wallet_4i7/actions/runs/1234",
  artifactName: `gold-${"b".repeat(40)}-1234-1`,
};
const build = {
  command: ["node", "./node_modules/next/dist/bin/next", "build"],
  compiler: "Turbopack", exitCode: 0, buildInvocationCount: 1, actualNextCompileCount: 1,
  nodeVersion: "v24.21.0", pnpmVersion: "10.33.2", nextVersion: "16.3.5",
  baseImageDigest: "sha256:ec857ea6bb60cb3d0fa4d97495590c5fe7d51be8572c307b55957eeb06569cf7",
  distDir: ".next-gold-public", assetPrefix: "/gold", basePath: "",
};
const imageTag = "novex-gold:ci-7d097c9-1234-1";
const releaseId = "ci-7d097c9-1234-1";
const sourceArchiveSha256 = "a".repeat(64);
const runtimeEnvironment = {
  NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1",
  NOVEX_GOLD_ASSET_PREFIX: "/gold", NOVEX_NEXT_DIST_DIR: ".next-gold-public",
};

function inspectedImage() {
  return {
    Id: `sha256:${"c".repeat(64)}`, Size: 5000, Os: "linux", Architecture: "amd64", RepoTags: [imageTag],
    Config: {
      User: "node", WorkingDir: "/workspace/apps/miniapp", Entrypoint: ["docker-entrypoint.sh"],
      Cmd: ["node", "./node_modules/next/dist/bin/next", "start", "-p", "3000", "-H", "0.0.0.0"],
      Env: Object.entries(runtimeEnvironment).map(([key, value]) => `${key}=${value}`), Volumes: null,
      Labels: { "org.opencontainers.image.revision": appSource, "io.novex.ci.commit": ci.commit },
    },
  };
}

function inspectedContainer() {
  return {
    Id: "d".repeat(64), Image: `sha256:${"c".repeat(64)}`,
    State: { Running: true, ExitCode: 0, OOMKilled: false, Error: "", StartedAt: "2026-10-18T12:00:00Z" },
    HostConfig: {
      NanoCpus: 1000000000, Memory: 536870912, MemorySwap: 536870912,
      PortBindings: {}, NetworkMode: "none", CapDrop: ["ALL"], SecurityOpt: ["no-new-privileges"],
    },
    Mounts: [],
  };
}

async function readyFixture(t) {
  const value = await fixture(t);
  const smoke = {
    schemaVersion: 1, status: "PASS", source: appSource, sourceArchiveSha256, imageTag, releaseId,
    linuxBuildId: "Linux-Build-123", publicSourceManifestSha256: "e".repeat(64), build,
    http: {
      goldStatus: 200, manifestStatus: 200,
      assets: [
        { path: "/gold/_next/static/chunks/app.js", status: 200, sizeBytes: 123, sha256: "f".repeat(64) },
        { path: "/gold/_next/static/chunks/app.css", status: 200, sizeBytes: 45, sha256: "f".repeat(64) },
      ],
      rsc: { status: 200, contentType: "text/x-component", chunks: ["/gold/_next/static/chunks/lazy.js"] },
      lazyRuntimeBase: "/gold/_next/",
    },
  };
  await writeFile(path.join(value.directory, "ci-smoke.json"), JSON.stringify(smoke));
  return { ...value, inputs: { image: inspectedImage(), container: inspectedContainer(), ci, sourceArchiveSha256 } };
}

test("embeds the actual Linux BUILD_ID while keeping app and recipe identities separate", async (t) => {
  const { directory } = await fixture(t);
  await mkdir(path.join(directory, ".next-gold-public"));
  await writeFile(path.join(directory, ".next-gold-public/BUILD_ID"), "Linux-Build-123\n");
  const result = await writeEmbeddedManifest(directory, { sourceArchiveSha256, imageTag, releaseId, ciCommit: ci.commit, build });
  assert.equal(result?.gitHead, appSource);
  const embedded = JSON.parse(await readFile(path.join(directory, "public/gold/source-manifest.json"), "utf8"));
  assert.equal(embedded.gitHead, appSource);
  assert.equal(embedded.ciCommit, ci.commit);
  assert.equal(embedded.linuxBuildId, "Linux-Build-123");
  assert.equal(embedded.archiveSha256, sourceArchiveSha256);
  assert.equal(embedded.imageId, undefined);
  assert.equal(embedded.imageArchiveSha256, undefined);
});

test("rejects invalid embedded provenance before creating public files", async (t) => {
  const { directory } = await fixture(t);
  await assert.rejects(writeEmbeddedManifest(directory, { sourceArchiveSha256: "bad", imageTag, releaseId, ciCommit: ci.commit, build }), /source archive/);
  assert.deepEqual(await readdir(directory), ["gold-image.tar"]);
});

test("produces four load-ready files whose verified provenance matches the expected CI run", async (t) => {
  const { directory, inputs } = await readyFixture(t);
  await emitArtifact(directory, inputs);
  assert.deepEqual((await readdir(directory)).sort(), ["SHA256SUMS", "artifact-ready.json", "ci-smoke.json", "gold-image.tar"]);
  const manifest = await verifyArtifact(directory, ci);
  assert.equal(manifest.source, appSource);
  assert.equal(manifest.ci.commit, ci.commit);
  assert.equal(manifest.imageId, `sha256:${"c".repeat(64)}`);
  assert.equal(manifest.archive.file, "gold-image.tar");
  assert.equal(manifest.linuxBuildId, "Linux-Build-123");
  const sums = await readFile(path.join(directory, "SHA256SUMS"), "utf8");
  assert.equal(sums.trim().split("\n").length, 3);
});

async function downloadFixture(t) {
  const value = await readyFixture(t);
  const smoke = JSON.parse(await readFile(path.join(value.directory, "ci-smoke.json"), "utf8"));
  smoke.container = inspectedContainer();
  await writeFile(path.join(value.directory, "ci-smoke.json"), JSON.stringify(smoke));
  const smokeBytes = await readFile(path.join(value.directory, "ci-smoke.json"));
  const manifest = {
    schemaVersion: 1, status: "ARTIFACT_READY", source: appSource, sourceArchiveSha256, ci,
    platform: "linux/amd64", imageTag, imageId: `sha256:${"c".repeat(64)}`, imageSizeBytes: 5000,
    archive: value.archive, linuxBuildId: "Linux-Build-123", releaseId,
    namespace: "/gold/_next/static/", lazyRuntimeBase: "/gold/_next/", build,
    runtime: {
      user: "node", workingDir: "/workspace/apps/miniapp", entrypoint: ["docker-entrypoint.sh"],
      cmd: ["node", "./node_modules/next/dist/bin/next", "start", "-p", "3000", "-H", "0.0.0.0"],
      environment: runtimeEnvironment, declaredVolumes: [],
    },
    publicSourceManifestSha256: "e".repeat(64),
    smoke: { file: "ci-smoke.json", status: "PASS", sha256: createHash("sha256").update(smokeBytes).digest("hex") },
  };
  await writeFile(path.join(value.directory, "artifact-ready.json"), JSON.stringify(manifest));
  await refreshChecksums(value.directory);
  return value;
}

async function refreshChecksums(directory) {
  const sums = [];
  for (const name of ["gold-image.tar", "artifact-ready.json", "ci-smoke.json"]) {
    sums.push(`${createHash("sha256").update(await readFile(path.join(directory, name))).digest("hex")}  ${name}\n`);
  }
  await writeFile(path.join(directory, "SHA256SUMS"), sums.join(""));
}

test("verifies an independently constructed valid download", async (t) => {
  const { directory } = await downloadFixture(t);
  const manifest = await verifyArtifact(directory, ci);
  assert.equal(manifest?.source, appSource);
});

for (const [name, mutate] of [
  ["wrong image label", (v) => { v.image.Config.Labels["org.opencontainers.image.revision"] = "0".repeat(40); }],
  ["wrong CI label", (v) => { v.image.Config.Labels["io.novex.ci.commit"] = "0".repeat(40); }],
  ["wrong architecture", (v) => { v.image.Architecture = "arm64"; }],
  ["root runtime user", (v) => { v.image.Config.User = "root"; }],
  ["generic Next dist", (v) => { v.image.Config.Env = v.image.Config.Env.map((s) => s.replace(".next-gold-public", ".next")); }],
  ["host port", (v) => { v.container.HostConfig.PortBindings = { "3000/tcp": [{ HostPort: "3000" }] }; }],
  ["mount", (v) => { v.container.Mounts = [{ Source: "/tmp", Destination: "/data" }]; }],
  ["memory limit drift", (v) => { v.container.HostConfig.Memory = 1073741824; }],
  ["OOM", (v) => { v.container.State.OOMKilled = true; }],
]) {
  test(`rejects ${name} before writing ready manifests or checksums`, async (t) => {
    const { directory, inputs } = await readyFixture(t);
    mutate(inputs);
    const before = await readFile(path.join(directory, "ci-smoke.json"), "utf8");
    await assert.rejects(emitArtifact(directory, inputs), /image|runtime|container/);
    assert.deepEqual((await readdir(directory)).sort(), ["ci-smoke.json", "gold-image.tar"]);
    assert.equal(await readFile(path.join(directory, "ci-smoke.json"), "utf8"), before);
  });
}

for (const [name, mutate] of [
  ["malformed schema", (m) => { m.schemaVersion = 99; }],
  ["app source mismatch", (m) => { m.source = "0".repeat(40); }],
  ["CI commit mismatch", (m) => { m.ci.commit = "0".repeat(40); }],
  ["CI attempt mismatch", (m) => { m.ci.runAttempt = "2"; }],
  ["archive path escape", (m) => { m.archive.file = "../gold-image.tar"; }],
  ["Linux BUILD mismatch", (m) => { m.linuxBuildId = "other-build"; }],
  ["wrong namespace", (m) => { m.namespace = "/_next/static/"; }],
  ["Windows build", (m) => { m.platform = "windows/amd64"; }],
]) {
  test(`rejects ${name} without changing downloaded artifact files`, async (t) => {
    const { directory } = await downloadFixture(t);
    const file = path.join(directory, "artifact-ready.json");
    const manifest = JSON.parse(await readFile(file, "utf8"));
    mutate(manifest);
    const bytes = JSON.stringify(manifest);
    await writeFile(file, bytes);
    await refreshChecksums(directory);
    await assert.rejects(verifyArtifact(directory, ci), /invalid|mismatch/);
    assert.equal(await readFile(file, "utf8"), bytes);
    assert.equal((await readdir(directory)).length, 4);
  });
}

test("rejects malformed JSON before any artifact processing", async (t) => {
  const { directory } = await downloadFixture(t);
  await writeFile(path.join(directory, "artifact-ready.json"), "{");
  await assert.rejects(verifyArtifact(directory, ci), /JSON/);
  assert.equal(await readFile(path.join(directory, "artifact-ready.json"), "utf8"), "{");
});

test("rejects missing actual container evidence even if all payload checksums are valid", async (t) => {
  const { directory } = await downloadFixture(t);
  const smoke = JSON.parse(await readFile(path.join(directory, "ci-smoke.json"), "utf8"));
  delete smoke.container;
  const smokeBytes = JSON.stringify(smoke);
  await writeFile(path.join(directory, "ci-smoke.json"), smokeBytes);
  const manifest = JSON.parse(await readFile(path.join(directory, "artifact-ready.json"), "utf8"));
  manifest.smoke.sha256 = createHash("sha256").update(smokeBytes).digest("hex");
  await writeFile(path.join(directory, "artifact-ready.json"), JSON.stringify(manifest));
  await refreshChecksums(directory);
  await assert.rejects(verifyArtifact(directory, ci), /container/);
});

test("rejects checksum filename traversal before processing a downloaded archive", async (t) => {
  const { directory } = await downloadFixture(t);
  const sumsFile = path.join(directory, "SHA256SUMS");
  const malformed = (await readFile(sumsFile, "utf8")).replace("  gold-image.tar", "  ../gold-image.tar");
  await writeFile(sumsFile, malformed);
  await assert.rejects(verifyArtifact(directory, ci), /invalid SHA256SUMS/);
  assert.equal(await readFile(sumsFile, "utf8"), malformed);
});

test("rejects unexpected payload files without deleting them", async (t) => {
  const { directory } = await downloadFixture(t);
  await writeFile(path.join(directory, "unexpected.txt"), "keep");
  await assert.rejects(verifyArtifact(directory, ci), /invalid artifact filenames/);
  assert.equal(await readFile(path.join(directory, "unexpected.txt"), "utf8"), "keep");
});

test("cannot overwrite evidence from an already emitted immutable delivery", async (t) => {
  const { directory, inputs } = await readyFixture(t);
  await emitArtifact(directory, inputs);
  const before = await readFile(path.join(directory, "ci-smoke.json"), "utf8");
  inputs.container.State.StartedAt = "2026-10-18T13:00:00Z";
  await assert.rejects(emitArtifact(directory, inputs));
  assert.equal(await readFile(path.join(directory, "ci-smoke.json"), "utf8"), before);
});
