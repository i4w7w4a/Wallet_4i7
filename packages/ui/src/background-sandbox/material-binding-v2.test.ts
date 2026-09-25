import { describe, expect, it } from "vitest";
import { vaultGridDefinition } from "./effects/vault-grid/definition";
import { bindMaterialV2 } from "./material-binding-v2";
import { createMaterialCatalogV2 } from "./registry-v2";

describe("v2 material catalog", () => {
  it("copies a complete installed recipe into a button target without sharing its parameters", () => {
    const source = {
      kind: "novex-material", version: 2, effectId: "vault-grid", effectVersion: 1,
      seed: 7, params: { ...vaultGridDefinition.schema.defaults }, assetIds: [],
    };
    const catalog = createMaterialCatalogV2([bindMaterialV2(vaultGridDefinition)]);
    const copied = catalog.copyForTarget(source, "button-fill");

    expect(copied.ok).toBe(true);
    if (!copied.ok) return;
    expect(copied.value).toEqual(source);
    expect(copied.value.params).not.toBe(source.params);
    source.params.baseColor = "#ffffff";
    expect((copied.value.params as { baseColor: string }).baseColor).toBe("#111820");
  });

  it("rejects a material on a target outside its declared capabilities", () => {
    const catalog = createMaterialCatalogV2([bindMaterialV2(vaultGridDefinition)]);
    const recipe = catalog.materials[0]!.presets[0]!.recipe;

    expect(catalog.copyForTarget(recipe, "button-border").ok).toBe(false);
    expect(catalog.copyForTarget(recipe, "button-fill").ok).toBe(true);
  });

  it("rejects an accessor recipe without running untrusted code", () => {
    const catalog = createMaterialCatalogV2([bindMaterialV2(vaultGridDefinition)]);
    const recipe = { ...catalog.materials[0]!.presets[0]!.recipe };
    let reads = 0;
    Object.defineProperty(recipe, "effectId", { enumerable: true, get() { reads++; throw new Error("must not run"); } });

    expect(catalog.parseRecipe(recipe).ok).toBe(false);
    expect(reads).toBe(0);
  });

  it("keeps the direct descriptor parser safe for imported accessor fields", () => {
    const descriptor = bindMaterialV2(vaultGridDefinition).descriptor;
    const recipe = { ...descriptor.presets[0]!.recipe };
    let reads = 0;
    Object.defineProperty(recipe, "seed", { enumerable: true, get() { reads++; return 1; } });

    expect(descriptor.parseRecipe(recipe).ok).toBe(false);
    expect(reads).toBe(0);
  });

  it("marks dependent controls unavailable without removing their saved values", () => {
    const definition = {
      ...vaultGridDefinition,
      isControlDisabled: (params: typeof vaultGridDefinition.schema.defaults, key: string) =>
        key === "drift" && params.pattern === "tile",
    };
    const descriptor = bindMaterialV2(definition).descriptor;
    const recipe = descriptor.presets[0]!.recipe;

    expect(descriptor.readControls(recipe).find(item => item.control.key === "drift")?.disabled).toBe(true);
    const updated = descriptor.updateParameter(recipe, "drift", 0.01);
    expect(updated.ok).toBe(true);
    if (updated.ok) expect((updated.value.params as { drift: number }).drift).toBe(0.01);
  });

  it("rejects accessor entries in asset IDs without evaluating them", () => {
    const descriptor = bindMaterialV2({ ...vaultGridDefinition, assetIds: ["mono.quick.send"] }).descriptor;
    const source = descriptor.presets[0]!.recipe;
    const assetIds: string[] = ["mono.quick.send"];
    let reads = 0;
    Object.defineProperty(assetIds, "0", { enumerable: true, get() { reads++; return "mono.quick.send"; } });

    expect(descriptor.parseRecipe({ ...source, assetIds }).ok).toBe(false);
    expect(reads).toBe(0);
  });

  it("refuses duplicate effect registrations instead of choosing a hidden winner", () => {
    const binding = bindMaterialV2(vaultGridDefinition);

    expect(() => createMaterialCatalogV2([binding, binding])).toThrow(/vault-grid/);
  });
});
