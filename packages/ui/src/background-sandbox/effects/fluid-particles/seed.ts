export type ParticleSeed = Readonly<{
  positions: Float32Array;
  randoms: Float32Array;
  coordinates: Float32Array;
}>;

export function createParticleSeed(
  size: Readonly<{ width: number; height: number }>, seed: number, fill: number, radius: number,
): ParticleSeed {
  if (!Number.isInteger(size.width) || !Number.isInteger(size.height) || size.width < 1 || size.height < 1
    || !Number.isInteger(seed) || seed < 0 || seed > 0xffffffff
    || !Number.isFinite(fill) || fill <= 0 || fill > 1
    || !Number.isFinite(radius) || radius <= 0 || radius >= 10 || fill * 40 <= 2 * radius) {
    throw new RangeError("Invalid particle seed geometry");
  }
  let state = (seed >>> 0) || 0x6d2b79f5;
  const next = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x100000000;
  };
  const count = size.width * size.height;
  const positions = new Float32Array(count * 4);
  const randoms = new Float32Array(count * 4);
  const coordinates = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    const x = i % size.width;
    const y = Math.floor(i / size.width);
    coordinates[i * 2] = (x + 0.5) / size.width;
    coordinates[i * 2 + 1] = (y + 0.5) / size.height;
    positions[i * 4] = radius + next() * (fill * 40 - 2 * radius);
    positions[i * 4 + 1] = radius + next() * (20 - 2 * radius);
    positions[i * 4 + 2] = radius + next() * (20 - 2 * radius);
    const theta = next() * 2 * Math.PI;
    const u = next() * 2 - 1;
    const radial = Math.sqrt(1 - u * u);
    randoms[i * 4] = radial * Math.cos(theta);
    randoms[i * 4 + 1] = radial * Math.sin(theta);
    randoms[i * 4 + 2] = u;
  }
  return { positions, randoms, coordinates };
}
