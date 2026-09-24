export type SilkPalette = "radiant" | "graphite" | "champagne";

export interface SilkParams {
  flowSpeed: number;
  sheenIntensity: number;
  foldScale: number;
  lightWidth: number;
  palette: SilkPalette;
}

export const SILK_BOUNDS = Object.freeze({
  flowSpeed: Object.freeze({ min: 0.1, max: 1.5, step: 0.05 }),
  sheenIntensity: Object.freeze({ min: 0.3, max: 2, step: 0.1 }),
  foldScale: Object.freeze({ min: 0.6, max: 1.8, step: 0.05 }),
  lightWidth: Object.freeze({ min: 0.5, max: 2, step: 0.05 }),
});
export const SILK_PALETTES = Object.freeze([
  { value: "radiant", label: "Radiant · исходный" },
  { value: "graphite", label: "Графит" },
  { value: "champagne", label: "Перламутр" },
] as const);

export const SILK_BASELINE: Readonly<SilkParams> = Object.freeze({
  flowSpeed: 0.4, sheenIntensity: 1, foldScale: 1, lightWidth: 1, palette: "radiant",
});
export const SILK_DEFAULTS: Readonly<SilkParams> = Object.freeze({
  flowSpeed: 0.25, sheenIntensity: 0.8, foldScale: 1, lightWidth: 1.2, palette: "graphite",
});
export const SILK_VARIANTS = Object.freeze([
  { id: "graphite", label: "Графитовый шёлк", params: SILK_DEFAULTS },
  { id: "champagne", label: "Тёплый перламутр", params: Object.freeze<SilkParams>({
    flowSpeed: 0.3, sheenIntensity: 0.85, foldScale: 0.85, lightWidth: 1.35, palette: "champagne",
  }) },
]);

export function parseSilkParams(input: unknown): SilkParams | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const prototype: unknown = Object.getPrototypeOf(input);
  if (prototype !== Object.prototype && prototype !== null) return null;
  const keys = Reflect.ownKeys(input);
  const numericKeys = Object.keys(SILK_BOUNDS) as (keyof typeof SILK_BOUNDS)[];
  if (keys.length !== numericKeys.length + 1 || keys.some((key) =>
    key !== "palette" && !numericKeys.some((allowed) => allowed === key)
  )) return null;
  const data = input as Record<string, unknown>;
  for (const key of numericKeys) {
    const value = data[key];
    const { min, max } = SILK_BOUNDS[key];
    if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) return null;
  }
  if (!SILK_PALETTES.some(({ value }) => value === data.palette)) return null;
  // Values are complete and validated. Preserve in-range precision: the control
  // step is an editing affordance, not a lossy import quantizer.
  return {
    flowSpeed: data.flowSpeed as number,
    sheenIntensity: data.sheenIntensity as number,
    foldScale: data.foldScale as number,
    lightWidth: data.lightWidth as number,
    palette: data.palette as SilkPalette,
  };
}
