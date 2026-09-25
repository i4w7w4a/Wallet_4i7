import { describe, expect, it } from "vitest";
import type { OGLRenderingContext } from "ogl";
import { createVaultGridMaterial } from "./adapter";
import { VAULT_GRID_DEFAULTS } from "./schema";

const geometry = {
  capability: "button-fill" as const, x: 0, y: 0, width: 120, height: 48,
  pixelWidth: 180, pixelHeight: 72, dpr: 1.5,
  radiusCss: 12, borderWidthCss: 0, mask: { kind: "rounded-rect" as const },
};
const init = {
  params: VAULT_GRID_DEFAULTS,
  seed: 0,
  viewport: { cssWidth: 390, cssHeight: 844, pixelWidth: 585, pixelHeight: 1266, dpr: 1.5 },
  geometry,
  quality: "balanced" as const,
  limits: { maxTextureSize: 2048, maxRenderTargetBytes: 4_000_000 },
  prepared: null,
  plan: { attachmentBytes: 51_840, textureBytes: 0, passesPerFrame: 1, quality: "RGBA8 · one pass" },
};

describe("vault-grid adapter resource boundary", () => {
  it("rejects a stale undersized plan before touching the graphics context", () => {
    const forbiddenGl = new Proxy({}, {
      get() { throw new Error("GPU accessed before plan validation"); },
    }) as OGLRenderingContext;
    expect(createVaultGridMaterial(forbiddenGl, {
      ...init, plan: { ...init.plan, attachmentBytes: 1 },
    })).toEqual({ ok: false, error: {
      code: "invalid-config", message: "Vault-grid: план ресурсов не соответствует цели.",
    } });
  });

  it("reports context loss before native allocation", () => {
    const gl = { isContextLost: () => true } as OGLRenderingContext;
    expect(createVaultGridMaterial(gl, init)).toEqual({ ok: false, error: {
      code: "context-lost", message: "Графический контекст vault-grid потерян.",
    } });
  });
});
