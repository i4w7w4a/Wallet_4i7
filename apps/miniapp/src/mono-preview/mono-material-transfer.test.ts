import { DEFAULT_BACKGROUND_EDGE_FINISH, createTargetBinding, materialCatalogV2 } from "@wallet/ui";
import { expect, it } from "vitest";
import { createMonoWorkingDocument, exportMonoWorkingPreset, previewMonoWorkingImport,
  type MonoWorkingLibrary } from "./mono-working-presets";
import { applyMonoMaterialPatch } from "./mono-material-transfer";

it("applies background then buttons to one chosen record and direction without changing other fields", async () => {
  const first = createMonoWorkingDocument();
  first.appearance.ledger.logo.hue = 47;
  const second = createMonoWorkingDocument();
  second.appearance.frost.logo.hue = 204;
  second.background = "strata";
  const library: MonoWorkingLibrary = { version: 2, skinId: "mono-ledger-v1", generation: 6,
    activeId: "first", records: [
      { id: "first", name: "Первый", revision: 2, document: first },
      { id: "second", name: "Второй", revision: 3, document: second },
    ] };
  const untouched = structuredClone(library);
  const fluid = materialCatalogV2.materials.find(item => item.id === "fluid")!.presets[0]!.recipe;
  const background = { version: 1 as const, recipe: fluid, edgeFinish: DEFAULT_BACKGROUND_EDGE_FINISH };
  const withBackground = applyMonoMaterialPatch(library, { targetId: "second", direction: "frost",
    expectedGeneration: 6, expectedRevision: 3, patch: { scope: "background", value: background } });

  const border = materialCatalogV2.materials.find(item => item.id === "pulsing-border")!.presets[0]!.recipe;
  const binding = createTargetBinding("quick.send", "border", border, materialCatalogV2);
  if (!binding.ok) throw new Error("Installed border fixture is invalid");
  const withButtons = applyMonoMaterialPatch(withBackground, { targetId: "second", direction: "frost",
    expectedGeneration: 7, expectedRevision: 4,
    patch: { scope: "buttons", selection: { target: "quick.send", layer: "border" },
      value: { version: 1, bindings: [binding.value] } } });

  expect(withButtons.generation).toBe(8);
  expect(withButtons.activeId).toBe("second");
  expect(withButtons.records[0]).toEqual(untouched.records[0]);
  expect(withButtons.records[1].revision).toBe(5);
  expect(withButtons.records[1].document.materials.frost).toEqual({
    background, buttons: { version: 1, bindings: [binding.value] },
  });
  expect(withButtons.records[1].document.materials.ledger).toEqual({ background: null, buttons: null });
  expect(withButtons.records[1].document.appearance).toEqual(untouched.records[1].document.appearance);
  expect(withButtons.records[1].document.palette).toEqual(untouched.records[1].document.palette);
  expect(withButtons.records[1].document.background).toBe("strata");
  expect(library).toEqual(untouched);
  const imported = await previewMonoWorkingImport(exportMonoWorkingPreset("Второй", withButtons.records[1].document));
  expect(imported.document.materials.frost).toEqual(withButtons.records[1].document.materials.frost);
});

