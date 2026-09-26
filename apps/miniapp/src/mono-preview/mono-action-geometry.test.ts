import { createTargetBinding, materialCatalogV2 } from "@wallet/ui";
import { expect, it } from "vitest";
import { actionButtonRadii, visibleActionBindings } from "./mono-action-geometry";

it("matches each separate DOM button to its enabled border or fill material radius", () => {
  const metal = materialCatalogV2.materials.find(item => item.id === "liquid-metal")!.presets[0]!.recipe;
  const border = materialCatalogV2.materials.find(item => item.id === "pulsing-border")!.presets[0]!.recipe;
  const fill = createTargetBinding("quick.send", "fill", metal, materialCatalogV2);
  const edge = createTargetBinding("quick.send", "border", border, materialCatalogV2);
  if (!fill.ok || !edge.ok) throw new Error("Installed fixture is invalid");
  expect(actionButtonRadii([{ ...fill.value, radiusCss: 4 }, { ...edge.value, radiusCss: 24 }])).toEqual({ "quick.send": 24 });
  expect(actionButtonRadii([{ ...edge.value, enabled: false }, { ...fill.value, radiusCss: 7 }])).toEqual({ "quick.send": 7 });
});

it("icon-only executes icons without deleting saved fill and border bindings", () => {
  const metal = materialCatalogV2.materials.find(item => item.id === "liquid-metal")!.presets[0]!.recipe;
  const border = materialCatalogV2.materials.find(item => item.id === "pulsing-border")!.presets[0]!.recipe;
  const fill = createTargetBinding("quick.send", "fill", metal, materialCatalogV2);
  const icon = createTargetBinding("quick.send", "icon", metal, materialCatalogV2);
  const edge = createTargetBinding("quick.send", "border", border, materialCatalogV2);
  if (!fill.ok || !icon.ok || !edge.ok) throw new Error("Installed fixture is invalid");
  const saved = [fill.value, icon.value, edge.value];
  expect(visibleActionBindings("icons", saved)).toEqual([icon.value]);
  expect(visibleActionBindings("group", saved)).toEqual(saved);
  expect(visibleActionBindings("separate", saved)).toEqual(saved);
  expect(saved).toHaveLength(3);
});
