import { BUTTON_MASK_ASSETS, createTargetBinding, parseTargetBinding, parseTargetBindings,
  type ButtonMaterialLayer, type ButtonTargetId, type MaterialCatalogV2,
  type MaterialRecipeV2, type MaterialTargetBinding } from "@wallet/ui";
import type { ButtonLabDocument } from "./model";

export const BUTTON_TARGETS = Object.keys(BUTTON_MASK_ASSETS) as ButtonTargetId[];
export const BUTTON_LAYERS: readonly ButtonMaterialLayer[] = ["fill", "icon", "border"];

function valueOrThrow<T>(result: { ok: true; value: T } | { ok: false; issues: readonly { message: string }[] }): T {
  if (!result.ok) throw new Error(result.issues.map(issue => issue.message).join(" ") || "Материал не подходит для слоя.");
  return result.value;
}

/** The shared parser owns masks, bounds and effect compatibility; the document owns its key. */
export function parseButtonBinding(input: unknown, layer: ButtonMaterialLayer, target: ButtonTargetId,
  catalog: MaterialCatalogV2): MaterialTargetBinding {
  const binding = valueOrThrow(parseTargetBinding(input, catalog));
  if (binding.targetId !== target || binding.layer !== layer) throw new Error("Привязка относится к другой кнопке или слою.");
  return binding;
}

export function createButtonBinding(target: ButtonTargetId, layer: ButtonMaterialLayer, recipe: MaterialRecipeV2,
  catalog: MaterialCatalogV2): MaterialTargetBinding {
  return valueOrThrow(createTargetBinding(target, layer, recipe, catalog));
}

export function replaceBindingRecipe(binding: MaterialTargetBinding, recipe: MaterialRecipeV2,
  catalog: MaterialCatalogV2): MaterialTargetBinding {
  return parseButtonBinding({ ...binding, recipe }, binding.layer, binding.targetId, catalog);
}

export function buttonDocumentBindings(document: ButtonLabDocument<ButtonTargetId, MaterialTargetBinding>,
  catalog: MaterialCatalogV2): readonly MaterialTargetBinding[] {
  const entries = BUTTON_TARGETS.flatMap(target => BUTTON_LAYERS.flatMap(layer => {
    const binding = document.actions[target][layer];
    return binding === null ? [] : [binding];
  }));
  return valueOrThrow(parseTargetBindings(entries, catalog));
}
