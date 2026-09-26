import { boundedButtonJson, parseButtonDocument, parseButtonLibrary, parseButtonTrial, parseButtonWorkspace,
  type ButtonRecipeParser, type ButtonTrialLibrary } from "./codec";
import { buttonFrameForTrial, copyButtonValue, createButtonDocument, createButtonWorkspace, editButtonBinding,
  editButtonFrameMode, editButtonSlot, finishButtonGesture, openButtonFrame, selectButtonSlot, undoButtonSlot,
  type ButtonLabDocument, type ButtonLabFrame, type ButtonLabSlot, type ButtonLabWorkspace,
  type ButtonFrameMode, type ButtonLayer, type ButtonSavedTrial, type ButtonTarget } from "./model";
import { ACCEPTED_KEY, LIBRARY_KEY, WORKSPACE_KEY, createButtonLibrary, saveButtonTrial, writeButtonChecked,
  type ButtonStoragePort } from "./storage";

export type ButtonStorageLock = <T>(task: () => T) => Promise<T>;
export type ButtonSessionSnapshot<A extends string, R> = {
  workspace: ButtonLabWorkspace<A, R>;
  accepted: ButtonLabDocument<A, R>;
  library: ButtonTrialLibrary<A, R>;
  ready: boolean;
  saving: boolean;
  saveError: string;
  acceptedError: string;
  recoveryError: string;
  libraryError: string;
  externalChange: boolean;
  comparing: boolean;
  restartKey: number;
  recovered: boolean;
  recoveryUnavailable: boolean;
  acceptedUnavailable: boolean;
  writeAvailable: boolean;
};
const message = (error: unknown) => error instanceof Error ? error.message : "Хранилище недоступно.";

