export type PositionSummary = Readonly<{
  count: number;
  min: readonly [number, number, number];
  max: readonly [number, number, number];
  mean: readonly [number, number, number];
  span: readonly [number, number, number];
}>;

export function summarizeParticlePositions(pixels: Float32Array): PositionSummary {
  if (pixels.length === 0 || pixels.length % 4 !== 0) throw new RangeError("Invalid particle readback size");
  const count = pixels.length / 4;
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  const sum: [number, number, number] = [0, 0, 0];
  for (let index = 0; index < pixels.length; index += 4) {
    for (let axis = 0; axis < 3; axis++) {
      const value = pixels[index + axis];
      if (!Number.isFinite(value)) throw new RangeError("Nonfinite particle position");
      min[axis] = Math.min(min[axis], value);
      max[axis] = Math.max(max[axis], value);
      sum[axis] += value;
    }
  }
  return { count, min, max, mean: sum.map(value => value / count) as [number, number, number],
    span: min.map((value, axis) => max[axis] - value) as [number, number, number] };
}
