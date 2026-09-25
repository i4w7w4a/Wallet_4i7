import { copyButtonValue, type ButtonLabDocument, type ButtonLabFrame, type ButtonLabSlot,
  type ButtonLabWorkspace, type ButtonLayer, type ButtonSavedTrial } from "./model";

export type ButtonRecipeParser<R, A extends string = string> = (input: unknown, layer: ButtonLayer, target: A) => R;
export type ButtonTrialLibrary<A extends string, R> = {
  version: 1; revision: number; nextId: number; trials: ButtonSavedTrial<A, R>[];
};

export function exactButtonObject(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
    Object.keys(value).length !== keys.length || !keys.every(key => Object.hasOwn(value, key))) {
    throw new Error("Нужны полные данные без дополнительных полей.");
  }
  return value as Record<string, unknown>;
}

export function boundedButtonJson(raw: string, maxBytes: number): unknown {
  if (new TextEncoder().encode(raw).byteLength > maxBytes) throw new Error(`Превышен предел ${maxBytes / 1024} KiB.`);
  try { return JSON.parse(raw) as unknown; } catch { throw new Error("Некорректный JSON."); }
}

function integer(value: unknown, min: number, max = Number.MAX_SAFE_INTEGER): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max) throw new Error("Недопустимое целое значение.");
  return value;
}

function trialName(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || [...value.trim()].length > 64 || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new Error("Введите имя от 1 до 64 символов без управляющих знаков.");
  }
  return value.trim();
}

export function parseButtonDocument<A extends string, R>(input: unknown, actionIds: readonly A[], parseRecipe: ButtonRecipeParser<R, A>): ButtonLabDocument<A, R> {
  const data = exactButtonObject(input, ["version", "actions"]);
  if (data.version !== 1) throw new Error("Версия ButtonLabDocument не поддерживается.");
  if (actionIds.length !== 4 || new Set(actionIds).size !== 4) throw new Error("Нужны четыре действия MONO.");
  const actions = exactButtonObject(data.actions, actionIds);
  const parsed = {} as ButtonLabDocument<A, R>["actions"];
  for (const action of actionIds) {
    const layers = exactButtonObject(actions[action], ["fill", "icon", "border"]);
    parsed[action] = {
      fill: layers.fill === null ? null : copyButtonValue(parseRecipe(layers.fill, "fill", action)),
      icon: layers.icon === null ? null : copyButtonValue(parseRecipe(layers.icon, "icon", action)),
      border: layers.border === null ? null : copyButtonValue(parseRecipe(layers.border, "border", action)),
    };
  }
  return { version: 1, actions: parsed };
}

export function parseButtonImport<A extends string, R>(raw: string, actionIds: readonly A[], parseRecipe: ButtonRecipeParser<R, A>): ButtonLabDocument<A, R> {
  return parseButtonDocument(boundedButtonJson(raw, 64 * 1024), actionIds, parseRecipe);
}

export function parseButtonTrial<A extends string, R>(input: unknown, actionIds: readonly A[], parseRecipe: ButtonRecipeParser<R, A>): ButtonSavedTrial<A, R> {
  const data = exactButtonObject(input, ["id", "name", "revision", "document"]);
  if (typeof data.id !== "string" || !/^trial-[1-9]\d{0,14}$/.test(data.id)) throw new Error("Неизвестный ID пробы.");
  return { id: data.id, name: trialName(data.name), revision: integer(data.revision, 1),
    document: parseButtonDocument(data.document, actionIds, parseRecipe) };
}

export function parseButtonLibrary<A extends string, R>(raw: string, actionIds: readonly A[], parseRecipe: ButtonRecipeParser<R, A>): ButtonTrialLibrary<A, R> {
  const data = exactButtonObject(boundedButtonJson(raw, 512 * 1024), ["version", "revision", "nextId", "trials"]);
  if (data.version !== 1) throw new Error("Версия библиотеки кнопок не поддерживается.");
  if (!Array.isArray(data.trials) || data.trials.length > 32) throw new Error("В библиотеке не больше 32 проб.");
  const trials = data.trials.map(value => parseButtonTrial(value, actionIds, parseRecipe));
  if (new Set(trials.map(value => value.id)).size !== trials.length ||
    new Set(trials.map(value => value.name.toLowerCase())).size !== trials.length) throw new Error("Повторяющийся ID или имя пробы.");
  const nextId = integer(data.nextId, 1);
  if (trials.some(value => Number(value.id.slice(6)) >= nextId)) throw new Error("Недопустимый следующий ID пробы.");
  return { version: 1, revision: integer(data.revision, 0), nextId, trials };
}

export function parseButtonWorkspace<A extends string, R>(raw: string, actionIds: readonly A[], parseRecipe: ButtonRecipeParser<R, A>): ButtonLabWorkspace<A, R> {
  const data = exactButtonObject(boundedButtonJson(raw, 1024 * 1024), ["version", "activeSlot", "selection", "slots", "pinned"]);
  if (data.version !== 1) throw new Error("Версия workspace кнопок не поддерживается.");
  const selection = exactButtonObject(data.selection, ["target", "layer"]);
  if (selection.target !== "all" && !actionIds.includes(selection.target as A)) throw new Error("Неизвестная кнопка.");
  if (selection.layer !== "fill" && selection.layer !== "icon" && selection.layer !== "border") throw new Error("Неизвестный слой кнопки.");
  function frame(input: unknown): ButtonLabFrame<A, R> {
    const item = exactButtonObject(input, ["document", "baseline", "source"]);
    const document = parseButtonDocument(item.document, actionIds, parseRecipe);
    const baseline = parseButtonDocument(item.baseline, actionIds, parseRecipe);
    const source = item.source === null ? null : exactButtonObject(item.source, ["id", "name", "revision"]);
    const binding = source === null ? null : parseButtonTrial({ ...source, document: baseline }, actionIds, parseRecipe);
    return { document, baseline, source: binding === null ? null : { id: binding.id, name: binding.name, revision: binding.revision } };
  }
  function slot(input: unknown): ButtonLabSlot<A, R> {
    const item = exactButtonObject(input, ["present", "past", "future"]);
    if (!Array.isArray(item.past) || !Array.isArray(item.future) || item.past.length + item.future.length > 50) throw new Error("Предел истории: 50.");
    return { present: frame(item.present), past: item.past.map(frame), future: item.future.map(frame) };
  }
  if (!Array.isArray(data.slots) || data.slots.length !== 3) throw new Error("Нужны три независимых slot.");
  return { version: 1, activeSlot: integer(data.activeSlot, 0, 2),
    selection: { target: selection.target as A | "all", layer: selection.layer },
    slots: [slot(data.slots[0]), slot(data.slots[1]), slot(data.slots[2])],
    pinned: data.pinned === null ? null : parseButtonTrial(data.pinned, actionIds, parseRecipe) };
}
