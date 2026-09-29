import { DEFAULT_BACKGROUND_EDGE_FINISH, FLUID_VIEWPORT_RESPONSE_DEFAULTS, createTargetBinding, materialCatalogV2 } from "@wallet/ui";
import { expect, it } from "vitest";
import { createEmptyMonoMaterials, normalizeMonoMaterialMap } from "./mono-material-preset";
import { createDefaultActionArtworkMap } from "./action-artwork/model";

const artwork = () => { const map = createDefaultActionArtworkMap();
  map["quick.send"].packId = "volume-v1"; return map; };

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

it("preserves v1 backgrounds and strictly accepts a v2 Fluid viewport sidecar", () => {
  const fluid = materialCatalogV2.materials.find(item => item.id === "fluid")!.presets[0]!.recipe;
  const response = { ...FLUID_VIEWPORT_RESPONSE_DEFAULTS, enabled: true, edgeResponse: 0.71 };
  const materials = createEmptyMonoMaterials();
  materials.ledger = { background: { version: 2, recipe: fluid,
    edgeFinish: DEFAULT_BACKGROUND_EDGE_FINISH, viewportResponse: response }, buttons: null };
  expect(normalizeMonoMaterialMap(materials)).toEqual(materials);
  expect(() => normalizeMonoMaterialMap({ ...materials, ledger: { ...materials.ledger,
    background: { ...materials.ledger.background, viewportResponse: { ...response, inertia: Infinity } } } })).toThrow();
  expect(() => normalizeMonoMaterialMap({ ...materials, ledger: { ...materials.ledger,
    background: { ...materials.ledger.background, extra: true } } })).toThrow();
  materials.ledger = { background: { version: 1, recipe: fluid,
    edgeFinish: DEFAULT_BACKGROUND_EDGE_FINISH }, buttons: null };
  expect(normalizeMonoMaterialMap(materials)).toEqual(materials);
});

it("retains a frame-only separate button material and rejects unknown frame modes", () => {
  const materials = createEmptyMonoMaterials();
  materials.ledger = { background: null, buttons: { version: 2, frameMode: "separate", bindings: [] } };
  expect(normalizeMonoMaterialMap(materials).ledger.buttons).toEqual(materials.ledger.buttons);
  expect(() => normalizeMonoMaterialMap({ ...materials, ledger: { background: null,
    buttons: { version: 2, frameMode: "unsupported", bindings: [] } } })).toThrow();
  materials.ledger = { background: null, buttons: { version: 2, frameMode: "icons", bindings: [] } };
  expect(normalizeMonoMaterialMap(materials).ledger.buttons).toEqual(materials.ledger.buttons);
});

it("accepts complete v3 artwork and refuses unknown pack fields or targets", () => {
  const materials = createEmptyMonoMaterials();
  materials.ledger = { background: null, buttons: { version: 3, frameMode: "group", bindings: [], artwork: artwork() } };
  expect(normalizeMonoMaterialMap(materials)).toEqual(materials);
  expect(() => normalizeMonoMaterialMap({ ...materials, ledger: { background: null,
    buttons: { ...materials.ledger.buttons, artwork: { ...artwork(),
      "quick.send": { ...artwork()["quick.send"], url: "https://example.test/a.png" } } } } })).toThrow();
  expect(() => normalizeMonoMaterialMap({ ...materials, ledger: { background: null,
    buttons: { ...materials.ledger.buttons, artwork: { ...artwork(), "quick.fake": artwork()["quick.send"] } } } })).toThrow();
});
