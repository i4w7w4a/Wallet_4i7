export interface SeedSplat { x: number; y: number; dx: number; dy: number; pigment: number }
/** Local initialization only; no entropy, time, stored pixels, or gesture history. */
export function createSeedSplats(seed: number): SeedSplat[] {
  let state = (seed >>> 0) || 0x9e3779b9;
  const random = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
  return Array.from({ length: 6 }, (_, index) => {
    const x = 0.15 + random() * 0.7;
    const y = 0.15 + random() * 0.7;
    const angle = random() * Math.PI * 2;
    const speed = 40 + random() * 80;
    return { x, y, dx: Math.cos(angle) * speed, dy: Math.sin(angle) * speed, pigment: index % 3 };
  });
}
