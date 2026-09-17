import {
  normalizeMonoPaletteConfig, randomizeMonoPalette, resolveMonoPalette, setMonoPaletteLock, updateMonoPaletteRecipe,
  type MonoPaletteConfigV1, type MonoPaletteMode, type MonoPaletteRecipe,
  type MonoPaletteRandomizeResult, type MonoPaletteRole, type MonoPaletteScope, type MonoOklch, MONO_PALETTE_ROLE_SCHEMA,
} from "@wallet/ui";

export type MonoPaletteEditorSnapshot = { config: MonoPaletteConfigV1; mode: MonoPaletteMode; paletteEnabled?: boolean };
export type MonoPaletteSlot = {
  baseline: MonoPaletteEditorSnapshot;
  present: MonoPaletteEditorSnapshot;
  past: MonoPaletteEditorSnapshot[];
  future: MonoPaletteEditorSnapshot[];
  transaction: { key: string; before: MonoPaletteEditorSnapshot } | null;
};
export type MonoPaletteWorkspace = {
  version: 1;
  activeSlotId: 1 | 2 | 3;
  slots: [MonoPaletteSlot, MonoPaletteSlot, MonoPaletteSlot];
  compare: "baseline" | "draft" | null;
};

const clone = <T,>(value: T): T => structuredClone(value);
const slotIndex = (workspace: MonoPaletteWorkspace) => workspace.activeSlotId - 1;
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function createMonoPaletteWorkspace(config: MonoPaletteConfigV1 = normalizeMonoPaletteConfig()): MonoPaletteWorkspace {
  const makeSlot = (): MonoPaletteSlot => {
    const baseline = { config: normalizeMonoPaletteConfig(config), mode: "dark" as const };
    return { baseline: clone(baseline), present: clone(baseline), past: [], future: [], transaction: null };
  };
  return { version: 1, activeSlotId: 1, slots: [makeSlot(), makeSlot(), makeSlot()], compare: null };
}

function change(workspace: MonoPaletteWorkspace, edit: (snapshot: MonoPaletteEditorSnapshot) => MonoPaletteEditorSnapshot): MonoPaletteWorkspace {
  const next = clone(workspace), slot = next.slots[slotIndex(next)];
  const before = clone(slot.present), after = edit(clone(before));
  if (equal(before, after)) return workspace;
  if (!slot.transaction) {
    slot.past = [...slot.past, before].slice(-50);
    slot.future = [];
  }
  slot.present = after;
  next.compare = null;
  return next;
}

export function switchMonoPaletteSlot(workspace: MonoPaletteWorkspace, id: 1 | 2 | 3): MonoPaletteWorkspace {
  if (id === workspace.activeSlotId) return workspace;
  const next = clone(workspace);
  next.activeSlotId = id;
  next.compare = null;
  return next;
}

export function switchMonoPaletteTheme(workspace: MonoPaletteWorkspace, mode: MonoPaletteMode): MonoPaletteWorkspace {
  return change(workspace, snapshot => ({ ...snapshot, mode }));
}

export function editMonoPaletteRecipe(workspace: MonoPaletteWorkspace, patch: Partial<MonoPaletteRecipe>): MonoPaletteWorkspace {
  return change(workspace, snapshot => {
    const source = snapshot.config.themes[snapshot.mode];
    snapshot.config.themes[snapshot.mode] = updateMonoPaletteRecipe(source, patch);
    if (snapshot.config.linkedThemes) {
      const character: Partial<MonoPaletteRecipe> = {};
      for (const key of ["anchorHue", "anchorChroma", "harmony", "temperature", "iridescence"] as const) {
        if (patch[key] !== undefined) Object.assign(character, { [key]: snapshot.config.themes[snapshot.mode].recipe[key] });
      }
      if (Object.keys(character).length) {
        const other = snapshot.mode === "dark" ? "light" : "dark";
        snapshot.config.themes[other] = updateMonoPaletteRecipe(snapshot.config.themes[other], character);
      }
    }
    return snapshot;
  });
}

export function setMonoPaletteRoleMode(workspace: MonoPaletteWorkspace, role: MonoPaletteRole, mode: "linked" | "offset" | "manual"): MonoPaletteWorkspace {
  return change(workspace, snapshot => {
    const theme = snapshot.config.themes[snapshot.mode], state = theme.roles[role];
    const resolved = resolveMonoPalette(theme).roles[role];
    if (mode === "manual") state.value = clone(resolved);
    if (mode === "offset" && state.mode === "manual") {
      const linked = clone(theme);
      linked.roles[role].mode = "linked";
      const base = resolveMonoPalette(linked).roles[role];
      state.offset = { l: resolved.l - base.l, c: resolved.c - base.c, h: resolved.h - base.h };
    }
    state.mode = mode;
    return snapshot;
  });
}

export function setMonoPaletteWorkspaceLock(workspace: MonoPaletteWorkspace, scope: MonoPaletteScope, locked: boolean): MonoPaletteWorkspace {
  return change(workspace, snapshot => {
    snapshot.config.themes[snapshot.mode] = setMonoPaletteLock(snapshot.config.themes[snapshot.mode], scope, locked);
    return snapshot;
  });
}

