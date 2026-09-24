import type { GpuLimits, Viewport } from "../../contracts";

export function resolveSilkTarget(viewport: Viewport, limits: GpuLimits): {
  width: number; height: number; bytes: number;
} | null {
  const width = viewport.pixelWidth;
  const height = viewport.pixelHeight;
  const bytes = width * height * 4;
  if (![width, height].every((size) => Number.isSafeInteger(size) && size > 0)
    || !Number.isFinite(limits.maxTextureSize) || !Number.isFinite(limits.maxRenderTargetBytes)
    || width > limits.maxTextureSize || height > limits.maxTextureSize
    || !Number.isSafeInteger(bytes) || bytes > limits.maxRenderTargetBytes) return null;
  return { width, height, bytes };
}
