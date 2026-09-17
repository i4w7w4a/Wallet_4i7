import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { normalizeMonoPaletteConfig, resolveMonoPalette } from "@wallet/ui";
import {
  createMonoPaletteFragment, exportMonoPalettePreset, importMonoPalettePreset,
  mergeMonoPaletteFragment, previewMonoPaletteFragment,
  type MonoSha256,
} from "./mono-preset-codec";

const digest: MonoSha256 = async bytes => new Uint8Array(createHash("sha256").update(bytes).digest());

describe("portable mono preset", () => {
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
});
