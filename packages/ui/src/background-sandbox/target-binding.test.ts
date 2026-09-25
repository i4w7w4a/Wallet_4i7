import { describe, expect, it } from "vitest";
import type { MaterialCatalogV2 } from "./host-contract";
import type { MaterialCapability, MaterialRecipeV2 } from "./material-contract";
import { createTargetBinding, parseTargetBinding, parseTargetBindings } from "./target-binding";

const metal: MaterialRecipeV2<"liquid-metal", { repetition: number }> = {
  kind: "novex-material", version: 2, effectId: "liquid-metal", effectVersion: 1,
  seed: 7, params: { repetition: 3 }, assetIds: [],
};
const border: MaterialRecipeV2<"pulsing-border", { thickness: number }> = {
  kind: "novex-material", version: 2, effectId: "pulsing-border", effectVersion: 1,
  seed: 9, params: { thickness: 2 }, assetIds: [],
};
function catalog(): MaterialCatalogV2 {
  const known = (input: unknown) => JSON.stringify(input) === JSON.stringify(metal) ? metal
    : JSON.stringify(input) === JSON.stringify(border) ? border : null;
  return {
    materials: [],
    parseRecipe(input) {
      const recipe = known(input);
      return recipe ? { ok: true, value: structuredClone(recipe) }
        : { ok: false, issues: [{ code: "unknown", message: "Unknown recipe" }] };
    },
    copyForTarget(input, capability: MaterialCapability) {
      const recipe = known(input);
      if (!recipe) return { ok: false, issues: [{ code: "unknown", message: "Unknown recipe" }] };
      if (capability === "button-border" && recipe.effectId !== "pulsing-border" ||
          capability !== "button-border" && recipe.effectId !== "liquid-metal") {
        return { ok: false, issues: [{ code: "incompatible", message: "Wrong target" }] };
      }
      return { ok: true, value: structuredClone(recipe) };
    },
  };
}

describe("real quick-action material bindings", () => {
  it("creates full independent icon and border snapshots with the matching Novex mask", () => {
    const icon = createTargetBinding("quick.send", "icon", metal, catalog());
    const frame = createTargetBinding("quick.send", "border", border, catalog());
    expect(icon).toMatchObject({ ok: true, value: {
      targetId: "quick.send", layer: "icon", mask: { kind: "icon", assetId: "mono.quick.send" },
      radiusCss: 0, borderWidthCss: 0, enabled: true,
    } });
    expect(frame).toMatchObject({ ok: true, value: {
      targetId: "quick.send", layer: "border", mask: { kind: "rounded-rect" },
      radiusCss: 12, borderWidthCss: 1, enabled: true,
    } });
    expect(icon.ok && icon.value.recipe).not.toBe(metal);
    if (!icon.ok || !frame.ok) throw new Error("fixture");
    expect(parseTargetBindings(JSON.parse(JSON.stringify([icon.value, frame.value])), catalog()).ok).toBe(true);
    expect(parseTargetBindings([icon.value, frame.value], catalog()).ok).toBe(true);
  });

  it("rejects foreign icon masks, unknown fields, bad geometry, unsupported materials and duplicate slots atomically", () => {
    const made = createTargetBinding("quick.send", "icon", metal, catalog());
    if (!made.ok) throw new Error("fixture");
    const valid = made.value;
    expect(parseTargetBinding({ ...valid, mask: { kind: "icon", assetId: "mono.quick.buy" } }, catalog()).ok).toBe(false);
    expect(parseTargetBinding({ ...valid, extra: "shader" }, catalog()).ok).toBe(false);
    expect(parseTargetBinding({ ...valid, radiusCss: 25 }, catalog()).ok).toBe(false);
    expect(parseTargetBinding({ ...valid, borderWidthCss: 2 }, catalog()).ok).toBe(false);
    expect(parseTargetBinding({ ...valid, recipe: border }, catalog()).ok).toBe(false);
    expect(parseTargetBindings([valid, valid], catalog()).ok).toBe(false);
  });
});
