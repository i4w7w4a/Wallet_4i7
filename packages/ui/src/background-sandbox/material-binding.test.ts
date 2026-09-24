import { describe, expect, it } from "vitest";
import type { Definition } from "./contracts";
import { bindMaterial } from "./material-binding";

const definition: Definition<"silk", { amount: number; palette: "a" | "b" }> = {
  id: "silk", abiVersion: 1, configVersion: 1, label: "Test material", description: "Parser fixture",
  assetIds: [], provenance: { id: "test", sourceUrl: "https://example.com", revision: "test", license: "test", changes: [] },
  fallback: { color: "#111111", label: "Static" },
  presets: [{ id: "base", label: "Base", seed: 9, params: { amount: 1, palette: "a" } }],
  schema: {
    defaults: { amount: 1, palette: "a" },
    controls: [
      { key: "amount", kind: "range", label: "Amount", min: 0, max: 2, step: 0.1 },
      { key: "palette", kind: "select", label: "Palette", options: [{ value: "a", label: "A" }, { value: "b", label: "B" }] },
    ],
    parse(input) {
      if (typeof input !== "object" || !input || Array.isArray(input)) return { ok: false, issues: [{ code: "params", message: "Invalid params" }] };
      const p = input as { amount?: unknown; palette?: unknown };
      if (Object.keys(p).length !== 2 || typeof p.amount !== "number" || !Number.isFinite(p.amount) || p.amount < 0 || p.amount > 2 || (p.palette !== "a" && p.palette !== "b")) {
        return { ok: false, issues: [{ code: "params", message: "Invalid params" }] };
      }
      return { ok: true, value: { amount: p.amount, palette: p.palette } };
    },
  },
  create() { throw new Error("CPU descriptor must never acquire GPU"); },
};

describe("material descriptor boundary", () => {
  it("exports full recipes and validates identity, versions, seed, keys and assets before use", () => {
    const binding = bindMaterial(definition);
    const recipe = binding.descriptor.presets[0]!.recipe;
    expect(recipe).toEqual({ kind: "novex-background", version: 1, effectId: "silk", effectVersion: 1,
      seed: 9, params: { amount: 1, palette: "a" }, assetIds: [] });
    expect(binding.descriptor.parseRecipe(recipe).ok).toBe(true);
    for (const patch of [{ version: 2 }, { effectId: "fluid" }, { effectVersion: 8 }, { seed: -1 },
      { seed: 0.5 }, { seed: Infinity }, { assetIds: ["https://evil.example/texture"] }, { code: "x" },
      { params: { amount: 99, palette: "a" } }]) {
      expect(binding.descriptor.parseRecipe({ ...recipe, ...patch }).ok).toBe(false);
    }
  });

  it("edits one allowlisted parameter atomically and leaves its source snapshot untouched", () => {
    const { descriptor } = bindMaterial(definition);
    const source = descriptor.presets[0]!.recipe;
    const result = descriptor.updateParameter(source, "amount", 1.5);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.params).toEqual({ amount: 1.5, palette: "a" });
    expect(source.params).toEqual({ amount: 1, palette: "a" });
    expect(descriptor.updateParameter(source, "amount", NaN).ok).toBe(false);
    expect(descriptor.updateParameter(source, "__proto__", "x").ok).toBe(false);
    expect(descriptor.readControls(result.value).map(item => item.value)).toEqual([1.5, "a"]);
  });
});
