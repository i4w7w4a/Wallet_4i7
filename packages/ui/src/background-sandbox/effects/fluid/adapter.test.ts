import { describe, expect, it } from "vitest";
import type { OGLRenderingContext } from "ogl";
import type { EffectInit } from "../../contracts";
import { createFluidEffect } from "./adapter";
import { FLUID_DEFAULTS, type FluidParams } from "./schema";

const init: EffectInit<FluidParams> = {
  params: FLUID_DEFAULTS, seed: 1,
  viewport: { cssWidth: 390, cssHeight: 844, pixelWidth: 585, pixelHeight: 1266, dpr: 1.5 },
  limits: { maxTextureSize: 4096, maxRenderTargetBytes: 8 * 1024 * 1024 },
};

describe("Fluid create boundary", () => {
  it("rejects malformed recipe before touching borrowed GL", () => {
    const gl = new Proxy({}, { get() { throw new Error("unexpected GL access"); } }) as OGLRenderingContext;
    expect(createFluidEffect(gl, { ...init, params: { ...FLUID_DEFAULTS, force: Infinity } })).toMatchObject({ ok: false, error: { code: "invalid-config" } });
    expect(createFluidEffect(gl, { ...init, seed: -1 })).toMatchObject({ ok: false, error: { code: "invalid-config" } });
  });

  it("reports unavailable WebGL2 without trying another renderer", () => {
    expect(createFluidEffect({ renderer: { isWebgl2: false } } as OGLRenderingContext, init)).toMatchObject({ ok: false, error: { code: "webgl2-unavailable" } });
  });

  it("reports context loss and missing float targets before creating any resource", () => {
    // These external capability gates are the only GL calls allowed before allocation.
    const base = { renderer: { isWebgl2: true, getExtension: () => null }, isContextLost: () => false };
    expect(createFluidEffect(base as unknown as OGLRenderingContext, init)).toMatchObject({ ok: false, error: { code: "unsupported-format" } });
    expect(createFluidEffect({ ...base, isContextLost: () => true } as unknown as OGLRenderingContext, init)).toMatchObject({ ok: false, error: { code: "context-lost" } });
  });
});
