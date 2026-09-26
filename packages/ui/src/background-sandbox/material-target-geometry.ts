import type { Viewport } from "./contracts";
import type { MaterialCapability, MaterialMask, MaterialTargetGeometry } from "./material-contract";

export type RectMeasure = Readonly<{ left: number; top: number; width: number; height: number }>;
export type MaterialScissorRect = Readonly<{ x: number; y: number; width: number; height: number }>;
export type MaterialHostClip = Readonly<{
  x: number; y: number; width: number; height: number; radiusCss: number; contentBottomY: number;
}>;

/** Explicit DOM silhouette for action passes, measured in the same canvas coordinates as targets. */
export function resolveMaterialHostClip(root: RectMeasure, host: RectMeasure, options: {
  layoutWidth: number; layoutHeight: number; radiusCss: number; borderCss: number;
  box: "padding" | "border"; statusTop?: number;
}): MaterialHostClip | null {
  if (![root.left, root.top, root.width, root.height, host.left, host.top, host.width, host.height,
    options.layoutWidth, options.layoutHeight, options.radiusCss, options.borderCss,
    ...(options.statusTop === undefined ? [] : [options.statusTop])].every(Number.isFinite) ||
    root.width <= 0 || root.height <= 0 || host.width <= 0 || host.height <= 0 ||
    options.layoutWidth <= 0 || options.layoutHeight <= 0 || options.radiusCss < 0 || options.borderCss < 0) return null;
  const scaleX = host.width / options.layoutWidth;
  const scaleY = host.height / options.layoutHeight;
  const insetX = options.box === "padding" ? options.borderCss * scaleX : 0;
  const insetY = options.box === "padding" ? options.borderCss * scaleY : 0;
  const width = host.width - 2 * insetX;
  const height = host.height - 2 * insetY;
  if (width <= 0 || height <= 0) return null;
  const x = host.left - root.left + insetX;
  const y = root.top + root.height - host.top - host.height + insetY;
  const radiusCss = Math.min(Math.min(width, height) * 0.5,
    Math.max(0, options.radiusCss - (options.box === "padding" ? options.borderCss : 0)) * Math.min(scaleX, scaleY));
  const contentBottomY = options.statusTop === undefined ? y :
    Math.min(y + height, Math.max(y, root.top + root.height - options.statusTop));
  return { x, y, width, height, radiusCss, contentBottomY };
}

/** The pass may keep its full local UV; only visible canvas pixels are composited. */
export function materialScissorRect(geometry: MaterialTargetGeometry, viewport: Viewport): MaterialScissorRect | null {
  const left = Math.max(0, Math.floor(geometry.x * viewport.dpr));
  const bottom = Math.max(0, Math.floor(geometry.y * viewport.dpr));
  const right = Math.min(viewport.pixelWidth, Math.ceil((geometry.x + geometry.width) * viewport.dpr));
  const top = Math.min(viewport.pixelHeight, Math.ceil((geometry.y + geometry.height) * viewport.dpr));
  return right > left && top > bottom ? { x: left, y: bottom, width: right - left, height: top - bottom } : null;
}

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
