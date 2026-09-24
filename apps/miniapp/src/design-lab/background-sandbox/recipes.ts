import type { BackgroundRecipe, BackgroundSandboxBindings } from "@wallet/ui";
import { parseMonoBackgroundRecipe, type MonoBackgroundRecipeConfig } from "../../mono-preview/mono-background-recipes";

/** Shell data union; the legacy format is not relabelled as a GPU effect. */
export type SandboxRecipe = BackgroundRecipe | MonoBackgroundRecipeConfig;
export const isGpuRecipe = (recipe: SandboxRecipe): recipe is BackgroundRecipe => "kind" in recipe;
export function recipeKey(recipe: SandboxRecipe) { return isGpuRecipe(recipe) ? recipe.effectId : `legacy-${recipe.recipe}`; }
export function recipeParser(bindings?: BackgroundSandboxBindings) {
  return (input: unknown): SandboxRecipe => {
    if (input && typeof input === "object" && "kind" in input) {
      if (!bindings) throw new Error("GPU-материал недоступен в этой сборке. Исходные данные сохранены.");
      const result = bindings.parseRecipe(input);
      if (!result.ok) throw new Error(result.issues.map(issue => issue.message).join(" "));
      return result.value;
    }
    return parseMonoBackgroundRecipe(JSON.stringify(input));
  };
}
