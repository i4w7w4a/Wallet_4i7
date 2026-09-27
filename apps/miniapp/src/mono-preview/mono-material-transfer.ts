import { BUTTON_MASK_ASSETS, type ButtonMaterialLayer, type ButtonTargetId } from "@wallet/ui";
import type { MonoShapePreset } from "./mono-shape-preview";
import { normalizeMonoMaterialMap, type MonoMaterialBackground, type MonoMaterialButtons } from "./mono-material-preset";
import { MonoWorkingStoreError, type MonoWorkingLibrary } from "./mono-working-presets";
import { createDefaultActionArtworkMap, parseMonoActionArtworkMap,
  type MonoActionArtworkMap } from "./action-artwork/model";

export type MonoMaterialPatch =
  | { scope: "background"; value: MonoMaterialBackground }
  | { scope: "buttons"; selection: { target: ButtonTargetId | "all"; layer: ButtonMaterialLayer };
      value: MonoMaterialButtons }
  | { scope: "artwork"; selection: { target: ButtonTargetId | "all" }; value: MonoActionArtworkMap };

export function applyMonoMaterialPatch(library: MonoWorkingLibrary, request: {
  targetId: string;
  direction: MonoShapePreset;
  expectedGeneration: number;
  expectedRevision: number;
  patch: MonoMaterialPatch;
}): MonoWorkingLibrary {
  if (library.generation !== request.expectedGeneration)
    throw new MonoWorkingStoreError("Рабочая библиотека изменилась в другой вкладке. Откройте выбор заново.", "conflict");
  if (request.direction !== "ledger" && request.direction !== "frost" && request.direction !== "mercury")
    throw new MonoWorkingStoreError("Направление MONO неизвестно.", "invalid");
  const target = library.records.find(item => item.id === request.targetId);
  if (!target || target.revision !== request.expectedRevision)
    throw new MonoWorkingStoreError("Выбранный пресет изменился. Откройте его заново.", "conflict");
  const prior = target.document.materials[request.direction];
  let value: MonoMaterialBackground | MonoMaterialButtons;
  if (request.patch.scope === "background") {
    value = request.patch.value;
  } else if (request.patch.scope === "artwork") {
    const { selection } = request.patch;
    if (selection.target !== "all" && !Object.hasOwn(BUTTON_MASK_ASSETS, selection.target))
      throw new MonoWorkingStoreError("Выбранная кнопка неизвестна.", "invalid");
    const incoming = parseMonoActionArtworkMap(request.patch.value);
    const previous = prior.buttons?.version === 3 ? prior.buttons.artwork : createDefaultActionArtworkMap();
    const artwork = selection.target === "all" ? incoming :
      { ...previous, [selection.target]: incoming[selection.target] };
    value = { version: 3,
      frameMode: prior.buttons?.version === 2 || prior.buttons?.version === 3 ? prior.buttons.frameMode : "group",
      bindings: prior.buttons?.bindings ?? [], artwork };
  } else {
    const { selection, value: selected } = request.patch;
    if ((selection.target !== "all" && !Object.hasOwn(BUTTON_MASK_ASSETS, selection.target)) ||
      (selection.layer !== "fill" && selection.layer !== "icon" && selection.layer !== "border") ||
      (selected.version !== 1 && selected.version !== 2) || !Array.isArray(selected.bindings) ||
      selected.bindings.some(binding => binding.layer !== selection.layer ||
        (selection.target !== "all" && binding.targetId !== selection.target))) {
      throw new MonoWorkingStoreError("Выбранный слой кнопки не совпадает с материалом.", "invalid");
    }
    const retained = prior.buttons?.bindings.filter(binding =>
      binding.layer !== selection.layer ||
      (selection.target !== "all" && binding.targetId !== selection.target)) ?? [];
    const frameMode = selected.version === 2 ? selected.frameMode :
      prior.buttons?.version === 2 || prior.buttons?.version === 3 ? prior.buttons.frameMode : null;
    const bindings = [...retained, ...selected.bindings];
    value = prior.buttons?.version === 3
      ? { version: 3, frameMode: frameMode ?? "group", bindings, artwork: prior.buttons.artwork }
      : frameMode === null ? { version: 1, bindings } : { version: 2, frameMode, bindings };
  }
  const materials = normalizeMonoMaterialMap({ ...target.document.materials,
    [request.direction]: { ...prior, [request.patch.scope === "artwork" ? "buttons" : request.patch.scope]: structuredClone(value) } });
  const records = library.records.map(item => item.id === target.id
    ? { ...item, revision: item.revision + 1,
      document: { ...item.document, materials } } : item);
  return { ...library, generation: library.generation + 1, activeId: target.id, records };
}
