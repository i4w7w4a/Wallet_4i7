import { describe, expect, it } from "vitest";
import { MONO_BACKGROUND_DEFAULTS, parseMonoBackgroundRecipe } from "../../mono-preview/mono-background-recipes";
import { createLibrary, parseLibrary, parseRecipeImport, saveTrial, readLegacyTrial, LIBRARY_KEY, LEGACY_KEY } from "./storage";

const parse = (value: unknown) => parseMonoBackgroundRecipe(JSON.stringify(value));
const recipe = { ...MONO_BACKGROUND_DEFAULTS.obsidian };
function memory() {
  const values = new Map<string, string>();
  return { values, getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
}

describe("named trials: independent snapshots and honest writes", () => {
  it("saves two names, updates only one, and reopens both after a fresh parse", () => {
    const store = memory();
    const first = saveTrial(store, null, createLibrary(), { name: "Тихий свет", recipe }, parse);
    const second = saveTrial(store, first.raw, first.library, { name: "Яркий свет", recipe: { ...recipe, intensity: .9 } }, parse);
    const third = saveTrial(store, second.raw, second.library, { id: first.trial.id, revision: 1, name: "Тихий свет", recipe: { ...recipe, intensity: .3 } }, parse);
    const restored = parseLibrary(store.getItem(LIBRARY_KEY)!, parse);
    expect(restored.trials.map(item => [item.name, item.revision, item.recipe.intensity])).toEqual([["Тихий свет", 2, .3], ["Яркий свет", 1, .9]]);
    expect(third.trial.revision).toBe(2);
    expect([...store.values.keys()]).toEqual([LIBRARY_KEY]);
  });

  it("rejects stale tabs and stale trial revisions without overwriting newer bytes", () => {
    const store = memory();
    const first = saveTrial(store, null, createLibrary(), { name: "Первая", recipe }, parse);
    const next = saveTrial(store, first.raw, first.library, { name: "Вторая", recipe }, parse);
    expect(() => saveTrial(store, first.raw, first.library, { name: "Устаревшая", recipe }, parse)).toThrow(/другой вкладке/);
    expect(() => saveTrial(store, next.raw, next.library, { id: first.trial.id, revision: 0, name: "Первая", recipe }, parse)).toThrow(/ревизия/);
    expect(store.getItem(LIBRARY_KEY)).toBe(next.raw);
  });

  it("propagates write failure and leaves the in-memory library and recipe intact", () => {
    const library = createLibrary<typeof recipe>();
    const store = { getItem: () => null, setItem: () => { throw new Error("QuotaExceeded"); } };
    expect(() => saveTrial(store, null, library, { name: "Не потерять", recipe }, parse)).toThrow(/сохран/);
    expect(library.trials).toEqual([]);
    expect(recipe.intensity).toBe(.6);
  });

  it("rejects duplicate names, unknown fields/versions, and more than 32 trials atomically", () => {
    const store = memory();
    let state = { library: createLibrary<typeof recipe>(), raw: null as string | null };
    for (let i = 0; i < 32; i++) state = saveTrial(store, state.raw, state.library, { name: `Проба ${i}`, recipe }, parse);
    const before = store.getItem(LIBRARY_KEY);
    expect(() => saveTrial(store, state.raw, state.library, { name: "Лишняя", recipe }, parse)).toThrow(/32/);
    expect(() => saveTrial(store, state.raw, state.library, { name: " проба 0 ", recipe }, parse)).toThrow(/имя/);
    expect(() => parseLibrary(JSON.stringify({ ...state.library, version: 9 }), parse)).toThrow();
    expect(() => parseLibrary(JSON.stringify({ ...state.library, wallet: "private" }), parse)).toThrow();
    expect(store.getItem(LIBRARY_KEY)).toBe(before);
  });
});

describe("strict recipe import and read-only legacy migration", () => {
  it("checks UTF-8 byte size before parsing and never accepts partial/unknown payloads", () => {
    expect(parseRecipeImport(JSON.stringify(recipe), parse)).toEqual(recipe);
    expect(() => parseRecipeImport('"' + "я".repeat(32768) + '"', parse)).toThrow(/64/);
    for (const value of [{ ...recipe, version: 7 }, { ...recipe, intensity: 2 }, { ...recipe, shader: "code" }, { ...recipe, intensity: null }]) {
      expect(() => parseRecipeImport(JSON.stringify(value), parse)).toThrow();
    }
  });

  it("offers the exact old CSS recipe without writing or reinterpreting its mechanism", () => {
    const store = memory();
    store.setItem(LEGACY_KEY, JSON.stringify({ ...recipe, recipe: "aperture", intensity: .73 }));
    store.setItem("wallet4i7.mono.working-presets.v2", "keep");
    const before = [...store.values];
    expect(readLegacyTrial(store)).toMatchObject({ recipe: "aperture", intensity: .73 });
    expect([...store.values]).toEqual(before);
  });
});
