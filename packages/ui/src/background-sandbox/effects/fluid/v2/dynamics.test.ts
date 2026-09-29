import { describe, expect, it } from "vitest";
import { fluidV2Decay, stepFluidViewportMotion } from "./dynamics";

describe("Fluid viewport momentum", () => {
  const on = { enabled: true, strength: 1, inertia: 0.5, edgeResponse: 0.5 };

  it("moves existing flow upward on positive wallet scroll and keeps edge attempts separate", () => {
    const next = stepFluidViewportMotion({ scrollY: 0, edgeY: 0 },
      { deltaY: 0.04, blockedY: 0.02 }, 1 / 60, on);
    expect(next).toEqual({ scrollY: 0.04, edgeY: 0.01 });
  });

  it("has no residual force when disabled, at zero strength, or with zero edge response", () => {
    const state = { scrollY: 0.08, edgeY: 0.04 };
    const input = { deltaY: 0.03, blockedY: 0.03 };
    expect(stepFluidViewportMotion(state, input, 1 / 60, { ...on, enabled: false }))
      .toEqual({ scrollY: 0, edgeY: 0 });
    expect(stepFluidViewportMotion(state, input, 1 / 60, { ...on, strength: 0 }))
      .toEqual({ scrollY: 0, edgeY: 0 });
    expect(stepFluidViewportMotion({ scrollY: 0, edgeY: 0 }, input, 1 / 60,
      { ...on, edgeResponse: 0 }).edgeY).toBe(0);
  });

  it("decays by elapsed seconds instead of frame count and caps event bursts", () => {
    const state = stepFluidViewportMotion({ scrollY: 0, edgeY: 0 },
      { deltaY: 20, blockedY: -20 }, 1 / 60, on);
    expect(state.scrollY).toBeLessThanOrEqual(0.12);
    expect(state.edgeY).toBeGreaterThanOrEqual(-0.12);
    const empty = { deltaY: 0, blockedY: 0 };
    const once = stepFluidViewportMotion(state, empty, 1 / 30, on);
    const twice = stepFluidViewportMotion(stepFluidViewportMotion(state, empty, 1 / 60, on), empty, 1 / 60, on);
    expect(once.scrollY).toBeCloseTo(twice.scrollY, 10);
    expect(once.edgeY).toBeCloseTo(twice.edgeY, 10);
  });

  it("reverses direction immediately when inertia is zero", () => {
    const direct = { ...on, inertia: 0 };
    const first = stepFluidViewportMotion({ scrollY: 0, edgeY: 0 },
      { deltaY: 0.06, blockedY: 0 }, 1 / 60, direct);
    expect(first.scrollY).toBe(0.06);
    const reversed = stepFluidViewportMotion(first,
      { deltaY: -0.04, blockedY: 0 }, 1 / 60, direct);
    expect(reversed.scrollY).toBe(-0.04);
  });

  it("approaches immediate settle smoothly near zero inertia", () => {
    const next = stepFluidViewportMotion({ scrollY: 0.08, edgeY: 0 },
      { deltaY: 0, blockedY: 0 }, 1 / 60, { ...on, inertia: 0.01 });
    expect(Math.abs(next.scrollY)).toBeLessThan(0.001);
  });
});

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
