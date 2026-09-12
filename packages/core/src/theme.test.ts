import { describe, expect, it } from "vitest";

import {
  DEFAULT_THEME,
  deriveThemeTokens,
  normalizeTheme,
  type ThemeConfig,
} from "./theme";

const VALID_THEME: ThemeConfig = {
  version: 1,
  background: "#101820",
  surface: "#182430",
  accent: "#123abc",
  glassTint: "#89ABCD",
  radius: 20,
  density: 1,
  glassOpacity: 0.24,
  glassBlur: 18,
  highlightIntensity: 0.55,
  refractionIntensity: 0.35,
  motionIntensity: 0.8,
};

describe("normalizeTheme", () => {
  it("ограничивает числовые параметры утверждёнными диапазонами", () => {
    const normalized = normalizeTheme({
      ...VALID_THEME,
      radius: 0,
      density: 2,
      glassOpacity: 0,
      glassBlur: 100,
      highlightIntensity: -1,
      refractionIntensity: 2,
      motionIntensity: 0.4,
    });

    expect(normalized).toMatchObject({
      radius: 12,
      density: 1.15,
      glassOpacity: 0.12,
      glassBlur: 28,
      highlightIntensity: 0,
      refractionIntensity: 1,
      motionIntensity: 0.4,
    });
  });

  it("заменяет некорректный hex безопасным цветом", () => {
    const normalized = normalizeTheme({
      ...VALID_THEME,
      background: "black",
      surface: "#1234",
    });

    expect(normalized.background).toBe(DEFAULT_THEME.background);
    expect(normalized.surface).toBe(DEFAULT_THEME.surface);
    expect(normalized.accent).toBe("#123abc");
    expect(normalized.glassTint).toBe("#89ABCD");
  });

  it("сбрасывает неизвестную версию к безопасной теме", () => {
    expect(normalizeTheme({ ...VALID_THEME, version: 2 })).toEqual(DEFAULT_THEME);
  });

  it("восстанавливает безопасную тему из повреждённого значения", () => {
    expect(normalizeTheme(null)).toEqual(DEFAULT_THEME);
    expect(normalizeTheme("{broken-json")).toEqual(DEFAULT_THEME);
  });
});

describe("deriveThemeTokens", () => {
  it("сохраняет базовые цвета и обеспечивает требуемый контраст", () => {
    const tokens = deriveThemeTokens(VALID_THEME);

    expect(tokens.background).toBe("#101820");
    expect(tokens.surface).toBe("#182430");
    expect(tokens.accent).toBe("#123abc");
    expect(tokens.glassTint).toBe("#89ABCD");
    expect(contrastRatio(tokens.textPrimary, tokens.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(tokens.textMuted, tokens.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(tokens.border, tokens.surface)).toBeGreaterThanOrEqual(3);
  });

  it("выбирает тёмные производные тона для светлой темы", () => {
    const tokens = deriveThemeTokens({
      ...VALID_THEME,
      background: "#F2F4F8",
      surface: "#FFFFFF",
    });

    expect(tokens.textPrimary).toBe("#000000");
    expect(contrastRatio(tokens.textMuted, tokens.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(tokens.border, tokens.surface)).toBeGreaterThanOrEqual(3);
  });
});

function contrastRatio(first: string, second: string): number {
  const lighter = Math.max(relativeLuminance(first), relativeLuminance(second));
  const darker = Math.min(relativeLuminance(first), relativeLuminance(second));

  return (lighter + 0.05) / (darker + 0.05);
}

function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const [red = 0, green = 0, blue = 0] = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}
