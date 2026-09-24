import type { ParameterSchema } from "../../contracts";

export type FluidPalette = "graphite" | "lagoon" | "copper";
export interface FluidParams { force: number; radius: number; curl: number; dissipation: number; palette: FluidPalette }
export const FLUID_DEFAULTS: Readonly<FluidParams> = Object.freeze({ force: 2600, radius: 0.2, curl: 22, dissipation: 0.8, palette: "graphite" });
export const FLUID_BOUNDS = Object.freeze({
  force: { min: 0, max: 6000, step: 100 },
  radius: { min: 0.05, max: 0.65, step: 0.01 },
  curl: { min: 0, max: 40, step: 1 },
  dissipation: { min: 0.15, max: 3, step: 0.05 },
});
export const FLUID_PALETTES: readonly FluidPalette[] = ["graphite", "lagoon", "copper"];

export function parseFluidParams(value: unknown): FluidParams | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return null;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length !== 5 || keys.some((key) => !Object.hasOwn(FLUID_DEFAULTS, key))) return null;
  for (const key of ["force", "radius", "curl", "dissipation"] as const) {
    const number = record[key];
    if (typeof number !== "number" || !Number.isFinite(number) || number < FLUID_BOUNDS[key].min || number > FLUID_BOUNDS[key].max) return null;
  }
  if (!FLUID_PALETTES.includes(record.palette as FluidPalette)) return null;
  return { force: record.force as number, radius: record.radius as number, curl: record.curl as number, dissipation: record.dissipation as number, palette: record.palette as FluidPalette };
}

export const fluidSchema: ParameterSchema<FluidParams> = {
  defaults: FLUID_DEFAULTS,
  controls: [
    { key: "force", kind: "range", label: "Сила", description: "Импульс скорости при рисовании с нажатой кнопкой.", ...FLUID_BOUNDS.force },
    { key: "radius", kind: "range", label: "Радиус", description: "Ширина пятна скорости и красителя.", ...FLUID_BOUNDS.radius },
    { key: "curl", kind: "range", label: "Вихри", description: "Усиление вращения внутри поля скорости.", ...FLUID_BOUNDS.curl },
    { key: "dissipation", kind: "range", label: "Затухание течения", description: "Выше — течение быстрее замедляется. Скорость исчезновения цвета фиксирована и этим параметром не меняется.", ...FLUID_BOUNDS.dissipation },
    { key: "palette", kind: "select", label: "Палитра", options: [{ value: "graphite", label: "Графит" }, { value: "lagoon", label: "Лагуна" }, { value: "copper", label: "Медь" }] },
  ],
  parse(input) {
    const value = parseFluidParams(input);
    return value ? { ok: true, value } : { ok: false, issues: [{ code: "invalid-fluid-params", message: "Нужны пять допустимых параметров Fluid без дополнительных полей." }] };
  },
};
