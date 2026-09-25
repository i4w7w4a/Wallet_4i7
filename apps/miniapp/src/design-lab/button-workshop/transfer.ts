import type { MaterialCatalogV2, MaterialRecipeV2 } from "@wallet/ui";
import { boundedButtonJson, exactButtonObject } from "./codec";

export const BACKGROUND_TO_BUTTONS_KEY = "wallet4i7.material-copy.background-to-buttons.v1";
export const BUTTONS_TO_BACKGROUND_KEY = "wallet4i7.material-copy.buttons-to-background.v1";

/** Transient handoff only. The destination validates before offering a draft edit. */
export function parseBackgroundToButtonsTransfer(raw: string, catalog: MaterialCatalogV2): MaterialRecipeV2 {
  const data = exactButtonObject(boundedButtonJson(raw, 64 * 1024), ["version", "target", "recipe"]);
  if (data.version !== 1 || data.target !== "buttons") throw new Error("Неизвестная передача материала.");
  const result = catalog.copyForTarget(data.recipe, "button-fill");
  if (!result.ok) throw new Error(result.issues.map(issue => issue.message).join(" ") || "Материал не подходит для кнопок.");
  return result.value;
}

export function createButtonsToBackgroundTransfer(input: unknown, catalog: MaterialCatalogV2): string {
  const result = catalog.copyForTarget(input, "background");
  if (!result.ok) throw new Error(result.issues.map(issue => issue.message).join(" ") || "Материал не подходит для фона.");
  const raw = JSON.stringify({ version: 1, target: "background", recipe: result.value });
  boundedButtonJson(raw, 64 * 1024);
  return raw;
}
