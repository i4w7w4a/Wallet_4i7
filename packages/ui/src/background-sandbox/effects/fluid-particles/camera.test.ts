import { describe, expect, it } from "vitest";
import { createParticleCamera, type CameraPreset } from "./camera";
import { createParticleSeed } from "./seed";

function project(matrix: ArrayLike<number>, point: readonly [number, number, number]) {
  const [x, y, z] = point;
  const w = matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15];
  return [
    (matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12]) / w,
    (matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13]) / w,
  ];
}

describe("particle camera containment", () => {
  for (const [width, height] of [[320, 800], [390, 800], [430, 800], [480, 800], [430, 720], [1600, 900]] as const) {
    for (const preset of ["front", "isometric", "high"] as const satisfies readonly CameraPreset[]) {
      it(`fits every sphere at the volume corners in ${width}×${height} · ${preset}`, () => {
        const radius = 0.35;
        const camera = createParticleCamera(width / height, preset, radius);
        expect(camera.eye[2]).toBeGreaterThan(10);
        for (const x of [radius, 40 - radius]) {
          for (const y of [radius, 20 - radius]) {
            for (const z of [radius, 20 - radius]) {
              for (const offset of [
                [0, 0, 0], [radius, 0, 0], [-radius, 0, 0],
                [0, radius, 0], [0, -radius, 0], [0, 0, radius], [0, 0, -radius],
              ] as const) {
                const [sx, sy] = project(camera.projectionViewMatrix,
                  [x + offset[0], y + offset[1], z + offset[2]]);
                expect(Math.abs(sx)).toBeLessThan(0.97);
                expect(Math.abs(sy)).toBeLessThan(0.97);
              }
            }
          }
        }
      });
    }
  }

  for (const width of [320, 390, 430, 480]) {
    it(`frames the seeded dam as a visible central 3D mass in MONO ${width}×800`, () => {
      const height = 800;
      const radius = (7 / 32) * 1.4;
      const camera = createParticleCamera(width / height, "isometric", radius);
      const positions = createParticleSeed({ width: 256, height: 120 }, 147, 0.375, radius).positions;
      let left = Infinity, right = -Infinity, bottom = Infinity, top = -Infinity;
      for (let i = 0; i < positions.length; i += 4) {
        const [x, y] = project(camera.projectionViewMatrix,
          [positions[i], positions[i + 1], positions[i + 2]]);
        left = Math.min(left, x); right = Math.max(right, x);
        bottom = Math.min(bottom, y); top = Math.max(top, y);
      }
      const projectedWidth = (right - left) * width / 2;
      const projectedHeight = (top - bottom) * height / 2;
      const centerX = (left + right + 2) * width / 4;
      expect(projectedWidth).toBeGreaterThan(width * 0.58);
      expect(projectedHeight).toBeGreaterThan(height * 0.25);
      expect(centerX).toBeGreaterThan(width * 0.35);
      expect(centerX).toBeLessThan(width * 0.65);
    });
  }
});
