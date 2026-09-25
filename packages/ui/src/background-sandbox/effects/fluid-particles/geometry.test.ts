import { describe, expect, it } from "vitest";
import { createSourceSphereGeometry } from "./geometry";

describe("source sphere geometry", () => {
  it("retains the effective 80-triangle source mesh", () => {
    const sphere = createSourceSphereGeometry();
    expect(sphere.indices.length / 3).toBe(80);
    expect(sphere.vertices.length / 3).toBe(42);
    for (let i = 0; i < sphere.vertices.length; i += 3) {
      expect(Math.hypot(sphere.vertices[i], sphere.vertices[i + 1], sphere.vertices[i + 2])).toBeCloseTo(1, 5);
    }
  });
});
