import { describe, expect, it } from "vitest";
import { particleDefinition } from "./index";
import { PARTICLE_DEFAULTS } from "./schema";
import type { MaterialInit } from "../../material-contract";
import type { ParticleParams } from "./schema";

function request(maxRenderTargetBytes: number): MaterialInit<ParticleParams, null> {
  return {
    params: PARTICLE_DEFAULTS, seed: 147, quality: "detail", prepared: null,
    viewport: { cssWidth: 1920, cssHeight: 1080, pixelWidth: 1920, pixelHeight: 1080, dpr: 1 },
    geometry: { capability: "background", x: 0, y: 0, width: 1920, height: 1080,
      pixelWidth: 1920, pixelHeight: 1080, dpr: 1, radiusCss: 0, borderWidthCss: 0,
      mask: { kind: "rounded-rect" } },
    limits: { maxTextureSize: 4096, maxRenderTargetBytes },
  };
}

describe("fluid-particles material contract", () => {
  it("keeps an explicit source-speed comparison beside a slow starting composition", () => {
    expect(particleDefinition.presets.find(preset => preset.id === "particles-source")?.params.timeScale).toBe(1);
    expect(particleDefinition.presets.some(preset => preset.params.timeScale <= 0.08)).toBe(true);
  });

  it("declares the full PIC/FLIP plus spherical AO/shadow pass budget before allocation", () => {
    const limit = 28 * 1024 * 1024;
    const result = particleDefinition.plan(request(limit));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.attachmentBytes + result.value.textureBytes).toBeLessThanOrEqual(limit);
    expect(result.value.passesPerFrame).toBeGreaterThanOrEqual(70);
    expect(result.value.quality).toContain("960×540");
  });

  it("reports a concrete budget failure before any GL call", () => {
    const result = particleDefinition.plan(request(1024 * 1024));
    expect(result).toMatchObject({ ok: false, error: { code: "budget-exceeded" } });
  });

  it("rejects a context without renderable float targets before allocation", () => {
    const init = request(28 * 1024 * 1024);
    const plan = particleDefinition.plan(init);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const gl = { renderer: { isWebgl2: true }, getExtension: () => null };
    const created = particleDefinition.create(gl as never, { ...init, plan: plan.value });
    expect(created).toMatchObject({ ok: false, error: { code: "unsupported-format" } });
  });

  it("rejects a half-float-only context because particle positions require RGBA32F", () => {
    const init = request(28 * 1024 * 1024);
    const plan = particleDefinition.plan(init);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const gl = { renderer: { isWebgl2: true },
      getExtension: (name: string) => name === "EXT_color_buffer_half_float" ? {} : null };
    expect(particleDefinition.create(gl as never, { ...init, plan: plan.value }))
      .toMatchObject({ ok: false, error: { code: "unsupported-format" } });
  });
});
