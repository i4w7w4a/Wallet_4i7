import { describe, expect, it } from "vitest";
import type { MaterialInit } from "../../../material-contract";
import { bindMaterialV2 } from "../../../material-binding-v2";
import { fluidDefinition } from "../index";
import { fluidV2Definition } from "./index";
import { FLUID_V2_DEFAULTS, type FluidV2Params } from "./schema";

const init: MaterialInit<FluidV2Params, null> = {
  params: FLUID_V2_DEFAULTS, seed: 147,
  viewport: { cssWidth: 390, cssHeight: 844, pixelWidth: 585, pixelHeight: 1266, dpr: 1.5 },
  geometry: { capability: "background", x: 0, y: 0, width: 390, height: 844, pixelWidth: 585, pixelHeight: 1266, dpr: 1.5, radiusCss: 0, borderWidthCss: 0, mask: { kind: "rounded-rect" } },
  quality: "balanced", limits: { maxTextureSize: 8192, maxRenderTargetBytes: 28 * 1024 * 1024 }, prepared: null,
};

describe("Fluid v2 definition", () => {
  it("roundtrips the full v2 recipe through the shared binder without rewriting v1", () => {
    const descriptor = bindMaterialV2(fluidV2Definition).descriptor;
    const recipe = { kind: "novex-material", version: 2, effectId: "fluid", effectVersion: 2, seed: 147, params: FLUID_V2_DEFAULTS, assetIds: [] };
    const parsed = descriptor.parseRecipe(JSON.parse(JSON.stringify(recipe)));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value).toEqual(recipe);
    expect(descriptor.parseRecipe({ ...recipe, effectVersion: 1 }).ok).toBe(false);
    const updated = descriptor.updateParameter(parsed.value, "colors", ["#112233", "#abcdef"]);
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    expect(updated.value.params).toMatchObject({ colors: ["#112233", "#ABCDEF"] });
    expect(parsed.value.params).toMatchObject({ colors: FLUID_V2_DEFAULTS.colors });
    const bloom = descriptor.readControls(updated.value).find(({ control }) => control.key === "bloomIntensity");
    expect(bloom?.disabled).toBe(true);
  });
  it("disables dependent controls only while their parent mode is inactive", () => {
    const disabled = (key: keyof FluidV2Params, patch: Partial<FluidV2Params> = {}) => fluidV2Definition.isControlDisabled?.({ ...FLUID_V2_DEFAULTS, ...patch }, key);
    expect(disabled("bloomIntensity")).toBe(true);
    expect(disabled("bloomThreshold")).toBe(true);
    expect(disabled("bloomIntensity", { bloomEnabled: true })).toBe(false);
    expect(disabled("sunraysWeight")).toBe(true);
    expect(disabled("sunraysWeight", { sunraysEnabled: true })).toBe(false);
    expect(disabled("ambientRate")).toBe(true);
    expect(disabled("ambientRate", { mode: "ambient" })).toBe(false);
    expect(disabled("colorCycleRate", { colors: ["#112233"] })).toBe(true);
    expect(disabled("colorCycleRate")).toBe(false);
  });
  it("registers as a distinct material version and leaves Fluid v1 addressable", () => {
    expect(fluidDefinition.id).toBe("fluid");
    expect(fluidDefinition.abiVersion).toBe(1);
    expect(fluidDefinition.configVersion).toBe(1);
    expect(fluidV2Definition.id).toBe("fluid");
    expect(fluidV2Definition.abiVersion).toBe(2);
    expect(fluidV2Definition.effectVersion).toBe(2);
    expect(fluidV2Definition.capabilities).toEqual(["background"]);
    expect(fluidV2Definition.schema.parse(FLUID_V2_DEFAULTS).ok).toBe(true);
    for (const preset of fluidV2Definition.presets) expect(fluidV2Definition.schema.parse(preset.params).ok).toBe(true);
  });

  it("declares attachment bytes and bounded active passes before GPU allocation", () => {
    const draw = fluidV2Definition.plan(init);
    expect(draw.ok).toBe(true);
    if (!draw.ok) return;
    expect(draw.value.attachmentBytes).toBeGreaterThan(0);
    expect(draw.value.attachmentBytes).toBeLessThanOrEqual(28 * 1024 * 1024);
    expect(draw.value.textureBytes).toBe(0);
    expect(draw.value.passesPerFrame).toBe(41); // 28 solver + display + 4 bounded 3-pass splats.
    const lit = fluidV2Definition.plan({ ...init, params: { ...FLUID_V2_DEFAULTS, bloomEnabled: true, sunraysEnabled: true } });
    expect(lit.ok && lit.value.passesPerFrame).toBe(51);
  });

  it("rejects corrupt params, seed and incompatible target without trying GPU", () => {
    expect(fluidV2Definition.plan({ ...init, params: { ...FLUID_V2_DEFAULTS, radius: Infinity } })).toMatchObject({ ok: false, error: { code: "invalid-config" } });
    expect(fluidV2Definition.plan({ ...init, seed: -1 })).toMatchObject({ ok: false, error: { code: "invalid-config" } });
    expect(fluidV2Definition.plan({ ...init, geometry: { ...init.geometry, capability: "button-fill" } })).toMatchObject({ ok: false, error: { code: "invalid-config" } });
    expect(fluidV2Definition.plan({ ...init, limits: { ...init.limits, maxRenderTargetBytes: 32 } })).toMatchObject({ ok: false, error: { code: "budget-exceeded" } });
  });
});
