import type { MaterialQualityProfile, MaterialRecipeV2, MaterialTargetBinding } from "./material-contract";

export function materialSceneStructureKey(
  background: MaterialRecipeV2 | null, bindings: readonly MaterialTargetBinding[], quality: MaterialQualityProfile,
): string {
  const recipeKey = (recipe: MaterialRecipeV2, icon: boolean) => {
    const shape = (recipe.effectId === "liquid-metal" || recipe.effectId === "gem-smoke") && !icon
      ? (recipe.params as { shape?: unknown }).shape === "none" ? "image" : "procedural"
      : null;
    return [recipe.kind, recipe.version, recipe.effectId, recipe.effectVersion,
      recipe.seed, recipe.assetIds, shape];
  };
  return JSON.stringify({
    quality,
    background: background ? recipeKey(background, false) : null,
    bindings: bindings.map(binding => [binding.targetId, binding.layer, binding.enabled,
      binding.mask, binding.radiusCss, binding.borderWidthCss,
      recipeKey(binding.recipe, binding.mask.kind === "icon")]),
  });
}
