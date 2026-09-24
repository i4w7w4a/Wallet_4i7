import { expect, it } from "vitest";
import { MONO_BACKGROUND_DEFAULTS, parseMonoBackgroundRecipe } from "../../mono-preview/mono-background-recipes";
import { createSandboxSession } from "./session";
import { LIBRARY_KEY, WORKSPACE_KEY } from "./storage";

const recipe = { ...MONO_BACKGROUND_DEFAULTS.obsidian };
const parse = (value: unknown) => parseMonoBackgroundRecipe(JSON.stringify(value));
const locked = async <T,>(task: () => T) => task();
function memory() {
  const values = new Map<string, string>();
  return { values, getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
}
function session(store = memory()) {
  const editor = createSandboxSession(recipe, "legacy-obsidian", parse);
  editor.connect(store, locked);
  return editor;
}

it("saves two names → switches → returns → reloads → compares without mixing data", async () => {
  const store = memory(), editor = session(store);
  editor.edit({ ...recipe, intensity: .25 });
  expect(await editor.save("Мягкий", true)).toBe(true);
  editor.edit({ ...recipe, intensity: .85 });
  expect(await editor.save("Яркий", true)).toBe(true);
  const [soft, bright] = editor.getSnapshot().library.trials;
  editor.openTrial(soft!);
  expect(editor.getSnapshot().workspace.slots[0].present.recipe.intensity).toBe(.25);
  editor.openTrial(bright!);
  await editor.flushRecovery();
  const restored = session(store);
  expect(restored.getSnapshot().workspace.slots[0].present.source?.name).toBe("Яркий");
  expect(restored.getSnapshot().workspace.slots[0].present.recipe.intensity).toBe(.85);
  restored.pin(soft!);
  await restored.flushRecovery();
  const bytes = [...store.values];
  restored.compare(true);
  expect(restored.shownRecipe().intensity).toBe(.25);
  restored.compare(false);
  expect(restored.shownRecipe().intensity).toBe(.85);
  await restored.flushRecovery();
  expect([...store.values]).toEqual(bytes);
});

it("reports quota and conflicts, keeps live edits, and never writes protected keys", async () => {
  const store = memory();
  store.setItem("wallet4i7.mono.working-presets.v2", "preserve");
  const a = session(store), b = session(store);
  await a.save("Из А", true);
  b.edit({ ...recipe, intensity: .77 });
  expect(await b.save("Из Б", true)).toBe(false);
  expect(b.getSnapshot().saveError).toMatch(/другой вкладке/);
  expect(b.getSnapshot().workspace.slots[0].present.recipe.intensity).toBe(.77);
  expect(store.getItem("wallet4i7.mono.working-presets.v2")).toBe("preserve");
  const failed = createSandboxSession(recipe, "legacy-obsidian", parse);
  failed.connect({ getItem: () => null, setItem: () => { throw new Error("quota"); } }, locked);
  expect(await failed.save("Не сохранено", true)).toBe(false);
  expect(failed.getSnapshot().workspace.slots[0].present.source).toBeNull();
  expect(failed.getSnapshot().saveError).toMatch(/сохран/);
  expect([...store.values.keys()].every(key => [LIBRARY_KEY, WORKSPACE_KEY, "wallet4i7.mono.working-presets.v2"].includes(key))).toBe(true);
});

it("preserves corrupt recovery bytes and does not claim workspace recovery is named Save", async () => {
  const store = memory();
  store.setItem(WORKSPACE_KEY, '{"version":999}');
  const editor = session(store);
  editor.edit({ ...recipe, intensity: .33 });
  await editor.flushRecovery();
  expect(store.getItem(WORKSPACE_KEY)).toBe('{"version":999}');
  expect(editor.getSnapshot().recoveryError).toBeTruthy();
  expect(store.getItem(LIBRARY_KEY)).toBeNull();
  expect(editor.getSnapshot().workspace.slots[0].present.source).toBeNull();
});

it("finishes a gesture before save and slot switch, preserving one undo and dormant drafts", async () => {
  const editor = session();
  editor.beginGesture(); editor.edit({ ...recipe, intensity: .2 }); editor.edit({ ...recipe, intensity: .3 });
  await editor.save("Одна транзакция", true);
  expect(editor.getSnapshot().workspace.slots[0].past).toHaveLength(1);
  editor.beginGesture(); editor.edit({ ...recipe, intensity: .4 }); editor.selectSlot(1);
  editor.selectSlot(0);
  editor.undo();
  expect(editor.shownRecipe().intensity).toBe(.3);
});

it("cannot overwrite another draft while a named Save waits for the storage lock", async () => {
  const store = memory();
  const editor = createSandboxSession(recipe, "legacy-obsidian", parse);
  let release: (() => void) | undefined;
  const gate = new Promise<void>(resolve => { release = resolve; });
  editor.connect(store, async task => { await gate; return task(); });
  editor.edit({ ...recipe, intensity: .44 });
  const saving = editor.save("Ожидает", true);
  editor.openRecipe({ ...recipe, intensity: .99 }, "import");
  editor.selectSlot(2);
  expect(editor.getSnapshot().workspace.activeSlot).toBe(0);
  expect(editor.shownRecipe().intensity).toBe(.44);
  release!();
  expect(await saving).toBe(true);
  expect(editor.getSnapshot().library.trials[0]?.recipe.intensity).toBe(.44);
});

it("disallows unsafe writes without Web Locks while preserving exportable edits", async () => {
  const store = memory();
  const editor = createSandboxSession(recipe, "legacy-obsidian", parse);
  editor.connect(store);
  editor.edit({ ...recipe, intensity: .7 });
  expect(await editor.save("Без блокировки", true)).toBe(false);
  expect(editor.getSnapshot().saveError).toMatch(/Web Locks/);
  expect(editor.shownRecipe().intensity).toBe(.7);
  expect(store.values.size).toBe(0);
});

it("does not carry a failed Save status into a different slot", async () => {
  const editor = createSandboxSession(recipe, "legacy-obsidian", parse);
  editor.connect({ getItem: () => null, setItem: () => { throw new Error("quota"); } }, locked);
  editor.edit({ ...recipe, intensity: .7 });
  await editor.save("Не записано", true);
  expect(editor.getSnapshot().saveError).toBeTruthy();
  editor.selectSlot(1);
  expect(editor.shownRecipe().intensity).toBe(.6);
  expect(editor.getSnapshot().saveError).toBe("");
});

it("does not turn an unchanged gesture into an A/B storage write", async () => {
  const store = memory(), editor = session(store);
  await editor.save("A", true);
  editor.pin(editor.getSnapshot().library.trials[0]!);
  await editor.flushRecovery();
  let writes = 0;
  const set = store.setItem;
  store.setItem = (key, value) => { writes++; set(key, value); };
  editor.beginGesture(); editor.compare(true);
  await editor.flushRecovery();
  expect(writes).toBe(0);
  expect(editor.getSnapshot().workspace.slots[0].past).toHaveLength(0);
});

it("does not reset the renderer on a current-slot click or unavailable Undo", () => {
  const editor = session();
  const restart = editor.getSnapshot().restartKey;
  editor.selectSlot(0); editor.undo();
  expect(editor.getSnapshot().restartKey).toBe(restart);
});

it("requires explicit fresh-start after an unavailable recovery instead of silently substituting a material", async () => {
  const store = memory();
  store.setItem(WORKSPACE_KEY, '{"version":999}');
  const editor = session(store);
  expect(editor.getSnapshot().recoveryUnavailable).toBe(true);
  editor.edit({ ...recipe, intensity: .9 });
  expect(editor.shownRecipe().intensity).toBe(.6);
  editor.startFresh();
  expect(editor.getSnapshot().recoveryUnavailable).toBe(false);
  editor.edit({ ...recipe, intensity: .9 });
  expect(editor.shownRecipe().intensity).toBe(.9);
  await editor.flushRecovery();
  expect(store.getItem(WORKSPACE_KEY)).toBe('{"version":999}');
});
