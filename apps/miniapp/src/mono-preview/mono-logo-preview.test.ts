import { beforeEach, expect, it } from "vitest";
import { monoContrastRatio, type MonoSrgb } from "@wallet/ui";

import {
  loadMonoLogoPreview,
  MONO_LOGO_PREVIEW_DEFAULTS,
  MONO_LOGO_PREVIEW_KEY,
  normalizeMonoLogoHue,
  resolveMonoLogoColors,
  saveMonoLogoPreview,
} from "./mono-logo-preview";

beforeEach(() => localStorage.clear());

const rgb = (hex: string): MonoSrgb => ({
  r: Number.parseInt(hex.slice(1, 3), 16) / 255,
  g: Number.parseInt(hex.slice(3, 5), 16) / 255,
  b: Number.parseInt(hex.slice(5, 7), 16) / 255,
  alpha: 1,
});

it("keeps a versioned local logo preview and rejects unknown or damaged settings", () => {
  const changed = { version: 1 as const, variant: "plaque" as const, customColor: true, hue: 330 };
  expect(saveMonoLogoPreview(localStorage, changed)).toBe(true);
  expect(loadMonoLogoPreview(localStorage)).toEqual(changed);

  for (const invalid of [
    { ...changed, version: 2 },
    { ...changed, hue: -1 },
    { ...changed, hue: 360 },
    { ...changed, hue: 30.5 },
    { ...changed, shader: "not allowed" },
  ]) {
    localStorage.setItem(MONO_LOGO_PREVIEW_KEY, JSON.stringify(invalid));
    expect(loadMonoLogoPreview(localStorage)).toEqual(MONO_LOGO_PREVIEW_DEFAULTS);
  }
  localStorage.setItem(MONO_LOGO_PREVIEW_KEY, "{");
  expect(loadMonoLogoPreview(localStorage)).toEqual(MONO_LOGO_PREVIEW_DEFAULTS);
});

it("keeps the live preview usable if local storage refuses writes", () => {
  expect(saveMonoLogoPreview({ setItem() { throw new Error("quota"); } }, MONO_LOGO_PREVIEW_DEFAULTS)).toBe(false);
});

it("turns one bounded hue into a linked emblem palette with legible light and dark segments", () => {
  expect(normalizeMonoLogoHue(-20)).toBe(0);
  expect(normalizeMonoLogoHue(400)).toBe(359);
  expect(normalizeMonoLogoHue(Number.NaN)).toBe(270);
  expect(resolveMonoLogoColors(20).dark.primary).not.toBe(resolveMonoLogoColors(300).dark.primary);

  const backgrounds = {
    dark: [rgb("#050505"), rgb("#252633")],
    light: [rgb("#e9e5dd"), rgb("#f7f5f9")],
  };
  for (let hue = 0; hue < 360; hue++) {
    const palette = resolveMonoLogoColors(hue);
    for (const mode of ["dark", "light"] as const) {
      for (const color of Object.values(palette[mode])) {
        expect(color).toMatch(/^#[0-9a-f]{6}$/);
        for (const background of backgrounds[mode]) {
          expect(monoContrastRatio(rgb(color), background), `${mode} ${hue}° ${color}`).toBeGreaterThanOrEqual(3);
        }
      }
    }
  }
});
