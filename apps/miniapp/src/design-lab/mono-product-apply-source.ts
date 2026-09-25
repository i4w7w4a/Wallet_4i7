import { materialCatalogV2, type ButtonMaterialLayer, type ButtonTargetId,
  type MaterialTargetBinding } from "@wallet/ui";
import { createEmptyMonoMaterials, normalizeMonoMaterialMap } from "../mono-preview/mono-material-preset";
import type { MonoMaterialPatch } from "../mono-preview/mono-material-transfer";
import { parseButtonBinding, BUTTON_TARGETS } from "./button-workshop/binding";
import { parseButtonDocument } from "./button-workshop/codec";

function exact(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
    Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))) {
    throw new Error("Проба содержит неизвестные или отсутствующие поля.");
  }
  return value as Record<string, unknown>;
}

export function backgroundPatchFromLab(document: unknown): MonoMaterialPatch {
  const data = exact(document, ["kind", "version", "material", "edgeFinish"]);
  if (data.kind !== "novex-background-lab" || data.version !== 1)
    throw new Error("Версия пробы фона не поддерживается.");
  if (!data.material || typeof data.material !== "object" ||
    (data.material as { kind?: unknown }).kind !== "novex-material") {
    throw new Error("В MONO можно применить только установленный материал фона v2; текущая проба остаётся в мастерской.");
  }
  const map = createEmptyMonoMaterials();
  map.ledger = { ...map.ledger, background: {
    version: 1, recipe: data.material as NonNullable<typeof map.ledger.background>["recipe"],
    edgeFinish: data.edgeFinish as NonNullable<typeof map.ledger.background>["edgeFinish"],
  } };
  const value = normalizeMonoMaterialMap(map).ledger.background!;
  return { scope: "background", value };
}

export function buttonPatchFromLab(document: unknown, selection: unknown): MonoMaterialPatch & { scope: "buttons" } {
  const chosen = exact(selection, ["target", "layer"]);
  if ((chosen.target !== "all" && !BUTTON_TARGETS.includes(chosen.target as ButtonTargetId)) ||
    (chosen.layer !== "fill" && chosen.layer !== "icon" && chosen.layer !== "border")) {
    throw new Error("Выберите кнопку и слой перед применением.");
  }
  const target = chosen.target as ButtonTargetId | "all";
  const layer = chosen.layer as ButtonMaterialLayer;
  const parsed = parseButtonDocument<ButtonTargetId, MaterialTargetBinding>(document, BUTTON_TARGETS,
    (input, slot, action) => parseButtonBinding(input, slot, action, materialCatalogV2));
  const targets = target === "all" ? BUTTON_TARGETS : [target];
  const bindings = targets.flatMap(action => {
    const value = parsed.actions[action][layer];
    return value === null ? [] : [value];
  });
  const map = createEmptyMonoMaterials();
  map.ledger = { ...map.ledger, buttons: { version: 1, bindings } };
  const value = normalizeMonoMaterialMap(map).ledger.buttons!;
  return { scope: "buttons", selection: { target, layer }, value };
}
