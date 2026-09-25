/**
 * Modified from Paper Shaders 0.0.81 (Apache-2.0), commit
 * 43cd68db79fa0b1759f72ffc941b3238e2a3954c, liquid-metal.ts,
 * gem-smoke.ts and heatmap.ts. This version takes bounded local pixels,
 * retains no canvas or decoded source, and returns upload-ready RGBA8.
 * See ./NOTICE and ./PROVENANCE.md.
 */

export type PaperMask = Readonly<{ width: number; height: number; data: Uint8Array }>;
export type AlphaSource = Readonly<{ width: number; height: number; alpha: Uint8Array }>;
export type ColorSource = Readonly<{ width: number; height: number; rgba: Uint8Array }>;

const MAX_SIDE = 256;
const MAX_PIXELS = MAX_SIDE * MAX_SIDE;
const POISSON_ITERATIONS = 40;

function assertSize(width: number, height: number, length: number, channels: number): void {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 ||
      width > MAX_SIDE || height > MAX_SIDE || width * height > MAX_PIXELS) {
    throw new RangeError("Paper mask size exceeds the bounded preparation profile.");
  }
  if (length !== width * height * channels) throw new RangeError("Paper mask pixel buffer has the wrong size.");
}

/** Selects a target-sized solve; a 44px icon gets 66 samples at mobile DPR 1.5. */
export function resolvePaperMaskSize(
  targetWidth: number, targetHeight: number, sourceWidth: number, sourceHeight: number,
): { width: number; height: number } {
  if (![targetWidth, targetHeight, sourceWidth, sourceHeight].every((n) => Number.isFinite(n) && n > 0)) {
    throw new RangeError("Paper mask size must be positive and finite.");
  }
  const ratio = sourceWidth / sourceHeight;
  const maxWidth = Math.min(MAX_SIDE, Math.max(1, Math.round(targetWidth * 1.5)));
  const maxHeight = Math.min(MAX_SIDE, Math.max(1, Math.round(targetHeight * 1.5)));
  const width = Math.min(maxWidth, Math.max(1, Math.round(maxHeight * ratio)));
  const height = Math.min(maxHeight, Math.max(1, Math.round(width / ratio)));
  return { width, height };
}

type PoissonWork = {
  width: number;
  height: number;
  alpha: Uint8Array;
  shape: Uint8Array;
  red: number[];
  black: number[];
  field: Float32Array;
};

function createPoissonWork({ width, height, alpha }: AlphaSource): PoissonWork {
  assertSize(width, height, alpha.length, 1);
  const n = width * height;
  const shape = new Uint8Array(n);
  const red: number[] = [];
  const black: number[] = [];
  for (let i = 0; i < n; i++) shape[i] = alpha[i]! > 0 ? 1 : 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!shape[i]) continue;
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1 ||
          !shape[i - 1] || !shape[i + 1] || !shape[i - width] || !shape[i + width] ||
          !shape[i - width - 1] || !shape[i - width + 1] ||
          !shape[i + width - 1] || !shape[i + width + 1]) {
        continue;
      } else {
        ((x + y) % 2 === 0 ? red : black).push(i);
      }
    }
  }
  return { width, height, alpha, shape, red, black, field: new Float32Array(n) };
}

function poissonIteration(work: PoissonWork): void {
  const { width, field, red, black } = work;
  for (const pixels of [red, black]) {
    for (const i of pixels) {
      const sum = field[i + 1]! + field[i - 1]! + field[i - width]! + field[i + width]!;
      field[i] = 1.9 * ((0.01 + sum) / 4) - 0.9 * field[i]!;
    }
  }
}

function finishPoisson(work: PoissonWork): PaperMask {
  const { width, height, alpha, shape, red, black, field } = work;
  const n = width * height;
  const interior = [...red, ...black];
  for (let pass = 0; pass < 3; pass++) {
    const previous = field.slice();
    for (const i of interior) {
      const sum = previous[i + 1]! + previous[i - 1]! + previous[i - width]! + previous[i + width]!;
      field[i] = (previous[i]! + sum / 4) * 0.5;
    }
  }
  let max = 0;
  for (const i of interior) max = Math.max(max, field[i]!);
  const data = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    const p = i * 4;
    data[p] = shape[i] ? (max === 0 ? 0 : Math.round(255 * (1 - field[i]! / max))) : 255;
    data[p + 1] = alpha[i]!;
    data[p + 2] = 255;
    data[p + 3] = 255;
  }
  return { width, height, data };
}

/** R=Paper's Poisson interior gradient, G=source alpha, A=opaque upload pixel. */
export function preparePoissonMask(source: AlphaSource): PaperMask {
  const work = createPoissonWork(source);
  for (let i = 0; i < POISSON_ITERATIONS; i++) poissonIteration(work);
  return finishPoisson(work);
}

