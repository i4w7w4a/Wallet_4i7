import type { CSSProperties } from "react";
import {
  isMonoFontId, MONO_FONT_REGISTRY, MONO_UI_FONT_IDS, monoFontPairCoversCurrencies,
  normalizeMonoFontWeight, type MonoFontId, type MonoUiFontId,
} from "./mono-font-registry";

export type { MonoFontId, MonoUiFontId } from "./mono-font-registry";
export type MonoTypographyPreset = "ledger" | "frost" | "mercury";
export type MonoTypographyRole = "body" | "balance" | "button" | "menu" | "label" | "mono";
export type MonoTypographyRoleSettings = { family: "primary" | "secondary"; size: number; weight: number };
export type MonoTypographyConfigV1 = {
  version: 1;
  catalogVersion: 1;
  primaryFontId: MonoUiFontId;
  secondaryFontId: MonoFontId;
  roles: Record<MonoTypographyRole, MonoTypographyRoleSettings>;
  bodyLineHeight: number;
  labelTracking: number;
};
export type MonoTypographyMap = Record<MonoTypographyPreset, MonoTypographyConfigV1>;
export type MonoTypographyStyle = CSSProperties & Record<`--mono-${string}`, string | number>;

export const MONO_TYPOGRAPHY_ROLES: readonly MonoTypographyRole[] = ["body", "balance", "button", "menu", "label", "mono"];
export const MONO_TYPOGRAPHY_BOUNDS = {
  body: { min: 14, max: 18, step: 1 }, balance: { min: 44, max: 60, step: 1 },
  button: { min: 12, max: 16, step: 1 }, menu: { min: 11, max: 15, step: 1 },
  label: { min: 11, max: 14, step: 1 }, mono: { min: 11, max: 15, step: 1 },
  bodyLineHeight: { min: 1.42, max: 1.6, step: 0.01 },
  labelTracking: { min: 0, max: 0.08, step: 0.01 },
} as const;

export function createMonoTypographySet(primaryFontId: MonoUiFontId): MonoTypographyConfigV1 {
  const numericSecondary = primaryFontId === "golos-text" || primaryFontId === "source-sans-3";
  return {
    version: 1, catalogVersion: 1, primaryFontId,
    secondaryFontId: primaryFontId === "golos-text" ? "ibm-plex-sans" : primaryFontId === "source-sans-3" ? "manrope" : "ibm-plex-mono",
    roles: {
      body: { family: "primary", size: 15, weight: 400 },
      balance: { family: numericSecondary ? "secondary" : "primary", size: 52, weight: primaryFontId === "onest" ? 650 : 600 },
      button: { family: "primary", size: 13, weight: 500 },
      menu: { family: "primary", size: 12, weight: 500 },
      label: { family: "primary", size: 12, weight: 500 },
      mono: { family: "secondary", size: 12, weight: 400 },
    },
    bodyLineHeight: 1.46, labelTracking: 0.02,
  };
}

