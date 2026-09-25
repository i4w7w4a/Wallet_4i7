import { describe, expect, it } from "vitest";
import { ActiveClock, PointerInput, resolveViewport } from "./host-input";

describe("active host time", () => {
  it("excludes hidden time and starts resume with zero dt", () => {
    const clock = new ActiveClock();
    expect(clock.advance(1000)).toEqual({ time: 0, dt: 0 });
    expect(clock.advance(1020)).toEqual({ time: 0.02, dt: 0.02 });
    clock.pause();
    expect(clock.advance(900000)).toEqual({ time: 0.02, dt: 0 });
    expect(clock.advance(900010)).toEqual({ time: 0.03, dt: 0.01 });
  });

  it("bounds long frames and ignores nonfinite or backwards samples", () => {
    const clock = new ActiveClock();
    clock.advance(10);
    expect(clock.advance(1010)).toEqual({ time: 0.064, dt: 0.064 });
    expect(clock.advance(Number.NaN)).toEqual({ time: 0.064, dt: 0 });
    expect(clock.advance(0)).toEqual({ time: 0.064, dt: 0 });
    expect(clock.advance(1020)).toEqual({ time: 0.074, dt: 0.01 });
    clock.reset();
    expect(clock.advance(8000)).toEqual({ time: 0, dt: 0 });
  });

  it("timestamps multiple pointer samples between RAF frames in active time", () => {
    const clock = new ActiveClock();
    clock.advance(1000);
    const down = clock.sampleTime(1002);
    const move = clock.sampleTime(1003);
    const up = clock.sampleTime(1003);
    expect(down).toBeGreaterThan(0);
    expect(move).toBeGreaterThan(down);
    expect(up).toBeGreaterThan(move);
    expect(clock.advance(1016).time).toBeGreaterThanOrEqual(up);
    clock.pause();
    expect(clock.advance(900000).dt).toBe(0);
  });
});

describe("host pointer collection", () => {
  it("does not turn arrival, re-entry, or cancellation into a fluid impulse", () => {
    const input = new PointerInput();
    input.push({ id: 1, phase: "enter", uv: [0.2, 0.7], time: 0, buttons: 0 });
    input.push({ id: 1, phase: "down", uv: [0.2, 0.7], time: 0.01, buttons: 1 });
    input.push({ id: 1, phase: "move", uv: [0.4, 0.6], time: 0.02, buttons: 1 });
    const frame = input.drain();
    expect(frame.down).toBe(true);
    expect(frame.samples[0]?.delta).toEqual([0, 0]);
    expect(frame.samples[2]?.delta[0]).toBeCloseTo(0.2);
    expect(frame.samples[2]?.delta[1]).toBeCloseTo(-0.1);
    expect(input.drain().samples).toEqual([]);
    input.push({ id: 1, phase: "cancel", uv: [0.4, 0.6], time: 0.03, buttons: 0 });
    expect(input.drain()).toMatchObject({ down: false, inside: false });
    input.push({ id: 1, phase: "move", uv: [0.9, 0.1], time: 1, buttons: 0 });
    expect(input.drain().samples[0]?.delta).toEqual([0, 0]);
  });

  it("bounds queued work, ignores extra pointers and nonfinite input, and resets resize delta", () => {
    const input = new PointerInput(4);
    input.push({ id: 3, phase: "enter", uv: [0, 0], time: 0, buttons: 0 });
    input.push({ id: 4, phase: "down", uv: [1, 1], time: 0.1, buttons: 1 });
    input.push({ id: 3, phase: "move", uv: [NaN, 0], time: 0.1, buttons: 0 });
    for (let i = 1; i <= 10; i++) input.push({ id: 3, phase: "move", uv: [i / 10, 0], time: i, buttons: 0 });
    const frame = input.drain();
    expect(frame.samples).toHaveLength(4);
    expect(frame.uv).toEqual([1, 0]);
    expect(frame.down).toBe(false);
    expect(frame.samples.every(sample => sample.id === 3)).toBe(true);
    input.reset();
    input.push({ id: 3, phase: "move", uv: [0.1, 0.2], time: 11, buttons: 0 });
    expect(input.drain().samples[0]?.delta).toEqual([0, 0]);
  });

  it("releases ownership on up so two separate touch taps reach the effect", () => {
    const input = new PointerInput();
    input.push({ id: 11, phase: "down", uv: [0.2, 0.5], time: 0.01, buttons: 1, pointerType: "touch" });
    input.push({ id: 11, phase: "up", uv: [0.2, 0.5], time: 0.02, buttons: 0, pointerType: "touch" });
    input.push({ id: 12, phase: "down", uv: [0.8, 0.5], time: 0.03, buttons: 1, pointerType: "touch" });
    input.push({ id: 12, phase: "up", uv: [0.8, 0.5], time: 0.04, buttons: 0, pointerType: "touch" });
    const samples = input.drain().samples;
    expect(samples.map(sample => sample.phase)).toEqual(["down", "up", "down", "up"]);
    expect(samples[2]?.delta).toEqual([0, 0]);
    expect(input.drain().down).toBe(false);
  });
});

describe("host raster budget", () => {
  it("preserves CSS geometry while capping DPR and GPU dimensions", () => {
    expect(resolveViewport(390, 800, 3, 4096)).toEqual({ cssWidth: 390, cssHeight: 800,
      pixelWidth: 585, pixelHeight: 1200, dpr: 1.5 });
    expect(resolveViewport(1600, 900, 3, 2048)).toEqual({ cssWidth: 1600, cssHeight: 900,
      pixelWidth: 2048, pixelHeight: 1152, dpr: 1.28 });
    expect(resolveViewport(0, 0, 2, 4096)).toBeNull();
    expect(resolveViewport(Infinity, 200, 1, 4096)).toBeNull();
  });
});