/** Browser storage is connected only after hydration; this store is safe to construct during SSR. */
export function createButtonSession<A extends string, R>(actionIds: readonly A[], parseRecipe: ButtonRecipeParser<R, A>,
  initialDraft?: ButtonLabDocument<A, R>) {
  const initialWorkspace = createButtonWorkspace<A, R>(actionIds,
    initialDraft ? parseButtonDocument(initialDraft, actionIds, parseRecipe) : undefined);
  let state: ButtonSessionSnapshot<A, R> = {
    workspace: initialWorkspace, accepted: createButtonDocument<A, R>(actionIds), library: createButtonLibrary<A, R>(),
    ready: false, saving: false, saveError: "", acceptedError: "", recoveryError: "", libraryError: "",
    externalChange: false, comparing: false, restartKey: 0, recovered: false,
    recoveryUnavailable: false, acceptedUnavailable: false, writeAvailable: false,
  };
  const serverState = state;
  const listeners = new Set<() => void>();
  let storage: ButtonStoragePort | null = null;
  let locked: ButtonStorageLock = async () => { throw new Error("Без Web Locks безопасное сохранение недоступно. Используйте экспорт."); };
  let libraryRaw: string | null = null, workspaceRaw: string | null = null, acceptedRaw: string | null = null;
  let libraryBlocked = false, recoveryBlocked = false;
  let gesture: ButtonLabFrame<A, R> | null = null;
  let pendingRecovery: string | null = null, recoveryTask: Promise<void> | null = null;

  function publish(patch: Partial<ButtonSessionSnapshot<A, R>>) {
    state = { ...state, ...patch };
    listeners.forEach(listener => listener());
  }
  function queueRecovery() {
    if (!storage || recoveryBlocked || !state.writeAvailable) return;
    pendingRecovery = JSON.stringify(state.workspace);
    if (recoveryTask) return;
    recoveryTask = Promise.resolve().then(async () => {
      while (pendingRecovery !== null && !recoveryBlocked) {
        const raw = pendingRecovery; pendingRecovery = null;
        try {
          parseButtonWorkspace(raw, actionIds, parseRecipe);
          await locked(() => { writeButtonChecked(storage!, WORKSPACE_KEY, workspaceRaw, raw); workspaceRaw = raw; });
          publish({ recoveryError: "" });
        } catch (error) {
          try { if (storage?.getItem(WORKSPACE_KEY) !== workspaceRaw) recoveryBlocked = true; }
          catch { recoveryBlocked = true; }
          publish({ recoveryError: message(error) });
        }
      }
    }).finally(() => {
      recoveryTask = null;
      // A newer edit can arrive after the loop's last check but before this finalizer.
      if (pendingRecovery !== null && !recoveryBlocked) queueRecovery();
    });
  }
  function workspace(next: ButtonLabWorkspace<A, R>, restart = false) {
    publish({ workspace: next, ...(restart ? { comparing: false, restartKey: state.restartKey + 1, saveError: "" } : {}) });
    queueRecovery();
  }
  function slot() { return state.workspace.slots[state.workspace.activeSlot]!; }
  function changeSlot(next: ButtonLabSlot<A, R>, restart = false) {
    if (next === slot() && !restart) return;
    const slots = [...state.workspace.slots] as ButtonLabWorkspace<A, R>["slots"];
    slots[state.workspace.activeSlot] = next;
    workspace({ ...state.workspace, slots }, restart);
  }
  function endGesture() {
    const before = gesture; gesture = null;
    if (before) changeSlot(finishButtonGesture(slot(), before));
  }
  function refreshLibrary() {
    if (!storage) return;
    try {
      const raw = storage.getItem(LIBRARY_KEY);
      const library = raw === null ? createButtonLibrary<A, R>() : parseButtonLibrary(raw, actionIds, parseRecipe);
      libraryRaw = raw; libraryBlocked = false;
      publish({ library, libraryError: "", externalChange: false });
    } catch (error) { libraryBlocked = true; publish({ libraryError: message(error) }); }
  }
  const api = {
    getSnapshot: () => state,
    getServerSnapshot: () => serverState,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    connect(port: ButtonStoragePort, runLocked?: ButtonStorageLock) {
      if (storage) return;
      storage = port;
      if (runLocked) locked = runLocked;
      refreshLibrary();
      try {
        acceptedRaw = storage.getItem(ACCEPTED_KEY);
        if (acceptedRaw !== null) publish({ accepted: parseButtonDocument(boundedButtonJson(acceptedRaw, 256 * 1024), actionIds, parseRecipe) });
      } catch (error) { publish({ acceptedError: message(error), acceptedUnavailable: true }); }
      try {
        workspaceRaw = storage.getItem(WORKSPACE_KEY);
        if (workspaceRaw !== null) publish({ workspace: parseButtonWorkspace(workspaceRaw, actionIds, parseRecipe), recovered: true });
        else if (acceptedRaw !== null && !state.acceptedUnavailable) {
          // A missing recovery key must not replace a previously accepted preview with new defaults.
          const recovered = createButtonWorkspace(actionIds, state.accepted);
          const visibleLayer = (["border", "fill", "icon"] as const).find(layer =>
            actionIds.some(action => state.accepted.actions[action][layer] !== null)) ?? "border";
          publish({ workspace: { ...recovered, selection: { target: "all", layer: visibleLayer } } });
        }
      } catch (error) { recoveryBlocked = true; publish({ recoveryError: message(error), recoveryUnavailable: true }); }
      publish({ ready: true, writeAvailable: !!runLocked });
      if (workspaceRaw === null && !recoveryBlocked) queueRecovery();
    },
    refreshLibrary,
    notifyExternalChange() { publish({ externalChange: true }); },
    startFresh() { if (!state.saving) { recoveryBlocked = false; publish({ recoveryUnavailable: false, acceptedUnavailable: false }); queueRecovery(); } },
    beginGesture() { if (!state.comparing && !state.saving) gesture ??= copyButtonValue(slot().present); },
    endGesture,
    edit(target: ButtonTarget<A>, layer: ButtonLayer, binding: R | ((action: A) => R | null) | null) {
      if (state.comparing || state.saving || state.recoveryUnavailable) return;
      const resolve = (action: A) => {
        const value = typeof binding === "function" ? (binding as (action: A) => R | null)(action) : binding;
        return value === null ? null : parseRecipe(value, layer, action);
      };
      changeSlot(editButtonSlot(slot(), editButtonBinding(slot().present.document, actionIds, target, layer, resolve), gesture !== null));
    },
    setFrameMode(mode: ButtonFrameMode) {
      if (state.comparing || state.saving || state.recoveryUnavailable) return;
      endGesture();
      changeSlot(editButtonSlot(slot(), editButtonFrameMode(slot().present.document, mode)));
    },
    undo(redo = false) {
      if (state.comparing || state.saving) return;
      endGesture();
      const next = undoButtonSlot(slot(), redo);
      if (next !== slot()) changeSlot(next, true);
    },
    selectSlot(index: number) {
      if (state.saving) return;
      endGesture();
      if (index !== state.workspace.activeSlot) workspace(selectButtonSlot(state.workspace, index), true);
    },
    selectTarget(target: ButtonTarget<A>) {
      if (target !== "all" && !actionIds.includes(target as A)) throw new Error("Неизвестная кнопка.");
      if (state.workspace.selection.target !== target) workspace({ ...state.workspace, selection: { ...state.workspace.selection, target } });
    },
    selectLayer(layer: ButtonLayer) {
      if (layer !== "fill" && layer !== "icon" && layer !== "border") throw new Error("Неизвестный слой кнопки.");
      if (state.workspace.selection.layer !== layer) workspace({ ...state.workspace, selection: { ...state.workspace.selection, layer } });
    },
    openTrial(trial: ButtonSavedTrial<A, R>) {
      if (state.saving) return;
      endGesture();
      const parsed = parseButtonTrial(trial, actionIds, parseRecipe);
      publish({ recoveryUnavailable: false });
      changeSlot(openButtonFrame(slot(), buttonFrameForTrial(parsed)), true);
    },
    openDocument(document: ButtonLabDocument<A, R>) {
      if (state.saving) return;
      endGesture();
      const parsed = parseButtonDocument(document, actionIds, parseRecipe);
      const frame = { document: parsed, baseline: copyButtonValue(parsed), source: null };
      changeSlot(openButtonFrame(slot(), frame), true);
    },
    pin(trial: ButtonSavedTrial<A, R>) {
      if (!state.saving) { endGesture(); workspace({ ...state.workspace, pinned: parseButtonTrial(trial, actionIds, parseRecipe) }); }
    },
    compare(showA: boolean) {
      if (state.saving) return;
      endGesture();
      if (showA && !state.workspace.pinned) return;
      if (state.comparing !== showA) publish({ comparing: showA, restartKey: state.restartKey + 1 });
    },
    restart() { endGesture(); publish({ restartKey: state.restartKey + 1 }); },
    shownDocument: () => state.comparing && state.workspace.pinned ? state.workspace.pinned.document : slot().present.document,
    cancel() {
      if (state.saving || state.recoveryUnavailable) return;
      endGesture();
      const document = copyButtonValue(state.accepted);
      changeSlot(openButtonFrame(slot(), { document, baseline: copyButtonValue(document), source: null }), true);
    },
    async apply() {
      if (!storage || state.saving || state.recoveryUnavailable || state.acceptedUnavailable) return false;
      endGesture();
      publish({ saving: true, saveError: "" });
      try {
        const document = parseButtonDocument(slot().present.document, actionIds, parseRecipe);
        const raw = JSON.stringify(document);
        await locked(() => { writeButtonChecked(storage!, ACCEPTED_KEY, acceptedRaw, raw); acceptedRaw = raw; });
        publish({ accepted: document });
        return true;
      } catch (error) { publish({ saveError: message(error) }); return false; }
      finally { publish({ saving: false }); }
    },
    async save(name?: string, asNew = false) {
      if (!storage || state.saving || state.recoveryUnavailable) return false;
      endGesture();
      const frame = slot().present;
      const source = asNew ? null : frame.source;
      publish({ saving: true, saveError: "" });
      try {
        if (libraryBlocked) throw new Error("Библиотека недоступна. Её данные не перезаписаны; доступен экспорт.");
        const result = await locked(() => saveButtonTrial(storage!, libraryRaw, state.library,
          { ...(source ? { id: source.id, revision: source.revision } : {}), name: name ?? source?.name ?? "", document: frame.document },
          actionIds, parseRecipe));
        libraryRaw = result.raw;
        publish({ library: result.library, externalChange: false });
        changeSlot(openButtonFrame(slot(), buttonFrameForTrial(result.trial)));
        return true;
      } catch (error) { publish({ saveError: message(error) }); return false; }
      finally { publish({ saving: false }); }
    },
    async flushRecovery() { while (recoveryTask) await recoveryTask; },
  };
  return api;
}
