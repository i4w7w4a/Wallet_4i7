import { expect, it } from "vitest";
import { MONO_BACKGROUND_DEFAULTS, parseMonoBackgroundRecipe } from "../../mono-preview/mono-background-recipes";
import { createWorkspace, editRecipe } from "./model";
import { WORKSPACE_KEY as V1_WORKSPACE_KEY } from "./storage";
import { V2_WORKSPACE_KEY } from "./storage-v2";
import { parseWorkspaceV2, persistWorkspaceV2, readV1WorkspacePreview } from "./workspace-v2";

const parse = (value: unknown) => parseMonoBackgroundRecipe(JSON.stringify(value));
const recipe = { ...MONO_BACKGROUND_DEFAULTS.obsidian };
function memory() {
  const values = new Map<string, string>();
  return { values, getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
}

it("writes a version-2 workspace without changing or silently adopting the old version-1 workspace", () => {
  const store = memory();
  const old = createWorkspace(recipe, "legacy-obsidian");
  old.slots[0] = editRecipe(old.slots[0], { ...recipe, intensity: .27 });
  const oldRaw = JSON.stringify(old);
  store.setItem(V1_WORKSPACE_KEY, oldRaw);
  const preview = readV1WorkspacePreview(store, parse);
  expect(preview?.slots[0].present.recipe.intensity).toBe(.27);
  expect(store.getItem(V2_WORKSPACE_KEY)).toBeNull();

  const fresh = createWorkspace(recipe, "legacy-obsidian");
  fresh.slots[1] = editRecipe(fresh.slots[1], { ...recipe, intensity: .91 });
  const raw = persistWorkspaceV2(store, null, fresh, parse);
  expect(JSON.parse(raw).version).toBe(2);
  expect(parseWorkspaceV2(raw, parse).slots.map(slot => slot.present.recipe.intensity)).toEqual([.6, .91, .6]);
  expect(store.getItem(V1_WORKSPACE_KEY)).toBe(oldRaw);
});

it("allows explicit restored old slots as a new independent workspace", () => {
  const store = memory();
  const old = createWorkspace(recipe, "legacy-obsidian");
  old.slots[2] = editRecipe(old.slots[2], { ...recipe, intensity: .44 });
  store.setItem(V1_WORKSPACE_KEY, JSON.stringify(old));
  const snapshot = readV1WorkspacePreview(store, parse)!;
  const raw = persistWorkspaceV2(store, null, snapshot, parse);
  expect(parseWorkspaceV2(raw, parse).slots[2].present.recipe.intensity).toBe(.44);
  expect(JSON.parse(store.getItem(V1_WORKSPACE_KEY)!).version).toBe(1);
});

it("refuses future/corrupt versions, 51 history entries, and unsafe competing writes", () => {
  const store = memory();
  const initial = createWorkspace(recipe, "legacy-obsidian");
  const raw = persistWorkspaceV2(store, null, initial, parse);
  expect(() => parseWorkspaceV2(JSON.stringify({ ...initial, version: 1 }), parse)).toThrow();
  expect(() => parseWorkspaceV2(JSON.stringify({ ...initial, version: 3 }), parse)).toThrow();
  expect(() => parseWorkspaceV2(JSON.stringify({ ...initial, version: 2, account: "private" }), parse)).toThrow();
  initial.slots[0].past = Array(51).fill(initial.slots[0].present);
  expect(() => persistWorkspaceV2(store, raw, initial, parse)).toThrow(/50/);
  expect(store.getItem(V2_WORKSPACE_KEY)).toBe(raw);
  const other = createWorkspace({ ...recipe, intensity: .2 }, "legacy-obsidian");
  expect(() => persistWorkspaceV2(store, null, other, parse)).toThrow(/другой вкладке/);
  expect(store.getItem(V2_WORKSPACE_KEY)).toBe(raw);
});

it("keeps the old raw workspace and live draft on quota failure", () => {
  const store = { getItem: (key: string) => key === V1_WORKSPACE_KEY ? "untouched v1" : null,
    setItem: () => { throw new Error("QuotaExceeded"); } };
  const draft = createWorkspace(recipe, "legacy-obsidian");
  draft.slots[0] = editRecipe(draft.slots[0], { ...recipe, intensity: .73 });
  expect(() => persistWorkspaceV2(store, null, draft, parse)).toThrow(/сохран/);
  expect(draft.slots[0].present.recipe.intensity).toBe(.73);
  expect(store.getItem(V1_WORKSPACE_KEY)).toBe("untouched v1");
});
