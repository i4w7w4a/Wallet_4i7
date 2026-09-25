import type { ParseResult } from "./contracts";
import type { MaterialCatalogV2 } from "./host-contract";
import type { MaterialCapability, MaterialEffectId, MaterialRecipeV2 } from "./material-contract";
import { bindMaterialV2, type MaterialBindingV2 } from "./material-binding-v2";
import { particleDefinition } from "./effects/fluid-particles";
import { liquidMetalDefinition, pulsingBorderDefinition } from "./effects/paper/definitions";
import { vaultGridDefinition } from "./effects/vault-grid/definition";

const unknownMaterial = (): ParseResult<never> => ({ ok: false, issues: [
  { code: "unknown-material", message: "Материал не установлен. Проба не изменена." },
] });

export function createMaterialCatalogV2(bindings: readonly MaterialBindingV2[]): MaterialCatalogV2 {
  const materials = bindings.map(binding => binding.descriptor);
  const byId = new Map<MaterialEffectId, MaterialBindingV2>();
  for (const binding of bindings) {
    if (byId.has(binding.descriptor.id)) throw new Error(`Duplicate material effect: ${binding.descriptor.id}`);
    byId.set(binding.descriptor.id, binding);
  }
  const find = (input: unknown): MaterialBindingV2 | undefined => {
    if (!input || typeof input !== "object" || Array.isArray(input)) return undefined;
    try {
      const prototype = Object.getPrototypeOf(input);
      if (prototype !== Object.prototype && prototype !== null) return undefined;
      const field = Object.getOwnPropertyDescriptor(input, "effectId");
      return field && "value" in field && typeof field.value === "string"
        ? byId.get(field.value as MaterialEffectId) : undefined;
    } catch { return undefined; }
  };
  return {
    materials,
    parseRecipe(input): ParseResult<MaterialRecipeV2> {
      return find(input)?.descriptor.parseRecipe(input) ?? unknownMaterial();
    },
    copyForTarget(input, capability: MaterialCapability): ParseResult<MaterialRecipeV2> {
      const binding = find(input);
      if (!binding) return unknownMaterial();
      if (!binding.descriptor.capabilities.includes(capability)) return { ok: false, issues: [
        { code: "unsupported-target", message: "Этот материал не поддерживает выбранный слой." },
      ] };
      return binding.descriptor.parseRecipe(input);
    },
  };
}

/** Register only adapters with real definitions and resources. More effects join after their own handoff. */
export const materialBindingsV2: readonly MaterialBindingV2[] = [
  bindMaterialV2(vaultGridDefinition),
  bindMaterialV2(liquidMetalDefinition),
  bindMaterialV2(pulsingBorderDefinition),
  bindMaterialV2(particleDefinition),
];
export const materialCatalogV2 = createMaterialCatalogV2(materialBindingsV2);
