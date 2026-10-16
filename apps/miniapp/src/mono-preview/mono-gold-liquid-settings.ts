/** Provisional Gold optics, separate from material recipes and the seven presets. */
export interface GoldLiquidSettings {
  ior: number; edgeThickness: number; cornerRadius: number; dispersion: number;
  edgeDarkening: number; highlightStrength: number;
  fieldEnabled: boolean; fieldStart: number; fieldSoftness: number; fieldFadeMode: 0 | 1;
  fieldCurve: number; fieldStrength: number;
  flowSpeed: number; flowStrength: number; flowScale: number; pixelRatio: number;
}
type NumericKey = Exclude<keyof GoldLiquidSettings, "fieldEnabled" | "fieldFadeMode">;
export interface GoldLiquidControl {
  key: NumericKey; label: string; min: number; max: number; step: number;
  group: "Optics" | "Field" | "Flow";
}
export const GOLD_LIQUID_DEFAULTS: Readonly<GoldLiquidSettings> = Object.freeze({
  ior: -0.65, edgeThickness: 0.12, cornerRadius: 0.025, dispersion: 0.012,
  edgeDarkening: 0.22, highlightStrength: 0.24,
  fieldEnabled: true, fieldStart: 0.45, fieldSoftness: 0.70, fieldFadeMode: 1,
  fieldCurve: 1.5, fieldStrength: 0.9,
  flowSpeed: 0.18, flowStrength: 0.45, flowScale: 2.4, pixelRatio: 1.25,
});
// Names/ranges adapted from Liquid_Prnc_Glass/settings.ts; pixelRatio is host-capped.
export const GOLD_LIQUID_CONTROLS: readonly GoldLiquidControl[] = Object.freeze([
  { key: "ior", label: "IOR", min: -3.05, max: 3.05, step: 0.01, group: "Optics" },
  { key: "edgeThickness", label: "Edge thickness", min: 0.02, max: 0.24, step: 0.005, group: "Optics" },
  { key: "cornerRadius", label: "Corner radius", min: 0, max: 0.18, step: 0.005, group: "Optics" },
  { key: "dispersion", label: "Dispersion", min: 0, max: 0.08, step: 0.001, group: "Optics" },
  { key: "edgeDarkening", label: "Edge darkening", min: 0, max: 0.85, step: 0.01, group: "Optics" },
  { key: "highlightStrength", label: "Highlights", min: 0, max: 1.5, step: 0.01, group: "Optics" },
  { key: "fieldStart", label: "Field start", min: 0, max: 0.72, step: 0.01, group: "Field" },
  { key: "fieldSoftness", label: "Field softness", min: 0.08, max: 0.9, step: 0.01, group: "Field" },
  { key: "fieldCurve", label: "Field curve", min: 0.45, max: 5, step: 0.05, group: "Field" },
  { key: "fieldStrength", label: "Field strength", min: 0, max: 2, step: 0.01, group: "Field" },
  { key: "flowSpeed", label: "Flow speed", min: 0, max: 4, step: 0.01, group: "Flow" },
  { key: "flowStrength", label: "Flow strength", min: 0, max: 1.5, step: 0.01, group: "Flow" },
  { key: "flowScale", label: "Flow scale", min: 0.25, max: 8, step: 0.01, group: "Flow" },
  { key: "pixelRatio", label: "Pixel ratio", min: 1, max: 1.5, step: 0.25, group: "Flow" },
] satisfies GoldLiquidControl[]);

export function normalizeGoldLiquidSettings(value: unknown): GoldLiquidSettings {
  const input = value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
  const settings: GoldLiquidSettings = { ...GOLD_LIQUID_DEFAULTS };
  for (const control of GOLD_LIQUID_CONTROLS) {
    const candidate = input[control.key];
    if (typeof candidate === "number" && Number.isFinite(candidate))
      settings[control.key] = Math.min(control.max, Math.max(control.min, candidate));
  }
  if (typeof input.fieldEnabled === "boolean") settings.fieldEnabled = input.fieldEnabled;
  if (input.fieldFadeMode === 0 || input.fieldFadeMode === 1) settings.fieldFadeMode = input.fieldFadeMode;
  return settings;
}

/** Quality limits are host policy, not serialized artist controls. */
export function planGoldLiquidSize(cssWidth: number, cssHeight: number, deviceDpr: number,
  pixelRatio: number, hardwareLimit = 2048): { width: number; height: number; dpr: number } | null {
  if (![cssWidth, cssHeight, hardwareLimit].every(n => Number.isFinite(n) && n > 0) ||
      cssWidth > 1e9 || cssHeight > 1e9) return null;
  const cap = Math.min(2048, Math.floor(hardwareLimit));
  if (cap < 1) return null;
  const device = Number.isFinite(deviceDpr) && deviceDpr > 0 ? deviceDpr : 1;
  const artistic = Number.isFinite(pixelRatio) ? Math.max(1, Math.min(1.5, pixelRatio)) : 1.25;
  const dpr = Math.min(device, artistic, 1.5, cap / cssWidth, cap / cssHeight,
    Math.sqrt(786432 / (cssWidth * cssHeight)));
  return { width: Math.max(1, Math.floor(cssWidth * dpr)),
    height: Math.max(1, Math.floor(cssHeight * dpr)), dpr };
}

export function serializeGoldLiquidSettings(settings: unknown): string {
  return JSON.stringify({ version: 1, kind: "gold-liquid-local",
    params: normalizeGoldLiquidSettings(settings) }, null, 2);
}
export function isGoldLiquidTunerLocation(location: { hostname: string; search: string }): boolean {
  return ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname) &&
    new URLSearchParams(location.search).get("goldLiquidTuner") === "1";
}
