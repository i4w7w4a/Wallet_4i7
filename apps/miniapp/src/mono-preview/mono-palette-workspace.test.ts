import { describe, expect, it } from "vitest";
import { normalizeMonoPaletteConfig, resolveMonoPalette } from "@wallet/ui";
import {
  beginMonoPaletteTransaction, createMonoPaletteWorkspace, editMonoPaletteRecipe,
  endMonoPaletteTransaction, redoMonoPaletteWorkspace, setMonoPaletteRoleMode,
  setMonoPaletteSeed, randomizeMonoPaletteWorkspace, resetMonoPaletteSlot,
  previewMonoThemesLink, setMonoPaletteWorkspaceLock, setMonoThemesLinked, switchMonoPaletteSlot,
  switchMonoPaletteTheme, toggleMonoPaletteCompare, undoMonoPaletteWorkspace,
} from "./mono-palette-workspace";

describe("mono palette workspace", () => {
  it("restores exact independent Dark and Light drafts and three slots", () => {
    let state = createMonoPaletteWorkspace();
    state = editMonoPaletteRecipe(state, { exposure: 0.03 });
    const dark = state.slots[0].present.config.themes.dark;
    state = switchMonoPaletteTheme(state, "light");
    state = editMonoPaletteRecipe(state, { exposure: -0.04 });
    const light = state.slots[0].present.config.themes.light;
    state = switchMonoPaletteSlot(state, 2);
    expect(state.slots[1].present.config.themes.dark.recipe.exposure).toBe(0);
    state = switchMonoPaletteSlot(state, 1);
    expect(state.slots[0].present.config.themes.dark).toEqual(dark);
    expect(state.slots[0].present.config.themes.light).toEqual(light);
    expect(state.slots[0].present.mode).toBe("light");
  });

  it("freezes a linked role into manual without a resolved color jump", () => {
    const before = createMonoPaletteWorkspace();
    const color = resolveMonoPalette(before.slots[0].present.config.themes.dark).roles.accentPrimary;
    const after = setMonoPaletteRoleMode(before, "accentPrimary", "manual");
    expect(after.slots[0].present.config.themes.dark.roles.accentPrimary.mode).toBe("manual");
    expect(resolveMonoPalette(after.slots[0].present.config.themes.dark).roles.accentPrimary).toEqual(color);
    const offset = setMonoPaletteRoleMode(after, "accentPrimary", "offset");
    const offsetColor = resolveMonoPalette(offset.slots[0].present.config.themes.dark).roles.accentPrimary;
    expect(offsetColor.l).toBeCloseTo(color.l, 9);
    expect(offsetColor.c).toBeCloseTo(color.c, 9);
    expect(offsetColor.h).toBeCloseTo(color.h, 9);
  });

  it("links character axes but keeps exposure, contrast and surface response per theme", () => {
    let state = createMonoPaletteWorkspace();
    state = setMonoThemesLinked(state, true);
    state = editMonoPaletteRecipe(state, { anchorHue: 35, harmony: "mineral", exposure: 0.03, contrast: 1.1 });
    expect(state.slots[0].present.config.themes.light.recipe.anchorHue).toBe(35);
    expect(state.slots[0].present.config.themes.light.recipe.harmony).toBe("mineral");
    expect(state.slots[0].present.config.themes.light.recipe.exposure).toBe(0);
    expect(state.slots[0].present.config.themes.light.recipe.contrast).toBe(1);
    state = setMonoThemesLinked(state, false);
    const frozen = structuredClone(state.slots[0].present.config.themes.light);
    state = editMonoPaletteRecipe(state, { anchorHue: 80 });
    expect(state.slots[0].present.config.themes.light).toEqual(frozen);
  });

  it("captures role and group locks with exact resolved snapshots", () => {
    let state = createMonoPaletteWorkspace();
    const before = resolveMonoPalette(state.slots[0].present.config.themes.dark);
    state = setMonoPaletteWorkspaceLock(state, { kind: "point", role: "accentPrimary" }, true);
    state = setMonoPaletteWorkspaceLock(state, { kind: "group", group: "core" }, true);
    expect(state.slots[0].present.config.themes.dark.roles.accentPrimary.lockedValue).toEqual(before.roles.accentPrimary);
    expect(state.slots[0].present.config.themes.dark.roles.canvas.lockedValue).toEqual(before.roles.canvas);
    state = editMonoPaletteRecipe(state, { anchorHue: 35 });
    const after = resolveMonoPalette(state.slots[0].present.config.themes.dark);
    expect(after.roles.accentPrimary).toEqual(before.roles.accentPrimary);
    expect(after.roles.canvas).toEqual(before.roles.canvas);
  });

  it("coalesces a gesture, restores full editor state, and clears redo on a branch", () => {
    let state = createMonoPaletteWorkspace();
    const original = structuredClone(state.slots[0].present);
    state = beginMonoPaletteTransaction(state, "hue-drag");
    state = editMonoPaletteRecipe(state, { anchorHue: 40 });
    state = editMonoPaletteRecipe(state, { anchorHue: 80 });
    state = endMonoPaletteTransaction(state, "hue-drag");
    expect(state.slots[0].past).toHaveLength(1);
    state = setMonoPaletteWorkspaceLock(state, { kind: "point", role: "accentPrimary" }, true);
    expect(state.slots[0].past).toHaveLength(2);
    state = undoMonoPaletteWorkspace(state);
    expect(state.slots[0].present.config.themes.dark.roles.accentPrimary.locked).toBe(false);
    state = undoMonoPaletteWorkspace(state);
    expect(state.slots[0].present).toEqual(original);
    state = redoMonoPaletteWorkspace(state);
    expect(state.slots[0].present.config.themes.dark.recipe.anchorHue).toBe(80);
    state = editMonoPaletteRecipe(state, { anchorHue: 100 });
    expect(state.slots[0].future).toHaveLength(0);
    expect(redoMonoPaletteWorkspace(state)).toEqual(state);
  });

  it("keeps compare history-neutral and leaves the draft untouched", () => {
    const before = createMonoPaletteWorkspace(normalizeMonoPaletteConfig());
    const after = toggleMonoPaletteCompare(before);
    expect(after.slots).toEqual(before.slots);
    expect(after.compare).toBe("baseline");
    expect(toggleMonoPaletteCompare(after).compare).toBe("draft");
  });

  it("requires an explicit confirmation before relinking divergent character recipes", () => {
    let state = createMonoPaletteWorkspace();
    state = editMonoPaletteRecipe(state, { anchorHue: 35 });
    const diff = previewMonoThemesLink(state);
    expect(diff).toEqual([{ key: "anchorHue", dark: 35, light: 250 }]);
    expect(() => setMonoThemesLinked(state, true)).toThrow(/confirm/i);
    const linked = setMonoThemesLinked(state, true, { confirm: true });
    expect(linked.slots[0].present.config.themes.light.recipe.anchorHue).toBe(35);
    expect(linked.slots[0].past).toHaveLength(2);
  });

  it("undoes seed reset, randomization counter and slot reset as complete snapshots", () => {
    let state = createMonoPaletteWorkspace();
    state = setMonoPaletteSeed(state, "replay");
    expect(state.slots[0].present.config.actionCounter).toBe(0);
    const random = randomizeMonoPaletteWorkspace(state, { kind: "point", role: "edgeCool" });
    expect(random.result.status).toBe("changed");
    expect(random.workspace.slots[0].present.config.actionCounter).toBe(1);
    state = resetMonoPaletteSlot(random.workspace);
    expect(state.slots[0].present.config.seed).toBe("mono");
    state = undoMonoPaletteWorkspace(state);
    expect(state.slots[0].present.config.seed).toBe("replay");
    expect(state.slots[0].present.config.actionCounter).toBe(1);
    state = undoMonoPaletteWorkspace(state);
    expect(state.slots[0].present.config.actionCounter).toBe(0);
    expect(state.slots[0].present.config.seed).toBe("replay");
  });
});
