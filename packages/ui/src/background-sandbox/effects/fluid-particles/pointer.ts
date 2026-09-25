import type { PointerFrame } from "../../contracts";
import type { ParticleCamera } from "./camera";

export type ParticlePointer = Readonly<{
  velocity: readonly [number, number, number];
  ray: readonly [number, number, number];
}>;

export function computeParticlePointer(pointer: PointerFrame, camera: ParticleCamera, aspect: number): ParticlePointer {
  const inverse = camera.inverseViewMatrix;
  const uv = pointer.uv.every(Number.isFinite) ? pointer.uv : [0.5, 0.5];
  const vx = (uv[0] * 2 - 1) * Math.tan(camera.fov / 2) * aspect;
  const vy = (uv[1] * 2 - 1) * Math.tan(camera.fov / 2);
  const direction = [inverse[0] * vx + inverse[4] * vy - inverse[8],
    inverse[1] * vx + inverse[5] * vy - inverse[9],
    inverse[2] * vx + inverse[6] * vy - inverse[10]];
  const directionLength = Math.hypot(...direction);
  const ray = directionLength > 0 && Number.isFinite(directionLength)
    ? direction.map(value => value / directionLength) as [number, number, number]
    : [0, 0, -1] as const;
  const sample = pointer.inside ? [...pointer.samples].reverse().find(item => item.phase === "move"
    && item.buttons === 0 && item.delta.every(Number.isFinite)) : null;
  if (!sample) return { velocity: [0, 0, 0], ray };
  const distance = Math.hypot(camera.eye[0] - 20, camera.eye[1] - 10, camera.eye[2] - 10);
  const planeX = sample.delta[0] * 2 * Math.tan(camera.fov / 2) * aspect * distance;
  const planeY = sample.delta[1] * 2 * Math.tan(camera.fov / 2) * distance;
  const unbounded = [inverse[0] * planeX + inverse[4] * planeY,
    inverse[1] * planeX + inverse[5] * planeY,
    inverse[2] * planeX + inverse[6] * planeY];
  const speed = Math.hypot(...unbounded);
  if (!Number.isFinite(speed)) return { velocity: [0, 0, 0], ray };
  const scale = speed > 8 ? 8 / speed : 1;
  return { velocity: unbounded.map(value => value * scale) as [number, number, number], ray };
}
