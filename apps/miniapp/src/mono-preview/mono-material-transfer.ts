import { BUTTON_MASK_ASSETS, type ButtonMaterialLayer, type ButtonTargetId } from "@wallet/ui";
import type { MonoShapePreset } from "./mono-shape-preview";
import { normalizeMonoMaterialMap, type MonoMaterialBackground, type MonoMaterialButtons } from "./mono-material-preset";
import { MonoWorkingStoreError, type MonoWorkingLibrary } from "./mono-working-presets";

export type MonoMaterialPatch =
  | { scope: "background"; value: MonoMaterialBackground }
  | { scope: "buttons"; selection: { target: ButtonTargetId | "all"; layer: ButtonMaterialLayer };
      value: MonoMaterialButtons };

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
      prior.buttons?.version === 2 ? prior.buttons.frameMode : null;
    value = frameMode === null
      ? { version: 1, bindings: [...retained, ...selected.bindings] }
      : { version: 2, frameMode, bindings: [...retained, ...selected.bindings] };
  }
  const materials = normalizeMonoMaterialMap({ ...target.document.materials,
    [request.direction]: { ...prior, [request.patch.scope]: structuredClone(value) } });
  const records = library.records.map(item => item.id === target.id
    ? { ...item, revision: item.revision + 1,
      document: { ...item.document, materials } } : item);
  return { ...library, generation: library.generation + 1, activeId: target.id, records };
}
