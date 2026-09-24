import { describe, expect, it } from "vitest";
import { advanceSilkMotion, createSilkMotion } from "./motion";

describe("Silk light continuity", () => {
  it("reaches the same light after the same gesture duration at 30 and 144 fps", () => {
    const run = (fps: number) => {
      let state = createSilkMotion(0);
      for (const pointer of [[0.9, 0.1], null, [0.1, 0.95]] as const) {
        for (let frame = 0; frame < fps; frame += 1) {
          state = advanceSilkMotion(state, 1 / fps, 0.4, pointer);
        }
      }
      return state;
    };
    const slow = run(30);
    const fast = run(144);
    expect(slow.phase).toBeCloseTo(1.2, 10);
    expect(slow.phase).toBeCloseTo(fast.phase, 10);
    expect(slow.pointerX).toBeCloseTo(fast.pointerX, 10);
    expect(slow.pointerY).toBeCloseTo(fast.pointerY, 10);
    expect(slow.pointerWeight).toBeCloseTo(fast.pointerWeight, 10);
  });

  it("does not snap on leave, opposite-edge re-entry or a zero-dt resume", () => {
    const start = createSilkMotion(0);
    const entered = advanceSilkMotion(start, 1 / 60, 0.4, [1, 0]);
    expect(entered.pointerX).toBeGreaterThan(0.5);
    expect(entered.pointerX).toBeLessThan(0.6);
    expect(entered.pointerWeight).toBeGreaterThan(0);
    expect(entered.pointerWeight).toBeLessThan(0.15);
    const left = advanceSilkMotion(entered, 1 / 60, 0.4, null);
    expect(left.pointerX).toBe(entered.pointerX);
    expect(left.pointerWeight).toBeGreaterThan(0);
    expect(left.pointerWeight).toBeLessThan(entered.pointerWeight);
    expect(advanceSilkMotion(left, 0, 0.4, [0, 1])).toEqual(left);
    const reentered = advanceSilkMotion(left, 1 / 144, 0.4, [0, 1]);
    expect(Math.abs(reentered.pointerX - left.pointerX)).toBeLessThan(0.05);
  });

  it("integrates flow speed without rephasing the folds on update", () => {
    let state = createSilkMotion(0);
    for (let i = 0; i < 60; i += 1) state = advanceSilkMotion(state, 1 / 60, 0.4, null);
    expect(state.phase).toBeCloseTo(0.4, 12);
    state = advanceSilkMotion(state, 0, 1.5, null);
    expect(state.phase).toBeCloseTo(0.4, 12);
    state = advanceSilkMotion(state, 1 / 60, 1.5, null);
    expect(state.phase).toBeCloseTo(0.425, 12);
  });

  it("resets seed/phase deterministically and keeps the Radiant seed at time zero", () => {
    expect(createSilkMotion(0).phase).toBe(0);
    expect(createSilkMotion(729)).toEqual(createSilkMotion(729));
    expect(createSilkMotion(729).phase).not.toBe(createSilkMotion(730).phase);
    expect(createSilkMotion(729).pointerWeight).toBe(0);
    expect(createSilkMotion(0xffffffff).phase).toBeLessThan(64);
    expect(createSilkMotion(NaN)).toEqual(createSilkMotion(0));
  });

  it("does not turn malformed pointer or time into poisoned uniforms", () => {
    const initial = createSilkMotion(0);
    expect(advanceSilkMotion(initial, Number.NaN, 0.4, [1, 1])).toEqual(initial);
    expect(advanceSilkMotion(initial, -1, 0.4, [1, 1])).toEqual(initial);
    const invalidPointer = advanceSilkMotion(initial, 1 / 60, 0.4, [NaN, Infinity]);
    expect(invalidPointer.pointerWeight).toBe(0);
    expect(Object.values(invalidPointer).every(Number.isFinite)).toBe(true);
    const clampedPointer = advanceSilkMotion(initial, 1 / 60, 0.4, [4, -4]);
    expect(clampedPointer.pointerX).toBeGreaterThan(0.5);
    expect(clampedPointer.pointerX).toBeLessThan(1);
    expect(clampedPointer.pointerY).toBeGreaterThan(0);
    expect(clampedPointer.pointerY).toBeLessThan(0.5);
  });
});
