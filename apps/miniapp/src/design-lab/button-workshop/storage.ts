import { parseButtonDocument, parseButtonLibrary, type ButtonRecipeParser, type ButtonTrialLibrary } from "./codec";
import type { ButtonLabDocument, ButtonSavedTrial } from "./model";

export const ACCEPTED_KEY = "wallet4i7.button-sandbox.accepted.v1";
export const WORKSPACE_KEY = "wallet4i7.button-sandbox.workspace.v1";
export const LIBRARY_KEY = "wallet4i7.button-sandbox.library.v1";
export type ButtonStoragePort = Pick<Storage, "getItem" | "setItem">;

export function createButtonLibrary<A extends string, R>(): ButtonTrialLibrary<A, R> {
  return { version: 1, revision: 0, nextId: 1, trials: [] };
}

/** Execute under a Web Lock. Byte comparison also catches clients that bypass it. */
export function writeButtonChecked(store: ButtonStoragePort, key: string, expected: string | null, raw: string): void {
  let current: string | null;
  try { current = store.getItem(key); } catch { throw new Error("Не удалось прочитать хранилище. Черновик остаётся в памяти."); }
  if (current !== expected) throw new Error("Данные изменены в другой вкладке. Обновите библиотеку или экспортируйте черновик.");
  try {
    store.setItem(key, raw);
    if (store.getItem(key) !== raw) throw new Error("Write verification failed");
  } catch { throw new Error("Не удалось сохранить. Черновик остаётся в памяти; доступен экспорт."); }
}

function trialName(value: string): string {
  if (!value.trim() || [...value.trim()].length > 64 || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new Error("Введите имя от 1 до 64 символов без управляющих знаков.");
  }
  return value.trim();
}

export function saveButtonTrial<A extends string, R>(store: ButtonStoragePort, expected: string | null,
  library: ButtonTrialLibrary<A, R>, request: { id?: string; revision?: number; name: string; document: ButtonLabDocument<A, R> },
  actionIds: readonly A[], parseRecipe: ButtonRecipeParser<R>): { raw: string; library: ButtonTrialLibrary<A, R>; trial: ButtonSavedTrial<A, R> } {
  const name = trialName(request.name);
  const document = parseButtonDocument(request.document, actionIds, parseRecipe);
  const prior = request.id ? library.trials.find(item => item.id === request.id) : undefined;
  if (request.id && (!prior || prior.revision !== request.revision)) throw new Error("Сохранённая ревизия изменилась. Откройте пробу заново или сохраните копию.");
  if (library.trials.some(item => item.id !== request.id && item.name.toLowerCase() === name.toLowerCase())) throw new Error("Это имя уже занято. Выберите другое имя.");
  if (!prior && library.trials.length >= 32) throw new Error("Достигнут предел: 32 именованные пробы. Доступен экспорт JSON.");
  const trial: ButtonSavedTrial<A, R> = { id: prior?.id ?? `trial-${library.nextId}`, name,
    revision: (prior?.revision ?? 0) + 1, document };
  const next: ButtonTrialLibrary<A, R> = { version: 1, revision: library.revision + 1,
    nextId: library.nextId + (prior ? 0 : 1),
    trials: prior ? library.trials.map(item => item.id === prior.id ? trial : item) : [...library.trials, trial] };
  const raw = JSON.stringify(next);
  const checked = parseButtonLibrary(raw, actionIds, parseRecipe);
  writeButtonChecked(store, LIBRARY_KEY, expected, raw);
  return { raw, library: checked, trial: checked.trials.find(item => item.id === trial.id)! };
}
