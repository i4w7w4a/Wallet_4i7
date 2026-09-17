import { beforeEach, describe, expect, it } from "vitest";
import { normalizeMonoPaletteConfig, resolveMonoPalette, setMonoPaletteLock } from "@wallet/ui";
import { createHash } from "node:crypto";
import { exportMonoPalettePreset, importMonoPalettePreset, type MonoSha256 } from "./mono-preset-codec";
import { beginMonoPaletteTransaction, createMonoPaletteWorkspace, editMonoPaletteRecipe, redoMonoPaletteWorkspace, toggleMonoPaletteCompare, undoMonoPaletteWorkspace } from "./mono-palette-workspace";
import {
  MONO_PALETTE_ACTIVE_KEY, MONO_PALETTE_PRESETS_KEY, MONO_PALETTE_WORKSPACE_KEY,
  applyMonoPaletteActive, loadMonoPaletteActive, loadMonoPalettePresets,
  loadMonoPaletteWorkspace, loadVerifiedMonoPalettePresets, readMonoPaletteWorkspace, saveMonoPalettePresets, saveMonoPaletteWorkspace,
} from "./mono-palette-storage";

const digest: MonoSha256 = async bytes => new Uint8Array(createHash("sha256").update(bytes).digest());

beforeEach(() => localStorage.clear());

describe("mono palette storage", () => {
  it("stores workspace, active appearance and local library under separate V1 keys", () => {
    const draft = editMonoPaletteRecipe(createMonoPaletteWorkspace(), { anchorHue: 42 });
    saveMonoPaletteWorkspace(localStorage, draft);
    expect(localStorage.getItem(MONO_PALETTE_WORKSPACE_KEY)).not.toBeNull();
    expect(localStorage.getItem(MONO_PALETTE_ACTIVE_KEY)).toBeNull();
    expect(localStorage.getItem(MONO_PALETTE_PRESETS_KEY)).toBeNull();
    expect(loadMonoPaletteWorkspace(localStorage).slots[0].present.config.themes.dark.recipe.anchorHue).toBe(42);
    applyMonoPaletteActive(localStorage, normalizeMonoPaletteConfig());
    saveMonoPalettePresets(localStorage, []);
    expect(loadMonoPaletteActive(localStorage)?.config.themes.dark.recipe.anchorHue).toBe(250);
    expect(loadMonoPalettePresets(localStorage)).toEqual([]);
    expect(localStorage.length).toBe(3);
  });

  it("recovers corrupt workspace and rejects unknown versions atomically without changing active", () => {
    applyMonoPaletteActive(localStorage, normalizeMonoPaletteConfig());
    localStorage.setItem(MONO_PALETTE_WORKSPACE_KEY, "{bad-json");
    expect(loadMonoPaletteWorkspace(localStorage).activeSlotId).toBe(1);
    localStorage.setItem(MONO_PALETTE_WORKSPACE_KEY, JSON.stringify({ version: 2, slots: [] }));
    expect(loadMonoPaletteWorkspace(localStorage).slots).toHaveLength(3);
    expect(loadMonoPaletteActive(localStorage)?.config.themes.dark.recipe.anchorHue).toBe(250);
    localStorage.setItem(MONO_PALETTE_ACTIVE_KEY, JSON.stringify({ version: 2, config: normalizeMonoPaletteConfig() }));
    expect(loadMonoPaletteActive(localStorage)).toBeNull();
  });

  it("distinguishes a corrupt workspace from a valid one so Active can recover", () => {
    expect(readMonoPaletteWorkspace(localStorage)).toBeNull();
    localStorage.setItem(MONO_PALETTE_WORKSPACE_KEY, "{bad-json");
    expect(readMonoPaletteWorkspace(localStorage)).toBeNull();
    saveMonoPaletteWorkspace(localStorage, createMonoPaletteWorkspace());
    expect(readMonoPaletteWorkspace(localStorage)?.activeSlotId).toBe(1);
  });

  it("does not persist the ephemeral Compare state", () => {
    const state = toggleMonoPaletteCompare(createMonoPaletteWorkspace());
    saveMonoPaletteWorkspace(localStorage, state);
    expect(loadMonoPaletteWorkspace(localStorage).compare).toBeNull();
  });

  it("does not replace a valid active appearance when Apply validation fails", () => {
    applyMonoPaletteActive(localStorage, normalizeMonoPaletteConfig());
    const invalid = normalizeMonoPaletteConfig();
    invalid.themes.dark.roles.canvas.mode = "manual";
    invalid.themes.dark.roles.canvas.value.alpha = 0;
    expect(() => applyMonoPaletteActive(localStorage, invalid)).toThrow();
    expect(loadMonoPaletteActive(localStorage)?.config.themes.dark.roles.canvas.mode).toBe("linked");
  });

  it("applies the exact locked color without leaking editor locks into active appearance", () => {
    const config = normalizeMonoPaletteConfig();
    config.themes.dark = setMonoPaletteLock(config.themes.dark, { kind: "point", role: "edgeCool" }, true);
    const color = resolveMonoPalette(config.themes.dark).roles.edgeCool;
    const active = applyMonoPaletteActive(localStorage, config);
    expect(active.config.themes.dark.roles.edgeCool.locked).toBe(false);
    expect(active.config.themes.dark.roles.edgeCool.lockedValue).toBeNull();
    expect(resolveMonoPalette(active.config.themes.dark).roles.edgeCool).toEqual(color);
    expect(config.themes.dark.roles.edgeCool.locked).toBe(true);
  });

  it("rejects a library containing an unknown preset version rather than loading a prefix", () => {
    localStorage.setItem(MONO_PALETTE_PRESETS_KEY, JSON.stringify({ version: 1, presets: [
      { schemaVersion: 1, skinId: "mono-ledger-v1" },
      { schemaVersion: 2, skinId: "mono-ledger-v1" },
    ] }));
    expect(loadMonoPalettePresets(localStorage)).toEqual([]);
  });

  it("verifies every local revision hash before restoring any preset", async () => {
    const preset = await importMonoPalettePreset(await exportMonoPalettePreset(normalizeMonoPaletteConfig(), digest), digest);
    saveMonoPalettePresets(localStorage, [preset]);
    expect(await loadVerifiedMonoPalettePresets(localStorage, digest)).toEqual([preset]);
    const forged = structuredClone(preset);
    forged.config.seed = "forged";
    localStorage.setItem(MONO_PALETTE_PRESETS_KEY, JSON.stringify({ version: 1, presets: [preset, forged] }));
    expect(await loadVerifiedMonoPalettePresets(localStorage, digest)).toEqual([]);
  });

  it("saves an active edited gesture as one coherent history branch", () => {
    let state = editMonoPaletteRecipe(createMonoPaletteWorkspace(), { anchorHue: 42 });
    state = undoMonoPaletteWorkspace(state);
    state = beginMonoPaletteTransaction(state, "hue-drag");
    state = editMonoPaletteRecipe(state, { anchorHue: 80 });
    saveMonoPaletteWorkspace(localStorage, state);
    const restored = loadMonoPaletteWorkspace(localStorage);
    expect(restored.slots[0].past).toHaveLength(1);
    expect(restored.slots[0].future).toHaveLength(0);
    expect(undoMonoPaletteWorkspace(restored).slots[0].present.config.themes.dark.recipe.anchorHue).toBe(250);
    expect(redoMonoPaletteWorkspace(undoMonoPaletteWorkspace(restored)).slots[0].present.config.themes.dark.recipe.anchorHue).toBe(80);
  });
});
