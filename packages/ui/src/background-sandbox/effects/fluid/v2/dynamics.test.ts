import { describe, expect, it } from "vitest";
import { fluidV2Decay } from "./dynamics";

describe("Fluid v2 independent physics controls", () => {
  it("holds dye while the velocity field fades when only velocity dissipation rises", () => {
    const decay = fluidV2Decay(1 / 60, 4, 0, 0.8);
    expect(decay.velocity).toBeCloseTo(1 / (1 + 4 / 60), 9);
    expect(decay.dye).toBe(1);
    expect(decay.pressure).toBeCloseTo(0.8, 9);
  });

  it("fades dye independently of retained velocity and pressure", () => {
    const decay = fluidV2Decay(1 / 60, 0, 4, 1);
    expect(decay.velocity).toBe(1);
    expect(decay.dye).toBeCloseTo(1 / (1 + 4 / 60), 9);
    expect(decay.pressure).toBe(1);
  });

  it("scales pressure retention by integrated seconds and freezes at zero dt", () => {
    expect(fluidV2Decay(1 / 30, 1, 1, 0.8).pressure).toBeCloseTo(0.64, 9);
    expect(fluidV2Decay(0, 4, 4, 0.1)).toEqual({ velocity: 1, dye: 1, pressure: 1 });
  });
});
