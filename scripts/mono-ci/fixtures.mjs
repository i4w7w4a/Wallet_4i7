import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { gzipSync } from "node:zlib";

export const digest = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
export const source = "7dbf2b80086abe7ccb25b9df9d989d36e04230a1";
export const ci = {
  repository: "i4w7w4a/Wallet_4i7", ref: "refs/heads/codex/compact-workbench-20261020",
  workflowPath: ".github/workflows/mono-ci-release.yml", commit: "b".repeat(40), runId: "1234", runAttempt: "1",
  runUrl: "https://github.com/i4w7w4a/Wallet_4i7/actions/runs/1234", artifactName: `mono-${"b".repeat(40)}-1234-1`,
};
export const imageTag = "novex-mono:ci-7dbf2b8-1234-1";
export const releaseId = "ci-7dbf2b8-1234-1";
export const sourceArchiveSha256 = "a".repeat(64);
export const build = {
  command: ["node", "./node_modules/next/dist/bin/next", "build"], compiler: "Turbopack", exitCode: 0,
  buildInvocationCount: 1, actualNextCompileCount: 1, nodeVersion: "v24.22.0", pnpmVersion: "10.33.2", nextVersion: "16.3.5",
  baseImageDigest: "sha256:ec857ea6bb60cb3d0fa4d97495590c5fe7d51be8572c307b55957eeb06569cf7",
  distDir: ".next-mono-public", assetPrefix: "", basePath: "",
};

export function containerFixture(image) {
  return {
    Id: "d".repeat(64), Image: image.Id, Config: structuredClone(image.Config),
    State: { Running: true, ExitCode: 0, OOMKilled: false, Error: "", StartedAt: "2026-10-20T12:00:00Z" },
    HostConfig: { NanoCpus: 1000000000, Memory: 536870912, MemorySwap: 536870912,
      PortBindings: {}, NetworkMode: "none", CapDrop: ["ALL"], SecurityOpt: ["no-new-privileges:true"] }, Mounts: [],
  };
}

export function smokeFixture() {
  return {
    schemaVersion: 1, status: "PASS", source, sourceArchiveSha256, imageTag, releaseId, ciCommit: ci.commit,
    linuxBuildId: "Linux-Build-123", publicSourceManifestSha256: "e".repeat(64), build,
    http: {
      monoStatus: 200, root: { status: 307, location: "/mono" }, portableStatus: 200,
      published: { configStatus: 503, slotStatus: 503, pageStatus: 500, error: "Публикация не настроена." }, manifestStatus: 200,
      assets: [
        { path: "/_next/static/chunks/app.js", status: 200, contentType: "text/javascript", sizeBytes: 123, sha256: "f".repeat(64) },
        { path: "/_next/static/chunks/app.css", status: 200, contentType: "text/css", sizeBytes: 45, sha256: "f".repeat(64) },
      ],
      rsc: { status: 200, contentType: "text/x-component", chunks: ["/_next/static/chunks/lazy.js"] }, lazyRuntimeBase: "/_next/",
    },
  };
}

export function tar(entries) {
  const blocks = [];
  for (const [name, data, type = "0"] of entries) {
    const bytes = Buffer.from(data);
    const header = Buffer.alloc(512);
    header.write(name, 0, 100);
    for (const [offset, length, number] of [[100, 8, 420], [108, 8, 0], [116, 8, 0], [124, 12, bytes.length], [136, 12, 0]]) {
      header.write(number.toString(8).padStart(length - 1, "0") + "\0", offset, length);
    }
    header.fill(32, 148, 156);
    header.write(type, 156, 1);
    header.write("ustar\0", 257, 6);
    const sum = header.reduce((total, byte) => total + byte, 0);
    header.write(sum.toString(8).padStart(6, "0") + "\0 ", 148, 8);
    blocks.push(header, bytes, Buffer.alloc((512 - bytes.length % 512) % 512));
  }
  return Buffer.concat([...blocks, Buffer.alloc(1024)]);
}

