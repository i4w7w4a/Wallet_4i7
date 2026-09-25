import { expect, it } from "vitest";
import { materialCatalogV2 } from "@wallet/ui";
import { liftV2Workspace, parseBackgroundDocument } from "./document-v3";
import { createWorkspace, editRecipe } from "./model";
import { isV2Recipe, type SandboxRecipe } from "./recipes";
import { MONO_BACKGROUND_DEFAULTS } from "../../mono-preview/mono-background-recipes";

const fluid = materialCatalogV2.materials.find(item => item.id === "fluid")!.presets[0]!.recipe;
const seedOf = (material: SandboxRecipe) => isV2Recipe(material) ? material.seed : null;
const parseMaterial = (input: unknown) => {
  const result = materialCatalogV2.parseRecipe(input);
  if (!result.ok) throw new Error(result.issues.map(issue => issue.message).join(" "));
  return result.value;
};

it.each([
  { version: 1, sideDarkening: "bad", inset: .1, softness: .1 },
  { version: 1, sideDarkening: .6, inset: .1 },
  { version: 1, sideDarkening: .6, inset: Number.NaN, softness: .1 },
])("rejects malformed full edge settings instead of silently replacing them with off: %j", edgeFinish => {
  expect(() => parseBackgroundDocument({ kind: "novex-background-lab", version: 1,
    material: fluid, edgeFinish }, parseMaterial)).toThrow(/Недопустимая отделка краёв/);
});

it("lifts all three v2 slots, undo frames, and pinned A without dropping source identity", () => {
  const source = createWorkspace(fluid, "material:fluid:2");
  source.slots[1] = editRecipe(source.slots[1], { ...fluid, seed: 31 });
  source.slots[2] = editRecipe(source.slots[2], { ...fluid, seed: 32 });
  source.activeSlot = 2;
  source.pinned = { id: "trial-1", name: "Старая A", revision: 4, recipe: fluid };
  const lifted = liftV2Workspace(source);
  expect(lifted.activeSlot).toBe(2);
  expect(lifted.slots.map(slot => seedOf(slot.present.recipe.material))).toEqual([fluid.seed, 31, 32]);
  expect(seedOf(lifted.slots[1].past[0]!.recipe.material)).toBe(fluid.seed);
  expect(lifted.slots[2].past[0]?.recipe.edgeFinish).toEqual({ version: 1, sideDarkening: 0, inset: 0, softness: 0 });
  expect(lifted.pinned).toMatchObject({ id: "trial-1", name: "Старая A", revision: 4,
    recipe: { material: fluid, edgeFinish: { version: 1, sideDarkening: 0, inset: 0, softness: 0 } } });
});

it("rejects inactive edge values on a legacy scene whose renderer cannot use them", () => {
  const legacy = { ...MONO_BACKGROUND_DEFAULTS.obsidian };
  expect(() => parseBackgroundDocument({ kind: "novex-background-lab", version: 1, material: legacy,
    edgeFinish: { version: 1, sideDarkening: 0, inset: .1, softness: 0 } }, () => legacy))
    .toThrow(/только для материалов v2/);
});
