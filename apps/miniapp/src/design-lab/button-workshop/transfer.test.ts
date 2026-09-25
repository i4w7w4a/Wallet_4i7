import { expect, test } from "vitest";
import type { MaterialCatalogV2, MaterialRecipeV2 } from "@wallet/ui";
import { parseBackgroundToButtonsTransfer, createButtonsToBackgroundTransfer,
  BACKGROUND_TO_BUTTONS_KEY, BUTTONS_TO_BACKGROUND_KEY } from "./transfer";

const recipe: MaterialRecipeV2<"liquid-metal"> = { kind: "novex-material", version: 2, effectId: "liquid-metal",
  effectVersion: 1, seed: 1, params: { colorTint: "#abcdef" }, assetIds: [] };
const catalog: MaterialCatalogV2 = { materials: [], parseRecipe: input => ({ ok: true, value: input as MaterialRecipeV2 }),
  copyForTarget: input => ({ ok: true, value: input as MaterialRecipeV2 }) };

test("one-shot transfer accepts a full normalized recipe for button fill only", () => {
  const raw = JSON.stringify({ version: 1, target: "buttons", recipe });
  expect(BACKGROUND_TO_BUTTONS_KEY).toBe("wallet4i7.material-copy.background-to-buttons.v1");
  expect(parseBackgroundToButtonsTransfer(raw, catalog)).toEqual(recipe);
  expect(() => parseBackgroundToButtonsTransfer(JSON.stringify({ version: 1, target: "buttons", recipe, script: "x" }), catalog)).toThrow();
  expect(() => parseBackgroundToButtonsTransfer(" ".repeat(65537), catalog)).toThrow(/64 KiB/);
});

test("reverse handoff exports only a full compatible recipe", () => {
  const raw = createButtonsToBackgroundTransfer(recipe, catalog);
  expect(BUTTONS_TO_BACKGROUND_KEY).toBe("wallet4i7.material-copy.buttons-to-background.v1");
  expect(JSON.parse(raw)).toEqual({ version: 1, target: "background", recipe });
});
