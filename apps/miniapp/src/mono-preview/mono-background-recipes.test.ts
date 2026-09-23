import { describe, expect, it } from "vitest";
import {
  MONO_BACKGROUND_DEFAULTS, normalizeMonoBackgroundRecipe, parseMonoBackgroundRecipe,
  monoBackgroundPointer, monoBackgroundTiming,
} from "./mono-background-recipes";

describe("MONO atmosphere config boundary", () => {
  it("recovers malformed local data and clamps finite values without changing defaults", () => {
    expect(normalizeMonoBackgroundRecipe(null)).toEqual(MONO_BACKGROUND_DEFAULTS.obsidian);
    expect(normalizeMonoBackgroundRecipe({ version: 8, recipe: "aperture" })).toEqual(MONO_BACKGROUND_DEFAULTS.obsidian);
    expect(normalizeMonoBackgroundRecipe({ version: 1, recipe: "aperture", intensity: 50,
      speed: -1, pointerResponse: NaN, calm: "false", character: "code" })).toEqual({
      ...MONO_BACKGROUND_DEFAULTS.aperture, intensity: 1, speed: 0,
    });
  });

  it("round-trips complete data, rejecting partial, executable and future imports", () => {
    const config = { ...MONO_BACKGROUND_DEFAULTS.aperture, intensity: .37, calm: true };
    expect(parseMonoBackgroundRecipe(JSON.stringify(config))).toEqual(config);
    for (const value of [{ ...config, version: 2 }, { ...config, css: "body{}" },
      { ...config, speed: 9 }, { ...config, recipe: "remote" }, { version: 1 }]) {
      expect(() => parseMonoBackgroundRecipe(JSON.stringify(value))).toThrow();
    }
    expect(() => parseMonoBackgroundRecipe(" ".repeat(4097))).toThrow();
    expect(() => parseMonoBackgroundRecipe("{")).toThrow();
  });
});

describe("bounded pointer response", () => {
  const config = { ...MONO_BACKGROUND_DEFAULTS.obsidian, pointerResponse: 1 };
  it("responds to direction inside an invariant finite travel budget", () => {
    const left = monoBackgroundPointer(0, 0, 390, 844, config);
    const right = monoBackgroundPointer(390, 844, 390, 844, config);
    expect(left.x).toBeLessThan(0);
    expect(right.x).toBeGreaterThan(0);
    expect(Math.abs(left.x)).toBeLessThanOrEqual(28);
    expect(Math.abs(right.y)).toBeLessThanOrEqual(20);
    expect(monoBackgroundPointer(99999, -99, 390, 844, config)).toEqual(
      monoBackgroundPointer(390, 0, 390, 844, config));
  });
  it("returns still material for calm, zero response and invalid geometry", () => {
    for (const sample of [monoBackgroundPointer(390, 844, 390, 844, { ...config, calm: true }),
      monoBackgroundPointer(390, 844, 390, 844, { ...config, pointerResponse: 0 }),
      monoBackgroundPointer(NaN, 0, 390, 844, config), monoBackgroundPointer(5, 5, 0, 0, config)]) {
      expect(sample).toEqual({ x: 0, y: 0, angle: 0 });
    }
  });
  it("speed and character affect settling, with no overshoot and a bounded duration", () => {
    expect(monoBackgroundTiming({ ...config, speed: 1 }).durationMs)
      .toBeLessThan(monoBackgroundTiming({ ...config, speed: 0 }).durationMs);
    expect(monoBackgroundTiming({ ...config, character: "precise" }).durationMs)
      .toBeLessThan(monoBackgroundTiming({ ...config, character: "fluid" }).durationMs);
  });
});
