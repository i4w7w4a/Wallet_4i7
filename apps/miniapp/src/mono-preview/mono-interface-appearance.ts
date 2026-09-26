export type MonoEyeAppearance = { blinkEnabled: boolean };
export type MonoNavigationAppearance = {
  indicator: "original" | "line" | "capsule" | "dot";
  glowPercent: number;
  softnessPx: number;
  shimmerEnabled: boolean;
  periodSeconds: number;
};

export const MONO_EYE_DEFAULT: Readonly<MonoEyeAppearance> = Object.freeze({ blinkEnabled: true });
export const MONO_NAVIGATION_DEFAULT: Readonly<MonoNavigationAppearance> = Object.freeze({
  indicator: "original", glowPercent: 0, softnessPx: 0, shimmerEnabled: false, periodSeconds: 6,
});
export const MONO_NAVIGATION_BOUNDS = Object.freeze({
  glowPercent: Object.freeze({ min: 0, max: 100, step: 1 }),
  softnessPx: Object.freeze({ min: 0, max: 16, step: 1 }),
  periodSeconds: Object.freeze({ min: 2, max: 12, step: 1 }),
});

const object = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
const exact = (value: Record<string, unknown>, keys: readonly string[]) =>
  Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const boundedInteger = (value: unknown, bound: { min: number; max: number }) =>
  Number.isInteger(value) && Number(value) >= bound.min && Number(value) <= bound.max;

export function parseMonoEyeAppearance(value: unknown): MonoEyeAppearance | null {
  const input = object(value);
  return input && exact(input, ["blinkEnabled"]) && typeof input.blinkEnabled === "boolean"
    ? { blinkEnabled: input.blinkEnabled } : null;
}

export function parseMonoNavigationAppearance(value: unknown): MonoNavigationAppearance | null {
  const input = object(value);
  if (!input || !exact(input, ["indicator", "glowPercent", "softnessPx", "shimmerEnabled", "periodSeconds"]) ||
    (input.indicator !== "original" && input.indicator !== "line" && input.indicator !== "capsule" && input.indicator !== "dot") ||
    !boundedInteger(input.glowPercent, MONO_NAVIGATION_BOUNDS.glowPercent) ||
    !boundedInteger(input.softnessPx, MONO_NAVIGATION_BOUNDS.softnessPx) ||
    !boundedInteger(input.periodSeconds, MONO_NAVIGATION_BOUNDS.periodSeconds) ||
    typeof input.shimmerEnabled !== "boolean") return null;
  return { indicator: input.indicator, glowPercent: Number(input.glowPercent), softnessPx: Number(input.softnessPx),
    shimmerEnabled: input.shimmerEnabled, periodSeconds: Number(input.periodSeconds) };
}
