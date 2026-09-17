export type MonoOklch = { l: number; c: number; h: number; alpha: number };
export type MonoSrgb = { r: number; g: number; b: number; alpha: number };

const finite = (value: unknown, fallback = 0): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;
const clamp = (value: number, max = 1): number => Math.min(max, Math.max(0, value));
const hue = (value: number): number => ((value % 360) + 360) % 360;

export function normalizeMonoOklch(input: unknown): MonoOklch {
  const value = input && typeof input === "object" ? input as Partial<MonoOklch> : {};
  return { l: clamp(finite(value.l)), c: clamp(finite(value.c), 0.4),
    h: hue(finite(value.h)), alpha: clamp(finite(value.alpha, 1)) };
}

function normalizeSrgb(value: MonoSrgb): MonoSrgb {
  return { r: clamp(finite(value.r)), g: clamp(finite(value.g)), b: clamp(finite(value.b)),
    alpha: clamp(finite(value.alpha, 1)) };
}

const linearize = (value: number): number =>
  value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
const encode = (value: number): number =>
  value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055;

// Published OKLab matrices: https://bottosson.github.io/posts/oklab/
export function srgbToOklch(input: MonoSrgb): MonoOklch {
  const rgb = normalizeSrgb(input);
  const r = linearize(rgb.r), g = linearize(rgb.g), b = linearize(rgb.b);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const lightness = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const labB = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const chroma = Math.hypot(a, labB);
  return { l: clamp(lightness), c: chroma < 1e-7 ? 0 : chroma,
    h: chroma < 1e-7 ? 0 : hue(Math.atan2(labB, a) * 180 / Math.PI), alpha: rgb.alpha };
}

function toLinearRgb(color: MonoOklch): [number, number, number] {
  const angle = color.h * Math.PI / 180;
  const a = color.c * Math.cos(angle), b = color.c * Math.sin(angle);
  const l = (color.l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (color.l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (color.l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
}

/** Constant-L/H chroma reduction, never channel clipping as a gamut strategy. */
export function gamutMapMonoOklch(input: MonoOklch): MonoOklch {
  const color = normalizeMonoOklch(input);
  if (color.l === 0 || color.l === 1) return { ...color, c: 0 };
  const inGamut = (c: number) => toLinearRgb({ ...color, c }).every(v => v >= -1e-7 && v <= 1 + 1e-7);
  if (inGamut(color.c)) return color;
  let low = 0, high = color.c;
  for (let step = 0; step < 32; step++) {
    const mid = (low + high) / 2;
    if (inGamut(mid)) low = mid; else high = mid;
  }
  return { ...color, c: low };
}

export function oklchToSrgb(input: MonoOklch): MonoSrgb {
  const mapped = gamutMapMonoOklch(input);
  // Only remove matrix roundoff (<=1e-7) after chroma mapping.
  const [r, g, b] = toLinearRgb(mapped).map(value => encode(clamp(value)));
  return { r: r!, g: g!, b: b!, alpha: mapped.alpha };
}

/** CSS source-over alpha compositing in encoded sRGB. */
export function compositeMonoSrgb(foreground: MonoSrgb, background: MonoSrgb): MonoSrgb {
  const fg = normalizeSrgb(foreground), bg = normalizeSrgb(background);
  const alpha = fg.alpha + bg.alpha * (1 - fg.alpha);
  if (alpha === 0) return { r: 0, g: 0, b: 0, alpha: 0 };
  const channel = (f: number, b: number) => (f * fg.alpha + b * bg.alpha * (1 - fg.alpha)) / alpha;
  return { r: channel(fg.r, bg.r), g: channel(fg.g, bg.g), b: channel(fg.b, bg.b), alpha };
}

/** Background must already be composited onto an opaque backdrop. */
export function monoContrastRatio(foreground: MonoSrgb, background: MonoSrgb): number {
  if (background.alpha !== 1) throw new Error("Contrast requires an opaque backdrop");
  const fg = compositeMonoSrgb(foreground, background), bg = normalizeSrgb(background);
  const luminance = (c: MonoSrgb) => 0.2126 * linearize(c.r) + 0.7152 * linearize(c.g) + 0.0722 * linearize(c.b);
  const a = luminance(fg), b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

export function monoWorstContrast(foreground: MonoSrgb, surface: MonoSrgb, backdrops: readonly MonoSrgb[]): number {
  if (backdrops.length === 0) throw new Error("At least one allowed backdrop is required");
  return Math.min(...backdrops.map(backdrop => monoContrastRatio(foreground, compositeMonoSrgb(surface, backdrop))));
}
