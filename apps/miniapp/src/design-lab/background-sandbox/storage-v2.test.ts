import { describe, expect, it } from "vitest";
import { MONO_BACKGROUND_DEFAULTS, parseMonoBackgroundRecipe } from "../../mono-preview/mono-background-recipes";
import { LIBRARY_KEY as V1_LIBRARY_KEY, WORKSPACE_KEY as V1_WORKSPACE_KEY } from "./storage";
import { V2_LIBRARY_KEY, V2_WORKSPACE_KEY, createLibraryV2, parseLibraryV2, readV1LibraryPreview, saveTrialV2 } from "./storage-v2";

const parse = (value: unknown) => parseMonoBackgroundRecipe(JSON.stringify(value));
const obsidian = { ...MONO_BACKGROUND_DEFAULTS.obsidian };
function memory() {
  const values = new Map<string, string>();
  return { values, getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
}

describe("v2 named library leaves valid v1 bytes untouched", () => {
  it("previews a v1 trial, then saves an independent full copy in v2", () => {
    const store = memory();
    const oldRaw = JSON.stringify({ version: 1, revision: 4, nextId: 3, trials: [
      { id: "trial-2", name: "Старый материал", revision: 2, recipe: { ...obsidian, intensity: .3 } },
    ] });
    store.setItem(V1_LIBRARY_KEY, oldRaw);
    store.setItem(V1_WORKSPACE_KEY, "old workspace bytes");
    const old = readV1LibraryPreview(store, parse);
    expect(old?.trials[0]?.recipe.intensity).toBe(.3);
    expect(store.getItem(V2_LIBRARY_KEY)).toBeNull();
    const saved = saveTrialV2(store, null, createLibraryV2(), { name: "Копия", recipe: old!.trials[0]!.recipe }, parse);
    expect(saved.trial).toMatchObject({ id: "trial-1", name: "Копия", revision: 1, recipe: { version: 1, intensity: .3 } });
    expect(parseLibraryV2(store.getItem(V2_LIBRARY_KEY)!, parse)).toEqual(saved.library);
    expect(store.getItem(V1_LIBRARY_KEY)).toBe(oldRaw);
    expect(store.getItem(V1_WORKSPACE_KEY)).toBe("old workspace bytes");
    expect(store.getItem(V2_WORKSPACE_KEY)).toBeNull();
  });

  it("keeps two v2 names and revisions independent after reload", () => {
    const store = memory();
    const a = saveTrialV2(store, null, createLibraryV2(), { name: "Один", recipe: { ...obsidian, intensity: .2 } }, parse);
    const b = saveTrialV2(store, a.raw, a.library, { name: "Два", recipe: { ...obsidian, intensity: .8 } }, parse);
    const updated = saveTrialV2(store, b.raw, b.library, { id: a.trial.id, revision: a.trial.revision, name: "Один", recipe: { ...obsidian, intensity: .4 } }, parse);
    expect(parseLibraryV2(store.getItem(V2_LIBRARY_KEY)!, parse).trials.map(trial => [trial.name, trial.revision, trial.recipe.intensity]))
      .toEqual([["Один", 2, .4], ["Два", 1, .8]]);
    expect(updated.library.version).toBe(2);
    expect(store.values.has(V1_LIBRARY_KEY)).toBe(false);
  });
});

describe("v2 storage refuses silent loss", () => {
  it("rejects stale-tab and stale-trial writes without claiming a new version", () => {
    const store = memory();
    const a = saveTrialV2(store, null, createLibraryV2(), { name: "А", recipe: obsidian }, parse);
    const b = saveTrialV2(store, a.raw, a.library, { name: "Б", recipe: obsidian }, parse);
    expect(() => saveTrialV2(store, a.raw, a.library, { name: "Устарело", recipe: obsidian }, parse)).toThrow(/другой вкладке/);
    expect(() => saveTrialV2(store, b.raw, b.library, { id: a.trial.id, revision: 0, name: "А", recipe: obsidian }, parse)).toThrow(/ревизия/);
    expect(store.getItem(V2_LIBRARY_KEY)).toBe(b.raw);
  });

  it("preserves the current library on quota failure, invalid recipe, duplicate name, or full capacity", () => {
    const store = memory();
    let state = { raw: null as string | null, library: createLibraryV2<typeof obsidian>() };
    for (let i = 0; i < 32; i++) state = saveTrialV2(store, state.raw, state.library, { name: `Проба ${i}`, recipe: obsidian }, parse);
    const before = store.getItem(V2_LIBRARY_KEY);
    expect(() => saveTrialV2(store, state.raw, state.library, { name: "Лишняя", recipe: obsidian }, parse)).toThrow(/32/);
    expect(() => saveTrialV2(store, state.raw, state.library, { name: " проба 0 ", recipe: obsidian }, parse)).toThrow(/имя/);
    expect(() => saveTrialV2(store, state.raw, state.library, { id: state.library.trials[0]!.id, revision: 1, name: "Проба 0", recipe: { ...obsidian, intensity: Number.NaN } }, parse)).toThrow();
    expect(store.getItem(V2_LIBRARY_KEY)).toBe(before);
    const quota = { getItem: () => null, setItem: () => { throw new Error("QuotaExceeded"); } };
    expect(() => saveTrialV2(quota, null, createLibraryV2(), { name: "Draft", recipe: obsidian }, parse)).toThrow(/сохран/);
  });

  it("rejects damaged/unknown v2 and old v1 envelopes atomically", () => {
    const store = memory();
    const library = createLibraryV2<typeof obsidian>();
    expect(() => parseLibraryV2(JSON.stringify({ ...library, version: 3 }), parse)).toThrow();
    expect(() => parseLibraryV2(JSON.stringify({ ...library, account: "private" }), parse)).toThrow();
    expect(() => parseLibraryV2(JSON.stringify({ ...library, trials: Array(33).fill({}) }), parse)).toThrow(/32/);
    expect(() => parseLibraryV2(JSON.stringify({ ...library, note: "я".repeat(262144) }), parse)).toThrow();
    store.setItem(V1_LIBRARY_KEY, '{"version":9}');
    expect(() => readV1LibraryPreview(store, parse)).toThrow();
    expect(store.getItem(V2_LIBRARY_KEY)).toBeNull();
  });
});
