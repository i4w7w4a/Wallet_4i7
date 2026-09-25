import { boundedJson, exactObject, integer, LIBRARY_KEY, parseLibrary, parseSavedTrial,
  type RecipeParser, type SavedTrial, type StoragePort, type TrialLibrary } from "./storage";

export const V2_LIBRARY_KEY = "wallet4i7.background-sandbox.library.v2";
export const V2_WORKSPACE_KEY = "wallet4i7.background-sandbox.workspace.v2";
export type TrialLibraryV2<R> = { version: 2; revision: number; nextId: number; trials: SavedTrial<R>[] };
export function createLibraryV2<R>(): TrialLibraryV2<R> { return { version: 2, revision: 0, nextId: 1, trials: [] }; }

/** Unknown recipe revisions are delegated to the one allowlisted ABI parser. */
export function parseLibraryV2<R>(raw: string, parse: RecipeParser<R>): TrialLibraryV2<R> {
  const data = exactObject(boundedJson(raw, 512 * 1024), ["version", "revision", "nextId", "trials"]);
  if (data.version !== 2) throw new Error("Версия библиотеки фонов не поддерживается.");
  if (!Array.isArray(data.trials) || data.trials.length > 32) throw new Error("В библиотеке не больше 32 проб.");
  const trials = data.trials.map(value => parseSavedTrial(value, parse));
  const nextId = integer(data.nextId, 1);
  if (new Set(trials.map(trial => trial.id)).size !== trials.length ||
    new Set(trials.map(trial => trial.name.toLowerCase())).size !== trials.length ||
    trials.some(trial => Number(trial.id.slice(6)) >= nextId)) {
    throw new Error("Повторяющийся ID или имя пробы.");
  }
  return { version: 2, revision: integer(data.revision), nextId, trials };
}

/** An explicit preview, never migration-on-read. v1 bytes are never written here. */
export function readV1LibraryPreview<R>(store: StoragePort, parse: RecipeParser<R>): TrialLibrary<R> | null {
  const raw = store.getItem(LIBRARY_KEY);
  return raw === null ? null : parseLibrary(raw, parse);
}

function writeV2Checked(store: StoragePort, expected: string | null, raw: string) {
  let current: string | null;
  try { current = store.getItem(V2_LIBRARY_KEY); }
  catch { throw new Error("Не удалось прочитать библиотеку фонов. Draft остаётся в памяти."); }
  if (current !== expected) throw new Error("Библиотека изменилась в другой вкладке. Откройте её заново или экспортируйте draft.");
  try {
    store.setItem(V2_LIBRARY_KEY, raw);
    if (store.getItem(V2_LIBRARY_KEY) !== raw) throw new Error("Write verification failed");
  } catch { throw new Error("Не удалось сохранить. Draft остаётся в памяти; доступен экспорт."); }
}

/** Call under a background-v2 origin Web Lock; the old namespace stays read-only. */
export function saveTrialV2<R>(store: StoragePort, expected: string | null, library: TrialLibraryV2<R>, request: {
  id?: string; revision?: number; name: string; recipe: R;
}, parse: RecipeParser<R>): { raw: string; library: TrialLibraryV2<R>; trial: SavedTrial<R> } {
  const current = parseLibraryV2(JSON.stringify(library), parse);
  const previous = request.id ? current.trials.find(item => item.id === request.id) : undefined;
  if (request.id && (!previous || previous.revision !== request.revision)) {
    throw new Error("Сохранённая ревизия изменилась. Откройте пробу заново или сохраните копию.");
  }
  const trial = parseSavedTrial({ id: previous?.id ?? `trial-${current.nextId}`, name: request.name,
    revision: (previous?.revision ?? 0) + 1, recipe: request.recipe }, parse);
  if (current.trials.some(item => item.id !== trial.id && item.name.toLowerCase() === trial.name.toLowerCase())) {
    throw new Error("Это имя уже занято. Выберите другое имя.");
  }
  if (!previous && current.trials.length >= 32) throw new Error("Достигнут предел: 32 именованные пробы. Доступен экспорт JSON.");
  const next: TrialLibraryV2<R> = { version: 2, revision: current.revision + 1, nextId: current.nextId + (previous ? 0 : 1),
    trials: previous ? current.trials.map(item => item.id === previous.id ? trial : item) : [...current.trials, trial] };
  const raw = JSON.stringify(next);
  const checked = parseLibraryV2(raw, parse);
  writeV2Checked(store, expected, raw);
  return { raw, library: checked, trial: checked.trials.find(item => item.id === trial.id)! };
}
