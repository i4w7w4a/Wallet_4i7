import { expect, test } from "vitest";
import { createButtonDocument } from "./model";
import { createButtonLibrary, saveButtonTrial, LIBRARY_KEY } from "./storage";

const ACTIONS = ["send", "receive", "exchange", "buy"] as const;
type Recipe = { effectId: "liquid-metal"; params: { tint: string } };
const parse = (value: unknown): Recipe => value as Recipe;
function memoryStorage() {
  const values = new Map<string, string>();
  return { values, getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
}

test("revision checks reject stale writes and preserve existing library bytes", () => {
  const store = memoryStorage();
  const document = createButtonDocument<typeof ACTIONS[number], Recipe>(ACTIONS);
  const first = saveButtonTrial(store, null, createButtonLibrary(), { name: "First", document }, ACTIONS, parse);
  expect(first.trial.revision).toBe(1);
  expect(() => saveButtonTrial(store, null, first.library, { name: "Stale", document }, ACTIONS, parse)).toThrow(/другой вкладке/);
  expect(store.values.get(LIBRARY_KEY)).toBe(first.raw);
  const updated = saveButtonTrial(store, first.raw, first.library,
    { id: first.trial.id, revision: first.trial.revision, name: "First", document }, ACTIONS, parse);
  expect(updated.trial.revision).toBe(2);
  expect(updated.library.trials).toHaveLength(1);
});

test("named library stops at 32 trials without losing exportable draft", () => {
  const store = memoryStorage();
  const document = createButtonDocument<typeof ACTIONS[number], Recipe>(ACTIONS);
  let raw: string | null = null;
  let library = createButtonLibrary<typeof ACTIONS[number], Recipe>();
  for (let index = 0; index < 32; index++) ({ raw, library } = saveButtonTrial(store, raw, library,
    { name: `Trial ${index}`, document }, ACTIONS, parse));
  expect(() => saveButtonTrial(store, raw, library, { name: "Trial 33", document }, ACTIONS, parse)).toThrow(/32/);
  expect(store.values.get(LIBRARY_KEY)).toBe(raw);
});
