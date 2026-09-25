import { describe, expect, it } from "vitest";
import type { OGLRenderingContext } from "ogl";
import type { MaterialInit, MaterialResourcePlan } from "../../../material-contract";
import { createFluidV2Pass } from "./adapter";
import { FLUID_V2_DEFAULTS, type FluidV2Params } from "./schema";

const init: MaterialInit<FluidV2Params, null> & { plan: MaterialResourcePlan } = {
  params: FLUID_V2_DEFAULTS, seed: 147,
  viewport: { cssWidth: 390, cssHeight: 844, pixelWidth: 585, pixelHeight: 1266, dpr: 1.5 },
  geometry: { capability: "background", x: 0, y: 0, width: 390, height: 844, pixelWidth: 585, pixelHeight: 1266, dpr: 1.5, radiusCss: 0, borderWidthCss: 0, mask: { kind: "rounded-rect" } },
  quality: "balanced", limits: { maxTextureSize: 8192, maxRenderTargetBytes: 28 * 1024 * 1024 }, prepared: null,
  plan: { attachmentBytes: 8 * 1024 * 1024, textureBytes: 0, passesPerFrame: 41, quality: "balanced" },
};

describe("Fluid v2 borrowed-context boundary", () => {
  it("rejects invalid params/seed before any GL call", () => {
    const gl = new Proxy({}, { get() { throw new Error("GL must not be touched"); } }) as OGLRenderingContext;
    expect(createFluidV2Pass(gl, { ...init, params: { ...FLUID_V2_DEFAULTS, force: Infinity } })).toMatchObject({ ok: false, error: { code: "invalid-config" } });
    expect(createFluidV2Pass(gl, { ...init, seed: -1 })).toMatchObject({ ok: false, error: { code: "invalid-config" } });
  });

  it("reports WebGL2/context-loss/float target failures without allocating a second renderer", () => {
    const gl = { renderer: { isWebgl2: true, getExtension: () => null }, isContextLost: () => false } as unknown as OGLRenderingContext;
    expect(createFluidV2Pass({ ...gl, renderer: { ...gl.renderer, isWebgl2: false } } as OGLRenderingContext, init)).toMatchObject({ ok: false, error: { code: "webgl2-unavailable" } });
    expect(createFluidV2Pass({ ...gl, isContextLost: () => true } as OGLRenderingContext, init)).toMatchObject({ ok: false, error: { code: "context-lost" } });
    expect(createFluidV2Pass(gl, init)).toMatchObject({ ok: false, error: { code: "unsupported-format" } });
  });
});
