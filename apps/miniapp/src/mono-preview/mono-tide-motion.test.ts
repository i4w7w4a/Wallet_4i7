import { describe, expect, it } from "vitest";

import { stepTideMotion, type TideMotionState } from "./mono-tide-motion";

function move(
  state: TideMotionState | null,
  x: number,
  time: number,
  y = 100,
) {
  return stepTideMotion(state, { x, y, time });
}

describe("stepTideMotion", () => {
  it("uses the first sample only to seed the surface", () => {
    const first = move(null, 40, 0);

    expect(first.pulse).toBeNull();
    expect(first.state.energy).toBe(0);
  });

  it("ramps into a wake instead of striking on the first fast movement", () => {
    let state: TideMotionState | null = null;
    const energies: number[] = [];
    const pulseTimes: number[] = [];

    for (let index = 0; index <= 10; index += 1) {
      const step = move(state, 40 + index * 16, index * 16);
      state = step.state;
      energies.push(step.state.energy);
      if (step.pulse) pulseTimes.push(index * 16);
    }

    expect(energies.slice(1).every((value, index) => index === 0 || value >= energies[index]!)).toBe(true);
    expect(pulseTimes[0]).toBeGreaterThanOrEqual(140);
  });

  it("keeps a slow pointer drift below the wake threshold", () => {
    let state: TideMotionState | null = null;
    let pulseCount = 0;

    for (let index = 0; index <= 30; index += 1) {
      const step = move(state, 40 + index * 2, index * 16);
      state = step.state;
      if (step.pulse) pulseCount += 1;
    }

    expect(pulseCount).toBe(0);
    expect(state?.energy ?? 1).toBeLessThan(0.3);
  });

  it("dissipates stored speed across an idle gap before a new gesture", () => {
    let state: TideMotionState | null = null;
    for (let index = 0; index <= 10; index += 1) {
      state = move(state, 40 + index * 16, index * 16).state;
    }

    const resumed = move(state, 216, 660);

    expect(resumed.pulse).toBeNull();
    expect(resumed.state.energy).toBeLessThan(0.3);
  });

  it("spaces emitted wakes in both time and distance", () => {
    let state: TideMotionState | null = null;
    const pulses: Array<{ time: number; x: number }> = [];

    for (let index = 0; index <= 24; index += 1) {
      const time = index * 16;
      const x = 20 + index * 16;
      const step = move(state, x, time);
      state = step.state;
      if (step.pulse) pulses.push({ time, x });
    }

    expect(pulses.length).toBeGreaterThanOrEqual(2);
    for (let index = 1; index < pulses.length; index += 1) {
      expect(pulses[index]!.time - pulses[index - 1]!.time).toBeGreaterThanOrEqual(140);
      expect(pulses[index]!.x - pulses[index - 1]!.x).toBeGreaterThanOrEqual(44);
    }
  });
});
