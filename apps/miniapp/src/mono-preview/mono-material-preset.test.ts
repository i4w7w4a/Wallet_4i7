import { DEFAULT_BACKGROUND_EDGE_FINISH, createTargetBinding, materialCatalogV2 } from "@wallet/ui";
import { expect, it } from "vitest";
import { createEmptyMonoMaterials, normalizeMonoMaterialMap } from "./mono-material-preset";

it("accepts installed background and button material only in their selected direction", () => {
  const fluid = materialCatalogV2.materials.find(item => item.id === "fluid")!.presets[0]!.recipe;
  const border = materialCatalogV2.materials.find(item => item.id === "pulsing-border")!.presets[0]!.recipe;
  const created = createTargetBinding("quick.send", "border", border, materialCatalogV2);
  if (!created.ok) throw new Error("Installed border fixture is invalid");
  const materials = createEmptyMonoMaterials();
  materials.frost = {
    background: { version: 1, recipe: fluid, edgeFinish: DEFAULT_BACKGROUND_EDGE_FINISH },
    buttons: { version: 1, bindings: [created.value] },
  };

  const parsed = normalizeMonoMaterialMap(materials);
  expect(parsed.frost.background?.recipe).toEqual(fluid);
  expect(parsed.frost.buttons?.bindings).toEqual([created.value]);
  expect(parsed.ledger).toEqual({ background: null, buttons: null });
  expect(parsed.mercury).toEqual({ background: null, buttons: null });
});
