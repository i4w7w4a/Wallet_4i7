import { describe, expect, it } from "vitest";

import {
  createPresetJson,
  magneticOffset,
  parsePresetJson,
  type ControlFeedbackPreset,
} from "./control-feedback-model";

const sample: ControlFeedbackPreset = {
  schemaVersion: 1,
  sceneId: "control-feedback-01",
  implementationVersion: 1,
  effectId: "magnetic",
  view: "context",
  previewWidth: 390,
  status: "draft",
  config: { pressDepth: 2, magneticTravel: 5, settleMs: 190 },
};

describe("CONTROL-FEEDBACK-01 preset", () => {
  it("round-trips every effective value through versioned JSON", () => {
    expect(parsePresetJson(createPresetJson(sample))).toEqual(sample);
  });

  it("rejects unknown fields, out-of-range controls and unknown versions", () => {
    expect(() => parsePresetJson(JSON.stringify({ ...sample, action: "transfer" }))).toThrow();
    expect(() => parsePresetJson(JSON.stringify({ ...sample, config: { ...sample.config, magneticTravel: 50 } }))).toThrow();
    expect(() => parsePresetJson(JSON.stringify({ ...sample, schemaVersion: 2 }))).toThrow();
  });

  it("rejects oversized and malformed imports before any application", () => {
    expect(() => parsePresetJson(" ".repeat(8193))).toThrow();
    expect(() => parsePresetJson("{" )).toThrow();
  });
});

describe("bounded magnetic target", () => {
  const rect = { left: 100, top: 100, width: 160, height: 48 };

  it("stays inside the configured travel and responds to direction changes", () => {
    const right = magneticOffset({ x: 235, y: 124 }, rect, 6);
    const left = magneticOffset({ x: 125, y: 124 }, rect, 6);

    expect(right.x).toBeGreaterThan(0);
    expect(left.x).toBeLessThan(0);
    expect(Math.abs(right.x)).toBeLessThanOrEqual(6);
    expect(Math.abs(left.x)).toBeLessThanOrEqual(6);
    expect(right.y).toBe(0);
  });

  it("returns neutral outside the stable button box", () => {
    expect(magneticOffset({ x: 270, y: 124 }, rect, 6)).toEqual({ x: 0, y: 0 });
  });
});
