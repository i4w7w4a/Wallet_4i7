import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { normalizeMonoPaletteConfig, randomizeMonoPaletteRecipe, resolveMonoPalette, setMonoPaletteLock } from "@wallet/ui";
import {
  createMonoPaletteFragment, exportMonoPalettePreset, importMonoPalettePreset,
  mergeMonoPaletteFragment, previewMonoPaletteFragment,
  type MonoSha256,
} from "./mono-preset-codec";

const digest: MonoSha256 = async bytes => new Uint8Array(createHash("sha256").update(bytes).digest());

describe("portable mono preset", () => {
  it("uses a versioned envelope for protected-focus quick variants and keeps V1 exports unchanged", async () => {
    const legacy = normalizeMonoPaletteConfig({ seed: "preset-focus-version" });
    const legacyText = await exportMonoPalettePreset(legacy, digest);
    expect(JSON.parse(legacyText).schemaVersion).toBe(1);
    const changed = randomizeMonoPaletteRecipe(legacy, "dark");
    expect(changed.status).toBe("changed");
    const text = await exportMonoPalettePreset(changed.config, digest);
    const portable = JSON.parse(text);
    expect(portable.schemaVersion).toBe(2);
    expect(portable.config.themes.dark.focusAnchor.version).toBe(1);
    const imported = await importMonoPalettePreset(text, digest);
    expect(imported.config).toEqual(changed.config);
    expect(imported.resolved.dark.roles.focus).toEqual(resolveMonoPalette(legacy.themes.dark).roles.focus);
    expect(await importMonoPalettePreset(legacyText, digest)).toMatchObject({ schemaVersion: 1, config: legacy });
  });

  it("carries focus protection through a full theme fragment but not a glass-only fragment", async () => {
    const base = normalizeMonoPaletteConfig({ seed: "fragment-focus-version" });
    const changed = randomizeMonoPaletteRecipe(base, "dark");
    expect(changed.status).toBe("changed");
    const preset = await importMonoPalettePreset(await exportMonoPalettePreset(changed.config, digest), digest);
    const dark = createMonoPaletteFragment(preset, "dark");
    expect(dark.version).toBe(2);
    const merged = mergeMonoPaletteFragment(base, dark);
    expect(merged.config.themes.dark.focusAnchor).toEqual(changed.config.themes.dark.focusAnchor);
    expect(resolveMonoPalette(merged.config.themes.dark).roles.focus).toEqual(resolveMonoPalette(base.themes.dark).roles.focus);
    const glass = createMonoPaletteFragment(preset, "glass-color");
    const glassMerged = mergeMonoPaletteFragment(base, glass);
    expect(glassMerged.config.themes.dark.focusAnchor).toBeUndefined();
  });

  it("exports and imports full normalized Dark/Light snapshots with verified SHA-256", async () => {
    const config = normalizeMonoPaletteConfig();
    config.seed = "portable-seed";
    config.themes.dark.recipe.anchorHue = 42;
    config.themes.light.recipe.exposure = -0.02;
    const text = await exportMonoPalettePreset(config, digest);
    const exported = JSON.parse(text);
    expect(exported.contentHash).toMatch(/^sha256-[0-9a-f]{64}$/);
    expect(exported.resolved.dark.roles.canvas).toEqual(resolveMonoPalette(config.themes.dark).roles.canvas);
    expect(exported.resolved.light.roles.canvas).toEqual(resolveMonoPalette(config.themes.light).roles.canvas);
    const imported = await importMonoPalettePreset(text, digest);
    expect(imported.config).toEqual(normalizeMonoPaletteConfig(config));
    expect(imported.contentHash).toBe(exported.contentHash);
  });

  it("rejects tampering, unknown fields, unknown versions and oversized imports atomically", async () => {
    const text = await exportMonoPalettePreset(normalizeMonoPaletteConfig(), digest);
    const modified = JSON.parse(text);
    modified.config.seed = "altered";
    await expect(importMonoPalettePreset(JSON.stringify(modified), digest)).rejects.toThrow(/hash/i);
    const unknown = JSON.parse(text);
    unknown.config.walletBalance = "100";
    await expect(importMonoPalettePreset(JSON.stringify(unknown), digest)).rejects.toThrow(/field/i);
    const version = JSON.parse(text);
    version.schemaVersion = 2;
    await expect(importMonoPalettePreset(JSON.stringify(version), digest)).rejects.toThrow(/version/i);
    await expect(importMonoPalettePreset(" ".repeat(131_073), digest)).rejects.toThrow(/size/i);
  });

  it("previews a partial diff and preserves locked roles by default", async () => {
    const target = normalizeMonoPaletteConfig();
    target.themes.dark.roles.glassTint.locked = true;
    target.themes.dark.roles.glassTint.lockedValue = resolveMonoPalette(target.themes.dark).roles.glassTint;
    const source = normalizeMonoPaletteConfig();
    source.themes.dark.roles.glassTint.mode = "manual";
    source.themes.dark.roles.glassTint.value = { l: 0.3, c: 0.04, h: 40, alpha: 0.2 };
    source.themes.dark.roles.edgeCool.mode = "manual";
    source.themes.dark.roles.edgeCool.value = { l: 0.75, c: 0.05, h: 70, alpha: 1 };
    source.themes.dark.roles.edgeCool.locked = true;
    const preset = await importMonoPalettePreset(await exportMonoPalettePreset(source, digest), digest);
    const fragment = createMonoPaletteFragment(preset, "glass-color");
    const preview = previewMonoPaletteFragment(target, fragment);
    expect(preview.diff.some(item => item.path === "themes.dark.roles.edgeCool")).toBe(true);
    expect(preview.skipped).toContain("themes.dark.roles.glassTint");
    const merged = mergeMonoPaletteFragment(target, fragment);
    expect(merged.config.themes.dark.roles.glassTint).toEqual(target.themes.dark.roles.glassTint);
    expect(merged.config.themes.dark.roles.edgeCool.mode).toBe("manual");
    expect(merged.config.themes.dark.roles.edgeCool.value).toEqual(source.themes.dark.roles.edgeCool.value);
    expect(merged.config.themes.dark.roles.edgeCool.locked).toBe(false);
    expect(target.themes.dark.roles.edgeCool.mode).toBe("linked");
  });

  it("restricts partial scopes to the named allowlist", async () => {
    const preset = await importMonoPalettePreset(await exportMonoPalettePreset(normalizeMonoPaletteConfig(), digest), digest);
    expect(() => createMonoPaletteFragment(preset, "themes.dark.roles.canvas" as never)).toThrow(/scope/i);
    const typography = createMonoPaletteFragment(preset, "typography");
    expect(typography.scope).toBe("typography");
    const result = mergeMonoPaletteFragment(normalizeMonoPaletteConfig(), typography);
    expect(result.diff).toEqual([]);
    expect(result.issues).toEqual(["Typography is not part of MonoPaletteConfigV1"]);
  });

  it("copies a linked glass-color fragment at its source resolved hue without changing outside roles", async () => {
    const source = normalizeMonoPaletteConfig();
    source.themes.dark.recipe.anchorHue = 42;
    const target = normalizeMonoPaletteConfig();
    const outsideBefore = resolveMonoPalette(target.themes.dark).roles.accentPrimary;
    const sourceHue = resolveMonoPalette(source.themes.dark).roles.edgeCool.h;
    const preset = await importMonoPalettePreset(await exportMonoPalettePreset(source, digest), digest);
    const result = mergeMonoPaletteFragment(target, createMonoPaletteFragment(preset, "glass-color"));
    expect(resolveMonoPalette(result.config.themes.dark).roles.edgeCool.h).toBeCloseTo(sourceHue, 9);
    expect(result.diff.some(item => item.path === "themes.dark.roles.edgeCool")).toBe(true);
    expect(resolveMonoPalette(result.config.themes.dark).roles.accentPrimary).toEqual(outsideBefore);
  });

  it("overrides color without importing source editor locks when respectLocks is false", async () => {
    const source = normalizeMonoPaletteConfig();
    source.themes.dark.roles.edgeCool.mode = "manual";
    source.themes.dark.roles.edgeCool.value = { l: 0.75, c: 0.05, h: 70, alpha: 1 };
    source.themes.dark = setMonoPaletteLock(source.themes.dark, { kind: "group", group: "core" }, true);
    const target = normalizeMonoPaletteConfig();
    target.themes.dark = setMonoPaletteLock(target.themes.dark, { kind: "point", role: "edgeCool" }, true);
    target.themes.dark = setMonoPaletteLock(target.themes.dark, { kind: "group", group: "decorative" }, true);
    const preset = await importMonoPalettePreset(await exportMonoPalettePreset(source, digest), digest);
    const merged = mergeMonoPaletteFragment(target, createMonoPaletteFragment(preset, "dark"), { respectLocks: false });
    expect(merged.config.themes.dark.groupLocks.decorative).toBe(true);
    expect(merged.config.themes.dark.groupLocks.core).toBe(false);
    expect(merged.config.themes.dark.roles.edgeCool.locked).toBe(true);
    expect(resolveMonoPalette(merged.config.themes.dark).roles.edgeCool).toEqual(resolveMonoPalette(source.themes.dark).roles.edgeCool);
  });

  it("rejects an entire fragment with an unknown internal config version atomically", async () => {
    const source = normalizeMonoPaletteConfig();
    source.seed = "imported";
    const preset = await importMonoPalettePreset(await exportMonoPalettePreset(source, digest), digest);
    const fragment = createMonoPaletteFragment(preset, "entire");
    (fragment.payload as { version: number }).version = 99;
    const target = normalizeMonoPaletteConfig();
    expect(() => mergeMonoPaletteFragment(target, fragment)).toThrow(/version/i);
    expect(target.seed).toBe("mono");
  });

  it("shows seed, counter and theme-link changes with resulting palette strips in entire preview", async () => {
    const source = normalizeMonoPaletteConfig();
    source.seed = "new-seed";
    source.actionCounter = 3;
    source.linkedThemes = true;
    source.themes.dark.recipe.anchorHue = 42;
    const target = normalizeMonoPaletteConfig();
    const preset = await importMonoPalettePreset(await exportMonoPalettePreset(source, digest), digest);
    const preview = previewMonoPaletteFragment(target, createMonoPaletteFragment(preset, "entire"));
    expect(preview.diff.map(item => item.path)).toEqual(expect.arrayContaining(["seed", "actionCounter", "linkedThemes"]));
    expect(preview.resolved.dark.roles.edgeCool).toEqual(resolveMonoPalette(preview.config.themes.dark).roles.edgeCool);
    expect(preview.resolved.light.roles.canvas).toEqual(resolveMonoPalette(preview.config.themes.light).roles.canvas);
  });
});
