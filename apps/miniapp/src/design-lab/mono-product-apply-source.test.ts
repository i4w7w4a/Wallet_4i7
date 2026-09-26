import { DEFAULT_BACKGROUND_EDGE_FINISH, createTargetBinding, materialCatalogV2 } from "@wallet/ui";
import { expect, it } from "vitest";
import { createButtonDocument } from "./button-workshop/model";
import { BUTTON_TARGETS } from "./button-workshop/binding";
import { backgroundPatchFromLab, buttonPatchFromLab } from "./mono-product-apply-source";

it("carries a complete installed v2 background and refuses unsupported lab material", () => {
  const fluid = materialCatalogV2.materials.find(item => item.id === "fluid")!.presets[0]!.recipe;
  const document = { kind: "novex-background-lab", version: 1, material: fluid,
    edgeFinish: DEFAULT_BACKGROUND_EDGE_FINISH };
  expect(backgroundPatchFromLab(document)).toEqual({ scope: "background", value: {
    version: 1, recipe: fluid, edgeFinish: DEFAULT_BACKGROUND_EDGE_FINISH,
  } });
  expect(() => backgroundPatchFromLab({ ...document, material: { kind: "novex-background", version: 1 } }))
    .toThrow(/v2|поддерж/);
});

it("extracts only the selected button layer and target from a full lab document", () => {
  const metal = materialCatalogV2.materials.find(item => item.id === "liquid-metal")!.presets[0]!.recipe;
  const border = materialCatalogV2.materials.find(item => item.id === "pulsing-border")!.presets[0]!.recipe;
  const sendFill = createTargetBinding("quick.send", "fill", metal, materialCatalogV2);
  const receiveFill = createTargetBinding("quick.receive", "fill", metal, materialCatalogV2);
  const sendBorder = createTargetBinding("quick.send", "border", border, materialCatalogV2);
  if (!sendFill.ok || !receiveFill.ok || !sendBorder.ok) throw new Error("Installed fixture is invalid");
  const document = createButtonDocument(BUTTON_TARGETS);
  document.actions["quick.send"].fill = sendFill.value;
  document.actions["quick.receive"].fill = receiveFill.value;
  document.actions["quick.send"].border = sendBorder.value;
  expect(buttonPatchFromLab(document, { target: "quick.send", layer: "border" })).toEqual({
    scope: "buttons", selection: { target: "quick.send", layer: "border" },
    value: { version: 1, bindings: [sendBorder.value] },
  });
  expect(buttonPatchFromLab(document, { target: "all", layer: "fill" }).value.bindings)
    .toEqual([sendFill.value, receiveFill.value]);
});

it("carries explicit frame mode even when the selected layer has no bindings", () => {
  const legacy = createButtonDocument(BUTTON_TARGETS);
  expect(buttonPatchFromLab(legacy, { target: "all", layer: "border" }).value).toEqual({ version: 1, bindings: [] });
  const separate = { version: 2 as const, frameMode: "separate" as const, actions: legacy.actions };
  expect(buttonPatchFromLab(separate, { target: "all", layer: "border" }).value).toEqual({
    version: 2, frameMode: "separate", bindings: [],
  });
  const icons = { version: 2 as const, frameMode: "icons" as const, actions: legacy.actions };
  expect(buttonPatchFromLab(icons, { target: "all", layer: "icon" }).value).toEqual({
    version: 2, frameMode: "icons", bindings: [],
  });
});
