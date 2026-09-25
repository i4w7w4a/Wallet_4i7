import { describe, expect, it } from "vitest";
import { materialCatalogV2 } from "./registry-v2";

describe("installed v2 material catalog", () => {
  it("offers real Paper button layers and keeps the volumetric background out of button slots", () => {
    const byId = new Map(materialCatalogV2.materials.map(material => [material.id, material]));
    const metal = byId.get("liquid-metal")?.presets[0]?.recipe;
    const border = byId.get("pulsing-border")?.presets[0]?.recipe;
    const particles = byId.get("fluid-particles")?.presets[0]?.recipe;

    expect(metal && materialCatalogV2.copyForTarget(metal, "button-icon").ok).toBe(true);
    expect(border && materialCatalogV2.copyForTarget(border, "button-border").ok).toBe(true);
    expect(particles && materialCatalogV2.copyForTarget(particles, "button-fill").ok).toBe(false);
  });

  it("roundtrips all completed source material families through the installed parser", () => {
    for (const id of ["fluid", "gem-smoke", "heatmap"] as const) {
      const material = materialCatalogV2.materials.find(item => item.id === id);
      expect(material).toBeDefined();
      const recipe = material!.presets[0]!.recipe;
      expect(materialCatalogV2.parseRecipe(recipe)).toEqual({ ok: true, value: recipe });
    }
  });
});
