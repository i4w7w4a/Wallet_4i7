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
  const worldRadius = Math.hypot(20, 10, 10) + radius;
  const direction = preset === "front" ? [0, 0.16, 1]
    : preset === "high" ? [0.35, 0.95, 1] : [-1, 0.35, 0.2];
  const directionLength = Math.hypot(...direction);
  const unit = direction.map(value => value / directionLength);
  const target = new Vec3(20, 10, 10);
  const up = new Vec3(0, 1, 0);
  const fitProjection = new Mat4().fromPerspective({ fov, aspect, near: 0.1, far: 100000 });
  // The source uses a fixed desktop camera. Fit the actual physical box in
  // portrait instead of its enclosing sphere: the latter leaves the seeded
  // dam tiny even though much of the viewport is unused. The expanded box
  // includes every sphere at the solver's maximum editable render radius.
  const fits = (distance: number) => {
    const eye = new Vec3(20 + unit[0] * distance, 10 + unit[1] * distance, 10 + unit[2] * distance);
    const view = new Mat4().inverse(new Mat4().lookAt(eye, target, up));
    const matrix = new Mat4().multiply(fitProjection, view);
    for (const x of [-radius, 40 + radius]) for (const y of [-radius, 20 + radius]) for (const z of [-radius, 20 + radius]) {
      const w = matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15];
      if (w <= 0) return false;
      const projectedX = (matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12]) / w;
      const projectedY = (matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13]) / w;
      if (Math.abs(projectedX) > 0.94 || Math.abs(projectedY) > 0.94) return false;
    }
    return true;
  };
  let lower = worldRadius + 1;
  let upper = Math.max(40, lower * 2);
  while (!fits(upper)) {
    upper *= 2;
    if (upper > 100000) throw new RangeError("Particle camera cannot fit physical volume");
  }
  for (let i = 0; i < 32; i++) {
    const middle = (lower + upper) / 2;
    if (fits(middle)) upper = middle;
    else lower = middle;
  }
  const distance = upper;
  const eye = [20 + direction[0] / directionLength * distance,
    10 + direction[1] / directionLength * distance,
    10 + direction[2] / directionLength * distance] as const;
  const world = new Mat4().lookAt(new Vec3(...eye), target, up);
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
