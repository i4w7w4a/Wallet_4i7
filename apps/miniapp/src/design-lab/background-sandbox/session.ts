import { createLibrary, parseLibrary, saveTrial, writeChecked, LIBRARY_KEY, WORKSPACE_KEY,
  type RecipeParser, type SavedTrial, type StoragePort, type TrialLibrary } from "./storage";
import { createLibraryV2, parseLibraryV2, saveTrialV2, V2_LIBRARY_KEY, V2_WORKSPACE_KEY, type TrialLibraryV2 } from "./storage-v2";
import { parseWorkspaceV2, persistWorkspaceV2 } from "./workspace-v2";
import { createWorkspace, editRecipe, finishGesture, frameForTrial, freshFrame, markSaved, openFrame, parseWorkspace,
  pinTrial, selectSlot, undoSlot, type EditorFrame, type SandboxSlot, type SandboxWorkspace } from "./model";

export type StorageLock = <T>(task: () => T) => Promise<T>;
export type SessionSnapshot<R> = {
  workspace: SandboxWorkspace<R>; library: TrialLibrary<R> | TrialLibraryV2<R>; ready: boolean; saving: boolean;
  saveError: string; recoveryError: string; libraryError: string; externalChange: boolean;
  comparing: boolean; restartKey: number; recovered: boolean; recoveryUnavailable: boolean; writeAvailable: boolean;
};
const message = (error: unknown) => error instanceof Error ? error.message : "Хранилище недоступно.";

/** Pure editor store. Browser connection is explicit, after hydration; no render-time reads/writes. */
export function createSandboxSession<R>(recipe: R, key: string, parse: RecipeParser<R>, storageVersion: 1 | 2 = 1) {
  const libraryKey = storageVersion === 2 ? V2_LIBRARY_KEY : LIBRARY_KEY;
  const workspaceKey = storageVersion === 2 ? V2_WORKSPACE_KEY : WORKSPACE_KEY;
  let state: SessionSnapshot<R> = { workspace: createWorkspace(recipe, key),
    library: storageVersion === 2 ? createLibraryV2<R>() : createLibrary<R>(), ready: false,
    saving: false, saveError: "", recoveryError: "", libraryError: "", externalChange: false, comparing: false, restartKey: 0, recovered: false, recoveryUnavailable: false, writeAvailable: false };
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
    pendingRecovery = JSON.stringify(storageVersion === 2 ? { ...state.workspace, version: 2 } : state.workspace);
    if (recoveryTask) return;
    recoveryTask = Promise.resolve().then(async () => {
      while (pendingRecovery !== null && !recoveryBlocked) {
        const raw = pendingRecovery; pendingRecovery = null;
        try {
          const validated = storageVersion === 2 ? parseWorkspaceV2(raw, parse) : parseWorkspace(raw, parse);
          await locked(() => {
            if (storage!.getItem(workspaceKey) !== workspaceRaw) recoveryBlocked = true;
            if (storageVersion === 2) workspaceRaw = persistWorkspaceV2(storage!, workspaceRaw, validated, parse);
            else { writeChecked(storage!, WORKSPACE_KEY, workspaceRaw, raw); workspaceRaw = raw; }
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
    if (next === slot() && !restart) return;
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
      const raw = storage.getItem(libraryKey);
      const library = storageVersion === 2
        ? raw === null ? createLibraryV2<R>() : parseLibraryV2(raw, parse)
        : raw === null ? createLibrary<R>() : parseLibrary(raw, parse);
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
        workspaceRaw = storage.getItem(workspaceKey);
        if (workspaceRaw !== null) publish({ workspace: storageVersion === 2 ? parseWorkspaceV2(workspaceRaw, parse) : parseWorkspace(workspaceRaw, parse), recovered: true });
      } catch (error) { recoveryBlocked = true; publish({ recoveryError: message(error), recoveryUnavailable: true }); }
      publish({ ready: true, writeAvailable: !!runLocked });
    },
    refreshLibrary,
    // Keep unavailable recovery bytes untouched; a fresh named trial can still be saved separately.
    startFresh() { if (!state.saving) publish({ recoveryUnavailable: false }); },
    notifyExternalChange() { publish({ externalChange: true }); },
    beginGesture() { if (!state.comparing && !state.saving) gesture ??= slot().present; },
    endGesture,
    edit(next: R) {
      if (state.comparing || state.saving || state.recoveryUnavailable) return;
      changeSlot(editRecipe(slot(), parse(next), gesture !== null));
    },
    undo(redo = false) {
      if (state.comparing || state.saving) return;
      endGesture(); const next = undoSlot(slot(), redo);
      if (next !== slot()) changeSlot(next, true);
    },
    selectSlot(index: number) {
      if (state.saving) return;
      endGesture();
      if (index !== state.workspace.activeSlot) workspace(selectSlot(state.workspace, index), true);
    },
    openTrial(trial: SavedTrial<R>) { if (state.saving) return; endGesture(); publish({ recoveryUnavailable: false }); changeSlot(openFrame(slot(), frameForTrial(trial)), true); },
    openRecipe(next: R, nextKey: string, restoreDraft = false) {
      if (state.saving) return;
      endGesture();
      publish({ recoveryUnavailable: false });
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
      if (!storage || state.saving || state.recoveryUnavailable) return false;
      endGesture();
      const frame = slot().present;
      const source = asNew ? null : frame.source;
      publish({ saving: true, saveError: "" });
      try {
        if (libraryBlocked) throw new Error("Библиотека повреждена или недоступна. Её данные не перезаписаны; доступен экспорт.");
        const request = { ...(source ? { id: source.id, revision: source.revision } : {}), name: name ?? source?.name ?? "", recipe: frame.recipe };
        const result = await locked(() => {
          if (storageVersion === 2) {
            if (state.library.version !== 2) throw new Error("Версия библиотеки фонов не поддерживается.");
            return saveTrialV2(storage!, libraryRaw, state.library, request, parse);
          }
          if (state.library.version !== 1) throw new Error("Версия библиотеки фонов не поддерживается.");
          return saveTrial(storage!, libraryRaw, state.library, request, parse);
        });
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
