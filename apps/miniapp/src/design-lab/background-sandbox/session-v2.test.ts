import { expect, it } from "vitest";
import { MONO_BACKGROUND_DEFAULTS, parseMonoBackgroundRecipe } from "../../mono-preview/mono-background-recipes";
import { createSandboxSession } from "./session";
import { LIBRARY_KEY as V1_LIBRARY_KEY, WORKSPACE_KEY as V1_WORKSPACE_KEY } from "./storage";
import { V2_LIBRARY_KEY, V2_WORKSPACE_KEY, parseLibraryV2 } from "./storage-v2";
import { parseWorkspaceV2 } from "./workspace-v2";

const recipe = { ...MONO_BACKGROUND_DEFAULTS.obsidian };
const parse = (value: unknown) => parseMonoBackgroundRecipe(JSON.stringify(value));
const locked = async <T,>(task: () => T) => task();
function memory() {
  const values = new Map<string, string>();
  return { values, getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
}

it("opens a fresh v2 session, saves a name, then recovers it without writing v1 or MONO keys", async () => {
  const store = memory();
  const oldLibrary = JSON.stringify({ version: 1, revision: 1, nextId: 2, trials: [
    { id: "trial-1", name: "Старая проба", revision: 1, recipe: { ...recipe, intensity: .21 } },
  ] });
  const oldWorkspace = '{"version":1,"old":"preserve"}';
  store.setItem(V1_LIBRARY_KEY, oldLibrary);
  store.setItem(V1_WORKSPACE_KEY, oldWorkspace);
  store.setItem("wallet4i7.mono.working-presets.v2", "untouched");
  const editor = createSandboxSession(recipe, "legacy-obsidian", parse, 2);
  editor.connect(store, locked);
  expect(editor.getSnapshot().library.version).toBe(2);
  expect(editor.getSnapshot().library.trials).toEqual([]);
  expect(editor.getSnapshot().workspace.slots[0].present.recipe.intensity).toBe(.6);
  editor.edit({ ...recipe, intensity: .75 });
  expect(await editor.save("Новая", true)).toBe(true);
  await editor.flushRecovery();
  expect(parseLibraryV2(store.getItem(V2_LIBRARY_KEY)!, parse).trials[0]?.recipe.intensity).toBe(.75);
  expect(parseWorkspaceV2(store.getItem(V2_WORKSPACE_KEY)!, parse).slots[0].present.source?.name).toBe("Новая");
  expect(store.getItem(V1_LIBRARY_KEY)).toBe(oldLibrary);
  expect(store.getItem(V1_WORKSPACE_KEY)).toBe(oldWorkspace);
  expect(store.getItem("wallet4i7.mono.working-presets.v2")).toBe("untouched");
  const reloaded = createSandboxSession(recipe, "legacy-obsidian", parse, 2);
  reloaded.connect(store, locked);
  expect(reloaded.getSnapshot().workspace.slots[0].present.recipe.intensity).toBe(.75);
  expect(reloaded.getSnapshot().workspace.slots[0].present.source?.name).toBe("Новая");
});

it("keeps a conflicting v2 draft in memory and never overwrites a newer tab", async () => {
  const store = memory();
  const a = createSandboxSession(recipe, "legacy-obsidian", parse, 2);
  const b = createSandboxSession(recipe, "legacy-obsidian", parse, 2);
  a.connect(store, locked); b.connect(store, locked);
  expect(await a.save("Первый", true)).toBe(true);
  const savedRaw = store.getItem(V2_LIBRARY_KEY);
  b.edit({ ...recipe, intensity: .8 });
  expect(await b.save("Второй", true)).toBe(false);
  expect(b.getSnapshot().saveError).toMatch(/другой вкладке/);
  expect(b.getSnapshot().workspace.slots[0].present.recipe.intensity).toBe(.8);
  expect(store.getItem(V2_LIBRARY_KEY)).toBe(savedRaw);
});
