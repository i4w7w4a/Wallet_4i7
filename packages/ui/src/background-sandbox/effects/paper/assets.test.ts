import { describe, expect, it } from "vitest";

import { paperAssetKey, rasterizePaperGeometry } from "./assets";

describe("Paper shape assets", () => {
  it("makes a strict rectangle with opaque center and clear padded corners", () => {
    const asset = rasterizePaperGeometry("strict-rectangle", 16, 12, 0);
    expect(asset.rgba[(6 * 16 + 8) * 4 + 3]).toBe(255);
    expect(asset.rgba[(0 * 16 + 0) * 4 + 3]).toBe(255);
    expect(asset.rgba[(6 * 16 + 8) * 4]).toBe(0);
    const padded = rasterizePaperGeometry("strict-rectangle", 16, 12, 0.125);
    expect(padded.rgba[3]).toBe(0);
    expect(padded.rgba[(6 * 16 + 8) * 4 + 3]).toBe(255);
  });

  it("keeps rounded and strict rectangles distinct", () => {
    const strict = rasterizePaperGeometry("strict-rectangle", 32, 32, 0);
    const rounded = rasterizePaperGeometry("rounded-rectangle", 32, 32, 0);
    expect(strict.rgba[3]).toBe(255);
    expect(rounded.rgba[3]).toBe(0);
    expect(rounded.rgba[(16 * 32 + 16) * 4 + 3]).toBe(255);
  });

  it("keys masks by effect, asset, geometry and revision", () => {
    expect(paperAssetKey("metal", "mono.quick.send", 66, 66, 1, 0)).toBe("metal:mono.quick.send:66x66:r0:v1");
    expect(paperAssetKey("metal", "mono.quick.send", 66, 66, 2, 0)).not.toBe(paperAssetKey("metal", "mono.quick.send", 66, 66, 1, 0));
    expect(paperAssetKey("metal", "rounded-rectangle", 66, 66, 1, 8)).not.toBe(paperAssetKey("metal", "rounded-rectangle", 66, 66, 1, 12));
  });
});
