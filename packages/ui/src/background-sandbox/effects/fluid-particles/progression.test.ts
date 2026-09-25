import { describe, expect, it } from "vitest";
import { summarizeParticlePositions } from "./progression";

describe("particle progression readback", () => {
  it("reports changes in physical position rather than display color", () => {
    const pixels = new Float32Array([
      1, 2, 3, 0,
      3, 4, 5, 0,
      5, 6, 7, 0,
      7, 8, 9, 0,
    ]);
    expect(summarizeParticlePositions(pixels)).toMatchObject({
      count: 4, min: [1, 2, 3], max: [7, 8, 9],
      mean: [4, 5, 6], span: [6, 6, 6],
    });
  });

  it("rejects malformed or nonfinite GPU readback", () => {
    expect(() => summarizeParticlePositions(new Float32Array())).toThrow();
    expect(() => summarizeParticlePositions(new Float32Array([1, 2, NaN, 0]))).toThrow();
  });
});
