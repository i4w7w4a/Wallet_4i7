import type { MaterialAssetId } from "../../material-contract";
import { createPaperMaskCache, prepareHeatmapMaskAsync, preparePoissonMaskAsync, resolvePaperMaskSize, type PaperMask } from "./masks";

export type PaperAssetId = "strict-rectangle" | "rounded-rectangle" | MaterialAssetId;
export type PaperMaskKind = "metal" | "gem" | "heatmap";
export type RasterPaperAsset = Readonly<{ width: number; height: number; rgba: Uint8Array }>;

// Exact SVG paths from MonoScene ACTIONS. The original DOM icons remain live.
const ACTION_PATHS: Readonly<Record<MaterialAssetId, string>> = {
  "mono.quick.send": "M5 18 19 4M8 4h11v11",
  "mono.quick.receive": "M19 6 5 20M16 20H5V9",
  "mono.quick.swap": "M4 8h16m0 0-4-4m4 4-4 4M20 16H4m0 0 4-4m-4 4 4 4",
  "mono.quick.buy": "M12 4v16M4 12h16",
};

function validate(width: number, height: number, padding: number): void {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 ||
      width > 256 || height > 256 || !Number.isFinite(padding) || padding < 0 || padding > 0.375) {
    throw new RangeError("Paper asset exceeds its geometry budget.");
  }
}

/** Black opaque silhouette; the transparent pixels composite to white for Heatmap. */
export function rasterizePaperGeometry(
  id: "strict-rectangle" | "rounded-rectangle", width: number, height: number, padding: number, radiusPx = Math.min(width, height) * 0.24,
): RasterPaperAsset {
  validate(width, height, padding);
  if (!Number.isFinite(radiusPx) || radiusPx < 0) throw new RangeError("Invalid Paper geometry radius.");
  const data = new Uint8Array(width * height * 4);
  const insetX = width * padding;
  const insetY = height * padding;
  const halfW = width * 0.5 - insetX;
  const halfH = height * 0.5 - insetY;
  const radius = id === "rounded-rectangle" ? Math.min(radiusPx, halfW, halfH) : 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = Math.abs(x + 0.5 - width * 0.5) - halfW + radius;
      const dy = Math.abs(y + 0.5 - height * 0.5) - halfH + radius;
      const distance = Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0) - radius;
      data[(y * width + x) * 4 + 3] = Math.round(255 * Math.max(0, Math.min(1, 0.5 - distance)));
    }
  }
  return { width, height, rgba: data };
}

export function rasterizePaperAsset(id: PaperAssetId, width: number, height: number, padding = 0, radiusPx?: number): RasterPaperAsset {
  if (id === "strict-rectangle" || id === "rounded-rectangle") return rasterizePaperGeometry(id, width, height, padding, radiusPx);
  validate(width, height, padding);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Paper action icon requires Canvas 2D for its bounded mask.");
  const usableW = width * (1 - 2 * padding);
  const usableH = height * (1 - 2 * padding);
  const unit = Math.min(usableW, usableH) / 24;
  ctx.translate(width * 0.5 - unit * 12, height * 0.5 - unit * 12);
  ctx.scale(unit, unit);
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke(new Path2D(ACTION_PATHS[id]));
  return { width, height, rgba: new Uint8Array(ctx.getImageData(0, 0, width, height).data) };
}

export function paperAssetKey(kind: PaperMaskKind, id: PaperAssetId, width: number, height: number, revision: number, radiusPx: number): string {
  if (!Number.isInteger(revision) || revision < 1 || !Number.isFinite(radiusPx) || radiusPx < 0) throw new RangeError("Invalid Paper mask key.");
  return `${kind}:${id}:${width}x${height}:r${Math.round(radiusPx * 100) / 100}:v${revision}`;
}

/** Private mask cache. Color, time and other shader uniforms are deliberately absent from the key. */
export function createPaperAssetPreparer(maxCacheBytes = 2 * 1024 * 1024) {
  const cache = createPaperMaskCache(maxCacheBytes);
  return {
    async prepare(
      kind: PaperMaskKind, id: PaperAssetId,
      targetWidth: number, targetHeight: number,
      revision = 1,
      radiusPx = 0,
      signal?: AbortSignal,
    ): Promise<PaperMask> {
      const { width, height } = resolvePaperMaskSize(targetWidth, targetHeight, targetWidth, targetHeight);
      const scaledRadius = radiusPx * width / targetWidth;
      const key = paperAssetKey(kind, id, width, height, revision, scaledRadius);
      return cache.getOrPrepare(key, async () => {
        if (signal?.aborted) throw new DOMException("Paper mask preparation cancelled.", "AbortError");
        const padding = kind === "gem" ? 0.025 : kind === "heatmap" ? 0.375 : 0;
        const source = rasterizePaperAsset(id, width, height, padding, scaledRadius);
        if (kind === "heatmap") return prepareHeatmapMaskAsync(source, signal);
        const alpha = new Uint8Array(width * height);
        for (let i = 0; i < alpha.length; i++) alpha[i] = source.rgba[i * 4 + 3]!;
        return preparePoissonMaskAsync({ width, height, alpha }, signal);
      });
    },
    clear: cache.clear,
    get byteLength() { return cache.byteLength; },
  };
}