it("merges only the selected button layer and target, including an explicit clear", () => {
  const document = createMonoWorkingDocument();
  const library: MonoWorkingLibrary = { version: 2, skinId: "mono-ledger-v1", generation: 1,
    activeId: "mine", records: [{ id: "mine", name: "Мой", revision: 1, document }] };
  const metal = materialCatalogV2.materials.find(item => item.id === "liquid-metal")!.presets[0]!.recipe;
  const border = materialCatalogV2.materials.find(item => item.id === "pulsing-border")!.presets[0]!.recipe;
  const binding = (target: "quick.send" | "quick.receive", layer: "fill" | "border", recipe: typeof metal) => {
    const result = createTargetBinding(target, layer, recipe, materialCatalogV2);
    if (!result.ok) throw new Error("Installed fixture is invalid");
    return result.value;
  };
  const sendFill = binding("quick.send", "fill", metal);
  const receiveFill = binding("quick.receive", "fill", metal);
  const sendBorder = binding("quick.send", "border", border);
  const withFill = applyMonoMaterialPatch(library, { targetId: "mine", direction: "ledger",
    expectedGeneration: 1, expectedRevision: 1,
    patch: { scope: "buttons", selection: { target: "all", layer: "fill" },
      value: { version: 1, bindings: [sendFill, receiveFill] } } });
  const withBorder = applyMonoMaterialPatch(withFill, { targetId: "mine", direction: "ledger",
    expectedGeneration: 2, expectedRevision: 2,
    patch: { scope: "buttons", selection: { target: "quick.send", layer: "border" },
      value: { version: 1, bindings: [sendBorder] } } });
  expect(withBorder.records[0].document.materials.ledger.buttons?.bindings).toEqual([sendFill, receiveFill, sendBorder]);
  const cleared = applyMonoMaterialPatch(withBorder, { targetId: "mine", direction: "ledger",
    expectedGeneration: 3, expectedRevision: 3,
    patch: { scope: "buttons", selection: { target: "quick.send", layer: "fill" },
      value: { version: 1, bindings: [] } } });
  expect(cleared.records[0].document.materials.ledger.buttons?.bindings).toEqual([receiveFill, sendBorder]);
});

it("keeps explicit separate mode through later layer edits and clearing the last binding", async () => {
  const document = createMonoWorkingDocument();
  document.appearance.ledger.logo.hue = 73;
  const library: MonoWorkingLibrary = { version: 2, skinId: "mono-ledger-v1", generation: 1,
    activeId: "mine", records: [{ id: "mine", name: "Мой", revision: 1, document }] };
  const metal = materialCatalogV2.materials.find(item => item.id === "liquid-metal")!.presets[0]!.recipe;
  const created = createTargetBinding("quick.send", "fill", metal, materialCatalogV2);
  if (!created.ok) throw new Error("Installed fixture is invalid");
  const separate = applyMonoMaterialPatch(library, { targetId: "mine", direction: "ledger",
    expectedGeneration: 1, expectedRevision: 1,
    patch: { scope: "buttons", selection: { target: "quick.send", layer: "fill" },
      value: { version: 2, frameMode: "separate", bindings: [created.value] } } });
  const cleared = applyMonoMaterialPatch(separate, { targetId: "mine", direction: "ledger",
    expectedGeneration: 2, expectedRevision: 2,
    patch: { scope: "buttons", selection: { target: "quick.send", layer: "fill" },
      value: { version: 1, bindings: [] } } });
  expect(cleared.records[0].document.materials.ledger.buttons).toEqual({
    version: 2, frameMode: "separate", bindings: [],
  });
  expect(cleared.records[0].document.appearance.ledger.logo.hue).toBe(73);
  const restored = await previewMonoWorkingImport(exportMonoWorkingPreset("Мой", cleared.records[0].document));
  expect(restored.document.materials.ledger.buttons).toEqual(cleared.records[0].document.materials.ledger.buttons);
});

it("switches to a common frame without removing bindings in other layers", () => {
  const document = createMonoWorkingDocument();
  const metal = materialCatalogV2.materials.find(item => item.id === "liquid-metal")!.presets[0]!.recipe;
  const created = createTargetBinding("quick.send", "fill", metal, materialCatalogV2);
  if (!created.ok) throw new Error("Installed fixture is invalid");
  document.materials.ledger = { background: null,
    buttons: { version: 2, frameMode: "separate", bindings: [created.value] } };
  const library: MonoWorkingLibrary = { version: 2, skinId: "mono-ledger-v1", generation: 1,
    activeId: "mine", records: [{ id: "mine", name: "Мой", revision: 1, document }] };
  const updated = applyMonoMaterialPatch(library, { targetId: "mine", direction: "ledger",
    expectedGeneration: 1, expectedRevision: 1,
    patch: { scope: "buttons", selection: { target: "all", layer: "border" },
      value: { version: 2, frameMode: "group", bindings: [] } } });
  expect(updated.records[0].document.materials.ledger.buttons).toEqual({
    version: 2, frameMode: "group", bindings: [created.value],
  });
});
