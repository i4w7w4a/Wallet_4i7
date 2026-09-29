import { describe, expect, it } from "vitest";
import { EMPTY_FLUID_VIEWPORT_MOTION, fluidV2Decay, stepFluidViewportMotion } from "./dynamics";

describe("Fluid viewport momentum", () => {
  const on = { enabled: true, strength: 1, inertia: 0.5, edgeResponse: 0.5 };

  it("moves existing flow upward on positive wallet scroll and keeps edge attempts separate", () => {
    const next = stepFluidViewportMotion(EMPTY_FLUID_VIEWPORT_MOTION,
      { deltaY: 0.04, blockedY: 0.02 }, 1 / 60, on);
    expect(next.drive.scrollY).toBeGreaterThan(0);
    expect(next.drive.edgeY).toBeCloseTo(next.drive.scrollY / 4, 9);
  });

  it("has no residual force when disabled, at zero strength, or with zero edge response", () => {
    const state = { ...EMPTY_FLUID_VIEWPORT_MOTION, scrollY: 0.08, edgeY: 0.04 };
    const input = { deltaY: 0.03, blockedY: 0.03 };
    for (const response of [{ ...on, enabled: false }, { ...on, strength: 0 }]) {
      const result = stepFluidViewportMotion(state, input, 1 / 60, response);
      expect(result.state).toEqual(EMPTY_FLUID_VIEWPORT_MOTION);
      expect(result.drive).toEqual({ scrollY: 0, edgeY: 0 });
    }
    const noEdge = stepFluidViewportMotion(EMPTY_FLUID_VIEWPORT_MOTION, input, 1 / 60,
      { ...on, edgeResponse: 0 });
    expect(noEdge.drive.edgeY).toBe(0);
  });

  it("decays by elapsed seconds instead of frame count and caps event bursts", () => {
    const burst = stepFluidViewportMotion(EMPTY_FLUID_VIEWPORT_MOTION,
      { deltaY: 20, blockedY: -20 }, 1 / 60, on);
    expect(burst.state.scrollY).toBeLessThanOrEqual(32);
    expect(burst.state.edgeY).toBeGreaterThanOrEqual(-32);
    const empty = { deltaY: 0, blockedY: 0 };
    const once = stepFluidViewportMotion(burst.state, empty, 1 / 30, on);
    const half = stepFluidViewportMotion(burst.state, empty, 1 / 60, on);
    const twice = stepFluidViewportMotion(half.state, empty, 1 / 60, on);
    expect(once.state.scrollY).toBeCloseTo(twice.state.scrollY, 10);
    expect(once.state.edgeY).toBeCloseTo(twice.state.edgeY, 10);
  });

  it("reverses direction immediately when inertia is zero", () => {
    const direct = { ...on, inertia: 0 };
    const first = stepFluidViewportMotion(EMPTY_FLUID_VIEWPORT_MOTION,
      { deltaY: 0.06, blockedY: 0 }, 1 / 60, direct);
    expect(first.drive.scrollY).toBeCloseTo(3.6, 9);
    const reversed = stepFluidViewportMotion(first.state,
      { deltaY: -0.04, blockedY: 0 }, 1 / 60, direct);
    expect(reversed.drive.scrollY).toBeCloseTo(-2.4, 9);
  });

  it("approaches immediate settle smoothly near zero inertia", () => {
    const next = stepFluidViewportMotion({ ...EMPTY_FLUID_VIEWPORT_MOTION, scrollY: 0.08 },
      { deltaY: 0, blockedY: 0 }, 1 / 60, { ...on, inertia: 0.01 });
    expect(Math.abs(next.state.scrollY)).toBeLessThan(0.001);
  });

  it("delivers the same total scroll forcing at 30, 60 and 120 Hz", () => {
    const integrated = (hz: number, inertia: number) => {
      let state = EMPTY_FLUID_VIEWPORT_MOTION;
      let forcing = 0;
      for (let frame = 0; frame < hz; frame++) {
        const next = stepFluidViewportMotion(state, { deltaY: 0.6 / hz, blockedY: 0 },
          1 / hz, { ...on, strength: 0.35, inertia });
        state = next.state;
        forcing += next.drive.scrollY / hz;
      }
      return forcing;
    };
    for (const inertia of [0, 0.45]) {
      const at30 = integrated(30, inertia);
      expect(at30).toBeCloseTo(integrated(60, inertia), 8);
      expect(at30).toBeCloseTo(integrated(120, inertia), 8);
    }
  });

  it("holds a scroll event until the first positive dt instead of losing it on resume", () => {
    const waiting = stepFluidViewportMotion(EMPTY_FLUID_VIEWPORT_MOTION,
      { deltaY: 0.04, blockedY: 0 }, 0, on);
    expect(waiting.drive).toEqual({ scrollY: 0, edgeY: 0 });
    expect(waiting.state.pendingDeltaY).toBe(0.04);
    const active = stepFluidViewportMotion(waiting.state,
      { deltaY: 0, blockedY: 0 }, 1 / 60, on);
    expect(active.drive.scrollY).toBeGreaterThan(0);
    expect(active.state.pendingDeltaY).toBe(0);
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
