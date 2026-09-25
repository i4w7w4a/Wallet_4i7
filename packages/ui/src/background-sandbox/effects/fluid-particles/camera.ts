export type CameraPreset = "front" | "isometric" | "high";
export type ParticleCamera = Readonly<{
  eye: readonly [number, number, number];
  viewMatrix: Float32Array;
  inverseViewMatrix: Float32Array;
  projectionMatrix: Float32Array;
  projectionViewMatrix: Float32Array;
  lightProjectionViewMatrix: Float32Array;
  fov: number;
}>;

export function createParticleCamera(aspect: number, preset: CameraPreset, radius: number): ParticleCamera {
  if (!Number.isFinite(aspect) || aspect <= 0 || !Number.isFinite(radius) || radius <= 0) {
    throw new RangeError("Invalid particle camera geometry");
  }
  const fov = Math.PI / 3;
  const halfVertical = fov / 2;
  const halfHorizontal = Math.atan(Math.tan(halfVertical) * aspect);
  const worldRadius = Math.hypot(20, 10, 10) + radius;
  const distance = worldRadius / Math.sin(Math.min(halfVertical, halfHorizontal)) / 0.94;
  const direction = preset === "front" ? [0, 0.16, 1]
    : preset === "high" ? [0.35, 0.95, 1] : [0.75, 0.42, 1];
  const directionLength = Math.hypot(...direction);
  const eye = [20 + direction[0] / directionLength * distance,
    10 + direction[1] / directionLength * distance,
    10 + direction[2] / directionLength * distance] as const;
  const world = new Mat4().lookAt(new Vec3(...eye), new Vec3(20, 10, 10), new Vec3(0, 1, 0));
  const view = new Mat4().inverse(world);
  const projection = new Mat4().fromPerspective({ fov, aspect, near: 0.1, far: distance + worldRadius * 3 });
  const projectionView = new Mat4().multiply(projection, view);
  const lightWorld = new Mat4().lookAt(new Vec3(20, 70, 10), new Vec3(20, 10, 10), new Vec3(0, 0, 1));
  const lightView = new Mat4().inverse(lightWorld);
  const lightProjection = new Mat4().fromOrthogonal({ left: -21, right: 21, bottom: -11,
    top: 11, near: 1, far: 100 });
  return { eye, viewMatrix: view.toArray(new Float32Array(16)),
    inverseViewMatrix: world.toArray(new Float32Array(16)),
    projectionMatrix: projection.toArray(new Float32Array(16)),
    projectionViewMatrix: projectionView.toArray(new Float32Array(16)),
    lightProjectionViewMatrix: new Mat4().multiply(lightProjection, lightView).toArray(new Float32Array(16)),
    fov };
}
import { Mat4, Vec3 } from "ogl";
