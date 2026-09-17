import { describe, expect, it } from "vitest";
import {
  MONO_PALETTE_GROUPS, MONO_PALETTE_HARMONIES, normalizeMonoPaletteConfig, resolveMonoPalette,
  setMonoPaletteLock, updateMonoPaletteRecipe, validateMonoPaletteApply, randomizeMonoPalette,
} from "./mono-palette";
import { monoContrastRatio } from "./mono-color-space";

describe("MONO palette schema and recipes", () => {
  it("normalizes independent dark/light branches and strips unknown fields", () => {
    const config = normalizeMonoPaletteConfig({ themes: { dark: { recipe: {
      anchorHue: -30, anchorChroma: 6, exposure: Infinity, harmony: "bad", shader: "bad",
    } } }, seed: "fixture", actionCounter: -5, code: "bad" });
    expect(config).toMatchObject({ version: 1, engineVersion: 1, catalogVersion: 1, skinId: "mono-ledger-v1",
      seed: "fixture", actionCounter: 0, themes: {
        dark: { mode: "dark", recipe: { anchorHue: 330, anchorChroma: 0.2, exposure: 0, harmony: "spectral-graphite" } },
        light: { mode: "light", recipe: { anchorHue: 250 } },
      } });
    expect(config).not.toHaveProperty("code");
    expect(config.themes.dark.recipe).not.toHaveProperty("shader");
    expect(normalizeMonoPaletteConfig(JSON.parse(JSON.stringify(config)))).toEqual(config);
    expect(() => normalizeMonoPaletteConfig({ version: 99 })).toThrow(/version/i);
    expect(() => normalizeMonoPaletteConfig({ engineVersion: 99 })).toThrow(/version/i);
  });

  it("derives every role and confines secondary harmony hues to decorative material", () => {
    const config = normalizeMonoPaletteConfig();
    for (const harmony of MONO_PALETTE_HARMONIES) {
      const theme = config.themes.dark;
      theme.recipe = { ...theme.recipe, anchorHue: 40, anchorChroma: 0.15, harmony, iridescence: 1 };
      const palette = resolveMonoPalette(theme);
      expect(Object.keys(palette.roles)).toHaveLength(24);
      for (const role of [...MONO_PALETTE_GROUPS.core, ...MONO_PALETTE_GROUPS.content]) {
        expect(palette.roles[role].c).toBeLessThanOrEqual(0.018);
        expect(palette.roles[role].h).toBe(40);
      }
      const expectedSecondary = { "spectral-graphite": 208, mineral: 40,
        "thermal-duet": 208, "analog-mist": 64, "split-prism": 190 }[harmony];
      expect(palette.roles.accentSecondary.h).toBe(expectedSecondary);
      expect(palette.roles.edgeWarm.h).toBe(harmony === "split-prism" ? 250 : expectedSecondary);
    }
    expect(resolveMonoPalette(config.themes.light).roles.canvas.l).toBeGreaterThan(0.9);
    expect(resolveMonoPalette(config.themes.dark).roles.canvas.l).toBeLessThan(0.2);
  });

  it("resolves manual values and offsets without mutating the recipe or caller", () => {
    const theme = normalizeMonoPaletteConfig().themes.dark;
    expect(theme?.roles).toBeDefined();
    const before = resolveMonoPalette(theme).roles.edgeCool;
    expect(before).toBeDefined();
    theme.roles.edgeCool.mode = "offset";
    theme.roles.edgeCool.offset = { l: 0.02, c: 0.01, h: 20 };
    theme.roles.accentPrimary.mode = "manual";
    theme.roles.accentPrimary.value = { l: 0.6, c: 0.03, h: 130, alpha: 0.5 };
    const snapshot = JSON.stringify(theme);
    const palette = resolveMonoPalette(theme);
    expect(palette.roles.edgeCool.l).toBeCloseTo(before.l + 0.02);
    expect(palette.roles.edgeCool.h).toBe((before.h + 20) % 360);
    expect(palette.roles.accentPrimary).toEqual({ l: 0.6, c: 0.03, h: 130, alpha: 0.5 });
    expect(JSON.stringify(theme)).toBe(snapshot);
  });
});