export function imageFixture({ legacy = false, compression, alterConfig, alterManifest, extraEntries = [] } = {}) {
  const layerBytes = [Buffer.from("first uncompressed layer\n"), Buffer.from("second uncompressed layer\n")];
  const storedLayers = compression === "gzip" ? layerBytes.map((bytes) => gzipSync(bytes)) : layerBytes;
  const environment = ["PATH=/usr/local/bin:/usr/bin:/bin", "NODE_VERSION=24.22.0", "YARN_VERSION=1.22.22",
    "NODE_ENV=production", "NEXT_TELEMETRY_DISABLED=1", "NOVEX_NEXT_DIST_DIR=.next-mono-public"];
  const config = {
    architecture: "amd64", os: "linux",
    config: {
      User: "node", WorkingDir: "/workspace/apps/miniapp", Entrypoint: ["docker-entrypoint.sh"],
      Cmd: ["node", "./node_modules/next/dist/bin/next", "start", "-p", "3000", "-H", "0.0.0.0"],
      Env: environment, Volumes: null,
      Labels: { "org.opencontainers.image.revision": source, "io.novex.ci.commit": ci.commit },
    },
    rootfs: { type: "layers", diff_ids: layerBytes.map(digest) }, history: [{ created_by: "fixture" }],
  };
  alterConfig?.(config);
  const configBytes = Buffer.from(JSON.stringify(config));
  const configDigest = digest(configBytes);
  const configFile = legacy ? `${configDigest.slice(7)}.json` : `blobs/sha256/${configDigest.slice(7)}`;
  const layerFiles = storedLayers.map((bytes, index) => legacy ? `layer${index}/layer.tar` : `blobs/sha256/${digest(bytes).slice(7)}`);
  const manifest = {
    schemaVersion: 2, mediaType: "application/vnd.oci.image.manifest.v1+json",
    config: { mediaType: "application/vnd.oci.image.config.v1+json", digest: configDigest, size: configBytes.length },
    layers: storedLayers.map((bytes) => ({ mediaType: `application/vnd.oci.image.layer.v1.tar${compression === "gzip" ? "+gzip" : ""}`, digest: digest(bytes), size: bytes.length })),
  };
  alterManifest?.(manifest);
  const manifestBytes = Buffer.from(JSON.stringify(manifest));
  const manifestDigest = digest(manifestBytes);
  const indexBytes = Buffer.from(JSON.stringify({ schemaVersion: 2, manifests: [{ mediaType: manifest.mediaType,
    digest: manifestDigest, size: manifestBytes.length, platform: { os: "linux", architecture: "amd64" } }] }));
  const dockerManifest = Buffer.from(JSON.stringify([{ Config: configFile, RepoTags: [imageTag], Layers: layerFiles }]));
  const entries = [["manifest.json", dockerManifest], [configFile, configBytes], ...layerFiles.map((file, i) => [file, storedLayers[i]])];
  if (!legacy) entries.push(["oci-layout", '{"imageLayoutVersion":"1.0.0"}'], ["index.json", indexBytes], [`blobs/sha256/${manifestDigest.slice(7)}`, manifestBytes]);
  entries.push(...extraEntries);
  return { bytes: tar(entries), entries, config, configBytes, configDigest, manifestBytes, manifestDigest, dockerManifest,
    indexBytes, layerBytes, storedLayers, layerFiles, configFile,
    image: { Id: configDigest, Size: 5000, Os: "linux", Architecture: "amd64", RepoTags: [imageTag], Config: config.config,
      RootFS: { Type: "layers", Layers: [...config.rootfs.diff_ids] } },
  };
}

export async function directoryFixture(t, options) {
  const directory = await mkdtemp(path.join(tmpdir(), "novex-mono-ci-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const value = imageFixture(options);
  await writeFile(path.join(directory, "mono-image.tar"), value.bytes);
  return { directory, ...value };
}
