import { boundedJson, exactObject, type RecipeParser, type StoragePort } from "./storage";
import { parseWorkspace, type SandboxWorkspace } from "./model";
import { V3_WORKSPACE_KEY } from "./storage-v3";

export function parseWorkspaceV3<R>(raw: string, parse: RecipeParser<R>): SandboxWorkspace<R> {
  const data = exactObject(boundedJson(raw, 1024 * 1024), ["version", "activeSlot", "slots", "pinned"]);
  if (data.version !== 3) throw new Error("Версия рабочего места фонов не поддерживается.");
  return parseWorkspace(JSON.stringify({ ...data, version: 1 }), parse);
}

export function persistWorkspaceV3<R>(store: StoragePort, expected: string | null, workspace: SandboxWorkspace<R>, parse: RecipeParser<R>): string {
  const valid = parseWorkspace(JSON.stringify(workspace), parse);
  const raw = JSON.stringify({ ...valid, version: 3 });
  parseWorkspaceV3(raw, parse);
  if (store.getItem(V3_WORKSPACE_KEY) !== expected) {
    throw new Error("Рабочее место изменено в другой вкладке. Экспортируйте draft перед переключением.");
  }
  try {
    store.setItem(V3_WORKSPACE_KEY, raw);
    if (store.getItem(V3_WORKSPACE_KEY) !== raw) throw new Error("Write verification failed");
  } catch { throw new Error("Не удалось сохранить рабочее место. Draft остаётся в памяти."); }
  return raw;
}
