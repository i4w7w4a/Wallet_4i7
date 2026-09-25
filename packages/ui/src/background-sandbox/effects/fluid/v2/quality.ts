export interface FluidSize { width: number; height: number }
export type FluidQualityProfile = "economy" | "balanced" | "detail";
export interface FluidV2Allocation {
  simulation: FluidSize;
  dye: FluidSize;
  output: FluidSize;
  bloom: FluidSize[];
  sunrays: FluidSize;
  bytes: number;
  targetCount: number;
  pressureIterations: number;
  scale: number;
}
const PROFILES = {
  economy: { simShort: 64, simLong: 128, dyeShort: 128, dyeLong: 256, outputPixels: 512 * 1024, bloomLong: 128, rayLong: 96, pressureIterations: 12 },
  balanced: { simShort: 128, simLong: 256, dyeShort: 256, dyeLong: 512, outputPixels: 1024 * 1024, bloomLong: 256, rayLong: 196, pressureIterations: 20 },
  detail: { simShort: 256, simLong: 512, dyeShort: 512, dyeLong: 1024, outputPixels: 1536 * 1024, bloomLong: 256, rayLong: 196, pressureIterations: 20 },
} as const;

/** All optional post targets are reserved up front, so toggles never remount the field. */
export function planFluidV2Allocation(width: number, height: number, maxTexture: number, hostBytes: number, profile: FluidQualityProfile): FluidV2Allocation | null {
  if (![width, height, maxTexture, hostBytes].every((n) => Number.isFinite(n) && n >= 1)) return null;
  if (width > 1e9 || height > 1e9 || !Object.hasOwn(PROFILES, profile)) return null;
  const cap = Math.floor(maxTexture);
  const budget = Math.min(hostBytes, 28 * 1024 * 1024); // 32 MiB host envelope minus 4 MiB Promo reserve.
  const policy = PROFILES[profile];
  const scaled = (factor: number): FluidSize => ({ width: Math.max(1, Math.round(width * factor)), height: Math.max(1, Math.round(height * factor)) });
  const field = (short: number, long: number, scale: number): FluidSize => scaled(scale * Math.min(1, short / Math.min(width, height), long / Math.max(width, height), cap / Math.max(width, height)));
  const outputFactor = Math.min(1, cap / Math.max(width, height), Math.sqrt(policy.outputPixels / (width * height)));
  for (const scale of [1, 0.75, 0.5, 0.375, 0.25, 0.125, 0.0625]) {
    const simulation = field(policy.simShort, policy.simLong, scale);
    const dye = field(policy.dyeShort, policy.dyeLong, scale);
    const output = scaled(outputFactor * scale);
    const bloom = [field(policy.bloomLong, policy.bloomLong, scale)];
    for (let i = 1; i < 6; i++) {
      const previous = bloom[i - 1];
      bloom.push({ width: Math.max(1, Math.floor(previous.width / 2)), height: Math.max(1, Math.floor(previous.height / 2)) });
    }
    const sunrays = field(policy.rayLong, policy.rayLong, scale);
    const pixels = (size: FluidSize) => size.width * size.height;
    const bytes = 16 * pixels(simulation) + 32 * pixels(dye) + 4 * pixels(output) + 8 * bloom.reduce((sum, size) => sum + pixels(size), 0) + 6 * pixels(sunrays);
    if (bytes <= budget) return { simulation, dye, output, bloom, sunrays, bytes, targetCount: 20, pressureIterations: policy.pressureIterations, scale };
  }
  return null;
}
