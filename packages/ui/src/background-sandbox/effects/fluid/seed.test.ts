import { describe, expect, it } from "vitest";
import { createSeedSplats } from "./seed";

describe("Fluid deterministic reset", () => {
  it("replays the same bounded initial impulses and distinguishes different seeds", () => {
    const first = createSeedSplats(1);
    expect(first).toEqual(createSeedSplats(1));
    expect(first).not.toEqual(createSeedSplats(2));
    expect(first).toHaveLength(6);
    expect(first[0].x).toBeCloseTo(0.150044065, 8);
    expect(first[0].y).toBeCloseTo(0.1610232, 7);
    for (const splat of first) {
      expect(splat.x).toBeGreaterThanOrEqual(0.15);
      expect(splat.x).toBeLessThanOrEqual(0.85);
      expect(splat.y).toBeGreaterThanOrEqual(0.15);
      expect(splat.y).toBeLessThanOrEqual(0.85);
      expect(Math.hypot(splat.dx, splat.dy)).toBeLessThanOrEqual(120);
      expect(splat.pigment).toBeGreaterThanOrEqual(0);
      expect(splat.pigment).toBeLessThanOrEqual(2);
    }
  });

  it("accepts seed zero without a degenerate all-zero initial field", () => {
    const splats = createSeedSplats(0);
    expect(splats).toEqual(createSeedSplats(0));
    expect(new Set(splats.map(({ x }) => x)).size).toBe(6);
  });
});