function yieldToHost(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** Use from prepare(), never render(); yields after two source-equivalent SOR iterations. */
export async function preparePoissonMaskAsync(source: AlphaSource, signal?: AbortSignal): Promise<PaperMask> {
  const work = createPoissonWork(source);
  for (let i = 0; i < POISSON_ITERATIONS; i++) {
    if (signal?.aborted) throw new DOMException("Paper mask preparation cancelled.", "AbortError");
    poissonIteration(work);
    if (i % 2 === 1) await yieldToHost();
  }
  if (signal?.aborted) throw new DOMException("Paper mask preparation cancelled.", "AbortError");
  return finishPoisson(work);
}

function blurGray(input: Uint8Array, width: number, height: number, radius: number): Uint8Array {
  if (radius === 0) return input.slice();
  const integral = new Uint32Array(width * height);
  for (let y = 0; y < height; y++) {
    let rowSum = 0;
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      rowSum += input[i]!;
      integral[i] = rowSum + (y > 0 ? integral[i - width]! : 0);
    }
  }
  const output = new Uint8Array(width * height);
  const at = (x: number, y: number) => x < 0 || y < 0 ? 0 : integral[y * width + x]!;
  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - radius);
    const y1 = Math.min(height - 1, y + radius);
    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(width - 1, x + radius);
      const sum = at(x1, y1) - at(x0 - 1, y1) - at(x1, y0 - 1) + at(x0 - 1, y0 - 1);
      output[y * width + x] = Math.round(sum / ((x1 - x0 + 1) * (y1 - y0 + 1)));
    }
  }
  return output;
}

function multiPassBlur(input: Uint8Array, width: number, height: number, radius: number, passes: number): Uint8Array {
  let result = input;
  for (let i = 0; i < passes; i++) result = blurGray(result, width, height, radius);
  return result;
}

async function multiPassBlurAsync(
  input: Uint8Array, width: number, height: number, radius: number, passes: number, signal?: AbortSignal,
): Promise<Uint8Array> {
  let result = input;
  for (let i = 0; i < passes; i++) {
    if (signal?.aborted) throw new DOMException("Paper mask preparation cancelled.", "AbortError");
    result = blurGray(result, width, height, radius);
    await yieldToHost();
  }
  return result;
}

function heatmapGray({ width, height, rgba }: ColorSource): Uint8Array {
  assertSize(width, height, rgba.length, 4);
  const n = width * height;
  const gray = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const p = i * 4;
    const luminance = 0.299 * rgba[p]! + 0.587 * rgba[p + 1]! + 0.114 * rgba[p + 2]!;
    gray[i] = Math.round(255 - rgba[p + 3]! * (255 - luminance) / 255);
  }
  return gray;
}

function packHeatmap(width: number, height: number, contour: Uint8Array, outer: Uint8Array, inner: Uint8Array): PaperMask {
  const n = width * height;
  const data = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    const p = i * 4;
    data[p] = contour[i]!;
    data[p + 1] = outer[i]!;
    data[p + 2] = inner[i]!;
    data[p + 3] = 255;
  }
  return { width, height, data };
}

/** R=contour luminance, G=wide blur, B=inner blur, A=opaque. */
export function prepareHeatmapMask({ width, height, rgba }: ColorSource): PaperMask {
  const gray = heatmapGray({ width, height, rgba });
  const side = Math.max(width, height);
  const bigRadius = Math.floor(side * 0.15);
  const contour = multiPassBlur(gray, width, height, Math.round(side * 0.005), 1);
  const outer = multiPassBlur(gray, width, height, bigRadius, 3);
  const inner = multiPassBlur(gray, width, height, Math.max(1, Math.round(bigRadius * 0.12)), 3);
  return packHeatmap(width, height, contour, outer, inner);
}

export async function prepareHeatmapMaskAsync(source: ColorSource, signal?: AbortSignal): Promise<PaperMask> {
  const { width, height } = source;
  const gray = heatmapGray(source);
  const side = Math.max(width, height);
  const bigRadius = Math.floor(side * 0.15);
  const contour = await multiPassBlurAsync(gray, width, height, Math.round(side * 0.005), 1, signal);
  const outer = await multiPassBlurAsync(gray, width, height, bigRadius, 3, signal);
  const inner = await multiPassBlurAsync(gray, width, height, Math.max(1, Math.round(bigRadius * 0.12)), 3, signal);
  if (signal?.aborted) throw new DOMException("Paper mask preparation cancelled.", "AbortError");
  return packHeatmap(width, height, contour, outer, inner);
}

export function createPaperMaskCache(maxBytes = 2 * 1024 * 1024) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) throw new RangeError("Invalid Paper mask cache budget.");
  const resolved = new Map<string, PaperMask>();
  const pending = new Map<string, Promise<PaperMask>>();
  let used = 0;
  return {
    async getOrPrepare(key: string, prepare: () => Promise<PaperMask>): Promise<PaperMask> {
      const existing = resolved.get(key);
      if (existing) {
        resolved.delete(key);
        resolved.set(key, existing);
        return existing;
      }
      const inFlight = pending.get(key);
      if (inFlight) return inFlight;
      const work = prepare().then((mask) => {
        assertSize(mask.width, mask.height, mask.data.length, 4);
        if (mask.data.byteLength <= maxBytes) {
          while (used + mask.data.byteLength > maxBytes) {
            const oldest = resolved.keys().next().value;
            if (oldest === undefined) break;
            const evicted = resolved.get(oldest)!;
            used -= evicted.data.byteLength;
            resolved.delete(oldest);
          }
          resolved.set(key, mask);
          used += mask.data.byteLength;
        }
        return mask;
      }).finally(() => pending.delete(key));
      pending.set(key, work);
      return work;
    },
    clear(): void { resolved.clear(); pending.clear(); used = 0; },
    get byteLength(): number { return used; },
  };
}
