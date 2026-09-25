import type { ParseResult } from "./contracts";
import type { MaterialCatalogV2 } from "./host-contract";
import type {
  ButtonMaterialLayer, ButtonTargetId, MaterialAssetId,
  MaterialCapability, MaterialMask, MaterialRecipeV2, MaterialTargetBinding,
} from "./material-contract";

export const BUTTON_MASK_ASSETS: Readonly<Record<ButtonTargetId, MaterialAssetId>> = Object.freeze({
  "quick.send": "mono.quick.send",
  "quick.receive": "mono.quick.receive",
  "quick.swap": "mono.quick.swap",
  "quick.buy": "mono.quick.buy",
});
export const MATERIAL_RADIUS_BOUNDS = Object.freeze({ min: 0, max: 24 });
export const MATERIAL_BORDER_BOUNDS = Object.freeze({ min: 1, max: 8 });
const LAYERS: readonly ButtonMaterialLayer[] = ["fill", "icon", "border"];
const KEYS = ["targetId", "layer", "recipe", "mask", "radiusCss", "borderWidthCss", "enabled"] as const;
const invalid = (message: string): ParseResult<never> =>
  ({ ok: false, issues: [{ code: "invalid-target-binding", message }] });

function exactRecord(input: unknown, keys: readonly string[]): input is Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return false;
  const prototype = Object.getPrototypeOf(input);
  if (prototype !== Object.prototype && prototype !== null) return false;
  const present = Object.keys(input);
  return present.length === keys.length && present.every(key => keys.includes(key));
}
function target(value: unknown): value is ButtonTargetId {
  return typeof value === "string" && Object.hasOwn(BUTTON_MASK_ASSETS, value);
}
function layer(value: unknown): value is ButtonMaterialLayer {
  return typeof value === "string" && LAYERS.includes(value as ButtonMaterialLayer);
}
function mask(value: unknown, targetId: ButtonTargetId, slot: ButtonMaterialLayer): value is MaterialMask {
  if (slot === "icon") return exactRecord(value, ["kind", "assetId"]) &&
    value.kind === "icon" && value.assetId === BUTTON_MASK_ASSETS[targetId];
  return exactRecord(value, ["kind"]) && value.kind === "rounded-rect";
}
function capability(slot: ButtonMaterialLayer): MaterialCapability { return `button-${slot}`; }

/** One strict, allowlisted boundary shared by button storage and the real scene host. */
export function parseTargetBinding(input: unknown, catalog: MaterialCatalogV2): ParseResult<MaterialTargetBinding> {
  if (!exactRecord(input, KEYS) || !target(input.targetId) || !layer(input.layer)) {
    return invalid("Неизвестная кнопка, слой или поле привязки.");
  }
  const { targetId, layer: slot } = input;
  const radiusCss = input.radiusCss, borderWidthCss = input.borderWidthCss;
  if (!mask(input.mask, targetId, slot) || typeof input.enabled !== "boolean" ||
      typeof radiusCss !== "number" || !Number.isFinite(radiusCss) ||
      radiusCss < MATERIAL_RADIUS_BOUNDS.min || radiusCss > MATERIAL_RADIUS_BOUNDS.max ||
      typeof borderWidthCss !== "number" || !Number.isFinite(borderWidthCss) ||
      (slot === "icon" && radiusCss !== 0) ||
      (slot === "border" ? borderWidthCss < MATERIAL_BORDER_BOUNDS.min ||
        borderWidthCss > MATERIAL_BORDER_BOUNDS.max : borderWidthCss !== 0)) {
    return invalid("Маска или геометрия кнопки не поддерживается.");
  }
  const recipe = catalog.copyForTarget(input.recipe, capability(slot));
  if (!recipe.ok) return recipe;
  return { ok: true, value: {
    targetId, layer: slot, recipe: recipe.value, mask: input.mask,
    radiusCss, borderWidthCss, enabled: input.enabled,
  } };
}

/** A new binding starts from a real installed recipe; it cannot invent a placeholder effect. */
export function createTargetBinding(targetId: ButtonTargetId, slot: ButtonMaterialLayer,
  recipe: MaterialRecipeV2, catalog: MaterialCatalogV2): ParseResult<MaterialTargetBinding> {
  return parseTargetBinding({
    targetId, layer: slot, recipe,
    mask: slot === "icon" ? { kind: "icon", assetId: BUTTON_MASK_ASSETS[targetId] } : { kind: "rounded-rect" },
    radiusCss: slot === "icon" ? 0 : 12,
    borderWidthCss: slot === "border" ? 1 : 0,
    enabled: true,
  }, catalog);
}

/** At most one fill, icon and border per real button. Reject the whole document on conflict. */
export function parseTargetBindings(input: unknown, catalog: MaterialCatalogV2):
  ParseResult<readonly MaterialTargetBinding[]> {
  if (!Array.isArray(input) || input.length > 12) return invalid("Нужно не больше 12 привязок четырёх кнопок.");
  const bindings: MaterialTargetBinding[] = [];
  const seen = new Set<string>();
  for (const entry of input) {
    const parsed = parseTargetBinding(entry, catalog);
    if (!parsed.ok) return parsed;
    const key = `${parsed.value.targetId}:${parsed.value.layer}`;
    if (seen.has(key)) return invalid("Повторяется слой одной кнопки.");
    seen.add(key); bindings.push(parsed.value);
  }
  return { ok: true, value: bindings };
}
