import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, open } from "node:fs/promises";
import path from "node:path";
import { createGunzip } from "node:zlib";

const hash = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function check(value, message) { if (!value) throw new Error(message); }
function safeMember(name) {
  check(typeof name === "string" && name.length > 0 && !name.includes("\\") && !name.startsWith("/")
    && !name.includes(":") && !name.split("/").some((part) => part === ".."), "invalid tar member path");
  return name.replace(/^\.\//, "").replace(/\/$/, "");
}
function octal(bytes) {
  const text = bytes.toString("ascii").replace(/\0.*$/, "").trim();
  check(/^[0-7]+$/.test(text), "invalid tar numeric field");
  const value = parseInt(text, 8);
  check(Number.isSafeInteger(value) && value >= 0, "invalid tar numeric size");
  return value;
}

async function scan(target) {
  const stat = await lstat(target);
  check(stat.isFile() && !stat.isSymbolicLink(), "invalid archive file type");
  const handle = await open(target, "r");
  const files = new Map();
  let position = 0;
  async function read(size) {
    check(size <= 1024 * 1024 && position + size <= stat.size, "truncated tar archive");
    const bytes = Buffer.alloc(size);
    let at = 0;
    while (at < size) {
      const result = await handle.read(bytes, at, size - at, position + at);
      check(result.bytesRead > 0, "truncated tar archive");
      at += result.bytesRead;
    }
    position += size;
    return bytes;
  }
  try {
    let ended = false;
    while (position < stat.size) {
      const header = await read(512);
      if (header.every((byte) => byte === 0)) {
        check((await read(512)).every((byte) => byte === 0), "invalid tar terminator");
        while (position < stat.size) check((await read(Math.min(1024 * 1024, stat.size - position))).every((b) => b === 0), "invalid trailing tar bytes");
        ended = true;
        break;
      }
      const expected = octal(header.subarray(148, 156));
      const checksum = header.reduce((sum, byte, i) => sum + (i >= 148 && i < 156 ? 32 : byte), 0);
      check(expected === checksum, "invalid tar header checksum");
      const field = (start, length) => header.subarray(start, start + length).toString("utf8").replace(/\0.*$/, "");
      const prefix = field(345, 155);
      const name = safeMember(`${prefix ? prefix + "/" : ""}${field(0, 100)}`);
      const type = field(156, 1);
      check(["", "0", "5"].includes(type), "unsupported tar member type");
      const sizeBytes = octal(header.subarray(124, 136));
      check(type !== "5" || sizeBytes === 0, "invalid tar directory type");
      const offset = position;
      const digest = createHash("sha256");
      let remaining = sizeBytes;
      while (remaining) { const bytes = await read(Math.min(1024 * 1024, remaining)); digest.update(bytes); remaining -= bytes.length; }
      const padding = (512 - sizeBytes % 512) % 512;
      if (padding) await read(padding);
      if (type !== "5") {
        check(!files.has(name), "duplicate tar member");
        check(files.size < 100000, "tar member count exceeds bound");
        files.set(name, { file: name, offset, sizeBytes, digest: `sha256:${digest.digest("hex")}` });
      }
    }
    check(ended, "missing tar terminator");
    return files;
  } finally { await handle.close(); }
}

// Read only bounded JSON metadata by its checked tar offset. Layer bytes stay on disk.
async function metadata(target, entry) {
  check(entry && entry.sizeBytes > 0 && entry.sizeBytes <= 2 * 1024 * 1024, "invalid or missing archive descriptor metadata");
  const chunks = [];
  for await (const bytes of createReadStream(target, { start: entry.offset, end: entry.offset + entry.sizeBytes - 1 })) chunks.push(bytes);
  const bytes = Buffer.concat(chunks);
  check(bytes.length === entry.sizeBytes && hash(bytes) === entry.digest, "archive metadata changed during read");
  return { ...entry, rawBase64: bytes.toString("base64"), json: JSON.parse(bytes.toString("utf8")) };
}
const raw = ({ file, digest, sizeBytes, rawBase64 }) => ({ file, digest, sizeBytes, rawBase64 });

export async function inspectDockerArchive(directory, file, imageTag) {
  check(file === "mono-image.tar", "invalid archive filename");
  const target = path.resolve(directory, file);
  const files = await scan(target);
  const used = new Set();
  function member(name) { const clean = safeMember(name); used.add(clean); return files.get(clean); }
  const docker = await metadata(target, member("manifest.json"));
  check(Array.isArray(docker.json) && docker.json.length === 1, "invalid Docker save manifest scope");
  const saved = docker.json[0];
  check(same(saved.RepoTags, [imageTag]), "Docker archive image tag mismatch");
  check(Array.isArray(saved.Layers) && saved.Layers.length > 0 && saved.Layers.length <= 256, "invalid Docker layer list");
  const config = await metadata(target, member(saved.Config));
  check(config.json.os === "linux" && config.json.architecture === "amd64", "invalid archive config platform");
  const diffIds = config.json.rootfs?.diff_ids;
  check(config.json.rootfs?.type === "layers" && Array.isArray(diffIds) && diffIds.length === saved.Layers.length, "invalid config layer diff IDs");
  let index = null, manifest = null, descriptorTarget = null;
  if (files.has("index.json")) {
    const layout = await metadata(target, member("oci-layout"));
    check(layout.json.imageLayoutVersion === "1.0.0", "invalid OCI layout");
    index = await metadata(target, member("index.json"));
    let current = index;
    for (let depth = 0; depth < 5; depth++) {
      check(current.json.schemaVersion === 2 && Array.isArray(current.json.manifests) && current.json.manifests.length === 1, "invalid OCI manifest scope");
      const descriptor = current.json.manifests[0];
      check(/^sha256:[a-f0-9]{64}$/.test(descriptor.digest), "invalid OCI descriptor digest");
      if (descriptor.platform) check(descriptor.platform.os === "linux" && descriptor.platform.architecture === "amd64", "invalid OCI descriptor platform");
      const next = await metadata(target, member(`blobs/sha256/${descriptor.digest.slice(7)}`));
      check(next.digest === descriptor.digest && next.sizeBytes === descriptor.size, "OCI descriptor checksum or size mismatch");
      const typed = { ...raw(next), mediaType: descriptor.mediaType };
      if (!descriptorTarget) descriptorTarget = typed;
      if (next.json.config && next.json.layers) { manifest = { ...next, mediaType: descriptor.mediaType }; break; }
      current = next;
    }
    check(manifest && manifest.json.schemaVersion === 2, "missing OCI image manifest");
    check(manifest.json.config.digest === config.digest && manifest.json.config.size === config.sizeBytes, "OCI config descriptor mismatch");
    check(manifest.json.layers.length === saved.Layers.length, "OCI layer count mismatch");
  }
  const layers = [];
  for (const [i, name] of saved.Layers.entries()) {
    const entry = member(name);
    check(entry && entry.sizeBytes > 0, "missing archive layer");
    const mediaType = manifest?.json.layers[i].mediaType ?? "application/vnd.docker.image.rootfs.diff.tar";
    const compressed = ["application/vnd.oci.image.layer.v1.tar+gzip", "application/vnd.docker.image.rootfs.diff.tar.gzip"].includes(mediaType);
    if (manifest) {
      const desc = manifest.json.layers[i];
      check(desc.digest === entry.digest && desc.size === entry.sizeBytes, "OCI layer descriptor or order mismatch");
      check(compressed || ["application/vnd.oci.image.layer.v1.tar", "application/vnd.docker.image.rootfs.diff.tar"].includes(mediaType), "unsupported layer media type");
    }
    let diffId = entry.digest;
    if (compressed) {
      const digest = createHash("sha256");
      let inflatedBytes = 0;
      const input = createReadStream(target, { start: entry.offset, end: entry.offset + entry.sizeBytes - 1 });
      const output = input.pipe(createGunzip());
      input.on("error", (error) => output.destroy(error));
      try {
        for await (const bytes of output) {
          inflatedBytes += bytes.length;
          check(inflatedBytes <= 16 * 1024 * 1024 * 1024, "inflated layer exceeds byte bound");
          digest.update(bytes);
        }
      } finally { input.destroy(); output.destroy(); }
      diffId = `sha256:${digest.digest("hex")}`;
    }
    check(diffIds[i] === diffId, "archive layer diff ID mismatch");
    layers.push({ file: entry.file, digest: entry.digest, sizeBytes: entry.sizeBytes, diffId, mediaType });
  }
  // Docker's legacy tag map is ancillary metadata, never an alternative identity.
  let repositories = null;
  if (files.has("repositories")) repositories = raw(await metadata(target, member("repositories")));
  // Moby's exporter also retains V1 compatibility config blobs, without OCI references.
  const legacyConfigs = [];
  for (const [name, entry] of files) {
    if (used.has(name)) continue;
    check(/^blobs\/sha256\/[a-f0-9]{64}$/.test(name) && name === `blobs/sha256/${entry.digest.slice(7)}`, "unexpected unreferenced archive file");
    const legacy = await metadata(target, member(name));
    check(/^[a-f0-9]{64}$/.test(legacy.json.id) && legacy.json.os === "linux"
      && !legacy.json.rootfs && !legacy.json.schemaVersion && !legacy.json.manifests, "invalid legacy config archive scope");
    legacyConfigs.push(raw(legacy));
  }
  check([...files.keys()].every((name) => used.has(name)), "unexpected unreferenced archive file");
  return { format: index ? "docker-save+oci" : "docker-save", dockerManifest: raw(docker), index: index ? raw(index) : null,
    target: descriptorTarget, manifest: manifest ? { ...raw(manifest), mediaType: manifest.mediaType } : null,
    config: raw(config), layers, repositories, legacyConfigs };
}