describe("MONO scoped deterministic randomization", () => {
  it("chooses a different admissible value when the sampled direction meets a lightness boundary", () => {
    const config = normalizeMonoPaletteConfig({ seed: "golden-v1" });
    config.themes.dark.roles.edgeWarm.mode = "manual";
    config.themes.dark.roles.edgeWarm.value = { l: 0, c: 0, h: 36, alpha: 1 };
    const result = randomizeMonoPalette(config, "dark", { kind: "point", role: "edgeWarm" });
    expect(result.status).toBe("changed");
    expect(resolveMonoPalette(result.config.themes.dark).roles.edgeWarm.l).toBeGreaterThan(0);
  });

  it("replays the V1 golden vector after a normalized JSON round-trip", () => {
    const config = normalizeMonoPaletteConfig({ seed: "golden-v1" });
    const result = randomizeMonoPalette(normalizeMonoPaletteConfig(JSON.parse(JSON.stringify(config))), "dark", { kind: "point", role: "edgeWarm" });
    // Frozen V1 fixture: FNV-1a channel streams, L=-.007 / C=.010 / H=36.
    expect(resolveMonoPalette(result.config.themes.dark).roles.edgeWarm)
      .toEqual({ l: 0.773, c: 0.01, h: 36, alpha: 1 });
    expect(result.replay).toMatchObject({ schemaHash: "c8019898", baseHash: "66fe044c" });
  });

  it("changes eligible values deterministically and records replay metadata", () => {
    const config = normalizeMonoPaletteConfig({ seed: "test-seed" });
    const input = JSON.stringify(config);
    const first = randomizeMonoPalette(config, "dark", { kind: "global" });
    expect(first.status).toBe("changed");
    expect(randomizeMonoPalette(config, "dark", { kind: "global" })).toEqual(first);
    expect(first.config.actionCounter).toBe(1);
    expect(first.replay).toMatchObject({ seed: "test-seed", actionCounter: 0, engineVersion: 1, catalogVersion: 1,
      skinId: "mono-ledger-v1", mode: "dark", scope: { kind: "global" }, schemaHash: expect.any(String), baseHash: expect.any(String) });
    expect(first.config.themes.light).toEqual(config.themes.light);
    expect(JSON.stringify(config)).toBe(input);
    const before = resolveMonoPalette(config.themes.dark), after = resolveMonoPalette(first.config.themes.dark);
    for (const role of first.changed) expect(after.roles[role]).not.toEqual(before.roles[role]);
    expect(first.changed.length).toBeGreaterThan(10);
    expect(validateMonoPaletteApply(first.config.themes.dark).valid).toBe(true);
    for (const role of MONO_PALETTE_GROUPS.system) expect(after.roles[role]).toEqual(before.roles[role]);
  });

  it("keeps neighbor streams stable when a role is locked and preserves exact scoped values", () => {
    const config = normalizeMonoPaletteConfig({ seed: "streams" });
    const unlocked = randomizeMonoPalette(config, "dark", { kind: "group", group: "decorative" });
    expect(unlocked.status).toBe("changed");
    config.themes.dark = setMonoPaletteLock(config.themes.dark, { kind: "point", role: "edgeCool" }, true);
    const locked = randomizeMonoPalette(config, "dark", { kind: "group", group: "decorative" });
    expect(locked.status).toBe("changed");
    const before = resolveMonoPalette(config.themes.dark), after = resolveMonoPalette(locked.config.themes.dark);
    expect(after.roles.edgeWarm).toEqual(resolveMonoPalette(unlocked.config.themes.dark).roles.edgeWarm);
    expect(after.roles.edgeCool).toEqual(before.roles.edgeCool);
    for (const role of [...MONO_PALETTE_GROUPS.core, ...MONO_PALETTE_GROUPS.content, ...MONO_PALETTE_GROUPS.structure]) {
      expect(after.roles[role]).toEqual(before.roles[role]);
      expect(after.srgb[role]).toEqual(before.srgb[role]);
    }
    expect(locked.skipped).toContainEqual({ role: "edgeCool", reason: "locked" });
  });

  it("point scope changes just one role; parent locks and protected points do not spend the counter", () => {
    const config = normalizeMonoPaletteConfig();
    const point = randomizeMonoPalette(config, "light", { kind: "point", role: "edgeWarm" });
    expect(point.changed).toEqual(["edgeWarm"]);
    const before = resolveMonoPalette(config.themes.light), after = resolveMonoPalette(point.config.themes.light);
    for (const role of Object.keys(before.roles) as Array<keyof typeof before.roles>) {
      if (role !== "edgeWarm") expect(after.roles[role]).toEqual(before.roles[role]);
    }
    config.themes.light = setMonoPaletteLock(config.themes.light, { kind: "group", group: "decorative" }, true);
    const locked = randomizeMonoPalette(config, "light", { kind: "point", role: "edgeWarm" });
    expect(locked).toMatchObject({ status: "noop", config, replay: null,
      skipped: [{ role: "edgeWarm", reason: "locked" }] });
    const protectedPoint = randomizeMonoPalette(config, "light", { kind: "point", role: "danger" });
    expect(protectedPoint).toMatchObject({ status: "noop", config, replay: null,
      skipped: [{ role: "danger", reason: "protected" }] });
  });

  it("returns an atomic error when locked foregrounds cannot satisfy contrast", () => {
    const config = normalizeMonoPaletteConfig();
    config.themes.dark.roles.textPrimary.mode = "manual";
    config.themes.dark.roles.textPrimary.value = { l: 0.12, c: 0, h: 0, alpha: 1 };
    config.themes.dark = setMonoPaletteLock(config.themes.dark, { kind: "point", role: "textPrimary" }, true);
    const result = randomizeMonoPalette(config, "dark", { kind: "global" });
    expect(result.status).toBe("error");
    expect(result.config).toEqual(config);
    expect(result.config.actionCounter).toBe(0);
    expect(result.issues.some(issue => issue.role === "textPrimary")).toBe(true);
  });
});

