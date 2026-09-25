import { expect, test } from "vitest";
import { createButtonWorkspace, editButtonBinding, editButtonSlot, isButtonSlotDirty,
  selectButtonSlot, undoButtonSlot } from "./model";

const ACTIONS = ["send", "receive", "exchange", "buy"] as const;
type Action = typeof ACTIONS[number];
type Recipe = { effectId: string; params: { tint: string } };
const metal: Recipe = { effectId: "liquid-metal", params: { tint: "#abcdef" } };
const border: Recipe = { effectId: "pulsing-border", params: { tint: "#123456" } };

test("an individual layer edit leaves the other eleven bindings untouched", () => {
  const initial = createButtonWorkspace<Action, Recipe>(ACTIONS);
  const before = initial.slots[0].present.document;
  const changed = editButtonBinding(before, ACTIONS, "send", "fill", metal);
  expect(changed.actions.send).toEqual({ fill: metal, icon: null, border: null });
  for (const action of ACTIONS.slice(1)) expect(changed.actions[action]).toEqual({ fill: null, icon: null, border: null });
  expect(before.actions.send.fill).toBeNull();
  metal.params.tint = "#000000";
  expect(changed.actions.send.fill?.params.tint).toBe("#abcdef");
});

test("all four border edits are one undo transaction", () => {
  const initial = createButtonWorkspace<Action, Recipe>(ACTIONS);
  const changed = editButtonSlot(initial.slots[0], editButtonBinding(initial.slots[0].present.document, ACTIONS, "all", "border", border));
  expect(changed.past).toHaveLength(1);
  expect(ACTIONS.map(action => changed.present.document.actions[action].border?.effectId)).toEqual([
    "pulsing-border", "pulsing-border", "pulsing-border", "pulsing-border",
  ]);
  const undone = undoButtonSlot(changed);
  expect(ACTIONS.map(action => undone.present.document.actions[action].border)).toEqual([null, null, null, null]);
  expect(undoButtonSlot(undone, true).present.document.actions.buy.border?.effectId).toBe("pulsing-border");
});

test("three slots have independent drafts and dirty baselines", () => {
  const initial = createButtonWorkspace<Action, Recipe>(ACTIONS);
  const first = editButtonSlot(initial.slots[0], editButtonBinding(initial.slots[0].present.document, ACTIONS, "send", "fill", metal));
  const next = { ...initial, slots: [first, initial.slots[1], initial.slots[2]] as typeof initial.slots };
  const selected = selectButtonSlot(next, 2);
  expect(selected.activeSlot).toBe(2);
  expect(selected.slots[2].present.document.actions.send.fill).toBeNull();
  expect(isButtonSlotDirty(selected.slots[0])).toBe(true);
  expect(isButtonSlotDirty(selected.slots[2])).toBe(false);
});
