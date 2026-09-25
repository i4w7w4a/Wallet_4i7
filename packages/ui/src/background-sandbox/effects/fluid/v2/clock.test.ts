import { describe, expect, it } from "vitest";
import { createFluidClock, stepFluidClock } from "./clock";

describe("Fluid v2 active clock and explicit ambient emitter", () => {
  it("keeps drawing mode free of automatic splats during long idle", () => {
    let clock = createFluidClock(147);
    let emissions = 0;
    for (let i = 0; i < 60 * 60; i++) {
      const step = stepFluidClock(clock, 1 / 60, 1, "draw", 2);
      clock = step.clock; emissions += step.splats.length;
    }
    expect(clock.time).toBeCloseTo(60, 6);
    expect(emissions).toBe(0);
  });

  it("feeds the live background at a bounded, reproducible rate after long idle", () => {
    const run = (seed: number) => {
      let clock = createFluidClock(seed);
      const all = [];
      for (let i = 0; i < 60 * 60; i++) {
        const step = stepFluidClock(clock, 1 / 60, 1, "ambient", 0.5);
        clock = step.clock;
        expect(step.splats.length).toBeLessThanOrEqual(2);
        all.push(...step.splats);
      }
      return { all, time: clock.time };
    };
    const first = run(147);
    expect(first.all).toHaveLength(30);
    expect(first).toEqual(run(147));
    expect(first.all).not.toEqual(run(148).all);
    expect(first.all.slice(-1)[0].ordinal).toBe(29);
    for (const splat of first.all) {
      expect(splat.x).toBeGreaterThanOrEqual(0.1);
      expect(splat.x).toBeLessThanOrEqual(0.9);
      expect(splat.y).toBeGreaterThanOrEqual(0.1);
      expect(splat.y).toBeLessThanOrEqual(0.9);
      expect(Math.hypot(splat.dx, splat.dy)).toBeLessThanOrEqual(120);
      expect(splat.pigment).toBeGreaterThanOrEqual(0);
      expect(splat.pigment).toBeLessThan(6);
    }
  });

  it("uses scaled simulation time while the host keeps drawing smoothly", () => {
    let clock = createFluidClock(1);
    for (let i = 0; i < 60; i++) clock = stepFluidClock(clock, 1 / 60, 0.1, "ambient", 1).clock;
    expect(clock.time).toBeCloseTo(0.1, 6);
    expect(clock.emitted).toBe(0);
    const paused = stepFluidClock(clock, 1 / 60, 0, "ambient", 2);
    expect(paused.clock.time).toBe(clock.time);
    expect(paused.splats).toEqual([]);
  });

  it("discards oversized resumed dt instead of spiraling through catch-up passes", () => {
    const step = stepFluidClock(createFluidClock(1), 10, 0.2, "ambient", 2);
    expect(step.dt).toBeCloseTo(1 / 150, 8);
    expect(step.clock.time).toBeCloseTo(1 / 150, 8);
    expect(step.splats).toEqual([]);
  });
});
