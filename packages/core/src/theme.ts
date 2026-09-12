export type ThemeConfig = {
  version: 1;
  background: string;
  surface: string;
  accent: string;
  glassTint: string;
  radius: number;
  density: number;
  glassOpacity: number;
  glassBlur: number;
  highlightIntensity: number;
  refractionIntensity: number;
  motionIntensity: number;
};

export type DerivedThemeTokens = ThemeConfig & {
  textPrimary: string;
  textMuted: string;
  border: string;
};

export interface PreferenceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const DEFAULT_THEME = {
  version: 1,
  background: "#05070B",
  surface: "#111620",
  accent: "#5B8CFF",
  glassTint: "#7C6CFF",
  radius: 24,
  density: 1,
  glassOpacity: 0.24,
  glassBlur: 18,
  highlightIntensity: 0.55,
  refractionIntensity: 0.35,
  motionIntensity: 0.8,
} as const satisfies ThemeConfig;

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export function normalizeTheme(input: unknown): ThemeConfig {
  if (!isRecord(input) || input.version !== 1) {
    return { ...DEFAULT_THEME };
  }

  return {
    version: 1,
    background: normalizeColor(input.background, DEFAULT_THEME.background),
    surface: normalizeColor(input.surface, DEFAULT_THEME.surface),
    accent: normalizeColor(input.accent, DEFAULT_THEME.accent),
    glassTint: normalizeColor(input.glassTint, DEFAULT_THEME.glassTint),
    radius: normalizeNumber(input.radius, 12, 32, DEFAULT_THEME.radius),
    density: normalizeNumber(input.density, 0.85, 1.15, DEFAULT_THEME.density),
    glassOpacity: normalizeNumber(input.glassOpacity, 0.12, 0.4, DEFAULT_THEME.glassOpacity),
    glassBlur: normalizeNumber(input.glassBlur, 8, 28, DEFAULT_THEME.glassBlur),
    highlightIntensity: normalizeNumber(
      input.highlightIntensity,
      0,
      1,
      DEFAULT_THEME.highlightIntensity,
    ),
    refractionIntensity: normalizeNumber(
      input.refractionIntensity,
      0,
      1,
      DEFAULT_THEME.refractionIntensity,
    ),
    motionIntensity: normalizeNumber(input.motionIntensity, 0, 1, DEFAULT_THEME.motionIntensity),
  };
}

export function deriveThemeTokens(input: ThemeConfig): DerivedThemeTokens {
  const theme = normalizeTheme(input);

  return {
    ...theme,
    textPrimary: contrastingEndpoint(theme.background),
    textMuted: accessibleTone(theme.background, 4.5),
    border: accessibleTone(theme.surface, 3),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeColor(value: unknown, fallback: string): string {
  return typeof value === "string" && HEX_COLOR.test(value) ? value : fallback;
}

function normalizeNumber(value: unknown, minimum: number, maximum: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(maximum, Math.max(minimum, value));
}

function accessibleTone(base: string, minimumRatio: number): string {
  const target = contrastingEndpoint(base);

  for (let step = 1; step <= 255; step += 1) {
    const candidate = mixHex(base, target, step / 255);

    if (contrastRatio(candidate, base) >= minimumRatio) {
      return candidate;
    }
  }

  return target;
}

function contrastingEndpoint(base: string): "#000000" | "#FFFFFF" {
  return contrastRatio("#FFFFFF", base) >= contrastRatio("#000000", base)
    ? "#FFFFFF"
    : "#000000";
}

function mixHex(from: string, to: string, amount: number): string {
  const fromChannels = parseHex(from);
  const toChannels = parseHex(to);
  const channels = fromChannels.map((channel, index) =>
    Math.round(channel + ((toChannels[index] ?? channel) - channel) * amount),
  );

  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

function contrastRatio(first: string, second: string): number {
  const lighter = Math.max(relativeLuminance(first), relativeLuminance(second));
  const darker = Math.min(relativeLuminance(first), relativeLuminance(second));

  return (lighter + 0.05) / (darker + 0.05);
}

function relativeLuminance(hex: string): number {
  const [red = 0, green = 0, blue = 0] = parseHex(hex).map((channel) => {
    const normalized = channel / 255;

    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function parseHex(hex: string): number[] {
  return [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16));
}
