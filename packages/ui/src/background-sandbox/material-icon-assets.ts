import type { ButtonTargetId, MaterialAssetId, MaterialMaskSource } from "./material-contract";
import { BUTTON_MASK_ASSETS } from "./target-binding";

/** The four existing MONO action strokes are the entire material icon allowlist. */
export const MATERIAL_ICON_PATHS: Readonly<Record<MaterialAssetId, string>> = Object.freeze({
  "mono.quick.send": "M5 18 19 4M8 4h11v11",
  "mono.quick.receive": "M19 6 5 20M16 20H5V9",
  "mono.quick.swap": "M4 8h16m0 0-4-4m4 4-4 4M20 16H4m0 0 4-4m-4 4 4 4",
  "mono.quick.buy": "M12 4v16M4 12h16",
});

export function monoActionIconPath(targetId: ButtonTargetId): string {
  return MATERIAL_ICON_PATHS[BUTTON_MASK_ASSETS[targetId]];
}

/** Bounded top-down coverage is shared with adapter preparation and the host clip. */
export function rasterizeMaterialIcon(assetId: MaterialAssetId, width: number, height: number): MaterialMaskSource {
  if (!Object.hasOwn(MATERIAL_ICON_PATHS, assetId) || !Number.isInteger(width) || !Number.isInteger(height) ||
      width < 1 || height < 1 || width > 256 || height > 256) throw new RangeError("Invalid MONO icon mask size or asset.");
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("MONO action mask requires Canvas 2D.");
  const unit = Math.min(width, height) / 24;
  ctx.translate(width * 0.5 - unit * 12, height * 0.5 - unit * 12);
  ctx.scale(unit, unit);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1.35;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke(new Path2D(MATERIAL_ICON_PATHS[assetId]));
  const rgba = ctx.getImageData(0, 0, width, height).data;
  const coverage = new Uint8Array(width * height);
  for (let pixel = 0; pixel < coverage.length; pixel++) coverage[pixel] = rgba[pixel * 4 + 3]!;
  return { assetId, width, height, coverage };
}
