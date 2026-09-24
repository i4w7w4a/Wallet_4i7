import { describe, expect, it } from "vitest";
import { parseSilkParams, SILK_BASELINE, SILK_DEFAULTS, SILK_VARIANTS } from "./schema";

describe("Silk parameter boundary", () => {
  it("round-trips full prepared recipes without clamping or dropping values", () => {
    for (const params of [SILK_BASELINE, SILK_DEFAULTS, ...SILK_VARIANTS.map((variant) => variant.params)]) {
      const decoded = parseSilkParams(JSON.parse(JSON.stringify(params)));
      expect(decoded).toEqual(params);
      expect(decoded).not.toBe(params);
    }
  });

  it("accepts both exact ends of every artistic range", () => {
    expect(parseSilkParams({ flowSpeed: 0.1, sheenIntensity: 0.3, foldScale: 0.6, lightWidth: 0.5, palette: "radiant" })).not.toBeNull();
    expect(parseSilkParams({ flowSpeed: 1.5, sheenIntensity: 2, foldScale: 1.8, lightWidth: 2, palette: "champagne" })).not.toBeNull();
  });

  it("rejects nonfinite, out-of-bounds and coercible numeric values atomically", () => {
    for (const [key, value] of [
      ["flowSpeed", 0.09], ["flowSpeed", 1.51], ["flowSpeed", "0.4"],
      ["sheenIntensity", 0.29], ["sheenIntensity", 2.01], ["sheenIntensity", Infinity],
      ["foldScale", 0.59], ["foldScale", 1.81], ["foldScale", NaN],
      ["lightWidth", 0.49], ["lightWidth", 2.01], ["lightWidth", null],
    ]) {
      expect(parseSilkParams({ ...SILK_BASELINE, [key as string]: value })).toBeNull();
    }
  });

  it("rejects partial recipes, unknown keys, unknown palette and non-records", () => {
    for (const value of [
      {}, [], null, 1, "silk", { ...SILK_BASELINE, palette: "url(https://example.com)" },
      { ...SILK_BASELINE, shader: "void main(){}" },
      { ...SILK_BASELINE, flowSpeed: undefined },
      Object.assign(Object.create({ injected: true }), SILK_BASELINE),
    ]) expect(parseSilkParams(value)).toBeNull();
  });

  it("does not fill missing imported fields from a mutable default", () => {
    const partial: Partial<typeof SILK_DEFAULTS> = { ...SILK_DEFAULTS };
    delete partial.lightWidth;
    expect(parseSilkParams(partial)).toBeNull();
    expect(parseSilkParams({ ...partial, lightWidth: 1.173 })?.lightWidth).toBe(1.173);
  });
});
