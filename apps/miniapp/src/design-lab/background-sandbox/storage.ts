import { parseMonoBackgroundRecipe } from "../../mono-preview/mono-background-recipes";

export const LIBRARY_KEY = "wallet4i7.background-sandbox.library.v1";
export const WORKSPACE_KEY = "wallet4i7.background-sandbox.workspace.v1";
export const LEGACY_KEY = "wallet4i7.mono.atmosphere-lab.v1";
export type StoragePort = Pick<Storage, "getItem" | "setItem">;
export type RecipeParser<R> = (value: unknown) => R;
export type SavedTrial<R> = { id: string; name: string; revision: number; recipe: R };
export type TrialLibrary<R> = { version: 1; revision: number; nextId: number; trials: SavedTrial<R>[] };
export function createLibrary<R>(): TrialLibrary<R> { return { version: 1, revision: 0, nextId: 1, trials: [] }; }

export function exactObject(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
    Object.keys(value).length !== keys.length || !keys.every(key => Object.hasOwn(value, key))) {
    throw new Error("Нужны полные данные без дополнительных полей.");
  }
  return value as Record<string, unknown>;
}
export function integer(value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max) throw new Error("Недопустимое целое значение.");
  return value;
}
export function boundedJson(raw: string, maxBytes: number): unknown {
  if (new TextEncoder().encode(raw).byteLength > maxBytes) throw new Error(`Превышен предел ${maxBytes / 1024} KiB.`);
  try { return JSON.parse(raw) as unknown; } catch { throw new Error("Некорректный JSON."); }
}
function trialName(value: unknown) {
  if (typeof value !== "string" || !value.trim() || [...value.trim()].length > 64 || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new Error("Введите имя от 1 до 64 символов без управляющих знаков.");
  }
  return value.trim();
}
export function parseSavedTrial<R>(value: unknown, parse: RecipeParser<R>): SavedTrial<R> {
  const data = exactObject(value, ["id", "name", "revision", "recipe"]);
  if (typeof data.id !== "string" || !/^trial-[1-9]\d{0,14}$/.test(data.id)) throw new Error("Неизвестный ID пробы.");
  return { id: data.id, name: trialName(data.name), revision: integer(data.revision, 1), recipe: parse(data.recipe) };
}
export function parseLibrary<R>(raw: string, parse: RecipeParser<R>): TrialLibrary<R> {
  const data = exactObject(boundedJson(raw, 512 * 1024), ["version", "revision", "nextId", "trials"]);
  if (data.version !== 1) throw new Error("Версия библиотеки не поддерживается.");
  if (!Array.isArray(data.trials) || data.trials.length > 32) throw new Error("В библиотеке не больше 32 проб.");
  const trials = data.trials.map(value => parseSavedTrial(value, parse));
  const ids = new Set(trials.map(trial => trial.id));
  const names = new Set(trials.map(trial => trial.name.toLowerCase()));
  const nextId = integer(data.nextId, 1);
  if (ids.size !== trials.length || names.size !== trials.length || trials.some(trial => Number(trial.id.slice(6)) >= nextId)) {
    throw new Error("Повторяющийся ID или имя пробы.");
  }
  return { version: 1, revision: integer(data.revision), nextId, trials };
}
export function parseRecipeImport<R>(raw: string, parse: RecipeParser<R>): R {
  return parse(boundedJson(raw, 64 * 1024));
}
export function readLegacyTrial(store: StoragePort): ReturnType<typeof parseMonoBackgroundRecipe> | null {
  const raw = store.getItem(LEGACY_KEY);
  return raw === null ? null : parseMonoBackgroundRecipe(raw);
}

/** Call under the origin's Web Lock. Raw-byte/revision checks also catch old clients. */
export function writeChecked(store: StoragePort, key: typeof LIBRARY_KEY | typeof WORKSPACE_KEY, expected: string | null, raw: string) {
  let current: string | null;
  try { current = store.getItem(key); } catch { throw new Error("Не удалось прочитать хранилище. Draft остаётся в памяти."); }
  if (current !== expected) throw new Error("Данные изменены в другой вкладке. Откройте библиотеку заново или экспортируйте draft.");
  try {
    store.setItem(key, raw);
    if (store.getItem(key) !== raw) throw new Error("Write verification failed");
  } catch { throw new Error("Не удалось сохранить. Draft остаётся в памяти; доступен экспорт."); }
}

export function saveTrial<R>(store: StoragePort, expected: string | null, library: TrialLibrary<R>, request: {
  id?: string; revision?: number; name: string; recipe: R;
}, parse: RecipeParser<R>): { raw: string; library: TrialLibrary<R>; trial: SavedTrial<R> } {
  const name = trialName(request.name);
  const recipe = parse(request.recipe);
  const previous = request.id ? library.trials.find(item => item.id === request.id) : undefined;
  if (request.id && (!previous || previous.revision !== request.revision)) throw new Error("Сохранённая ревизия изменилась. Откройте пробу заново или сохраните копию.");
  if (library.trials.some(item => item.id !== request.id && item.name.toLowerCase() === name.toLowerCase())) throw new Error("Это имя уже занято. Выберите другое имя.");
  if (!previous && library.trials.length >= 32) throw new Error("Достигнут предел: 32 именованные пробы. Доступен экспорт JSON.");
  const trial: SavedTrial<R> = { id: previous?.id ?? `trial-${library.nextId}`, name, revision: (previous?.revision ?? 0) + 1, recipe };
  const next: TrialLibrary<R> = { version: 1, revision: library.revision + 1, nextId: library.nextId + (previous ? 0 : 1),
    trials: previous ? library.trials.map(item => item.id === previous.id ? trial : item) : [...library.trials, trial] };
  const raw = JSON.stringify(next);
  const checked = parseLibrary(raw, parse);
  writeChecked(store, LIBRARY_KEY, expected, raw);
  return { raw, library: checked, trial: checked.trials.find(item => item.id === trial.id)! };
}
