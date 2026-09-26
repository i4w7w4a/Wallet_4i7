import { BACKGROUND_EDGE_FINISH_BOUNDS, materialCatalogV2, normalizeBackgroundEdgeFinish,
  parseTargetBindings, type BackgroundEdgeFinishV1, type MaterialRecipeV2, type MaterialTargetBinding } from "@wallet/ui";
import type { MonoShapePreset } from "./mono-shape-preview";

export type MonoMaterialBackground = Readonly<{
  version: 1;
  recipe: MaterialRecipeV2;
  edgeFinish: BackgroundEdgeFinishV1;
}>;
export type MonoMaterialButtons = Readonly<
  | { version: 1; bindings: readonly MaterialTargetBinding[] }
  | { version: 2; frameMode: "group" | "separate" | "icons"; bindings: readonly MaterialTargetBinding[] }
>;
export type MonoMaterialDirection = Readonly<{
  background: MonoMaterialBackground | null;
  buttons: MonoMaterialButtons | null;
}>;
export type MonoMaterialMap = Record<MonoShapePreset, MonoMaterialDirection>;

export function createEmptyMonoMaterials(): MonoMaterialMap {
  const empty = (): MonoMaterialDirection => ({ background: null, buttons: null });
  return { ledger: empty(), frost: empty(), mercury: empty() };
}

function exact(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
    Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))) {
    throw new Error("Материал содержит неизвестные или отсутствующие поля.");
  }
  return value as Record<string, unknown>;
}

function parseBackground(value: unknown): MonoMaterialBackground | null {
  if (value === null) return null;
  const input = exact(value, ["version", "recipe", "edgeFinish"]);
  if (input.version !== 1) throw new Error("Версия фонового материала не поддерживается.");
  const parsed = materialCatalogV2.copyForTarget(input.recipe, "background");
  if (!parsed.ok) throw new Error(parsed.issues.map(issue => issue.message).join(" "));
  const edge = exact(input.edgeFinish, ["version", "sideDarkening", "inset", "softness"]);
  if (edge.version !== 1) throw new Error("Версия отделки фона не поддерживается.");
  for (const key of ["sideDarkening", "inset", "softness"] as const) {
    const value = edge[key];
    const [min, max] = BACKGROUND_EDGE_FINISH_BOUNDS[key];
    if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max)
      throw new Error("Отделка фона содержит неподдерживаемое значение.");
  }
  return { version: 1, recipe: parsed.value, edgeFinish: normalizeBackgroundEdgeFinish(edge) };
}

function parseButtons(value: unknown): MonoMaterialButtons | null {
  if (value === null) return null;
  const version = value && typeof value === "object" && !Array.isArray(value) ? (value as { version?: unknown }).version : undefined;
  if (version !== 1 && version !== 2) throw new Error("Версия материала кнопок не поддерживается.");
  const input = exact(value, version === 1 ? ["version", "bindings"] : ["version", "frameMode", "bindings"]);
  if (version === 2 && input.frameMode !== "group" && input.frameMode !== "separate" && input.frameMode !== "icons")
    throw new Error("Неизвестный режим ряда кнопок.");
  const parsed = parseTargetBindings(input.bindings, materialCatalogV2);
  if (!parsed.ok) throw new Error(parsed.issues.map(issue => issue.message).join(" "));
  return version === 1 ? { version: 1, bindings: parsed.value } :
    { version: 2, frameMode: input.frameMode as "group" | "separate" | "icons", bindings: parsed.value };
}

/** A material extension is all-or-nothing. Unknown fields and effects must never disappear on read. */
export function normalizeMonoMaterialMap(value: unknown): MonoMaterialMap {
  const map = exact(value, ["ledger", "frost", "mercury"]);
  const direction = (input: unknown): MonoMaterialDirection => {
    const entry = exact(input, ["background", "buttons"]);
    return { background: parseBackground(entry.background), buttons: parseButtons(entry.buttons) };
  };
  return { ledger: direction(map.ledger), frost: direction(map.frost), mercury: direction(map.mercury) };
}
