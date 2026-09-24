import { expect, it } from "vitest";
import { MONO_BACKGROUND_DEFAULTS, parseMonoBackgroundRecipe } from "../../mono-preview/mono-background-recipes";
import { createWorkspace, editRecipe, finishGesture, undoSlot, openFrame, frameForTrial, markSaved, isDirty, parseWorkspace, pinTrial, selectSlot, freshFrame } from "./model";

const recipe = { ...MONO_BACKGROUND_DEFAULTS.obsidian };
const parse = (value: unknown) => parseMonoBackgroundRecipe(JSON.stringify(value));

it("keeps three slot drafts/history independent across 1 → 2 → 3 → 1 and recovery", () => {
  let workspace = createWorkspace(recipe, "obsidian");
  workspace.slots[0] = editRecipe(workspace.slots[0], { ...recipe, intensity: .8 });
  workspace = selectSlot(workspace, 1);
  workspace.slots[1] = editRecipe(workspace.slots[1], { ...recipe, intensity: .2 });
  workspace = selectSlot(selectSlot(workspace, 2), 0);
  const recovered = parseWorkspace(JSON.stringify(workspace), parse);
  expect(recovered.activeSlot).toBe(0);
  expect(recovered.slots.map(slot => slot.present.recipe.intensity)).toEqual([.8, .2, .6]);
  expect(undoSlot(recovered.slots[0]).present.recipe.intensity).toBe(.6);
  expect(recovered.slots[1].present.recipe.intensity).toBe(.2);
});

it("coalesces a gesture, restores it once, and clears redo on a new edit", () => {
  let slot = createWorkspace(recipe, "obsidian").slots[0];
  const before = slot.present;
  slot = editRecipe(slot, { ...recipe, intensity: .7 }, true);
  slot = editRecipe(slot, { ...recipe, intensity: .8 }, true);
  slot = finishGesture(slot, before);
  expect(slot.past).toHaveLength(1);
  slot = undoSlot(slot);
  expect(slot.present.recipe.intensity).toBe(.6);
  expect(undoSlot(slot, true).present.recipe.intensity).toBe(.8);
  slot = editRecipe(slot, { ...recipe, intensity: .4 });
  expect(slot.future).toHaveLength(0);
  for (let i = 0; i < 80; i++) slot = editRecipe(slot, { ...recipe, intensity: i / 100 });
  expect(slot.past).toHaveLength(50);
});

it("opens named trials atomically, retains material-local drafts and pins an immutable A", () => {
  let workspace = createWorkspace(recipe, "obsidian");
  let slot = editRecipe(workspace.slots[0], { ...recipe, intensity: .8 });
  const saved = { id: "trial-1", name: "Свет", revision: 1, recipe: { ...recipe, intensity: .8 } };
  slot = markSaved(slot, saved);
  expect(isDirty(slot)).toBe(false);
  slot = editRecipe(slot, { ...recipe, intensity: .9 });
  expect(isDirty(slot)).toBe(true);
  slot = openFrame(slot, freshFrame({ ...recipe, recipe: "aperture" }, "aperture"));
  expect(slot.drafts.find(frame => frame.key === "trial-1")?.recipe.intensity).toBe(.9);
  slot = openFrame(slot, frameForTrial(saved));
  expect(slot.present.recipe.intensity).toBe(.8);
  workspace = pinTrial(workspace, saved);
  saved.recipe.intensity = .1;
  expect(workspace.pinned?.recipe.intensity).toBe(.8);
  expect(workspace.slots[0].past).toHaveLength(0);
});

it("strict recovery rejects oversized histories, extra fields and invalid versions without partial repair", () => {
  const workspace = createWorkspace(recipe, "obsidian");
  for (const invalid of [{ ...workspace, version: 2 }, { ...workspace, activeSlot: 3 }, { ...workspace, secret: true }]) {
    expect(() => parseWorkspace(JSON.stringify(invalid), parse)).toThrow();
  }
  workspace.slots[0].past = Array(51).fill(workspace.slots[0].present);
  expect(() => parseWorkspace(JSON.stringify(workspace), parse)).toThrow(/50/);
});
