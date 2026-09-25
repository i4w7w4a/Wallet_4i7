import { describe, expect, it } from "vitest";
import type { MaterialDefinition } from "./material-contract";
import { bindMaterialV2 } from "./material-binding-v2";
import { createMaterialCatalogV2 } from "./registry-v2";

type Params = { pattern: "tile" | "rib"; baseColor: string; drift: number };
const definition: MaterialDefinition<"vault-grid", Params> = {
  id: "vault-grid", abiVersion: 2, effectVersion: 1, label: "Test material", description: "Catalog fixture",
  capabilities: ["background", "button-fill"], assetIds: [],
  provenance: { id: "test", sourceUrl: "https://example.com", revision: "test", license: "test", changes: [] },
  fallback: { color: "#111820", label: "Static" },
  presets: [{ id: "base", label: "Base", seed: 7, params: { pattern: "tile", baseColor: "#111820", drift: 0 } }],
  schema: {
    defaults: { pattern: "tile", baseColor: "#111820", drift: 0 },
    controls: [
      { key: "pattern", kind: "select", label: "Pattern", options: [
        { value: "tile", label: "Tile" }, { value: "rib", label: "Rib" },
      ] },
      { key: "baseColor", kind: "color", label: "Base color" },
      { key: "drift", kind: "range", label: "Drift", min: 0, max: 1, step: 0.01 },
    ],
    parse(input) {
      if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false, issues: [
        { code: "params", message: "Invalid params" },
      ] };
      const p = input as Partial<Params>;
      if (Object.keys(p).length !== 3 || (p.pattern !== "tile" && p.pattern !== "rib") ||
          typeof p.baseColor !== "string" || !/^#[\da-f]{6}$/i.test(p.baseColor) ||
          typeof p.drift !== "number" || !Number.isFinite(p.drift) || p.drift < 0 || p.drift > 1) {
        return { ok: false, issues: [{ code: "params", message: "Invalid params" }] };
      }
      return { ok: true, value: { pattern: p.pattern, baseColor: p.baseColor.toLowerCase(), drift: p.drift } };
    },
  },
  plan() { throw new Error("Descriptor test must not acquire GPU resources"); },
  create() { throw new Error("Descriptor test must not acquire GPU resources"); },
};

describe("v2 material catalog", () => {
  it("copies a complete installed recipe into a button target without sharing its parameters", () => {
    const source = {
      kind: "novex-material", version: 2, effectId: "vault-grid", effectVersion: 1,
      seed: 7, params: { ...definition.schema.defaults }, assetIds: [],
    };
    const catalog = createMaterialCatalogV2([bindMaterialV2(definition)]);
    const copied = catalog.copyForTarget(source, "button-fill");

    expect(copied.ok).toBe(true);
    if (!copied.ok) return;
    expect(copied.value).toEqual(source);
    expect(copied.value.params).not.toBe(source.params);
    source.params.baseColor = "#ffffff";
    expect((copied.value.params as { baseColor: string }).baseColor).toBe("#111820");
  });

  it("rejects a material on a target outside its declared capabilities", () => {
    const catalog = createMaterialCatalogV2([bindMaterialV2(definition)]);
    const recipe = catalog.materials[0]!.presets[0]!.recipe;

    expect(catalog.copyForTarget(recipe, "button-border").ok).toBe(false);
    expect(catalog.copyForTarget(recipe, "button-fill").ok).toBe(true);
  });

  it("rejects an accessor recipe without running untrusted code", () => {
    const catalog = createMaterialCatalogV2([bindMaterialV2(definition)]);
    const recipe = { ...catalog.materials[0]!.presets[0]!.recipe };
    let reads = 0;
    Object.defineProperty(recipe, "effectId", { enumerable: true, get() { reads++; throw new Error("must not run"); } });

    expect(catalog.parseRecipe(recipe).ok).toBe(false);
    expect(reads).toBe(0);
  });

  it("keeps the direct descriptor parser safe for imported accessor fields", () => {
    const descriptor = bindMaterialV2(definition).descriptor;
    const recipe = { ...descriptor.presets[0]!.recipe };
    let reads = 0;
    Object.defineProperty(recipe, "seed", { enumerable: true, get() { reads++; return 1; } });

    expect(descriptor.parseRecipe(recipe).ok).toBe(false);
    expect(reads).toBe(0);
  });

  it("marks dependent controls unavailable without removing their saved values", () => {
    const conditionalDefinition = {
      ...definition,
      isControlDisabled: (params: Readonly<Params>, key: string) =>
        key === "drift" && params.pattern === "tile",
    };
    const descriptor = bindMaterialV2(conditionalDefinition).descriptor;
    const recipe = descriptor.presets[0]!.recipe;

    expect(descriptor.readControls(recipe).find(item => item.control.key === "drift")?.disabled).toBe(true);
    const updated = descriptor.updateParameter(recipe, "drift", 0.01);
    expect(updated.ok).toBe(true);
    if (updated.ok) expect((updated.value.params as { drift: number }).drift).toBe(0.01);
  });

  it("rejects accessor entries in asset IDs without evaluating them", () => {
    const descriptor = bindMaterialV2({ ...definition, assetIds: ["mono.quick.send"] }).descriptor;
    const source = descriptor.presets[0]!.recipe;
    const assetIds: string[] = ["mono.quick.send"];
    let reads = 0;
    Object.defineProperty(assetIds, "0", { enumerable: true, get() { reads++; return "mono.quick.send"; } });

    expect(descriptor.parseRecipe({ ...source, assetIds }).ok).toBe(false);
    expect(reads).toBe(0);
  });

  it("refuses duplicate effect registrations instead of choosing a hidden winner", () => {
    const binding = bindMaterialV2(definition);

    expect(() => createMaterialCatalogV2([binding, binding])).toThrow(/vault-grid/);
  });
});
