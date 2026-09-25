import { expect, test } from "vitest";
import { createButtonSession } from "./session";
import { ACCEPTED_KEY, LIBRARY_KEY, WORKSPACE_KEY } from "./storage";

const ACTIONS = ["send", "receive", "exchange", "buy"] as const;
type Recipe = { effectId: string; params: { tint: string } };
const metal: Recipe = { effectId: "liquid-metal", params: { tint: "#abcdef" } };
const border: Recipe = { effectId: "pulsing-border", params: { tint: "#123456" } };
function parseRecipe(input: unknown, layer: "fill" | "icon" | "border"): Recipe {
  if (!input || typeof input !== "object") throw Error("Unknown recipe");
  const value = input as Recipe;
  if (value.effectId !== (layer === "border" ? "pulsing-border" : "liquid-metal") || !/^#[0-9a-f]{6}$/.test(value.params?.tint)) throw Error("Incompatible recipe");
  return { effectId: value.effectId, params: { tint: value.params.tint } };
}
function memoryStorage() {
  const values = new Map<string, string>();
  return { values, getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
}
const lock = async <T,>(task: () => T) => task();

test("Apply accepts only the current complete draft; Cancel restores accepted preview", async () => {
  const store = memoryStorage();
  const editor = createButtonSession(ACTIONS, parseRecipe);
  editor.connect(store, lock);
  editor.edit("all", "fill", metal);
  editor.edit("buy", "border", border);
  expect(editor.getSnapshot().accepted.actions.buy.border).toBeNull();
  expect(await editor.apply()).toBe(true);
  expect(editor.getSnapshot().accepted.actions.buy.border).toEqual(border);
  editor.edit("send", "icon", metal);
  editor.cancel();
  expect(editor.shownDocument().actions.send.icon).toBeNull();
  expect(editor.shownDocument().actions.buy.border).toEqual(border);
  expect(JSON.parse(store.values.get(ACCEPTED_KEY)!).actions.send.icon).toBeNull();
});

test("reload restores accepted bindings and three independent recovery drafts", async () => {
  const store = memoryStorage();
  const first = createButtonSession(ACTIONS, parseRecipe);
  first.connect(store, lock);
  first.edit("send", "fill", metal);
  expect(await first.apply()).toBe(true);
  first.selectSlot(1);
  first.edit("receive", "icon", metal);
  first.selectTarget("receive"); first.selectLayer("icon");
  await first.flushRecovery();
  expect(first.getSnapshot().recoveryError).toBe("");
  expect(JSON.parse(store.values.get(WORKSPACE_KEY)!).activeSlot).toBe(1);
  const reloaded = createButtonSession(ACTIONS, parseRecipe);
  reloaded.connect(store, lock);
  expect(reloaded.getSnapshot().accepted.actions.send.fill).toEqual(metal);
  expect(reloaded.getSnapshot().workspace.activeSlot).toBe(1);
  expect(reloaded.getSnapshot().workspace.selection).toEqual({ target: "receive", layer: "icon" });
  expect(reloaded.shownDocument().actions.receive.icon).toEqual(metal);
  expect(reloaded.getSnapshot().workspace.slots[0].present.document.actions.send.fill).toEqual(metal);
  expect(store.values.has(LIBRARY_KEY)).toBe(false);
  expect(store.values.has(WORKSPACE_KEY)).toBe(true);
});

test("Save and Save-as create full named snapshots without applying or touching product keys", async () => {
  const store = memoryStorage();
  store.values.set("wallet4i7.mono.working-presets.v2", "protected");
  const editor = createButtonSession(ACTIONS, parseRecipe);
  editor.connect(store, lock);
  editor.edit("all", "fill", metal);
  editor.edit("buy", "border", border);
  expect(await editor.save("Metal / border")).toBe(true);
  expect(editor.getSnapshot().library.trials[0].document.actions.buy.border).toEqual(border);
  expect(editor.getSnapshot().accepted.actions.buy.border).toBeNull();
  editor.edit("send", "icon", metal);
  expect(await editor.save("Second", true)).toBe(true);
  expect(editor.getSnapshot().library.trials).toHaveLength(2);
  editor.openTrial(editor.getSnapshot().library.trials[0]);
  expect(editor.shownDocument().actions.send.icon).toBeNull();
  expect(editor.shownDocument().actions.buy.border).toEqual(border);
  expect(store.values.get("wallet4i7.mono.working-presets.v2")).toBe("protected");
});

test("a stale library or quota failure keeps live draft and never reports Saved", async () => {
  const store = memoryStorage();
  const editor = createButtonSession(ACTIONS, parseRecipe);
  editor.connect(store, lock);
  editor.edit("send", "fill", metal);
  store.values.set(LIBRARY_KEY, "external change");
  expect(await editor.save("Conflict")).toBe(false);
  expect(editor.getSnapshot().saveError).toMatch(/другой вкладке/);
  expect(editor.shownDocument().actions.send.fill).toEqual(metal);
  expect(editor.getSnapshot().library.trials).toHaveLength(0);
});

test("unparseable workspace is preserved until explicit fresh start", () => {
  const store = memoryStorage();
  store.values.set(WORKSPACE_KEY, "{bad-json");
  const editor = createButtonSession(ACTIONS, parseRecipe);
  editor.connect(store, lock);
  expect(editor.getSnapshot().recoveryUnavailable).toBe(true);
  expect(store.values.get(WORKSPACE_KEY)).toBe("{bad-json");
});

test("a first visit records the initial draft for exact reload", async () => {
  const store = memoryStorage();
  const initial = createButtonSession(ACTIONS, parseRecipe);
  initial.connect(store, lock);
  await initial.flushRecovery();
  expect(store.values.has(WORKSPACE_KEY)).toBe(true);
  expect(JSON.parse(store.values.get(WORKSPACE_KEY)!).slots).toHaveLength(3);
});

test("recovery storage failure reports an error without rejecting the flush or losing the live draft", async () => {
  let reads = 0;
  const store = {
    getItem() { reads++; if (reads > 3) throw Error("Storage unavailable"); return null; },
    setItem() { throw Error("Quota"); },
  };
  const editor = createButtonSession(ACTIONS, parseRecipe);
  editor.connect(store, lock);
  editor.edit("send", "fill", metal);
  await expect(editor.flushRecovery()).resolves.toBeUndefined();
  expect(editor.getSnapshot().recoveryError).not.toBe("");
  expect(editor.shownDocument().actions.send.fill).toEqual(metal);
});
