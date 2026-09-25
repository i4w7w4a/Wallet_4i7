import { describe, expect, it } from "vitest";

import type { MaterialTargetGeometry } from "../../material-contract";
import { preparePaperMaskAsset } from "./prepare";
import { liquidMetalSchema } from "./schema";

const geometry: MaterialTargetGeometry = {
  capability: "button-fill", x: 0, y: 0, width: 44, height: 44,
  pixelWidth: 66, pixelHeight: 66, dpr: 1.5,
  radiusCss: 8, borderWidthCss: 1,
  mask: { kind: "rounded-rect" },
};

describe("Paper prepare phase", () => {
  it("prepares a rounded button mask before GPU creation with a geometry source key", async () => {
    const result = await preparePaperMaskAsset("metal", {
      params: liquidMetalSchema.defaults, seed: 0, geometry,
      quality: "balanced", maxCpuBytes: 500000,
    }, new AbortController().signal);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.assets).toHaveLength(1);
    expect(result.value.assets[0]!.source.kind).toBe("geometry");
    expect(result.value.assets[0]!.encoding).toBe("paper-gradient");
    expect(result.value.assets[0]!.rgba[(33 * 66 + 33) * 4 + 1]).toBe(255);
    expect(result.value.assets[0]!.rgba[1]).toBe(0);
  });

  it("rejects a CPU budget before starting a mask solve", async () => {
    const result = await preparePaperMaskAsset("metal", {
      params: liquidMetalSchema.defaults, seed: 0, geometry,
      quality: "balanced", maxCpuBytes: 100,
    }, new AbortController().signal);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("budget-exceeded");
  });

  it("honors cancellation between solver chunks", async () => {
    const controller = new AbortController();
    const pending = preparePaperMaskAsset("metal", {
      params: liquidMetalSchema.defaults, seed: 0, geometry,
      quality: "balanced", maxCpuBytes: 500000,
    }, controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });

  it("uses an allowlisted host icon coverage when one is supplied", async () => {
    const coverage = new Uint8Array(9 * 9);
    for (let y = 2; y <= 6; y++) for (let x = 2; x <= 6; x++) coverage[y * 9 + x] = 255;
    const result = await preparePaperMaskAsset("metal", {
      params: liquidMetalSchema.defaults, seed: 0,
      geometry: { ...geometry, capability: "button-icon", mask: { kind: "icon", assetId: "mono.quick.send" } },
      maskSource: { assetId: "mono.quick.send", width: 9, height: 9, coverage },
      quality: "balanced", maxCpuBytes: 500000,
    }, new AbortController().signal);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.assets[0]!.source).toEqual({ kind: "icon", assetId: "mono.quick.send" });
    expect(result.value.assets[0]!.rgba[1]).toBe(0);
    expect(result.value.assets[0]!.rgba[(33 * 66 + 33) * 4 + 1]).toBe(255);
  });

  it("returns an explicit failure for malformed host icon coverage", async () => {
    const result = await preparePaperMaskAsset("metal", {
      params: liquidMetalSchema.defaults, seed: 0,
      geometry: { ...geometry, capability: "button-icon", mask: { kind: "icon", assetId: "mono.quick.buy" } },
      maskSource: { assetId: "mono.quick.buy", width: 9, height: 9, coverage: new Uint8Array(3) },
      quality: "balanced", maxCpuBytes: 500000,
    }, new AbortController().signal);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("invalid-config");
  });
});
