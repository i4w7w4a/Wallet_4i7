import type { ParseResult, ParameterValue } from "./contracts";
import type { MaterialDefinition, MaterialDescriptorV2, MaterialEffectId, MaterialRecipeV2 } from "./material-contract";

export type MaterialBindingV2 = Readonly<{
  descriptor: MaterialDescriptorV2;
  fallback: Readonly<{ color: string; label: string }>;
}>;

const KEYS = ["kind", "version", "effectId", "effectVersion", "seed", "params", "assetIds"];
const invalid = (message: string): ParseResult<never> =>
  ({ ok: false, issues: [{ code: "invalid-material-recipe", message }] });

function matchesAssetIds(input: unknown, installed: readonly string[]): boolean {
  if (!Array.isArray(input)) return false;
  try {
    if (Object.getPrototypeOf(input) !== Array.prototype) return false;
    const keys = Reflect.ownKeys(input);
    if (keys.length !== installed.length + 1) return false;
    const fields: Record<string, PropertyDescriptor | undefined> = Object.getOwnPropertyDescriptors(input);
    if (fields.length?.value !== installed.length) return false;
    return installed.every((id, index) => {
      const field = fields[index];
      return field?.enumerable && "value" in field && field.value === id;
    });
  } catch { return false; }
}

/** Static CPU facade; a definition never acquires GPU resources while the catalog is built. */
export function bindMaterialV2<I extends MaterialEffectId, P extends object, A>(
  definition: MaterialDefinition<I, P, A>,
): MaterialBindingV2 {
  const parseRecipe = (input: unknown): ParseResult<MaterialRecipeV2<I, P>> => {
    if (!input || typeof input !== "object" || Array.isArray(input)) return invalid("Ожидается полная проба материала.");
    let value: Record<string, unknown>;
    try {
      const prototype = Object.getPrototypeOf(input);
      if (prototype !== Object.prototype && prototype !== null) return invalid("Ожидаются обычные данные пробы.");
      const keys = Reflect.ownKeys(input);
      if (keys.length !== KEYS.length || keys.some(key => typeof key !== "string" || !KEYS.includes(key))) {
        return invalid("Неизвестные или отсутствующие поля пробы.");
      }
      const fields = Object.getOwnPropertyDescriptors(input);
      if (KEYS.some(key => !fields[key]?.enumerable || !("value" in fields[key]))) {
        return invalid("Поля пробы должны содержать данные, а не вычисляемые свойства.");
      }
      value = Object.fromEntries(KEYS.map(key => [key, fields[key]!.value]));
    } catch { return invalid("Проба повреждена."); }
    if (value.kind !== "novex-material" || value.version !== 2 || value.effectId !== definition.id ||
        value.effectVersion !== definition.effectVersion) return invalid("Материал или версия пробы не поддерживаются.");
    if (typeof value.seed !== "number" || !Number.isInteger(value.seed) || value.seed < 0 || value.seed > 0xffffffff) {
      return invalid("Некорректное начальное состояние.");
    }
    if (!matchesAssetIds(value.assetIds, definition.assetIds)) return invalid("Проба содержит неподдерживаемые ресурсы.");
    try {
      const parsed = definition.schema.parse(value.params);
      if (!parsed.ok) return parsed;
      return { ok: true, value: {
        kind: "novex-material", version: 2, effectId: definition.id, effectVersion: definition.effectVersion,
        seed: value.seed, params: structuredClone(parsed.value), assetIds: [...definition.assetIds],
      } };
    } catch { return invalid("Параметры материала повреждены."); }
  };
  const presets = definition.presets.map(preset => {
    const parsed = parseRecipe({ kind: "novex-material", version: 2, effectId: definition.id,
      effectVersion: definition.effectVersion, seed: preset.seed, params: preset.params, assetIds: [...definition.assetIds] });
    if (!parsed.ok) throw new Error(`Invalid built-in material ${definition.id}/${preset.id}`);
    return { id: preset.id, label: preset.label, recipe: parsed.value };
  });
  const descriptor: MaterialDescriptorV2 = {
    id: definition.id, effectVersion: definition.effectVersion, label: definition.label,
    description: definition.description, capabilities: definition.capabilities,
    ...(definition.actions ? { actions: definition.actions } : {}),
    provenance: definition.provenance, presets, parseRecipe,
    readControls(recipe) {
      const parsed = parseRecipe(recipe);
      if (!parsed.ok) return [];
      return definition.schema.controls.flatMap(control => {
        const value = parsed.value.params[control.key];
        return typeof value === "number" || typeof value === "string" || typeof value === "boolean" ||
          (Array.isArray(value) && value.every(item => typeof item === "string"))
          ? [{ control, value: value as ParameterValue,
            ...(definition.isControlDisabled?.(parsed.value.params, control.key) ? { disabled: true } : {}) }] : [];
      });
    },
    updateParameter(recipe, key, value) {
      const parsed = parseRecipe(recipe);
      if (!parsed.ok) return parsed;
      if (!definition.schema.controls.some(control => control.key === key)) return invalid("Неизвестный параметр.");
      return parseRecipe({ ...parsed.value, params: { ...parsed.value.params, [key]: value } });
    },
  };
  return { descriptor, fallback: definition.fallback };
}
