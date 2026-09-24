import { createLibrary, parseLibrary, saveTrial, writeChecked, LIBRARY_KEY, WORKSPACE_KEY,
  type RecipeParser, type SavedTrial, type StoragePort, type TrialLibrary } from "./storage";
import { createWorkspace, editRecipe, finishGesture, frameForTrial, freshFrame, markSaved, openFrame, parseWorkspace,
  pinTrial, selectSlot, undoSlot, type EditorFrame, type SandboxSlot, type SandboxWorkspace } from "./model";

export type StorageLock = <T>(task: () => T) => Promise<T>;
export type SessionSnapshot<R> = {
  workspace: SandboxWorkspace<R>; library: TrialLibrary<R>; ready: boolean; saving: boolean;
  saveError: string; recoveryError: string; libraryError: string; externalChange: boolean;
  comparing: boolean; restartKey: number; recovered: boolean; writeAvailable: boolean;
};
const message = (error: unknown) => error instanceof Error ? error.message : "Хранилище недоступно.";

/** Pure editor store. Browser connection is explicit, after hydration; no render-time reads/writes. */
export function createSandboxSession<R>(recipe: R, key: string, parse: RecipeParser<R>) {
  let state: SessionSnapshot<R> = { workspace: createWorkspace(recipe, key), library: createLibrary<R>(), ready: false,
    saving: false, saveError: "", recoveryError: "", libraryError: "", externalChange: false, comparing: false, restartKey: 0, recovered: false, writeAvailable: false };
  const serverState = state;
  const listeners = new Set<() => void>();
  let storage: StoragePort | null = null;
  let locked: StorageLock = async () => { throw new Error("Без Web Locks безопасное сохранение недоступно. Используйте экспорт."); };
  let libraryRaw: string | null = null, workspaceRaw: string | null = null;
  let recoveryBlocked = false, libraryBlocked = false;
  let gesture: EditorFrame<R> | null = null;
  let pendingRecovery: string | null = null, recoveryTask: Promise<void> | null = null;
  function publish(patch: Partial<SessionSnapshot<R>>) { state = { ...state, ...patch }; listeners.forEach(listener => listener()); }
  function queueRecovery() {
    if (!storage || recoveryBlocked) return;
    pendingRecovery = JSON.stringify(state.workspace);
    if (recoveryTask) return;
    recoveryTask = Promise.resolve().then(async () => {
      while (pendingRecovery !== null && !recoveryBlocked) {
        const raw = pendingRecovery; pendingRecovery = null;
        try {
          parseWorkspace(raw, parse);
          await locked(() => {
            if (storage!.getItem(WORKSPACE_KEY) !== workspaceRaw) recoveryBlocked = true;
            writeChecked(storage!, WORKSPACE_KEY, workspaceRaw, raw);
            workspaceRaw = raw;
          });
          publish({ recoveryError: "" });
        } catch (error) { publish({ recoveryError: message(error) }); }
      }
    }).finally(() => { recoveryTask = null; });
  }
  function workspace(next: SandboxWorkspace<R>, restart = false) {
    publish({ workspace: next, ...(restart ? { comparing: false, restartKey: state.restartKey + 1, saveError: "" } : {}) });
    queueRecovery();
  }
  function slot() { return state.workspace.slots[state.workspace.activeSlot]!; }
  function changeSlot(next: SandboxSlot<R>, restart = false) {
    const slots = [...state.workspace.slots] as SandboxWorkspace<R>["slots"];
    slots[state.workspace.activeSlot] = next;
    workspace({ ...state.workspace, slots }, restart);
  }
  function endGesture() {
    const before = gesture; gesture = null;
    if (before) changeSlot(finishGesture(slot(), before));
  }
  function refreshLibrary() {
    if (!storage) return;
    try {
      const raw = storage.getItem(LIBRARY_KEY);
      const library = raw === null ? createLibrary<R>() : parseLibrary(raw, parse);
      libraryRaw = raw; libraryBlocked = false;
      publish({ library, libraryError: "", externalChange: false, saveError: "" });
    } catch (error) { libraryBlocked = true; publish({ libraryError: message(error) }); }
  }
  const api = {
    getSnapshot: () => state,
    getServerSnapshot: () => serverState,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    connect(port: StoragePort, runLocked?: StorageLock) {
      if (storage) return;
      storage = port;
      if (runLocked) locked = runLocked;
      refreshLibrary();
      try {
        workspaceRaw = storage.getItem(WORKSPACE_KEY);
        if (workspaceRaw !== null) publish({ workspace: parseWorkspace(workspaceRaw, parse), recovered: true });
      } catch (error) { recoveryBlocked = true; publish({ recoveryError: message(error) }); }
      publish({ ready: true, writeAvailable: !!runLocked });
    },
    refreshLibrary,
    notifyExternalChange() { publish({ externalChange: true }); },
    beginGesture() { if (!state.comparing && !state.saving) gesture ??= slot().present; },
    endGesture,
    edit(next: R) {
      if (state.comparing || state.saving) return;
      changeSlot(editRecipe(slot(), parse(next), gesture !== null));
    },
    undo(redo = false) { if (!state.comparing && !state.saving) { endGesture(); changeSlot(undoSlot(slot(), redo), true); } },
    selectSlot(index: number) { if (!state.saving) { endGesture(); workspace(selectSlot(state.workspace, index), true); } },
    openTrial(trial: SavedTrial<R>) { if (state.saving) return; endGesture(); changeSlot(openFrame(slot(), frameForTrial(trial)), true); },
    openRecipe(next: R, nextKey: string, restoreDraft = false) {
      if (state.saving) return;
      endGesture();
      const existing = restoreDraft ? [slot().present, ...slot().drafts].find(frame => frame.key === nextKey) : undefined;
      changeSlot(openFrame(slot(), existing ?? freshFrame(parse(next), nextKey)), true);
    },
    discard() { if (!state.saving) { endGesture(); changeSlot(editRecipe(slot(), slot().present.baseline)); } },
    pin(trial: SavedTrial<R>) { if (!state.saving) { endGesture(); workspace(pinTrial(state.workspace, trial)); } },
    compare(showA: boolean) {
      if (state.saving) return;
      endGesture();
      if (showA && !state.workspace.pinned) return;
      if (state.comparing !== showA) publish({ comparing: showA, restartKey: state.restartKey + 1 });
    },
    restart() { endGesture(); publish({ restartKey: state.restartKey + 1 }); },
    shownRecipe: () => state.comparing && state.workspace.pinned ? state.workspace.pinned.recipe : slot().present.recipe,
    async save(name?: string, asNew = false) {
      if (!storage || state.saving) return false;
      endGesture();
      const frame = slot().present;
      const source = asNew ? null : frame.source;
      publish({ saving: true, saveError: "" });
      try {
        if (libraryBlocked) throw new Error("Библиотека повреждена или недоступна. Её данные не перезаписаны; доступен экспорт.");
        const result = await locked(() => saveTrial(storage!, libraryRaw, state.library,
          { ...(source ? { id: source.id, revision: source.revision } : {}), name: name ?? source?.name ?? "", recipe: frame.recipe }, parse));
        libraryRaw = result.raw;
        publish({ library: result.library, externalChange: false });
        changeSlot(markSaved(slot(), result.trial));
        return true;
      } catch (error) { publish({ saveError: message(error) }); return false; }
      finally { publish({ saving: false }); }
    },
    async flushRecovery() { while (recoveryTask) await recoveryTask; },
  };
  return api;
}
