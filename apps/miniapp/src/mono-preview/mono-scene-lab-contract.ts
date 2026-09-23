export type MonoBalanceAppearance = {
  composition: "ledger" | "centered" | "compact";
  fractionSize: "small" | "medium" | "large";
  fractionTone: "primary" | "secondary";
};
export type MonoChartAppearance = { visible: boolean; variant: "line" | "area" | "step" };
export type MonoLayoutAppearance = { chartPosition: "top" | "bottom" };
export type MonoAssetListAppearance = {
  variant: "ledger" | "tiles";
  density: "comfortable" | "compact";
  separators: "subtle" | "none";
};
export type MonoSceneAppearance = {
  balance: MonoBalanceAppearance;
  chart: MonoChartAppearance;
  layout: MonoLayoutAppearance;
  assets: MonoAssetListAppearance;
};

export const MONO_BALANCE_DEFAULT: Readonly<MonoBalanceAppearance> = Object.freeze({
  composition: "ledger", fractionSize: "medium", fractionTone: "secondary",
});
// Migration of existing owner presets preserves their unsplit numeral treatment.
// New design candidates use MONO_BALANCE_DEFAULT; migrations opt into this explicitly.
export const MONO_BALANCE_LEGACY: Readonly<MonoBalanceAppearance> = Object.freeze({
  composition: "ledger", fractionSize: "large", fractionTone: "primary",
});
export const MONO_CHART_DEFAULT: Readonly<MonoChartAppearance> = Object.freeze({ visible: true, variant: "line" });
export const MONO_LAYOUT_DEFAULT: Readonly<MonoLayoutAppearance> = Object.freeze({ chartPosition: "top" });
export const MONO_ASSET_LIST_DEFAULT: Readonly<MonoAssetListAppearance> = Object.freeze({
  variant: "ledger", density: "comfortable", separators: "subtle",
});
export const MONO_SCENE_DEFAULT = Object.freeze({
  balance: MONO_BALANCE_DEFAULT, chart: MONO_CHART_DEFAULT,
  layout: MONO_LAYOUT_DEFAULT, assets: MONO_ASSET_LIST_DEFAULT,
});

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}

function choice<T extends string>(value: unknown, options: readonly T[], fallback: T): T {
  return typeof value === "string" && options.includes(value as T) ? value as T : fallback;
}

export function normalizeMonoBalanceAppearance(value: unknown): MonoBalanceAppearance {
  const input = record(value);
  return {
    composition: choice(input.composition, ["ledger", "centered", "compact"], MONO_BALANCE_DEFAULT.composition),
    fractionSize: choice(input.fractionSize, ["small", "medium", "large"], MONO_BALANCE_DEFAULT.fractionSize),
    fractionTone: choice(input.fractionTone, ["primary", "secondary"], MONO_BALANCE_DEFAULT.fractionTone),
  };
}

export function normalizeMonoChartAppearance(value: unknown): MonoChartAppearance {
  const input = record(value);
  return {
    visible: typeof input.visible === "boolean" ? input.visible : MONO_CHART_DEFAULT.visible,
    variant: choice(input.variant, ["line", "area", "step"], MONO_CHART_DEFAULT.variant),
  };
}

export function normalizeMonoLayoutAppearance(value: unknown): MonoLayoutAppearance {
  return { chartPosition: choice(record(value).chartPosition, ["top", "bottom"], MONO_LAYOUT_DEFAULT.chartPosition) };
}

export function normalizeMonoAssetListAppearance(value: unknown): MonoAssetListAppearance {
  const input = record(value);
  return {
    variant: choice(input.variant, ["ledger", "tiles"], MONO_ASSET_LIST_DEFAULT.variant),
    density: choice(input.density, ["comfortable", "compact"], MONO_ASSET_LIST_DEFAULT.density),
    separators: choice(input.separators, ["subtle", "none"], MONO_ASSET_LIST_DEFAULT.separators),
  };
}

// Recovery is for trusted local state/migration. Imports must use the strict parser below.
export function normalizeMonoSceneAppearance(value: unknown): MonoSceneAppearance {
  const input = record(value);
  return {
    balance: normalizeMonoBalanceAppearance(input.balance),
    chart: normalizeMonoChartAppearance(input.chart),
    layout: normalizeMonoLayoutAppearance(input.layout),
    assets: normalizeMonoAssetListAppearance(input.assets),
  };
}

function isCanonical(value: unknown, normalized: unknown): boolean {
  if (normalized === null || typeof normalized !== "object") return value === normalized;
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = record(value);
  const expected = record(normalized);
  const keys = Object.keys(expected);
  return Object.keys(actual).length === keys.length && keys.every((key) =>
    Object.hasOwn(actual, key) && isCanonical(actual[key], expected[key]));
}

export function parseMonoSceneAppearance(value: unknown): MonoSceneAppearance | null {
  const normalized = normalizeMonoSceneAppearance(value);
  return isCanonical(value, normalized) ? normalized : null;
}
