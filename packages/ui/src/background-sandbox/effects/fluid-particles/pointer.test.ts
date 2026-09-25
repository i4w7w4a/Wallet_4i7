import { describe, expect, it } from "vitest";
import type { PointerFrame } from "../../contracts";
import { createParticleCamera } from "./camera";
import { computeParticlePointer } from "./pointer";

const camera = createParticleCamera(390 / 844, "front", 0.35);
const frame = (delta: readonly [number, number], buttons = 0): PointerFrame => ({
  uv: [0.5, 0.5], inside: true, down: buttons > 0,
  samples: [{ id: 1, phase: "move", uv: [0.5, 0.5], delta, buttons, time: 1 }],
});

describe("borrowed pointer force", () => {
  it("converts hover movement into a finite bounded world impulse and ray", () => {
    const result = computeParticlePointer(frame([0.08, 0.04]), camera, 390 / 844);
    expect(Math.hypot(...result.velocity)).toBeGreaterThan(0);
    expect(Math.hypot(...result.velocity)).toBeLessThanOrEqual(8);
    expect(Math.hypot(...result.ray)).toBeCloseTo(1, 6);
  });

  it("does not pull on page drag or inject nonfinite host deltas", () => {
    expect(computeParticlePointer(frame([0.08, 0.04], 1), camera, 390 / 844).velocity).toEqual([0, 0, 0]);
    expect(computeParticlePointer(frame([Infinity, NaN]), camera, 390 / 844).velocity).toEqual([0, 0, 0]);
  });
});
