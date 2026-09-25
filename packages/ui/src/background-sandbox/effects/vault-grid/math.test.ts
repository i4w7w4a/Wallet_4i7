import { describe, expect, it } from "vitest";
import { advanceVaultPhase, hexToRgb } from "./math";

describe("vault-grid uniform math", () => {
  it("keeps a still material static and advances drift by active seconds", () => {
    expect(advanceVaultPhase(0.7, 0.5, 0)).toBe(0.7);
    expect(advanceVaultPhase(0.7, 0.5, 0.04)).toBeCloseTo(0.72);
    expect(advanceVaultPhase(0.72, 0.5, -0.04)).toBeCloseTo(0.7);
  });

  it("ignores invalid host intervals instead of jumping the light", () => {
    expect(advanceVaultPhase(0.7, -1, 0.04)).toBe(0.7);
    expect(advanceVaultPhase(0.7, Number.POSITIVE_INFINITY, 0.04)).toBe(0.7);
  });

  it("wraps negative drift across minus pi without changing direction", () => {
    expect(advanceVaultPhase(-3.13, 1, -0.04)).toBeCloseTo(3.113185307179586, 6);
  });

  it("converts canonical hex colors into shader RGB without palette lookup", () => {
    expect(hexToRgb("#ff8000")).toEqual([1, 128 / 255, 0]);
    expect(hexToRgb("#000000")).toEqual([0, 0, 0]);
  });
});