const characterKeys = ["anchorHue", "anchorChroma", "harmony", "temperature", "iridescence"] as const;
export function previewMonoThemesLink(workspace: MonoPaletteWorkspace): Array<{ key: typeof characterKeys[number]; dark: number | string; light: number | string }> {
  const { dark, light } = workspace.slots[slotIndex(workspace)].present.config.themes;
  return characterKeys.filter(key => dark.recipe[key] !== light.recipe[key]).map(key =>
    ({ key, dark: dark.recipe[key], light: light.recipe[key] }));
}

export function setMonoThemesLinked(workspace: MonoPaletteWorkspace, linked: boolean, options: { confirm?: boolean } = {}): MonoPaletteWorkspace {
  if (linked && !workspace.slots[slotIndex(workspace)].present.config.linkedThemes && previewMonoThemesLink(workspace).length && !options.confirm)
    throw new Error("Confirm theme link diff before replacing the other character recipe");
  return change(workspace, snapshot => {
    if (snapshot.config.linkedThemes === linked) return snapshot;
    if (linked) {
      const source = snapshot.config.themes[snapshot.mode].recipe;
      const other = snapshot.mode === "dark" ? "light" : "dark";
      snapshot.config.themes[other] = updateMonoPaletteRecipe(snapshot.config.themes[other], {
        anchorHue: source.anchorHue, anchorChroma: source.anchorChroma, harmony: source.harmony,
        temperature: source.temperature, iridescence: source.iridescence,
      });
    }
    snapshot.config.linkedThemes = linked;
    return snapshot;
  });
}

export function setMonoPaletteSeed(workspace: MonoPaletteWorkspace, seed: string): MonoPaletteWorkspace {
  return change(workspace, snapshot => {
    snapshot.config.seed = seed.slice(0, 256);
    snapshot.config.actionCounter = 0;
    return snapshot;
  });
}

export function randomizeMonoPaletteWorkspace(workspace: MonoPaletteWorkspace, scope: MonoPaletteScope): { workspace: MonoPaletteWorkspace; result: MonoPaletteRandomizeResult } {
  const present = workspace.slots[slotIndex(workspace)].present;
  const result = randomizeMonoPalette(present.config, present.mode, scope);
  if (result.status !== "changed") return { workspace, result };
  return { result, workspace: change(workspace, snapshot => ({ ...snapshot, config: result.config })) };
}

export function resetMonoPaletteSlot(workspace: MonoPaletteWorkspace): MonoPaletteWorkspace {
  const baseline = workspace.slots[slotIndex(workspace)].baseline;
  return change(workspace, () => clone(baseline));
}

export function beginMonoPaletteTransaction(workspace: MonoPaletteWorkspace, key: string): MonoPaletteWorkspace {
  const next = clone(workspace), slot = next.slots[slotIndex(next)];
  if (slot.transaction) throw new Error("Palette transaction already active");
  slot.transaction = { key, before: clone(slot.present) };
  return next;
}

export function endMonoPaletteTransaction(workspace: MonoPaletteWorkspace, key: string): MonoPaletteWorkspace {
  const next = clone(workspace), slot = next.slots[slotIndex(next)], transaction = slot.transaction;
  if (!transaction || transaction.key !== key) throw new Error("Palette transaction key mismatch");
  if (!equal(transaction.before, slot.present)) {
    slot.past = [...slot.past, transaction.before].slice(-50);
    slot.future = [];
  }
  slot.transaction = null;
  return next;
}

export function undoMonoPaletteWorkspace(workspace: MonoPaletteWorkspace): MonoPaletteWorkspace {
  const next = clone(workspace), slot = next.slots[slotIndex(next)];
  if (slot.transaction || !slot.past.length) return workspace;
  slot.future.push(slot.present);
  slot.present = slot.past.pop()!;
  next.compare = null;
  return next;
}

export function redoMonoPaletteWorkspace(workspace: MonoPaletteWorkspace): MonoPaletteWorkspace {
  const next = clone(workspace), slot = next.slots[slotIndex(next)];
  if (slot.transaction || !slot.future.length) return workspace;
  slot.past.push(slot.present);
  slot.present = slot.future.pop()!;
  next.compare = null;
  return next;
}

export function toggleMonoPaletteCompare(workspace: MonoPaletteWorkspace): MonoPaletteWorkspace {
  return { ...workspace, compare: workspace.compare === "baseline" ? "draft" : "baseline" };
}

export function enableMonoPalette(workspace: MonoPaletteWorkspace, paletteEnabled: boolean): MonoPaletteWorkspace {
  return change(workspace, snapshot => ({ ...snapshot, paletteEnabled }));
}

export function replaceMonoPaletteConfig(workspace: MonoPaletteWorkspace, config: MonoPaletteConfigV1): MonoPaletteWorkspace {
  return change(workspace, snapshot => ({ ...snapshot, config: normalizeMonoPaletteConfig(config), paletteEnabled: true }));
}

export function editMonoPaletteRole(workspace: MonoPaletteWorkspace, role: MonoPaletteRole, patch: Partial<MonoOklch>): MonoPaletteWorkspace {
  return change(workspace, snapshot => {
    const theme = snapshot.config.themes[snapshot.mode], group = MONO_PALETTE_ROLE_SCHEMA[role].group;
    if (group === "system" || theme.groupLocks[group] || theme.roles[role].locked) return snapshot;
    const state = theme.roles[role];
    if (state.mode === "linked") return snapshot;
    if (state.mode === "manual") state.value = { ...state.value, ...patch };
    else state.offset = { ...state.offset, ...patch };
    snapshot.config = normalizeMonoPaletteConfig(snapshot.config);
    return snapshot;
  });
}
