/**
 * Optical settings shared by server validation and the client renderer.
 * Optical field math adapted from Liquid_Prnc_Glass at
 * 97175e083782eab2d55b85abafc6a426c269e20a.
 * Copyright (c) 2026 i4w7w4a. MIT License.
 * https://github.com/i4w7w4a/Liquid_Prnc_Glass
 */

export type MonoOpticalPreset = "ledger" | "frost" | "mercury";

export type MonoGlassSettings = {
  ior: number;
  edgeThickness: number;
  edgeDarkening: number;
  highlightStrength: number;
  reflectionStrength: number;
  causticStrength: number;
  fieldEnabled: boolean;
  fieldFadeMode: 0 | 1;
  fieldStart: number;
  fieldSoftness: number;
  fieldCurve: number;
  fieldStrength: number;
  flowEnabled: boolean;
  flowMode: 0 | 5 | 9;
  flowSpeed: number;
  flowStrength: number;
  flowScale: number;
  pointerStrength: number;
};

type NumericGlassKey = Exclude<keyof MonoGlassSettings, "fieldEnabled" | "fieldFadeMode" | "flowEnabled" | "flowMode">;

export const MONO_GLASS_BOUNDS = {
  ior: { min: -2, max: 2, step: 0.01 },
  edgeThickness: { min: 0.06, max: 0.24, step: 0.005 },
  edgeDarkening: { min: 0, max: 0.65, step: 0.01 },
  highlightStrength: { min: 0, max: 1.1, step: 0.01 },
  reflectionStrength: { min: 0, max: 1.25, step: 0.01 },
  causticStrength: { min: 0, max: 1, step: 0.01 },
  fieldStart: { min: 0.18, max: 0.72, step: 0.01 },
  fieldSoftness: { min: 0.25, max: 1, step: 0.01 },
  fieldCurve: { min: 0.6, max: 3, step: 0.01 },
  fieldStrength: { min: 0, max: 2.5, step: 0.01 },
  flowSpeed: { min: 0, max: 0.7, step: 0.01 },
  flowStrength: { min: 0, max: 0.5, step: 0.01 },
  flowScale: { min: 1, max: 4.5, step: 0.01 },
  pointerStrength: { min: 0, max: 0.4, step: 0.01 },
} as const satisfies Record<NumericGlassKey, { min: number; max: number; step: number }>;

export const MONO_GLASS_DEFAULTS: Readonly<Record<MonoOpticalPreset, Readonly<MonoGlassSettings>>> = {
  ledger: { ior: 1.34, edgeThickness: 0.165, edgeDarkening: 0.5, highlightStrength: 0.54,
    reflectionStrength: 0.59, causticStrength: 0.63, fieldEnabled: true, fieldFadeMode: 1,
    fieldStart: 0.34, fieldSoftness: 0.99, fieldCurve: 2.69, fieldStrength: 1.92,
    flowEnabled: true, flowMode: 5, flowSpeed: 0.29, flowStrength: 0.44, flowScale: 4.47, pointerStrength: 0.23 },
  frost: { ior: -0.62, edgeThickness: 0.12, edgeDarkening: 0.32, highlightStrength: 0.44,
    reflectionStrength: 0.55, causticStrength: 0.5, fieldEnabled: true, fieldFadeMode: 0,
    fieldStart: 0.52, fieldSoftness: 0.66, fieldCurve: 1.55, fieldStrength: 1.4,
    flowEnabled: true, flowMode: 9, flowSpeed: 0.14, flowStrength: 0.22, flowScale: 2.8, pointerStrength: 0.13 },
  mercury: { ior: -0.83, edgeThickness: 0.16, edgeDarkening: 0.36, highlightStrength: 0.53,
    reflectionStrength: 0.85, causticStrength: 0.82, fieldEnabled: true, fieldFadeMode: 0,
    fieldStart: 0.47, fieldSoftness: 0.68, fieldCurve: 1.45, fieldStrength: 2.1,
    flowEnabled: true, flowMode: 5, flowSpeed: 0.28, flowStrength: 0.36, flowScale: 3, pointerStrength: 0.18 },
};

export function normalizeMonoGlassSettings(
  preset: MonoOpticalPreset,
  overrides: Partial<MonoGlassSettings> = {},
): MonoGlassSettings {
  const defaults = MONO_GLASS_DEFAULTS[preset];
  const result: MonoGlassSettings = { ...defaults };
  for (const key of Object.keys(MONO_GLASS_BOUNDS) as NumericGlassKey[]) {
    const value = overrides[key];
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    const { min, max } = MONO_GLASS_BOUNDS[key];
    result[key] = Math.min(max, Math.max(min, value));
  }
  if (typeof overrides.fieldEnabled === "boolean") result.fieldEnabled = overrides.fieldEnabled;
  if (typeof overrides.flowEnabled === "boolean") result.flowEnabled = overrides.flowEnabled;
  if (overrides.fieldFadeMode === 0 || overrides.fieldFadeMode === 1) result.fieldFadeMode = overrides.fieldFadeMode;
  if (overrides.flowMode === 0 || overrides.flowMode === 5 || overrides.flowMode === 9) result.flowMode = overrides.flowMode;
  if (result.flowMode === 0) result.flowEnabled = false;
  return result;
}
