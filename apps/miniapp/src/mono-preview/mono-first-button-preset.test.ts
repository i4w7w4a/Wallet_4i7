import { expect, it } from "vitest";
import original from "./first-iridescence.v1.json";
import { createEmptyMonoMaterials } from "./mono-material-preset";
import { createMonoWorkingDocument } from "./mono-working-presets";
import { FIRST_BUTTON_PRESET_NAME, createFirstButtonDocument, createFirstMonoWorkingDocument } from "./mono-first-button-preset";

it("keeps the owner's exact four-button source and only adds it to default MONO appearance", () => {
  expect(FIRST_BUTTON_PRESET_NAME).toBe("Первый · перелив");
  const buttons = createFirstButtonDocument();
  expect(buttons).toEqual(original);
  expect(Object.keys(buttons.actions)).toEqual(["quick.send", "quick.receive", "quick.swap", "quick.buy"]);
  for (const [targetId, action] of Object.entries(buttons.actions)) {
    expect(action.fill).toBeNull();
    expect(action.icon).toBeNull();
    expect(action.border).toMatchObject({ targetId, layer: "border", mask: { kind: "rounded-rect" },
      radiusCss: 0, borderWidthCss: 1.5, enabled: true,
      recipe: { kind: "novex-material", version: 2, effectId: "pulsing-border", effectVersion: 1, seed: 0,
        assetIds: [], params: { fit: "cover", scale: 1.15, rotation: 221, originX: 0.5, originY: 0.5,
          offsetX: -0.19, offsetY: 0.38, worldWidth: 0, worldHeight: 0, speed: 2, phaseMs: 120000,
          colorBack: "#000000", colors: ["#0dc1fd", "#d915ef", "#ff3f2ecc"], roundness: 0.14,
          thickness: 0.79, marginLeft: 0, marginRight: 0, marginTop: 0, marginBottom: 0,
          aspectRatio: "square", softness: 1, intensity: 0.2, bloom: 0.25, spots: 1, spotSize: 0.78,
          pulse: 1, smoke: 0.3, smokeSize: 0.94 } } });
  }
  (buttons.actions["quick.send"].border as { radiusCss: number }).radiusCss = 24;
  expect(createFirstButtonDocument()).toEqual(original);
  const starter = createFirstMonoWorkingDocument();
  expect(starter.materials.ledger.buttons).toEqual({ version: 1,
    bindings: [original.actions["quick.send"].border, original.actions["quick.receive"].border,
      original.actions["quick.swap"].border, original.actions["quick.buy"].border] });
  expect({ ...starter, materials: createEmptyMonoMaterials() }).toEqual(createMonoWorkingDocument());
});
