import type { CreateResult } from "../../contracts";
import type {
  MaterialPrepareRequest, PreparedMaterialAssets, PreparedMaterialAsset,
} from "../../material-contract";
import { createPaperAssetPreparer, paperAssetKey, paperCoverageHash, type PaperAssetId, type PaperMaskKind } from "./assets";
import { resolvePaperMaskSize, type PaperMask } from "./masks";
import { PAPER_NOISE_DATA_URI } from "./noise-source";
import type { GemSmokeParams, HeatmapParams, LiquidMetalParams } from "./schema";

export type PaperPreparedAssets = PreparedMaterialAssets & Readonly<{ noise?: PaperMask }>;
type MaskParams = LiquidMetalParams | GemSmokeParams | HeatmapParams;

const maskPreparer = createPaperAssetPreparer();
let noisePromise: Promise<PaperMask> | undefined;

function fail(message: string): CreateResult<PaperPreparedAssets> {
  return { ok: false, error: { code: "budget-exceeded", message } };
}

function abortIfNeeded(signal: AbortSignal): void {
  if (signal.aborted) throw new DOMException("Paper preparation cancelled.", "AbortError");
}

/** The source 128² PNG is decoded once, off the render path and without a remote request. */
async function loadNoise(): Promise<PaperMask> {
  noisePromise ??= new Promise<PaperMask>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      try {
        if (image.naturalWidth !== 128 || image.naturalHeight !== 128) throw new Error("Invalid Paper noise texture.");
        const canvas = document.createElement("canvas");
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) throw new Error("Paper noise requires Canvas 2D decoding.");
        ctx.drawImage(image, 0, 0);
        resolve({ width: 128, height: 128, data: new Uint8Array(ctx.getImageData(0, 0, 128, 128).data) });
      } catch (error) { reject(error); }
    };
    image.onerror = () => reject(new Error("Could not decode local Paper noise texture."));
    image.src = PAPER_NOISE_DATA_URI;
  }).catch((error) => { noisePromise = undefined; throw error; });
  return noisePromise;
}

/** Explicit release for host scene teardown; no retained decoded assets after last active scene. */
export function clearPaperPreparedAssets(): void {
  maskPreparer.clear();
  noisePromise = undefined;
}

export async function preparePaperNoise(
  request: MaterialPrepareRequest<object>, signal: AbortSignal,
): Promise<CreateResult<PaperPreparedAssets>> {
  abortIfNeeded(signal);
  if (request.maxCpuBytes < 128 * 128 * 4) return fail("Paper Border noise exceeds the CPU preparation budget.");
  try {
    const noise = await loadNoise();
    abortIfNeeded(signal);
    return { ok: true, value: {
      cacheKey: "paper-noise:43cd68:128x128", byteLength: noise.data.byteLength, assets: [], noise,
    } };
  } catch (error) {
    if (signal.aborted) throw error;
    return { ok: false, error: { code: "resource-allocation", message: "Local Paper noise could not be decoded." } };
  }
}

/** Poisson or luminance preprocessing is completed here, never in create/render/update. */
export async function preparePaperMaskAsset(
  kind: PaperMaskKind,
  request: MaterialPrepareRequest<MaskParams>,
  signal: AbortSignal,
): Promise<CreateResult<PaperPreparedAssets>> {
  abortIfNeeded(signal);
  const { geometry, params, quality } = request;
  const useImage = geometry.mask.kind === "icon" || kind === "heatmap" || !("shape" in params) || params.shape === "none";
  if (!useImage) return { ok: true, value: { cacheKey: `${kind}:procedural`, byteLength: 0, assets: [] } };
  const scale = quality === "economy" ? 0.75 : quality === "detail" ? 1.25 : 1;
  const targetWidth = geometry.width * scale;
  const targetHeight = geometry.height * scale;
  const { width, height } = resolvePaperMaskSize(targetWidth, targetHeight, targetWidth, targetHeight);
  // Includes source RGBA, binary shape, float solver, smoothing scratch and output.
  const estimatedPeak = width * height * (kind === "heatmap" ? 24 : 32);
  if (estimatedPeak > request.maxCpuBytes) return fail("Paper mask exceeds the CPU preparation budget.");
  const id: PaperAssetId = geometry.mask.kind === "icon" ? geometry.mask.assetId
    : geometry.radiusCss > 0 ? "rounded-rectangle" : "strict-rectangle";
  if (request.maskSource && (geometry.mask.kind !== "icon" || request.maskSource.assetId !== geometry.mask.assetId)) {
    return { ok: false, error: { code: "invalid-config", message: "Paper icon coverage does not match its allowlisted target." } };
  }
  const radius = geometry.radiusCss * scale;
  try {
    const mask = await maskPreparer.prepare(kind, id, targetWidth, targetHeight, 1, radius, signal, request.maskSource);
    abortIfNeeded(signal);
    const source: PreparedMaterialAsset["source"] = geometry.mask.kind === "icon"
      ? { kind: "icon", assetId: geometry.mask.assetId }
      : { kind: "geometry", key: `${id}:r${geometry.radiusCss}` };
    const asset: PreparedMaterialAsset = {
      source, width: mask.width, height: mask.height, rgba: mask.data,
      encoding: kind === "heatmap" ? "paper-luminance" : "paper-gradient",
    };
    return { ok: true, value: {
      cacheKey: paperAssetKey(kind, id, width, height, 1, radius, request.maskSource && paperCoverageHash(request.maskSource)),
      byteLength: mask.data.byteLength, assets: [asset],
    } };
  } catch (error) {
    if (signal.aborted) throw error;
    return { ok: false, error: {
      code: error instanceof RangeError ? "invalid-config" : "resource-allocation",
      message: error instanceof Error ? error.message : "Paper mask preparation failed.",
    } };
  }
}
