import { boundedJson, exactObject, WORKSPACE_KEY, type RecipeParser, type StoragePort } from "./storage";
import { parseWorkspace, type SandboxWorkspace } from "./model";
import { V2_WORKSPACE_KEY } from "./storage-v2";

/** Disk envelope v2, current editor state v1: the renderer never sees storage version tags. */
export function parseWorkspaceV2<R>(raw: string, parse: RecipeParser<R>): SandboxWorkspace<R> {
  const data = exactObject(boundedJson(raw, 1024 * 1024), ["version", "activeSlot", "slots", "pinned"]);
  if (data.version !== 2) throw new Error("Версия рабочего места фонов не поддерживается.");
  return parseWorkspace(JSON.stringify({ ...data, version: 1 }), parse);
}

/** For a user-triggered preview only; never mutates the legacy workspace. */
export function readV1WorkspacePreview<R>(store: StoragePort, parse: RecipeParser<R>): SandboxWorkspace<R> | null {
  const raw = store.getItem(WORKSPACE_KEY);
  return raw === null ? null : parseWorkspace(raw, parse);
}

/** Call under the background-v2 Web Lock; failure leaves both in-memory and v1 states intact. */
export function persistWorkspaceV2<R>(store: StoragePort, expected: string | null, workspace: SandboxWorkspace<R>, parse: RecipeParser<R>): string {
  const valid = parseWorkspace(JSON.stringify(workspace), parse);
  const raw = JSON.stringify({ ...valid, version: 2 });
  parseWorkspaceV2(raw, parse);
  let current: string | null;
  try { current = store.getItem(V2_WORKSPACE_KEY); }
  catch { throw new Error("Не удалось прочитать рабочее место. Draft остаётся в памяти."); }
  if (current !== expected) throw new Error("Рабочее место изменено в другой вкладке. Экспортируйте draft перед переключением.");
  try {
    store.setItem(V2_WORKSPACE_KEY, raw);
    if (store.getItem(V2_WORKSPACE_KEY) !== raw) throw new Error("Write verification failed");
  } catch { throw new Error("Не удалось сохранить рабочее место. Draft остаётся в памяти."); }
  return raw;
}
