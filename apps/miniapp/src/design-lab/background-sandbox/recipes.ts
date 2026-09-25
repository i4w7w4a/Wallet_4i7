import type { BackgroundRecipe, BackgroundSandboxBindings, MaterialRecipeV2 } from "@wallet/ui";
import { parseMonoBackgroundRecipe, type MonoBackgroundRecipeConfig } from "../../mono-preview/mono-background-recipes";

/** Shell data union; the legacy format is not relabelled as a GPU effect. */
export type SandboxRecipe = BackgroundRecipe | MaterialRecipeV2 | MonoBackgroundRecipeConfig;
export const isV2Recipe = (recipe: SandboxRecipe): recipe is MaterialRecipeV2 => "kind" in recipe && recipe.kind === "novex-material";
export const isV1GpuRecipe = (recipe: SandboxRecipe): recipe is BackgroundRecipe => "kind" in recipe && recipe.kind !== "novex-material";
export const isGpuRecipe = (recipe: SandboxRecipe): recipe is BackgroundRecipe | MaterialRecipeV2 => "kind" in recipe;
export function recipeKey(recipe: SandboxRecipe) {
  return isV2Recipe(recipe) ? `material:${recipe.effectId}:${recipe.effectVersion}`
    : isV1GpuRecipe(recipe) ? recipe.effectId : `legacy-${recipe.recipe}`;
}
export function recipeParser(bindings?: BackgroundSandboxBindings) {
  return (input: unknown): SandboxRecipe => {
    if (input && typeof input === "object" && "kind" in input) {
      if (!bindings) throw new Error("GPU-материал недоступен в этой сборке. Исходные данные сохранены.");
      const result = input.kind === "novex-material"
        ? bindings.materialCatalogV2?.parseRecipe(input)
        : bindings.parseRecipe(input);
      if (!result) throw new Error("Версия материала недоступна в этой сборке. Исходные данные сохранены.");
      if (!result.ok) throw new Error(result.issues.map(issue => issue.message).join(" "));
      return result.value;
    }
    return parseMonoBackgroundRecipe(JSON.stringify(input));
  };
}
