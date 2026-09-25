import { describe, expect, it } from "vitest";
import { createParticleCamera, type CameraPreset } from "./camera";

function project(matrix: ArrayLike<number>, point: readonly [number, number, number]) {
  const [x, y, z] = point;
  const w = matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15];
  return [
    (matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12]) / w,
    (matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13]) / w,
  ];
}

describe("particle camera containment", () => {
  for (const [width, height] of [[390, 844], [1600, 900]] as const) {
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
});
