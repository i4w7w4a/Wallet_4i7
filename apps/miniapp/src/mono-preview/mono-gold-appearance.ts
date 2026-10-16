import type { CSSProperties } from "react";
import { normalizeMonoPaletteConfig, resolveMonoPalette, type MonoOklch, type MonoPaletteRole } from "@wallet/ui";
import { createMonoAppearanceEnvelope, normalizeMonoAppearanceEnvelope, type MonoAppearanceEnvelope } from "./mono-preset-envelope";
import { createMonoTypographyDefaults, normalizeMonoTypography } from "./mono-typography";

/** A fixed presentation, separate from the seven working/published documents. */
function createGoldEnvelope(): MonoAppearanceEnvelope {
  const envelope = createMonoAppearanceEnvelope("ledger");
  const palette = normalizeMonoPaletteConfig({ seed: "mono-share" });
  const colors: Partial<Record<MonoPaletteRole, MonoOklch>> = {
    canvas: { l: 0.16, c: 0.008, h: 80, alpha: 1 },
    surfaceBase: { l: 0.20, c: 0.009, h: 80, alpha: 1 },
    surfaceRaised: { l: 0.24, c: 0.010, h: 80, alpha: 1 },
    surfaceOverlay: { l: 0.26, c: 0.010, h: 80, alpha: 1 },
    textPrimary: { l: 0.955, c: 0.012, h: 85, alpha: 1 },
    textSecondary: { l: 0.79, c: 0.015, h: 80, alpha: 1 },
    textMuted: { l: 0.72, c: 0.014, h: 80, alpha: 1 },
    textDisabled: { l: 0.69, c: 0.012, h: 80, alpha: 1 },
    borderSubtle: { l: 0.39, c: 0.025, h: 80, alpha: 1 },
    borderStrong: { l: 0.62, c: 0.045, h: 80, alpha: 1 },
    focus: { l: 0.88, c: 0.070, h: 85, alpha: 1 },
    accentPrimary: { l: 0.77, c: 0.080, h: 82, alpha: 1 },
    accentSecondary: { l: 0.83, c: 0.080, h: 85, alpha: 1 },
    glassTint: { l: 0.26, c: 0.012, h: 80, alpha: 0.06 },
    edgeCool: { l: 0.77, c: 0.045, h: 82, alpha: 1 },
    edgeWarm: { l: 0.83, c: 0.060, h: 85, alpha: 1 },
    atmosphereCool: { l: 0.40, c: 0.025, h: 80, alpha: 0.06 },
    atmosphereWarm: { l: 0.40, c: 0.025, h: 80, alpha: 0.06 },
    chartLine: { l: 0.78, c: 0.060, h: 82, alpha: 1 },
    selection: { l: 0.77, c: 0.045, h: 82, alpha: 0.16 },
  };
  for (const [role, value] of Object.entries(colors)) {
    palette.themes.dark.roles[role as MonoPaletteRole] = {
      ...palette.themes.dark.roles[role as MonoPaletteRole], mode: "manual", value,
    };
  }
  // Protected success/warning/danger/info remain the existing semantic colors.
  const typography = createMonoTypographyDefaults("ledger");
  typography.roles.balance.size = 48;
  typography.roles.balance.weight = 500;
  typography.roles.button.size = 13;
  typography.roles.menu.size = 13;
  typography.roles.label.size = 12;
  typography.bodyLineHeight = 1.5;
  return normalizeMonoAppearanceEnvelope({ ...envelope,
    appearance: { ...envelope.appearance,
      palette: { enabled: true, config: normalizeMonoPaletteConfig(palette) },
      typography: normalizeMonoTypography(typography),
      eye: { ...envelope.appearance.eye, blinkEnabled: false },
      navigation: { ...envelope.appearance.navigation, indicator: "line", shimmerEnabled: false, glowPercent: 0 },
      shape: { ...envelope.appearance.shape, "quick-actions": 12, "bottom-navigation": 0 },
    },
    material: { background: null, buttons: { version: 2, frameMode: "icons", bindings: [] } },
  });
}

function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

export const MONO_GOLD_ENVELOPE: Readonly<MonoAppearanceEnvelope> = freeze(createGoldEnvelope());

// The shared paint adapter exposes legacy paint aliases, but no accent/system aliases.
// Derive only Gold's extra accents from the same resolved palette, in the host scope.
const resolved = resolveMonoPalette(MONO_GOLD_ENVELOPE.appearance.palette.config.themes.dark);
function paint(role: MonoPaletteRole): string {
  const color = resolved.srgb[role];
  return `rgb(${color.r * 255} ${color.g * 255} ${color.b * 255} / ${color.alpha})`;
}
export const MONO_GOLD_PAINT: CSSProperties = Object.freeze({
  "--mono-gold-accent": paint("accentPrimary"),
  "--mono-gold-accent-light": paint("accentSecondary"),
  "--mono-gold-danger": paint("danger"),
} as CSSProperties);
