import { DEFAULT_BACKGROUND_EDGE_FINISH, materialCatalogV2, normalizeMonoPaletteConfig, setMonoPaletteLock } from "@wallet/ui";
import { describe, expect, it } from "vitest";
import { createMonoWorkingDocument } from "./mono-working-presets";
import { monoPaletteStyle } from "./mono-palette-tokens";
import { createMonoAppearanceEnvelope, createMonoAppearanceFromDocument, normalizeMonoAppearanceEnvelope } from "./mono-preset-envelope";

describe("allowlisted complete MONO appearance", () => {
  it("refuses a share link when selected material data cannot roundtrip through its envelope", () => {
    const document = createMonoWorkingDocument();
    const fluid = materialCatalogV2.materials.find(item => item.id === "fluid")!.presets[0]!.recipe;
    document.materials.ledger = { ...document.materials.ledger,
      background: { version: 1, recipe: fluid, edgeFinish: DEFAULT_BACKGROUND_EDGE_FINISH } };
    expect(() => createMonoAppearanceFromDocument(document, "ledger")).toThrow(/материал.*ссылк/i);
    expect(() => createMonoAppearanceFromDocument(document, "frost")).not.toThrow();
    document.materials.ledger = { background: null, buttons: { version: 1, bindings: [] } };
    expect(() => createMonoAppearanceFromDocument(document, "ledger")).not.toThrow();
    document.materials.ledger = { background: null, buttons: { version: 2, frameMode: "separate", bindings: [] } };
    expect(() => createMonoAppearanceFromDocument(document, "ledger")).toThrow(/материал.*ссылк/i);
  });

  it("provides a complete snapshot with the approved positive Ledger optics", () => {
    const result = createMonoAppearanceEnvelope();
    expect(result.appearance.optics.ior).toBe(1.34);
    expect(result.appearance.environment).toEqual({ theme: "dark", background: "iris" });
    expect(result.appearance).toHaveProperty("background", null);
    expect(result.appearance).toHaveProperty("typography", null);
    expect(Object.keys(result.appearance).sort()).toEqual(["assets", "background", "balance", "chart", "environment", "layout", "logo", "optics", "palette", "preset", "shape", "typography"]);
    expect(normalizeMonoAppearanceEnvelope(result)).toEqual(result);
  });

  it.each([false, true])("removes free seed text without changing either theme or focus colors (protected=%s)", protectedFocus => {
    const document = createMonoWorkingDocument();
    document.palette.activeSlotId = 2;
    const config = normalizeMonoPaletteConfig();
    config.seed = "private-name-address-secret";
    config.actionCounter = 8192;
    if (protectedFocus) for (const mode of ["dark", "light"] as const) {
      config.themes[mode].focusAnchor = { version: 1, h: 118, c: 0.016 };
      config.themes[mode] = setMonoPaletteLock(config.themes[mode], { kind: "point", role: "accentPrimary" }, true);
    }
    document.palette.slots[1].present = { config, mode: "light", paletteEnabled: true };
    document.background = "strata";
    const original = structuredClone(document);
    const result = createMonoAppearanceFromDocument(document);
    expect(result.appearance.preset).toBe("frost");
    expect(result.appearance.environment).toEqual({ theme: "light", background: "strata" });
    expect(result.appearance.palette.config.seed).toBe("mono-share");
    expect(result.appearance.palette.config.actionCounter).toBe(0);
    expect(JSON.stringify(result)).not.toContain("private-name-address-secret");
    for (const mode of ["dark", "light"] as const) {
      expect(monoPaletteStyle(result.appearance.palette.config.themes[mode])).toEqual(monoPaletteStyle(config.themes[mode]));
      expect(result.appearance.palette.config.themes[mode].focusAnchor).toEqual(config.themes[mode].focusAnchor);
    }
    expect(document).toEqual(original);
  });

  it("rejects unknown versions and any additional wallet or executable fields", () => {
    const input = createMonoAppearanceEnvelope();
    expect(() => normalizeMonoAppearanceEnvelope({ ...input, version: 99 })).toThrow();
    for (const extra of [{ address: "0x123" }, { balance: 200 }, { profile: {} }, { css: "body{}" }, { fontUrl: "https://evil.test/font" }]) {
      expect(() => normalizeMonoAppearanceEnvelope({ ...input, ...extra })).toThrow();
      expect(() => normalizeMonoAppearanceEnvelope({ ...input, appearance: { ...input.appearance, wallet: extra } })).toThrow();
    }
    input.appearance.palette.config.seed = "untrusted free text";
    expect(() => normalizeMonoAppearanceEnvelope(input)).toThrow();
  });

  it("rejects unbounded values and an enabled unreadable palette instead of silently repairing it", () => {
    const input = createMonoAppearanceEnvelope();
    input.appearance.optics.ior = Number.POSITIVE_INFINITY;
    expect(() => normalizeMonoAppearanceEnvelope(input)).toThrow();
    const unreadable = createMonoAppearanceEnvelope();
    unreadable.appearance.palette.enabled = true;
    for (const role of ["textPrimary", "canvas"] as const) {
      unreadable.appearance.palette.config.themes.dark.roles[role].mode = "manual";
      unreadable.appearance.palette.config.themes.dark.roles[role].value = { l: 0.12, c: 0, h: 0, alpha: 1 };
    }
    expect(() => normalizeMonoAppearanceEnvelope(unreadable)).toThrow(/контраст|читаем/);
  });
});
