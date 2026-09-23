// @vitest-environment node
import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";

import { decodeMonoSharePayload, encodeMonoSharePayload, MONO_SHARE_MAX_BYTES, MONO_SHARE_MAX_TOKEN_LENGTH } from "./mono-share-transport";

describe("bounded MONO snapshot transport", () => {
  it("roundtrips a Unicode snapshot without relying on a database or browser storage", async () => {
    const json = '{"version":1,"example":"Светлая тема · №2"}';
    const token = await encodeMonoSharePayload(json);
    expect(token).toMatch(/^m1\.[a-f0-9]{64}\.[A-Za-z0-9_-]+$/);
    expect(await decodeMonoSharePayload(token)).toBe(json);
  });

  it("detects changed bytes even when the compressed document is valid", async () => {
    const token = await encodeMonoSharePayload('{"version":1}');
    const [version, hash] = token.split(".");
    const changed = gzipSync('{"version":2}').toString("base64url");
    await expect(decodeMonoSharePayload(`${version}.${hash}.${changed}`)).rejects.toMatchObject({ kind: "corrupt" });
  });

  it.each(["", "m2.abc.abc", "m1.nope.%%%%", "m1." + "0".repeat(64) + ".a"])("rejects unsupported or malformed transport %s", async token => {
    await expect(decodeMonoSharePayload(token)).rejects.toMatchObject({ kind: token.startsWith("m2.") ? "version" : "corrupt" });
  });

  it("rejects oversized links before decoding and oversized snapshots before compression", async () => {
    await expect(decodeMonoSharePayload("x".repeat(MONO_SHARE_MAX_TOKEN_LENGTH + 1))).rejects.toMatchObject({ kind: "too-large" });
    await expect(encodeMonoSharePayload("я".repeat(MONO_SHARE_MAX_BYTES))).rejects.toMatchObject({ kind: "too-large" });
  });

  it("bounds decompressed bytes even for a very small compressed input", async () => {
    const compressed = gzipSync("a".repeat(MONO_SHARE_MAX_BYTES + 1)).toString("base64url");
    const token = `m1.${"0".repeat(64)}.${compressed}`;
    expect(token.length).toBeLessThan(MONO_SHARE_MAX_TOKEN_LENGTH);
    await expect(decodeMonoSharePayload(token)).rejects.toMatchObject({ kind: "too-large" });
  });
});