export function createMonoTypographyDefaults(preset: MonoTypographyPreset = "ledger"): MonoTypographyConfigV1 {
  return createMonoTypographySet(preset === "frost" ? "golos-text" : preset === "mercury" ? "onest" : "ibm-plex-sans");
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function number(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
function bounded(value: unknown, fallback: number, bounds: { min: number; max: number; step: number }): number {
  return Number(Math.min(bounds.max, Math.max(bounds.min, Math.round(number(value, fallback) / bounds.step) * bounds.step)).toFixed(3));
}

export function monoTypographyRoleFont(config: MonoTypographyConfigV1, role: MonoTypographyRole): MonoFontId {
  return config.roles[role].family === "primary" ? config.primaryFontId : config.secondaryFontId;
}

export function normalizeMonoTypography(input: unknown): MonoTypographyConfigV1 {
  const source = record(input);
  if (!source || source.version !== 1 || source.catalogVersion !== 1) return createMonoTypographyDefaults();
  const primary = MONO_UI_FONT_IDS.includes(source.primaryFontId as MonoUiFontId)
    ? source.primaryFontId as MonoUiFontId : "ibm-plex-sans";
  const result = createMonoTypographySet(primary);
  if (isMonoFontId(source.secondaryFontId) && monoFontPairCoversCurrencies(primary, source.secondaryFontId) &&
      (MONO_FONT_REGISTRY[primary].tabular || MONO_FONT_REGISTRY[source.secondaryFontId].tabular)) {
    result.secondaryFontId = source.secondaryFontId;
  }
  const roles = record(source.roles);
  for (const role of MONO_TYPOGRAPHY_ROLES) {
    const setting = record(roles?.[role]);
    const fallback = result.roles[role];
    const family = setting?.family === "primary" || setting?.family === "secondary" ? setting.family : fallback.family;
    result.roles[role] = { ...fallback, family };
    // Currency rows and balances must use a face with shaped equal advances.
    if (role === "balance" && !MONO_FONT_REGISTRY[monoTypographyRoleFont(result, role)].tabular) {
      result.roles[role].family = MONO_FONT_REGISTRY[result.primaryFontId].tabular ? "primary" : "secondary";
    }
    result.roles[role].size = bounded(setting?.size, fallback.size, MONO_TYPOGRAPHY_BOUNDS[role]);
    result.roles[role].weight = normalizeMonoFontWeight(monoTypographyRoleFont(result, role), number(setting?.weight, fallback.weight));
  }
  result.bodyLineHeight = bounded(source.bodyLineHeight, result.bodyLineHeight, MONO_TYPOGRAPHY_BOUNDS.bodyLineHeight);
  result.labelTracking = bounded(source.labelTracking, result.labelTracking, MONO_TYPOGRAPHY_BOUNDS.labelTracking);
  return result;
}

function equalShape(value: unknown, normalized: unknown): boolean {
  const left = record(value), right = record(normalized);
  if (!left || !right) return value === normalized;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every(key => Object.hasOwn(right, key) && equalShape(left[key], right[key]));
}

/** Strict import boundary: unknown fields, versions, IDs or repaired values reject. */
export function validateMonoTypography(input: unknown): input is MonoTypographyConfigV1 {
  return equalShape(input, normalizeMonoTypography(input));
}

export function createMonoTypographyMap(): MonoTypographyMap {
  return { ledger: createMonoTypographyDefaults(), frost: createMonoTypographyDefaults("frost"), mercury: createMonoTypographyDefaults("mercury") };
}

export function normalizeMonoTypographyMap(input: unknown): MonoTypographyMap {
  const source = record(input), defaults = createMonoTypographyMap();
  for (const preset of ["ledger", "frost", "mercury"] as const) {
    if (source?.[preset] !== undefined) defaults[preset] = normalizeMonoTypography(source[preset]);
  }
  return defaults;
}

export function monoTypographyStyle(input: MonoTypographyConfigV1): MonoTypographyStyle {
  const config = normalizeMonoTypography(input);
  const style: MonoTypographyStyle = { fontSynthesis: "none" };
  for (const role of MONO_TYPOGRAPHY_ROLES) {
    const font = monoTypographyRoleFont(config, role);
    const other = font === config.primaryFontId ? config.secondaryFontId : config.primaryFontId;
    style[`--mono-type-${role}-family`] = `"${MONO_FONT_REGISTRY[font].family}", "${MONO_FONT_REGISTRY[other].family}", Arial, sans-serif`;
    style[`--mono-type-${role}-size`] = `${config.roles[role].size}px`;
    style[`--mono-type-${role}-weight`] = config.roles[role].weight;
  }
  Object.assign(style, {
    "--mono-font-ui": style["--mono-type-body-family"],
    "--mono-font-display": style["--mono-type-body-family"],
    "--mono-font-numeric": style["--mono-type-balance-family"],
    "--mono-font-mono": style["--mono-type-mono-family"],
    "--mono-font-weight-body": config.roles.body.weight,
    "--mono-font-weight-medium": config.roles.button.weight,
    "--mono-font-weight-strong": normalizeMonoFontWeight(config.primaryFontId, 600),
    "--mono-font-weight-balance": config.roles.balance.weight,
    "--mono-type-section-size": `${config.roles.body.size + 7}px`,
    "--mono-type-row-value-size": `${config.roles.body.size + 1}px`,
    "--mono-type-body-line-height": config.bodyLineHeight,
    "--mono-type-label-tracking": `${config.labelTracking}em`,
    "--mono-type-numeric-features": '"tnum" 1, "lnum" 1',
    "--mono-type-numeric-variant": "tabular-nums lining-nums",
  });
  return style;
}
