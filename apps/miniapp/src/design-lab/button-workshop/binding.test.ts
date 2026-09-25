import { expect, test } from "vitest";
import type { MaterialCatalogV2, MaterialRecipeV2, MaterialTargetBinding } from "@wallet/ui";
import { createButtonBinding, parseButtonBinding, replaceBindingRecipe } from "./binding";

const recipe: MaterialRecipeV2<"liquid-metal"> = {
  kind: "novex-material", version: 2, effectId: "liquid-metal", effectVersion: 1,
  seed: 1, params: { colorTint: "#aabbcc" }, assetIds: [],
};
const borderRecipe: MaterialRecipeV2<"pulsing-border"> = {
  kind: "novex-material", version: 2, effectId: "pulsing-border", effectVersion: 1,
  seed: 2, params: { thickness: 2 }, assetIds: [],
};
const catalog: MaterialCatalogV2 = {
  materials: [],
  parseRecipe(input) { return { ok: true, value: input as MaterialRecipeV2 }; },
  copyForTarget(input, capability) {
    const value = input as MaterialRecipeV2;
    return (value.effectId === "liquid-metal" && capability !== "button-border") ||
      (value.effectId === "pulsing-border" && capability === "button-border")
      ? { ok: true, value: structuredClone(value) }
      : { ok: false, issues: [{ code: "incompatible", message: "Материал не подходит для слоя." }] };
  },
};

test("binding parser preserves full geometry and checks target, layer and material capability", () => {
  const binding = createButtonBinding("quick.send", "border", borderRecipe, catalog);
  const rectangle: MaterialTargetBinding = { ...binding, radiusCss: 0, borderWidthCss: 3.5, enabled: true };
  expect(parseButtonBinding(JSON.parse(JSON.stringify(rectangle)), "border", "quick.send", catalog)).toEqual(rectangle);
  expect(() => parseButtonBinding({ ...rectangle, targetId: "quick.buy" }, "border", "quick.send", catalog)).toThrow();
  expect(() => parseButtonBinding({ ...rectangle, borderWidthCss: 99 }, "border", "quick.send", catalog)).toThrow();
  expect(() => parseButtonBinding({ ...rectangle, recipe }, "border", "quick.send", catalog)).toThrow(/не подходит/);
});

test("icon binding uses only the matching allowlisted mask", () => {
  const binding = createButtonBinding("quick.swap", "icon", recipe, catalog);
  expect(binding.mask).toEqual({ kind: "icon", assetId: "mono.quick.swap" });
  expect(() => parseButtonBinding({ ...binding, mask: { kind: "icon", assetId: "mono.quick.buy" } }, "icon", "quick.swap", catalog)).toThrow();
});

test("changing a recipe preserves an individual target's geometry and does not alias the source", () => {
  const initial = { ...createButtonBinding("quick.send", "fill", recipe, catalog), radiusCss: 0 };
  const next = replaceBindingRecipe(initial, { ...recipe, seed: 2 }, catalog);
  expect(next).toMatchObject({ targetId: "quick.send", layer: "fill", radiusCss: 0, borderWidthCss: 0, recipe: { seed: 2 } });
  expect(initial.recipe.seed).toBe(1);
});
