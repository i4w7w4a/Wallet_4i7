export interface FluidSize { width: number; height: number }
export interface FluidAllocation {
  simulation: FluidSize;
  dye: FluidSize;
  output: FluidSize;
  bytes: number;
  pressureIterations: number;
  simulationPasses: number;
}
/** Policy v1: engineering bounds, deliberately absent from the saved params. */
export function planFluidAllocation(width: number, height: number, maxTexture: number, maxBytes: number): FluidAllocation | null {
  if (![width, height, maxTexture, maxBytes].every((n) => Number.isFinite(n) && n >= 1)) return null;
  const textureCap = Math.floor(maxTexture);
  const budget = Math.min(maxBytes, 8 * 1024 * 1024);
  const fit = (scale: number): FluidSize => ({
    width: Math.max(1, Math.floor(width * scale)),
    height: Math.max(1, Math.floor(height * scale)),
  });
  const field = (short: number, long: number): FluidSize => {
    const scale = Math.min(1, short / Math.min(width, height), long / Math.max(width, height), textureCap / Math.max(width, height));
    return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
  };
  const simulation = field(128, 256);
  const dye = field(256, 512);
  const output = fit(Math.min(1, textureCap / Math.max(width, height), Math.sqrt(1024 * 1024 / width / height)));
  for (const scale of [1, 0.5, 0.25, 0.125]) {
    const shrink = (size: FluidSize) => ({ width: Math.max(1, Math.floor(size.width * scale)), height: Math.max(1, Math.floor(size.height * scale)) });
    const sim = shrink(simulation);
    const ink = shrink(dye);
    const display = shrink(output);
    const bytes = 16 * sim.width * sim.height + 16 * ink.width * ink.height + 4 * display.width * display.height;
    if (bytes <= budget) return { simulation: sim, dye: ink, output: display, bytes, pressureIterations: 20, simulationPasses: 27 };
  }
  return null;
}
