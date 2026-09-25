import { describe, expect, it } from "vitest";
import type { MaterialTargetGeometry } from "../../material-contract";
import { VAULT_GRID_DEFAULTS } from "./schema";
import { planVaultGridMaterial, resolveVaultGridTarget } from "./target";

const geometry: MaterialTargetGeometry = {
  capability: "background", x: 0, y: 0, width: 390, height: 844,
  pixelWidth: 585, pixelHeight: 1266, dpr: 1.5,
  radiusCss: 0, borderWidthCss: 0, mask: { kind: "rounded-rect" },
};
const limits = { maxTextureSize: 2048, maxRenderTargetBytes: 4_000_000 };
const init = {
  params: VAULT_GRID_DEFAULTS, seed: 0, prepared: null, quality: "balanced" as const,
  viewport: { cssWidth: 390, cssHeight: 844, pixelWidth: 585, pixelHeight: 1266, dpr: 1.5 },
  geometry, limits,
};

describe("vault-grid target allocation", () => {
  it("charges a single RGBA8 target before GPU construction", () => {
    expect(resolveVaultGridTarget(geometry, limits)).toEqual({ width: 585, height: 1266, bytes: 2_962_440 });
    expect(planVaultGridMaterial(init)).toEqual({ ok: true, value: {
      attachmentBytes: 2_962_440, textureBytes: 0, passesPerFrame: 1,
      quality: "RGBA8 · one pass",
    } });
  });

  it("rejects over-budget, over-size, and malformed dimensions", () => {
    expect(resolveVaultGridTarget(geometry, {
      maxTextureSize: 2048, maxRenderTargetBytes: 2_900_000,
    })).toBeNull();
    expect(resolveVaultGridTarget(geometry, {
      maxTextureSize: 1024, maxRenderTargetBytes: 4_000_000,
    })).toBeNull();
    expect(resolveVaultGridTarget({ ...geometry, pixelWidth: 0 }, {
      maxTextureSize: 2048, maxRenderTargetBytes: 4_000_000,
    })).toBeNull();
    expect(resolveVaultGridTarget({ ...geometry, dpr: 0 }, {
      maxTextureSize: 2048, maxRenderTargetBytes: 4_000_000,
    })).toBeNull();
  });

  it("accepts button fill and rejects icon or border targets", () => {
    expect(planVaultGridMaterial({ ...init, geometry: { ...geometry, capability: "button-fill" } }).ok).toBe(true);
    expect(planVaultGridMaterial({ ...init, geometry: { ...geometry, capability: "button-icon" } }).ok).toBe(false);
    expect(planVaultGridMaterial({ ...init, geometry: { ...geometry, capability: "button-border" } }).ok).toBe(false);
  });
});