describe("MONO constraints and locks", () => {
  it("keeps recipe-following core/content offsets neutral while preserving invalid manual chroma", () => {
    const theme = normalizeMonoPaletteConfig().themes.dark;
    theme.roles.surfaceRaised.mode = "offset";
    theme.roles.surfaceRaised.offset.c = 0.3;
    theme.roles.textSecondary.mode = "offset";
    theme.roles.textSecondary.offset.c = 0.3;
    const palette = resolveMonoPalette(theme);
    expect(palette.roles.surfaceRaised.c).toBeLessThanOrEqual(0.018);
    expect(palette.roles.textSecondary.c).toBeLessThanOrEqual(0.018);
    theme.roles.surfaceRaised.mode = "manual";
    theme.roles.surfaceRaised.value = { l: 0.5, c: 0.08, h: 100, alpha: 1 };
    expect(resolveMonoPalette(theme).roles.surfaceRaised.c).toBeCloseTo(0.08);
    expect(validateMonoPaletteApply(theme).valid).toBe(false);
  });

  it("rejects a recipe edit whose contrast conflicts with a frozen text role", () => {
    let theme = normalizeMonoPaletteConfig().themes.dark;
    theme.roles.textPrimary.mode = "manual";
    theme.roles.textPrimary.value = { l: 0.767, c: 0, h: 0, alpha: 1 };
    theme = setMonoPaletteLock(theme, { kind: "point", role: "textPrimary" }, true);
    const snapshot = JSON.stringify(theme);
    expect(() => updateMonoPaletteRecipe(theme, { exposure: 0.08 })).toThrow(/lock|contrast/i);
    expect(JSON.stringify(theme)).toBe(snapshot);
  });

  it("repairs linked text for raised surfaces while leaving a failing manual draft visible", () => {
    const theme = normalizeMonoPaletteConfig().themes.dark;
    theme.roles.surfaceRaised = { ...theme.roles.surfaceRaised, mode: "manual", value: { l: 0.46, c: 0, h: 0, alpha: 1 } };
    let palette = resolveMonoPalette(theme);
    expect(monoContrastRatio(palette.srgb.textPrimary, palette.srgb.surfaceRaised)).toBeGreaterThanOrEqual(7);
    theme.roles.textPrimary = { ...theme.roles.textPrimary, mode: "manual", value: { l: 0.56, c: 0, h: 0, alpha: 1 } };
    palette = resolveMonoPalette(theme);
    expect(palette.roles.textPrimary.l).toBe(0.56);
    expect(validateMonoPaletteApply(theme, palette)).toMatchObject({ valid: false,
      issues: expect.arrayContaining([expect.objectContaining({ role: "textPrimary", code: "contrast", minimum: 7 })]) });
  });

  it("validates composited translucent material, neutrality and protected system roles", () => {
    const theme = normalizeMonoPaletteConfig().themes.dark;
    const before = resolveMonoPalette(theme);
    theme.roles.danger = { ...theme.roles.danger, mode: "manual", value: { l: 0, c: 0, h: 0, alpha: 0 } };
    expect(resolveMonoPalette(theme).roles.danger).toEqual(before.roles.danger);
    theme.roles.glassTint = { ...theme.roles.glassTint, mode: "manual", value: { l: 1, c: 0, h: 0, alpha: 0.8 } };
    theme.roles.textPrimary = { ...theme.roles.textPrimary, mode: "manual", value: { l: 0.9, c: 0.06, h: 130, alpha: 1 } };
    expect(validateMonoPaletteApply(theme)).toMatchObject({ valid: false, issues: expect.arrayContaining([
      expect.objectContaining({ role: "textPrimary", code: "contrast" }),
      expect.objectContaining({ role: "textPrimary", code: "neutrality" }),
    ]) });
  });

  it("keeps all default harmonies accessible in both themes", () => {
    for (const mode of ["dark", "light"] as const) for (const harmony of MONO_PALETTE_HARMONIES) {
      const theme = normalizeMonoPaletteConfig().themes[mode];
      theme.recipe.harmony = harmony;
      expect(validateMonoPaletteApply(theme).issues).toEqual([]);
    }
  });

  it("freezes exact role and parent-group values through recipe edits and child unlock", () => {
    let theme = normalizeMonoPaletteConfig().themes.dark;
    const before = resolveMonoPalette(theme);
    theme = setMonoPaletteLock(theme, { kind: "group", group: "decorative" }, true);
    theme = setMonoPaletteLock(theme, { kind: "point", role: "textSecondary" }, true);
    expect(theme.groupLocks.decorative).toBe(true);
    theme = setMonoPaletteLock(theme, { kind: "point", role: "edgeCool" }, false);
    theme = updateMonoPaletteRecipe(theme, { anchorHue: 30, anchorChroma: 0.16, exposure: 0.04 });
    const after = resolveMonoPalette(theme);
    expect(after.roles.canvas).not.toEqual(before.roles.canvas);
    for (const role of [...MONO_PALETTE_GROUPS.decorative, "textSecondary"] as const) {
      expect(after.roles[role]).toEqual(before.roles[role]);
      expect(after.srgb[role]).toEqual(before.srgb[role]);
    }
    expect(theme.roles.edgeCool.mode).toBe("linked");
  });
});
