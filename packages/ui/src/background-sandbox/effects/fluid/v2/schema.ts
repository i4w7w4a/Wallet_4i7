export interface FluidV2Params {
  mode: "draw" | "ambient";
  timeScale: number;
  force: number;
  radius: number;
  curl: number;
  velocityDissipation: number;
  dyeDissipation: number;
  pressureRetention: number;
  shading: boolean;
  colors: string[];
  colorAlpha: number;
  backgroundColor: string;
  backgroundAlpha: number;
  colorCycleRate: number;
  bloomEnabled: boolean;
  bloomIntensity: number;
  bloomThreshold: number;
  sunraysEnabled: boolean;
  sunraysWeight: number;
  ambientRate: number;
}
export const FLUID_V2_DEFAULTS: Readonly<FluidV2Params> = {
  mode: "draw", timeScale: 1, force: 3600, radius: 0.25, curl: 30,
  velocityDissipation: 0.2, dyeDissipation: 1, pressureRetention: 0.8,
  shading: true, colors: ["#9AA6B3", "#62738B", "#A7927E"],
  colorAlpha: 0.9, backgroundColor: "#080A0F", backgroundAlpha: 1,
  colorCycleRate: 0, bloomEnabled: false, bloomIntensity: 0.8, bloomThreshold: 0.6,
  sunraysEnabled: false, sunraysWeight: 1, ambientRate: 0.5,
};
export const FLUID_V2_BOUNDS = Object.freeze({
  timeScale: { min: 0, max: 2, step: 0.01 },
  force: { min: 0, max: 6000, step: 100 },
  radius: { min: 0.01, max: 1, step: 0.01 },
  curl: { min: 0, max: 50, step: 1 },
  velocityDissipation: { min: 0, max: 4, step: 0.05 },
  dyeDissipation: { min: 0, max: 4, step: 0.05 },
  pressureRetention: { min: 0, max: 1, step: 0.01 },
  colorAlpha: { min: 0, max: 1, step: 0.01 },
  backgroundAlpha: { min: 0, max: 1, step: 0.01 },
  colorCycleRate: { min: 0, max: 10, step: 0.1 },
  bloomIntensity: { min: 0, max: 2, step: 0.05 },
  bloomThreshold: { min: 0, max: 1, step: 0.01 },
  sunraysWeight: { min: 0.3, max: 2, step: 0.05 },
  ambientRate: { min: 0.05, max: 2, step: 0.05 },
});

const COLOR = /^#[\da-fA-F]{6}$/;
const isColor = (value: unknown): value is string => typeof value === "string" && COLOR.test(value);
export function parseFluidV2Params(value: unknown): FluidV2Params | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return null;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length !== Object.keys(FLUID_V2_DEFAULTS).length || keys.some((key) => !Object.hasOwn(FLUID_V2_DEFAULTS, key))) return null;
  if (record.mode !== "draw" && record.mode !== "ambient") return null;
  if (typeof record.shading !== "boolean" || typeof record.bloomEnabled !== "boolean" || typeof record.sunraysEnabled !== "boolean") return null;
  for (const key of Object.keys(FLUID_V2_BOUNDS) as (keyof typeof FLUID_V2_BOUNDS)[]) {
    const number = record[key];
    const bounds = FLUID_V2_BOUNDS[key];
    if (typeof number !== "number" || !Number.isFinite(number) || number < bounds.min || number > bounds.max) return null;
  }
  if (!Array.isArray(record.colors) || record.colors.length < 1 || record.colors.length > 6 || !record.colors.every(isColor)) return null;
  if (!isColor(record.backgroundColor)) return null;
  return {
    mode: record.mode,
    timeScale: record.timeScale as number,
    force: record.force as number,
    radius: record.radius as number,
    curl: record.curl as number,
    velocityDissipation: record.velocityDissipation as number,
    dyeDissipation: record.dyeDissipation as number,
    pressureRetention: record.pressureRetention as number,
    shading: record.shading,
    colors: (record.colors as string[]).map((color) => color.toUpperCase()),
    colorAlpha: record.colorAlpha as number,
    backgroundColor: (record.backgroundColor as string).toUpperCase(),
    backgroundAlpha: record.backgroundAlpha as number,
    colorCycleRate: record.colorCycleRate as number,
    bloomEnabled: record.bloomEnabled,
    bloomIntensity: record.bloomIntensity as number,
    bloomThreshold: record.bloomThreshold as number,
    sunraysEnabled: record.sunraysEnabled,
    sunraysWeight: record.sunraysWeight as number,
    ambientRate: record.ambientRate as number,
  };
}
