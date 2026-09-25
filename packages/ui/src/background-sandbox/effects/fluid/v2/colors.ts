export type FluidRgb = [number, number, number];
/** Input is a strict normalized #RRGGBB from parseFluidV2Params. */
export function fluidHexToRgb(hex: string): FluidRgb {
  return [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255) as FluidRgb;
}

/** Six transported channels each have a live color. Cycling shifts the mapping without resetting dye. */
export function resolveFluidV2Colors(colors: readonly string[], time: number, cycleRate: number): FluidRgb[] {
  const swatches = colors.map(fluidHexToRgb);
  const offset = ((time * cycleRate) % swatches.length + swatches.length) % swatches.length;
  const base = Math.floor(offset);
  const mix = offset - base;
  return Array.from({ length: 6 }, (_, pigment) => {
    const first = swatches[(base + pigment) % swatches.length];
    const second = swatches[(base + pigment + 1) % swatches.length];
    return [0, 1, 2].map((channel) => first[channel] * (1 - mix) + second[channel] * mix) as FluidRgb;
  });
}
