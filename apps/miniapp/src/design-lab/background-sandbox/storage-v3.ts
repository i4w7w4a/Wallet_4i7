import { boundedJson, exactObject, integer, parseSavedTrial,
  type RecipeParser, type SavedTrial, type StoragePort } from "./storage";

export const V3_LIBRARY_KEY = "wallet4i7.background-sandbox.library.v3";
export const V3_WORKSPACE_KEY = "wallet4i7.background-sandbox.workspace.v3";
export type TrialLibraryV3<R> = { version: 3; revision: number; nextId: number; trials: SavedTrial<R>[] };
export function createLibraryV3<R>(): TrialLibraryV3<R> { return { version: 3, revision: 0, nextId: 1, trials: [] }; }

export function parseLibraryV3<R>(raw: string, parse: RecipeParser<R>): TrialLibraryV3<R> {
  const data = exactObject(boundedJson(raw, 512 * 1024), ["version", "revision", "nextId", "trials"]);
  if (data.version !== 3) throw new Error("Версия библиотеки фонов не поддерживается.");
  if (!Array.isArray(data.trials) || data.trials.length > 32) throw new Error("В библиотеке не больше 32 проб.");
  const trials = data.trials.map(value => parseSavedTrial(value, parse));
  const nextId = integer(data.nextId, 1);
  if (new Set(trials.map(trial => trial.id)).size !== trials.length ||
    new Set(trials.map(trial => trial.name.toLowerCase())).size !== trials.length ||
    trials.some(trial => Number(trial.id.slice(6)) >= nextId)) {
    throw new Error("Повторяющийся ID или имя пробы.");
  }
  return { version: 3, revision: integer(data.revision), nextId, trials };
}

/** Caller owns a v3 Web Lock; a failed CAS never rewrites earlier namespaces. */
export function saveTrialV3<R>(store: StoragePort, expected: string | null, library: TrialLibraryV3<R>, request: {
  id?: string; revision?: number; name: string; recipe: R;
}, parse: RecipeParser<R>): { raw: string; library: TrialLibraryV3<R>; trial: SavedTrial<R> } {
  const current = parseLibraryV3(JSON.stringify(library), parse);
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
  const next: TrialLibraryV3<R> = { version: 3, revision: current.revision + 1, nextId: current.nextId + (previous ? 0 : 1),
    trials: previous ? current.trials.map(item => item.id === previous.id ? trial : item) : [...current.trials, trial] };
  const raw = JSON.stringify(next);
  const checked = parseLibraryV3(raw, parse);
  if (store.getItem(V3_LIBRARY_KEY) !== expected) {
    throw new Error("Библиотека изменилась в другой вкладке. Откройте её заново или экспортируйте draft.");
  }
  try {
    store.setItem(V3_LIBRARY_KEY, raw);
    if (store.getItem(V3_LIBRARY_KEY) !== raw) throw new Error("Write verification failed");
  } catch { throw new Error("Не удалось сохранить. Draft остаётся в памяти; доступен экспорт."); }
  return { raw, library: checked, trial: checked.trials.find(item => item.id === trial.id)! };
}
