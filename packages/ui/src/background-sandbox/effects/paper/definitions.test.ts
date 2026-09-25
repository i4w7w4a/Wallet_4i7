import { describe, expect, it } from "vitest";

import type { MaterialInit, MaterialTargetGeometry } from "../../material-contract";
import { liquidMetalDefinition, pulsingBorderDefinition } from "./definitions";
import type { PaperPreparedAssets } from "./prepare";

const geometry: MaterialTargetGeometry = {
  capability: "button-fill", x: 0, y: 0, width: 44, height: 44,
  pixelWidth: 66, pixelHeight: 66, dpr: 1.5,
  radiusCss: 8, borderWidthCss: 1, mask: { kind: "rounded-rect" },
};
const prepared: PaperPreparedAssets = { cacheKey: "fixture", byteLength: 256, assets: [] };

describe("Paper material definitions", () => {
  it("plans Metal output and mask texture before constructing a GPU pass", () => {
    const init: MaterialInit<typeof liquidMetalDefinition.schema.defaults, PaperPreparedAssets> = {
      params: liquidMetalDefinition.schema.defaults, seed: 0,
      viewport: { cssWidth: 390, cssHeight: 844, pixelWidth: 585, pixelHeight: 1266, dpr: 1.5 },
      geometry, quality: "balanced", prepared,
      limits: { maxTextureSize: 1024, maxRenderTargetBytes: 100000 },
    };
    expect(liquidMetalDefinition.plan(init)).toMatchObject({ ok: true, value: {
      attachmentBytes: 66 * 66 * 4, textureBytes: 260, passesPerFrame: 1,
    } });
    expect(liquidMetalDefinition.plan({ ...init, limits: { ...init.limits, maxRenderTargetBytes: 100 } }).ok).toBe(false);
  });

  it("offers the border specifically to actual button frames and preserves source-like controls", () => {
    expect(pulsingBorderDefinition.capabilities).toContain("button-border");
    expect(pulsingBorderDefinition.presets.some((preset) => preset.id === "source-default")).toBe(true);
    for (const preset of pulsingBorderDefinition.presets) {
      expect(pulsingBorderDefinition.schema.parse(preset.params).ok).toBe(true);
    }
  });
});
