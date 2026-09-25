import { describe, expect, it } from "vitest";
import { createParticleSeed } from "./seed";

describe("source-derived particle initialization", () => {
  it("replays the same dam and random directions from a seed", () => {
    const first = createParticleSeed({ width: 8, height: 4 }, 147, 0.375, 0.25);
    const replay = createParticleSeed({ width: 8, height: 4 }, 147, 0.375, 0.25);
    const another = createParticleSeed({ width: 8, height: 4 }, 148, 0.375, 0.25);
    expect(Array.from(first.positions)).toEqual(Array.from(replay.positions));
    expect(Array.from(first.randoms)).toEqual(Array.from(replay.randoms));
    expect(Array.from(first.positions)).not.toEqual(Array.from(another.positions));
    expect(first.positions.length).toBe(8 * 4 * 4);
  });

  it("keeps every rendered sphere inside the filled box and physical volume", () => {
    const radius = 0.3;
    const seed = createParticleSeed({ width: 16, height: 8 }, 99, 0.375, radius);
    expect(seed.positions.length).toBe(16 * 8 * 4);
    for (let i = 0; i < seed.positions.length; i += 4) {
      expect(seed.positions[i]).toBeGreaterThanOrEqual(radius);
      expect(seed.positions[i]).toBeLessThanOrEqual(15 - radius);
      expect(seed.positions[i + 1]).toBeGreaterThanOrEqual(radius);
      expect(seed.positions[i + 1]).toBeLessThanOrEqual(20 - radius);
      expect(seed.positions[i + 2]).toBeGreaterThanOrEqual(radius);
      expect(seed.positions[i + 2]).toBeLessThanOrEqual(20 - radius);
    }
  });

  it("assigns particle texture coordinates to texel centers", () => {
    const seed = createParticleSeed({ width: 2, height: 2 }, 1, 0.375, 0.25);
    expect(Array.from(seed.coordinates)).toEqual([0.25, 0.25, 0.75, 0.25, 0.25, 0.75, 0.75, 0.75]);
  });
});
