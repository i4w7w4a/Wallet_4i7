import { describe, expect, it } from "vitest";
import {
  compositeMonoSrgb, gamutMapMonoOklch, monoContrastRatio, monoWorstContrast,
  normalizeMonoOklch, oklchToSrgb, srgbToOklch,
} from "./mono-color-space";

const black = { r: 0, g: 0, b: 0, alpha: 1 };
const white = { r: 1, g: 1, b: 1, alpha: 1 };

describe("MONO color math", () => {
  it("normalizes non-finite channels, clamps lightness/chroma/alpha and wraps hue", () => {
    expect(normalizeMonoOklch({ l: 9, c: -1, h: -30, alpha: 2 }))
      .toEqual({ l: 1, c: 0, h: 330, alpha: 1 });
    expect(normalizeMonoOklch({ l: NaN, c: Infinity, h: -Infinity, alpha: NaN }))
      .toEqual({ l: 0, c: 0, h: 0, alpha: 1 });
    expect(normalizeMonoOklch(null)).toEqual({ l: 0, c: 0, h: 0, alpha: 1 });
  });

  it("matches the independently calculated sRGB red OKLab vector and round-trips primaries", () => {
    // OKLab red: L=.62795536, a=.22486306, b=.12584630.
    const red = srgbToOklch({ r: 1, g: 0, b: 0, alpha: 0.4 });
    expect(red.l).toBeCloseTo(0.62795536, 7);
    expect(red.c).toBeCloseTo(0.25768331, 7);
    expect(red.h).toBeCloseTo(29.233885, 4);
    expect(red.alpha).toBe(0.4);
    for (const source of [black, white, { r: 1, g: 0, b: 0, alpha: 0.4 },
      { r: 0, g: 1, b: 0, alpha: 1 }, { r: 0, g: 0, b: 1, alpha: 1 }]) {
      const roundTrip = oklchToSrgb(srgbToOklch(source));
      expect(roundTrip.r).toBeCloseTo(source.r, 5);
      expect(roundTrip.g).toBeCloseTo(source.g, 5);
      expect(roundTrip.b).toBeCloseTo(source.b, 5);
      expect(roundTrip.alpha).toBe(source.alpha);
    }
  });

  it("reduces out-of-gamut chroma without changing lightness or hue", () => {
    // At L=.5, H=0, the first sRGB boundary is green=0 at C≈.202696.
    const mapped = gamutMapMonoOklch({ l: 0.5, c: 0.4, h: 0, alpha: 0.6 });
    expect(mapped).toMatchObject({ l: 0.5, h: 0, alpha: 0.6 });
    expect(mapped.c).toBeCloseTo(0.202696, 5);
    const rgb = oklchToSrgb(mapped);
    expect(rgb.r).toBeCloseTo(0.708386, 4);
    expect(rgb.g).toBeCloseTo(0, 5);
    expect(rgb.b).toBeCloseTo(0.370493, 4);
    for (const value of Object.values(oklchToSrgb({ l: NaN, c: Infinity, h: NaN, alpha: -3 }))) {
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it("composites alpha in encoded sRGB before measuring WCAG relative luminance", () => {
    expect(compositeMonoSrgb({ ...black, alpha: 0.5 }, white))
      .toEqual({ r: 0.5, g: 0.5, b: 0.5, alpha: 1 });
    expect(monoContrastRatio(white, black)).toBe(21);
    // .5 sRGB -> .21404114 linear; (1+.05)/(.21404114+.05).
    expect(monoContrastRatio({ ...black, alpha: 0.5 }, white)).toBeCloseTo(3.976653, 5);
  });

  it("uses the worst allowed backdrop for translucent surfaces", () => {
    expect(monoWorstContrast(white, { ...black, alpha: 0.5 }, [black, white]))
      .toBeCloseTo(3.976653, 5);
    expect(() => monoWorstContrast(white, black, [])).toThrow();
  });
});
