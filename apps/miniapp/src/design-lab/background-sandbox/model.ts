import { boundedJson, exactObject, integer, parseSavedTrial, type RecipeParser, type SavedTrial } from "./storage";
export type TrialBinding = Pick<SavedTrial<never>, "id" | "name" | "revision">;
export type EditorFrame<R> = { key: string; recipe: R; baseline: R; source: TrialBinding | null };
export type SandboxSlot<R> = { present: EditorFrame<R>; drafts: EditorFrame<R>[]; past: EditorFrame<R>[]; future: EditorFrame<R>[] };
export type SandboxWorkspace<R> = { version: 1; activeSlot: number; slots: [SandboxSlot<R>, SandboxSlot<R>, SandboxSlot<R>]; pinned: SavedTrial<R> | null };
const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
export function freshFrame<R>(recipe: R, key: string): EditorFrame<R> {
  return { key, recipe: copy(recipe), baseline: copy(recipe), source: null };
}
export function createWorkspace<R>(recipe: R, key: string): SandboxWorkspace<R> {
  const slot = (): SandboxSlot<R> => ({ present: freshFrame(recipe, key), drafts: [], past: [], future: [] });
  return { version: 1, activeSlot: 0, slots: [slot(), slot(), slot()], pinned: null };
}
export function editRecipe<R>(slot: SandboxSlot<R>, recipe: R, transient = false): SandboxSlot<R> {
  if (equal(slot.present.recipe, recipe)) return slot;
  return { ...slot, present: { ...slot.present, recipe: copy(recipe) },
    past: transient ? slot.past : [...slot.past, slot.present].slice(-50), future: transient ? slot.future : [] };
}
export function finishGesture<R>(slot: SandboxSlot<R>, before: EditorFrame<R>): SandboxSlot<R> {
  return equal(slot.present, before) ? slot : { ...slot, past: [...slot.past, copy(before)].slice(-50), future: [] };
}
function replaceFrame<R>(slot: SandboxSlot<R>, frame: EditorFrame<R>): SandboxSlot<R> {
  const drafts = slot.drafts.filter(item => item.key !== frame.key && item.key !== slot.present.key);
  if (frame.key !== slot.present.key) drafts.push(copy(slot.present));
  if (drafts.length > 40) throw new Error("Слишком много черновиков в slot. Сохраните нужные пробы.");
  return { ...slot, present: copy(frame), drafts };
}
export function undoSlot<R>(slot: SandboxSlot<R>, redo = false): SandboxSlot<R> {
  const stack = redo ? slot.future : slot.past;
  const frame = stack.at(-1);
  if (!frame) return slot;
  return { ...replaceFrame(slot, frame),
    past: redo ? [...slot.past, slot.present].slice(-50) : slot.past.slice(0, -1),
    future: redo ? slot.future.slice(0, -1) : [...slot.future, slot.present].slice(-50) };
}
export function openFrame<R>(slot: SandboxSlot<R>, frame: EditorFrame<R>): SandboxSlot<R> {
  if (equal(slot.present, frame)) return slot;
  return { ...replaceFrame(slot, frame), past: [...slot.past, slot.present].slice(-50), future: [] };
}
export function frameForTrial<R>(trial: SavedTrial<R>): EditorFrame<R> {
  return { ...freshFrame(trial.recipe, trial.id), source: { id: trial.id, name: trial.name, revision: trial.revision } };
}
export function markSaved<R>(slot: SandboxSlot<R>, trial: SavedTrial<R>): SandboxSlot<R> {
  return replaceFrame(slot, frameForTrial(trial));
}
export function isDirty<R>(slot: SandboxSlot<R>): boolean { return !equal(slot.present.recipe, slot.present.baseline); }

export function parseWorkspace<R>(raw: string, parse: RecipeParser<R>): SandboxWorkspace<R> {
  const data = exactObject(boundedJson(raw, 1024 * 1024), ["version", "activeSlot", "slots", "pinned"]);
  if (data.version !== 1) throw new Error("Версия workspace не поддерживается.");
  function frame(value: unknown): EditorFrame<R> {
    const item = exactObject(value, ["key", "recipe", "baseline", "source"]);
    if (typeof item.key !== "string" || !/^[a-z][a-z0-9:-]{0,63}$/.test(item.key)) throw new Error("Неизвестный ID draft.");
    const baseline = parse(item.baseline);
    let source: TrialBinding | null = null;
    if (item.source !== null) {
      const binding = exactObject(item.source, ["id", "name", "revision"]);
      const trial = parseSavedTrial({ ...binding, recipe: baseline }, parse);
      source = { id: trial.id, name: trial.name, revision: trial.revision };
      if (source.id !== item.key) throw new Error("ID draft и пробы не совпадают.");
    }
    return { key: item.key, recipe: parse(item.recipe), baseline, source };
  }
  function frames(value: unknown, max: number): EditorFrame<R>[] {
    if (!Array.isArray(value) || value.length > max) throw new Error(`Предел истории: ${max}.`);
    return value.map(frame);
  }
  function slot(value: unknown): SandboxSlot<R> {
    const item = exactObject(value, ["present", "drafts", "past", "future"]);
    const present = frame(item.present), drafts = frames(item.drafts, 40), past = frames(item.past, 50), future = frames(item.future, 50);
    if (past.length + future.length > 50) throw new Error("Предел истории: 50.");
    if (new Set([present.key, ...drafts.map(value => value.key)]).size !== drafts.length + 1) throw new Error("Повторяющийся draft.");
    return { present, drafts, past, future };
  }
  if (!Array.isArray(data.slots) || data.slots.length !== 3) throw new Error("Нужны три независимых slot.");
  return { version: 1, activeSlot: integer(data.activeSlot, 0, 2), slots: [slot(data.slots[0]), slot(data.slots[1]), slot(data.slots[2])],
    pinned: data.pinned === null ? null : parseSavedTrial(data.pinned, parse) };
}
export function pinTrial<R>(workspace: SandboxWorkspace<R>, trial: SavedTrial<R>): SandboxWorkspace<R> {
  return { ...workspace, pinned: copy(trial) };
}
export function selectSlot<R>(workspace: SandboxWorkspace<R>, index: number): SandboxWorkspace<R> {
  return { ...workspace, activeSlot: integer(index, 0, 2) };
}
