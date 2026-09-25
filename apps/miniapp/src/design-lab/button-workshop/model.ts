/** Editor state for the four real MonoScene quick actions. Recipes are supplied by the shared material registry. */
export type ButtonLayer = "fill" | "icon" | "border";
export type ButtonTarget<A extends string> = A | "all";
export type ButtonLayers<R> = Record<ButtonLayer, R | null>;
export type ButtonLabDocument<A extends string, R> = { version: 1; actions: Record<A, ButtonLayers<R>> };
export type ButtonTrialBinding = { id: string; name: string; revision: number };
export type ButtonLabFrame<A extends string, R> = {
  document: ButtonLabDocument<A, R>;
  baseline: ButtonLabDocument<A, R>;
  source: ButtonTrialBinding | null;
};
export type ButtonLabSlot<A extends string, R> = {
  present: ButtonLabFrame<A, R>;
  past: ButtonLabFrame<A, R>[];
  future: ButtonLabFrame<A, R>[];
};
export type ButtonSavedTrial<A extends string, R> = ButtonTrialBinding & { document: ButtonLabDocument<A, R> };
export type ButtonLabWorkspace<A extends string, R> = {
  version: 1;
  activeSlot: number;
  selection: { target: ButtonTarget<A>; layer: ButtonLayer };
  slots: [ButtonLabSlot<A, R>, ButtonLabSlot<A, R>, ButtonLabSlot<A, R>];
  pinned: ButtonSavedTrial<A, R> | null;
};

export const copyButtonValue = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const equal = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);

export function createButtonDocument<A extends string, R>(actionIds: readonly A[]): ButtonLabDocument<A, R> {
  if (actionIds.length !== 4 || new Set(actionIds).size !== 4 || actionIds.includes("all" as A)) {
    throw new Error("Нужны четыре уникальных действия MONO.");
  }
  return { version: 1, actions: Object.fromEntries(actionIds.map(id => [id, { fill: null, icon: null, border: null }])) as Record<A, ButtonLayers<R>> };
}

export function createButtonWorkspace<A extends string, R>(actionIds: readonly A[], initialDraft?: ButtonLabDocument<A, R>): ButtonLabWorkspace<A, R> {
  const initial = initialDraft ? copyButtonValue(initialDraft) : createButtonDocument<A, R>(actionIds);
  const slot = (): ButtonLabSlot<A, R> => ({ present: { document: copyButtonValue(initial), baseline: copyButtonValue(initial), source: null }, past: [], future: [] });
  return { version: 1, activeSlot: 0, selection: { target: "all", layer: "fill" }, slots: [slot(), slot(), slot()], pinned: null };
}

export function editButtonBinding<A extends string, R>(document: ButtonLabDocument<A, R>, actionIds: readonly A[],
  target: ButtonTarget<A>, layer: ButtonLayer, binding: R | ((action: A) => R | null) | null): ButtonLabDocument<A, R> {
  if (layer !== "fill" && layer !== "icon" && layer !== "border") throw new Error("Неизвестный слой кнопки.");
  if (target !== "all" && !actionIds.includes(target as A)) throw new Error("Неизвестная кнопка.");
  const next = copyButtonValue(document);
  for (const action of target === "all" ? actionIds : [target as A]) {
    const value = typeof binding === "function" ? (binding as (action: A) => R | null)(action) : binding;
    next.actions[action][layer] = copyButtonValue(value);
  }
  return next;
}

export function editButtonSlot<A extends string, R>(slot: ButtonLabSlot<A, R>, document: ButtonLabDocument<A, R>, transient = false): ButtonLabSlot<A, R> {
  if (equal(slot.present.document, document)) return slot;
  return { present: { ...slot.present, document: copyButtonValue(document) },
    past: transient ? slot.past : [...slot.past, copyButtonValue(slot.present)].slice(-50),
    future: transient ? slot.future : [] };
}

export function finishButtonGesture<A extends string, R>(slot: ButtonLabSlot<A, R>, before: ButtonLabFrame<A, R>): ButtonLabSlot<A, R> {
  return equal(slot.present, before) ? slot : { ...slot, past: [...slot.past, copyButtonValue(before)].slice(-50), future: [] };
}

export function undoButtonSlot<A extends string, R>(slot: ButtonLabSlot<A, R>, redo = false): ButtonLabSlot<A, R> {
  const stack = redo ? slot.future : slot.past;
  const frame = stack.at(-1);
  if (!frame) return slot;
  return { present: copyButtonValue(frame),
    past: redo ? [...slot.past, copyButtonValue(slot.present)].slice(-50) : slot.past.slice(0, -1),
    future: redo ? slot.future.slice(0, -1) : [...slot.future, copyButtonValue(slot.present)].slice(-50) };
}

export function openButtonFrame<A extends string, R>(slot: ButtonLabSlot<A, R>, frame: ButtonLabFrame<A, R>): ButtonLabSlot<A, R> {
  if (equal(slot.present, frame)) return slot;
  return { present: copyButtonValue(frame), past: [...slot.past, copyButtonValue(slot.present)].slice(-50), future: [] };
}

export function buttonFrameForTrial<A extends string, R>(trial: ButtonSavedTrial<A, R>): ButtonLabFrame<A, R> {
  return { document: copyButtonValue(trial.document), baseline: copyButtonValue(trial.document),
    source: { id: trial.id, name: trial.name, revision: trial.revision } };
}

export function isButtonSlotDirty<A extends string, R>(slot: ButtonLabSlot<A, R>): boolean {
  return !equal(slot.present.document, slot.present.baseline);
}

export function selectButtonSlot<A extends string, R>(workspace: ButtonLabWorkspace<A, R>, index: number): ButtonLabWorkspace<A, R> {
  if (!Number.isInteger(index) || index < 0 || index > 2) throw new Error("Неизвестный slot.");
  return { ...workspace, activeSlot: index };
}
