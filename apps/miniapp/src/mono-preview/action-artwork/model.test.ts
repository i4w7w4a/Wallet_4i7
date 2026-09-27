import { describe, expect, it } from "vitest";
import {
  createDefaultActionArtwork, createDefaultActionArtworkMap,
  parseMonoActionArtwork, parseMonoActionArtworkMap,
} from "./model";

describe("MONO action artwork contract", () => {
  it("provides independent Original defaults for all four actions", () => {
    const first = createDefaultActionArtworkMap();
    const second = createDefaultActionArtworkMap();
    expect(Object.keys(first)).toEqual(["quick.send", "quick.receive", "quick.swap", "quick.buy"]);
    for (const value of Object.values(first)) expect(value).toEqual({
      version: 1, packId: "original", energy: { enabled: true, intensity: 0.35, durationMs: 700, width: 0.28 },
    });
    first["quick.send"].energy.intensity = 0.8;
    expect(first["quick.receive"].energy.intensity).toBe(0.35);
    expect(second["quick.send"].energy.intensity).toBe(0.35);
    expect(createDefaultActionArtwork()).toEqual(second["quick.send"]);
  });

  it("parses exact bounded values and returns a detached normalized copy", () => {
    const raw = { version: 1, packId: "volume-v1", energy: {
      enabled: false, intensity: 0, durationMs: 400, width: 0.12,
    } };
    const parsed = parseMonoActionArtwork(raw);
    expect(parsed).toEqual(raw);
    expect(parsed).not.toBe(raw);
    expect(parsed.energy).not.toBe(raw.energy);
    expect(parseMonoActionArtwork({ version: 1, packId: "contour-v1", energy: {
      enabled: true, intensity: 1, durationMs: 1200, width: 0.55,
    } }).packId).toBe("contour-v1");
  });

  it.each([
    null, [], {},
    { version: 2, packId: "original", energy: { enabled: true, intensity: 0.35, durationMs: 700, width: 0.28 } },
    { version: 1, packId: "https://evil.example/icon.png", energy: { enabled: true, intensity: 0.35, durationMs: 700, width: 0.28 } },
    { version: 1, packId: "volume-v1", energy: { enabled: true, intensity: NaN, durationMs: 700, width: 0.28 } },
    { version: 1, packId: "volume-v1", energy: { enabled: true, intensity: 1.01, durationMs: 700, width: 0.28 } },
    { version: 1, packId: "volume-v1", energy: { enabled: true, intensity: 0.35, durationMs: 399, width: 0.28 } },
    { version: 1, packId: "volume-v1", energy: { enabled: true, intensity: 0.35, durationMs: 700, width: 0.56 } },
    { version: 1, packId: "volume-v1", energy: { enabled: "true", intensity: 0.35, durationMs: 700, width: 0.28 } },
    { version: 1, packId: "volume-v1", energy: { enabled: true, intensity: 0.35, durationMs: 700, width: 0.28, interval: 1 } },
    { version: 1, packId: "volume-v1", energy: { enabled: true, intensity: 0.35, durationMs: 700, width: 0.28 }, assetUrl: "/remote.png" },
  ])("rejects malformed or unsupported artwork %j", input => {
    expect(() => parseMonoActionArtwork(input)).toThrow();
  });

  it("requires exactly the four action IDs in a map", () => {
    const valid = createDefaultActionArtworkMap();
    valid["quick.buy"] = { version: 1, packId: "contour-v1", energy: {
      enabled: true, intensity: 0.5, durationMs: 900, width: 0.3,
    } };
    const parsed = parseMonoActionArtworkMap(valid);
    expect(parsed).toEqual(valid);
    expect(parsed["quick.buy"]).not.toBe(valid["quick.buy"]);
    expect(() => parseMonoActionArtworkMap({ ...valid, "quick.pay": valid["quick.buy"] })).toThrow();
    const { "quick.buy": _omitted, ...missing } = valid;
    expect(() => parseMonoActionArtworkMap(missing)).toThrow();
    expect(() => parseMonoActionArtworkMap({ ...valid, "quick.send": { ...valid["quick.send"], packId: "external" } })).toThrow();
  });
});
