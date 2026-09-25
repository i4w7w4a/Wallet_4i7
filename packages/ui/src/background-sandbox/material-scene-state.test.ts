import { describe, expect, it } from "vitest";
import { createTargetBinding } from "./target-binding";
import { materialCatalogV2 } from "./registry-v2";
import { materialSceneStructureKey } from "./material-scene-state";

describe("material scene updates", () => {
  it("keeps color edits live while remounting a Paper mask only when its preparation path changes", () => {
    const metal = materialCatalogV2.materials.find(item => item.id === "liquid-metal")!;
    const recipe = metal.presets[0]!.recipe;
    const target = createTargetBinding("quick.send", "fill", recipe, materialCatalogV2);
    expect(target.ok).toBe(true);
    if (!target.ok) return;
    const key = materialSceneStructureKey(null, [target.value], "balanced");
    const colored = metal.updateParameter(recipe, "colorTint", "#112233");
    expect(colored.ok).toBe(true);
    if (!colored.ok) return;
    expect(materialSceneStructureKey(null, [{ ...target.value, recipe: colored.value }], "balanced")).toBe(key);
    const shaped = metal.updateParameter(recipe, "shape", "diamond");
    expect(shaped.ok).toBe(true);
    if (shaped.ok) expect(materialSceneStructureKey(null, [{ ...target.value, recipe: shaped.value }], "balanced")).not.toBe(key);
  });
});
