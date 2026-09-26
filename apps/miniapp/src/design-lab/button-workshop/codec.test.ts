import { expect, test } from "vitest";
import type { ButtonTargetId, MaterialTargetBinding } from "@wallet/ui";
import { createButtonWorkspace, editButtonBinding } from "./model";
import { parseButtonDocument, parseButtonImport, parseButtonWorkspace } from "./codec";

const ACTIONS = ["send", "receive", "exchange", "buy"] as const;
type Action = typeof ACTIONS[number];
type Recipe = { effectId: "liquid-metal" | "pulsing-border"; params: { tint: string } };
const parseRecipe = (input: unknown, layer: "fill" | "icon" | "border"): Recipe => {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw Error("Unknown recipe");
  const value = input as Record<string, unknown>;
  if (Object.keys(value).sort().join() !== "effectId,params" ||
    (layer === "border" ? value.effectId !== "pulsing-border" : value.effectId !== "liquid-metal")) throw Error("Incompatible material");
  const params = value.params as Record<string, unknown>;
  if (!params || Object.keys(params).join() !== "tint" || typeof params.tint !== "string" || !/^#[0-9a-f]{6}$/.test(params.tint)) throw Error("Invalid tint");
  return { effectId: value.effectId as Recipe["effectId"], params: { tint: params.tint } };
};

test("roundtrip retains fill, icon and border for all four actual targets", () => {
  let document = createButtonWorkspace<Action, Recipe>(ACTIONS).slots[0].present.document;
  document = editButtonBinding(document, ACTIONS, "all", "fill", { effectId: "liquid-metal", params: { tint: "#111111" } });
  document = editButtonBinding(document, ACTIONS, "receive", "icon", { effectId: "liquid-metal", params: { tint: "#222222" } });
  document = editButtonBinding(document, ACTIONS, "buy", "border", { effectId: "pulsing-border", params: { tint: "#333333" } });
  expect(parseButtonDocument(JSON.parse(JSON.stringify(document)), ACTIONS, parseRecipe)).toEqual(document);
  expect(parseButtonImport(JSON.stringify(document), ACTIONS, parseRecipe)).toEqual(document);
});

test("explicit frame mode roundtrips as v2 while legacy v1 keeps its exact shape", () => {
  const legacy = createButtonWorkspace<Action, Recipe>(ACTIONS).slots[0].present.document;
  const separate = { ...legacy, version: 2, frameMode: "separate" };
  expect(parseButtonDocument(legacy, ACTIONS, parseRecipe)).toEqual(legacy);
  expect(parseButtonImport(JSON.stringify(separate), ACTIONS, parseRecipe)).toEqual(separate);
  expect(() => parseButtonDocument({ ...separate, frameMode: "unknown" }, ACTIONS, parseRecipe)).toThrow();
  expect(() => parseButtonDocument({ ...legacy, frameMode: "separate" }, ACTIONS, parseRecipe)).toThrow();
});

test("codec refuses unknown targets, extra fields and an incompatible layer", () => {
  const document = createButtonWorkspace<Action, Recipe>(ACTIONS).slots[0].present.document;
  expect(() => parseButtonDocument({ ...document, actions: { ...document.actions, evil: document.actions.send } }, ACTIONS, parseRecipe)).toThrow();
  expect(() => parseButtonDocument({ ...document, script: "alert(1)" }, ACTIONS, parseRecipe)).toThrow();
  const bad = editButtonBinding(document, ACTIONS, "send", "border", { effectId: "liquid-metal", params: { tint: "#111111" } });
  expect(() => parseButtonDocument(bad, ACTIONS, parseRecipe)).toThrow("Incompatible material");
});

test("import limit and malformed recovery never normalize silently", () => {
  const document = createButtonWorkspace<Action, Recipe>(ACTIONS).slots[0].present.document;
  expect(() => parseButtonImport(" ".repeat(65537), ACTIONS, parseRecipe)).toThrow(/64 KiB/);
  const workspace = createButtonWorkspace<Action, Recipe>(ACTIONS);
  expect(() => parseButtonWorkspace(JSON.stringify({ ...workspace, version: 2 }), ACTIONS, parseRecipe)).toThrow(/Версия/);
  expect(() => parseButtonDocument({ ...document, actions: { ...document.actions, send: { fill: null, icon: null } } }, ACTIONS, parseRecipe)).toThrow();
});

test("full target bindings keep geometry and distinct IDs in one all-four edit", () => {
  const ids: readonly ButtonTargetId[] = ["quick.send", "quick.receive", "quick.swap", "quick.buy"];
  const recipe = { kind: "novex-material", version: 2, effectId: "liquid-metal", effectVersion: 1,
    seed: 7, params: { colorTint: "#abcdef" }, assetIds: [] } as const;
  const initial = createButtonWorkspace<ButtonTargetId, MaterialTargetBinding>(ids).slots[0].present.document;
  const document = editButtonBinding(initial, ids, "all", "fill", (targetId): MaterialTargetBinding => ({
    targetId, layer: "fill", recipe, mask: { kind: "rounded-rect" }, radiusCss: 0, borderWidthCss: 3, enabled: true,
  }));
  const parser = (input: unknown, layer: "fill" | "icon" | "border", target: ButtonTargetId): MaterialTargetBinding => {
    const value = input as MaterialTargetBinding;
    if (value.targetId !== target || value.layer !== layer) throw Error("Wrong target/layer");
    return value;
  };
  const restored = parseButtonDocument(JSON.parse(JSON.stringify(document)), ids, parser);
  expect(ids.map(id => restored.actions[id].fill?.targetId)).toEqual(ids);
  expect(restored.actions["quick.buy"].fill).toMatchObject({ radiusCss: 0, borderWidthCss: 3, enabled: true, mask: { kind: "rounded-rect" } });
  const swapped = JSON.parse(JSON.stringify(document));
  swapped.actions["quick.buy"].fill.targetId = "quick.send";
  expect(() => parseButtonDocument(swapped, ids, parser)).toThrow("Wrong target/layer");
});
