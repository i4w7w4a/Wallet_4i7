import { describe, expect, it } from "vitest";
import type { PointerFrame, PointerSample } from "../../contracts";
import { FluidDragInput } from "./input";

const sample = (phase: PointerSample["phase"], time: number, delta: readonly [number, number] = [0, 0], id = 1): PointerSample => ({ phase, time, delta, id, uv: [0.5, 0.5], buttons: phase === "up" || phase === "cancel" ? 0 : 1 });
const frame = (samples: PointerSample[], down = true): PointerFrame => ({ uv: [0.5, 0.5], inside: true, down, samples });

describe("Fluid drag boundary", () => {
  it("requires a down and real motion, then stops injecting after release", () => {
    const input = new FluidDragInput();
    expect(input.consume(frame([sample("move", 0, [0.1, 0.1])]), 1)).toEqual([]);
    expect(input.consume(frame([sample("down", 1)]), 1)).toEqual([]);
    expect(input.consume(frame([sample("move", 1.01, [0.01, 0])]), 1)).toEqual([{ x: 0.5, y: 0.5, dx: 0.01, dy: 0 }]);
    expect(input.consume(frame([sample("up", 1.02)], false), 1)).toEqual([]);
    expect(input.consume(frame([sample("move", 1.03, [0.01, 0])]), 1)).toEqual([]);
  });

  it("never converts leave, re-entry, cancel, reset or an unknown id into an impulse", () => {
    const input = new FluidDragInput();
    for (const boundary of ["enter", "leave", "cancel"] as const) {
      input.consume(frame([sample("down", 0)]), 1);
      expect(input.consume(frame([sample(boundary, 1, [100, 100]), sample("move", 2, [0.1, 0.1])]), 1)).toEqual([]);
    }
    input.consume(frame([sample("down", 3)]), 1);
    expect(input.consume(frame([sample("move", 4, [0.1, 0.1], 2)]), 1)).toEqual([]);
    input.reset();
    expect(input.consume(frame([sample("move", 5, [0.1, 0.1])]), 1)).toEqual([]);
  });

  it("bounds total energy and pass count even for a burst of extreme deltas", () => {
    const input = new FluidDragInput();
    input.consume(frame([sample("down", 0)]), 1);
    const splats = input.consume(frame(Array.from({ length: 100 }, (_, i) => sample("move", i + 1, [100, -100]))), 1);
    expect(splats.length).toBeGreaterThan(0);
    expect(splats.length).toBeLessThanOrEqual(4);
    expect(splats.reduce((sum, splat) => sum + Math.hypot(splat.dx, splat.dy), 0)).toBeLessThanOrEqual(0.060001);
  });

  it("rejects nonfinite and repeated/out of order samples", () => {
    const input = new FluidDragInput();
    input.consume(frame([sample("down", 2)]), 1);
    expect(input.consume(frame([sample("move", 1, [0.01, 0]), sample("move", 3, [Infinity, 0]), sample("move", NaN, [0.01, 0])]), 1)).toEqual([]);
    const one = frame([sample("move", 4, [0.01, 0])]);
    expect(input.consume(one, 1)).toHaveLength(1);
    expect(input.consume(one, 1)).toEqual([]);
  });
});
