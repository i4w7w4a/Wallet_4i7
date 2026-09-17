import { beforeEach, describe, expect, it } from "vitest";
import { createMonoPaletteWorkspace, enableMonoPalette, switchMonoPaletteTheme } from "./mono-palette-workspace";
import { MONO_PALETTE_PREPAINT_KEY, saveMonoPalettePrepaint } from "./mono-palette-prepaint";

beforeEach(() => localStorage.clear());

describe("palette prepaint cache", () => {
  it("stores only numeric paint channels, never raw CSS", () => {
    const workspace = switchMonoPaletteTheme(enableMonoPalette(createMonoPaletteWorkspace(), true), "light");
    saveMonoPalettePrepaint(localStorage, workspace);
    const raw = localStorage.getItem(MONO_PALETTE_PREPAINT_KEY)!;
    const cache = JSON.parse(raw);
    expect(cache.mode).toBe("light");
    expect(cache.paletteEnabled).toBe(true);
    expect(raw).not.toContain("rgb(");
    expect(Object.values(cache.tokens).length).toBeGreaterThan(50);
    for (const channels of Object.values(cache.tokens)) {
      expect(channels).toHaveLength(4);
      expect((channels as number[]).every(Number.isFinite)).toBe(true);
    }
  });

  it("keeps Compare out of the persisted paint cache", () => {
    const workspace = enableMonoPalette(createMonoPaletteWorkspace(), true);
    saveMonoPalettePrepaint(localStorage, workspace);
    const initial = localStorage.getItem(MONO_PALETTE_PREPAINT_KEY);
    saveMonoPalettePrepaint(localStorage, { ...workspace, compare: "baseline" });
    expect(localStorage.getItem(MONO_PALETTE_PREPAINT_KEY)).toBe(initial);
  });
});
