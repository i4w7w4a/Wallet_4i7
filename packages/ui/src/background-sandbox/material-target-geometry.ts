import type { Viewport } from "./contracts";
import type { MaterialCapability, MaterialMask, MaterialTargetGeometry } from "./material-contract";

export type RectMeasure = Readonly<{ left: number; top: number; width: number; height: number }>;

export function resolveMaterialTargetGeometry(
  root: RectMeasure, target: RectMeasure, viewport: Viewport,
  capability: MaterialCapability, mask: MaterialMask, radiusCss: number, borderWidthCss: number,
): MaterialTargetGeometry | null {
  if (![root.left, root.top, root.width, root.height, target.left, target.top, target.width,
    target.height, viewport.cssWidth, viewport.cssHeight, viewport.pixelWidth, viewport.pixelHeight,
    viewport.dpr, radiusCss, borderWidthCss].every(Number.isFinite) ||
    root.width <= 0 || root.height <= 0 || target.width <= 0 || target.height <= 0 ||
    viewport.dpr <= 0 || radiusCss < 0 || borderWidthCss < 0) return null;
  const x = target.left - root.left;
  const y = root.top + root.height - target.top - target.height;
  if (x >= root.width || y >= root.height || x + target.width <= 0 || y + target.height <= 0) return null;
  return {
    capability, x, y,
    width: target.width, height: target.height,
    pixelWidth: Math.max(1, Math.ceil(target.width * viewport.dpr)),
    pixelHeight: Math.max(1, Math.ceil(target.height * viewport.dpr)),
    dpr: viewport.dpr, radiusCss, borderWidthCss, mask,
  };
}
