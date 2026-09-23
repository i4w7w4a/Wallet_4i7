import { oklchToSrgb, type MonoSrgb } from "@wallet/ui";

export type MonoLogoVariant = "bare" | "plaque";
export type MonoLogoPreview = {
  version: 1;
  variant: MonoLogoVariant;
  customColor: boolean;
  hue: number;
};

export const MONO_LOGO_PREVIEW_KEY = "wallet4i7.mono.logo-preview.v1";
export const MONO_LOGO_PREVIEW_DEFAULTS: MonoLogoPreview = {
  version: 1,
  variant: "bare",
  customColor: false,
  hue: 270,
};

type LogoTone = { primary: string; depth: string; gradientStart: string; gradientEnd: string };

const toHex = (color: MonoSrgb): string =>
  `#${[color.r, color.g, color.b].map(value => Math.round(value * 255).toString(16).padStart(2, "0")).join("")}`;

export function normalizeMonoLogoHue(value: number): number {
  return Number.isFinite(value) ? Math.min(359, Math.max(0, Math.round(value))) : MONO_LOGO_PREVIEW_DEFAULTS.hue;
}

export function resolveMonoLogoColors(value: number): { dark: LogoTone; light: LogoTone } {
  const h = normalizeMonoLogoHue(value);
  const tone = (l: number, c: number) => toHex(oklchToSrgb({ l, c, h, alpha: 1 }));
  return {
    dark: {
      primary: tone(0.77, 0.16),
      depth: tone(0.67, 0.14),
      gradientStart: tone(0.64, 0.12),
      gradientEnd: tone(0.76, 0.14),
    },
    light: {
      primary: tone(0.48, 0.17),
      depth: tone(0.36, 0.14),
      gradientStart: tone(0.32, 0.11),
      gradientEnd: tone(0.46, 0.16),
    },
  };
}

export function loadMonoLogoPreview(storage: Pick<Storage, "getItem">): MonoLogoPreview {
  try {
    const raw = storage.getItem(MONO_LOGO_PREVIEW_KEY);
    if (raw === null) return { ...MONO_LOGO_PREVIEW_DEFAULTS };
    const candidate: unknown = JSON.parse(raw);
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate))
      return { ...MONO_LOGO_PREVIEW_DEFAULTS };
    const value = candidate as Record<string, unknown>;
    const fields = ["version", "variant", "customColor", "hue"];
    if (Object.keys(value).some(key => !fields.includes(key)) || value.version !== 1 ||
      (value.variant !== "bare" && value.variant !== "plaque") ||
      typeof value.customColor !== "boolean" ||
      typeof value.hue !== "number" || !Number.isInteger(value.hue) || value.hue < 0 || value.hue > 359)
      return { ...MONO_LOGO_PREVIEW_DEFAULTS };
    return value as MonoLogoPreview;
  } catch {
    return { ...MONO_LOGO_PREVIEW_DEFAULTS };
  }
}

export function saveMonoLogoPreview(storage: Pick<Storage, "setItem">, value: MonoLogoPreview): boolean {
  try {
    storage.setItem(MONO_LOGO_PREVIEW_KEY, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
