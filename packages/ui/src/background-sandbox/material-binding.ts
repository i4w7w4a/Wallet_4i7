import type { OGLRenderingContext } from "ogl";
import type { BackgroundRecipe, Definition, EffectId, GpuLimits, ParseResult } from "./contracts";
import type { BackgroundMaterialDescriptor } from "./host-contract";
import type { PreparedMaterial } from "./host-session";

export type MaterialBinding = Readonly<{
  descriptor: BackgroundMaterialDescriptor;
  fallback: Readonly<{ color: string; label: string }>;
  prepare(gl: OGLRenderingContext, limits: GpuLimits): PreparedMaterial;
}>;

const KEYS = ["kind", "version", "effectId", "effectVersion", "seed", "params", "assetIds"];
const invalid = (message: string): ParseResult<never> => ({ ok: false, issues: [{ code: "invalid-recipe", message }] });

/** Erases parameters only at the validated shell boundary; GPU remains concretely typed. */
export function bindMaterial<I extends EffectId, P extends object>(definition: Definition<I, P>): MaterialBinding {
  const parseRecipe = (input: unknown): ParseResult<BackgroundRecipe<I, P>> => {
    if (typeof input !== "object" || !input || Array.isArray(input)) return invalid("Ожидается полная проба материала.");
    const value = input as Record<string, unknown>;
    const keys = Object.keys(value);
    if (keys.length !== KEYS.length || keys.some(key => !KEYS.includes(key))) return invalid("Неизвестные или отсутствующие поля пробы.");
    if (value.kind !== "novex-background" || value.version !== 1 || value.effectVersion !== 1 || value.effectId !== definition.id) {
      return invalid("Материал или версия пробы не поддерживаются.");
    }
    if (typeof value.seed !== "number" || !Number.isInteger(value.seed) || value.seed < 0 || value.seed > 0xffffffff) {
      return invalid("Некорректное начальное состояние.");
    }
    if (!Array.isArray(value.assetIds) || value.assetIds.length !== definition.assetIds.length ||
        new Set(value.assetIds).size !== value.assetIds.length || value.assetIds.some(id => !definition.assetIds.includes(id))) {
      return invalid("Проба содержит неподдерживаемые ресурсы.");
    }
    try {
      const parsed = definition.schema.parse(value.params);
      if (!parsed.ok) return parsed;
      return { ok: true, value: { kind: "novex-background", version: 1, effectId: definition.id,
        effectVersion: 1, seed: value.seed, params: parsed.value, assetIds: [...definition.assetIds] } };
    } catch { return invalid("Параметры материала повреждены."); }
  };

  const presets = definition.presets.map(preset => {
    const parsed = parseRecipe({ kind: "novex-background", version: 1, effectId: definition.id,
      effectVersion: 1, seed: preset.seed, params: preset.params, assetIds: [...definition.assetIds] });
    if (!parsed.ok) throw new Error(`Invalid built-in material ${definition.id}/${preset.id}`);
    return { id: preset.id, label: preset.label, recipe: parsed.value };
  });

  const descriptor: BackgroundMaterialDescriptor = {
    id: definition.id, label: definition.label, description: definition.description,
    provenance: definition.provenance, presets, parseRecipe,
    readControls(recipe) {
      const parsed = parseRecipe(recipe);
      if (!parsed.ok) return [];
      return definition.schema.controls.flatMap(control => {
        const value = parsed.value.params[control.key];
        return typeof value === "number" || typeof value === "string" || typeof value === "boolean"
          ? [{ control, value }] : [];
      });
    },
    updateParameter(recipe, key, value) {
      const parsed = parseRecipe(recipe);
      if (!parsed.ok) return parsed;
      if (!definition.schema.controls.some(control => control.key === key)) return invalid("Неизвестный параметр.");
      return parseRecipe({ ...parsed.value, params: { ...parsed.value.params, [key]: value } });
    },
  };

  return {
    descriptor, fallback: definition.fallback,
    prepare(gl, limits) {
      return {
        id: definition.id,
        mount(recipe, viewport) {
          const parsed = parseRecipe(recipe);
          if (!parsed.ok) return { ok: false, error: { code: "invalid-config", message: parsed.issues.map(issue => issue.message).join(" ") } };
          const created = definition.create(gl, { params: parsed.value.params, seed: parsed.value.seed, viewport, limits });
          if (!created.ok) return created;
          const effect = created.value;
          return { ok: true, value: {
            update(next) {
              const valid = parseRecipe(next);
              if (!valid.ok) throw new Error(valid.issues.map(issue => issue.message).join(" "));
              effect.update(valid.value.params);
            },
            resize: size => effect.resize(size),
            render: frame => effect.render(frame),
            reset: seed => effect.reset(seed),
            dispose: () => effect.dispose(),
            ...(effect.getDiagnostics ? { getDiagnostics: () => effect.getDiagnostics!() } : {}),
          } };
        },
      };
    },
  };
}
