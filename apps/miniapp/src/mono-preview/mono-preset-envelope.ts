import { MONO_GLASS_DEFAULTS, normalizeMonoGlassSettings, normalizeMonoPaletteConfig, validateMonoPaletteApply,
  type MonoGlassSettings, type MonoPaletteConfigV1 } from "@wallet/ui";
import { loadMonoLogoPreview, MONO_LOGO_PREVIEW_DEFAULTS, type MonoLogoPreview } from "./mono-logo-preview";
import { createMonoShapeDefaults, normalizeMonoShapeMap, type MonoShapePreset, type MonoShapeSettings } from "./mono-shape-preview";
import { MONO_BALANCE_LEGACY, MONO_SCENE_DEFAULT, parseMonoSceneAppearance, type MonoSceneAppearance } from "./mono-scene-lab-contract";
import { normalizeMonoTypography, validateMonoTypography, type MonoTypographyConfigV1 } from "./mono-typography";
import { parseMonoBackgroundRecipe, type MonoBackgroundRecipeConfig } from "./mono-background-recipes";
import type { MonoWorkingDocument } from "./mono-working-presets";
import { MonoShareError } from "./mono-share-transport";

export type MonoExtendedAppearance = MonoSceneAppearance & {
  logo: MonoLogoPreview;
  typography: MonoTypographyConfigV1 | null;
  background: MonoBackgroundRecipeConfig | null;
};
export type MonoAppearance = MonoExtendedAppearance & {
  preset: MonoShapePreset;
  palette: { enabled: boolean; config: MonoPaletteConfigV1 };
  shape: MonoShapeSettings;
  optics: MonoGlassSettings;
  environment: { theme: "dark" | "light"; background: "iris" | "tide" | "strata" };
};
export type MonoAppearanceEnvelope = {
  kind: "mono-appearance";
  version: 1;
  skinId: "mono-ledger-v1";
  appearance: MonoAppearance;
};

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw invalid();
  return value as Record<string, unknown>;
}
const invalid = () => new MonoShareError("invalid", "Оформление содержит неизвестные поля или недопустимые значения.");

export function canonicalMonoAppearance(value: unknown, depth = 0): string {
  if (depth > 32) throw invalid();
  if (Array.isArray(value)) return `[${value.map(item => canonicalMonoAppearance(item, depth + 1)).join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.keys(value).sort().map(key =>
    `${JSON.stringify(key)}:${canonicalMonoAppearance((value as Record<string, unknown>)[key], depth + 1)}`).join(",")}}`;
  return JSON.stringify(value);
}

export function createMonoExtendedAppearance(preset: MonoShapePreset, logo = MONO_LOGO_PREVIEW_DEFAULTS, legacy = false): MonoExtendedAppearance {
  if (preset !== "ledger" && preset !== "frost" && preset !== "mercury") throw invalid();
  return { ...structuredClone(MONO_SCENE_DEFAULT), ...(legacy ? { balance: { ...MONO_BALANCE_LEGACY } } : {}),
    logo: { ...logo }, typography: null, background: null };
}

/** Strict import boundary: recovery normalizers never silently repair a shared snapshot. */
export function normalizeMonoExtendedAppearance(value: unknown): MonoExtendedAppearance {
  const input = record(value);
  const scene = parseMonoSceneAppearance({ balance: input.balance, chart: input.chart, layout: input.layout, assets: input.assets });
  if (!scene || (input.typography !== null && !validateMonoTypography(input.typography))) throw invalid();
  const logo = loadMonoLogoPreview({ getItem: () => JSON.stringify(input.logo) });
  let background: MonoBackgroundRecipeConfig | null;
  try { background = input.background === null ? null : parseMonoBackgroundRecipe(JSON.stringify(input.background)); }
  catch { throw invalid(); }
  const result = { ...scene, logo, typography: input.typography === null ? null : normalizeMonoTypography(input.typography), background };
  if (canonicalMonoAppearance(value) !== canonicalMonoAppearance(result)) throw invalid();
  return result;
}

export function createMonoAppearanceEnvelope(preset: MonoShapePreset = "ledger"): MonoAppearanceEnvelope {
  return { kind: "mono-appearance", version: 1, skinId: "mono-ledger-v1", appearance: {
    ...createMonoExtendedAppearance(preset), preset,
    palette: { enabled: false, config: normalizeMonoPaletteConfig({ seed: "mono-share" }) },
    shape: createMonoShapeDefaults()[preset], optics: { ...MONO_GLASS_DEFAULTS[preset] },
    environment: { theme: "dark", background: "iris" },
  } };
}

export function normalizeMonoAppearanceEnvelope(value: unknown): MonoAppearanceEnvelope {
  const input = record(value);
  if (input.version !== 1) throw new MonoShareError("version", "Эта версия оформления пока не поддерживается.");
  if (input.kind !== "mono-appearance" || input.skinId !== "mono-ledger-v1") throw invalid();
  const appearance = record(input.appearance), palette = record(appearance.palette), environment = record(appearance.environment);
  const preset = appearance.preset;
  if (preset !== "ledger" && preset !== "frost" && preset !== "mercury") throw invalid();
  if (typeof palette.enabled !== "boolean" || (environment.theme !== "dark" && environment.theme !== "light") ||
    (environment.background !== "iris" && environment.background !== "tide" && environment.background !== "strata")) throw invalid();
  const extended = normalizeMonoExtendedAppearance({ logo: appearance.logo, typography: appearance.typography,
    chart: appearance.chart, layout: appearance.layout, assets: appearance.assets, balance: appearance.balance, background: appearance.background });
  let config: MonoPaletteConfigV1;
  try { config = normalizeMonoPaletteConfig(palette.config); } catch { throw invalid(); }
  if (config.seed !== "mono-share" || config.actionCounter !== 0) throw invalid();
  const result: MonoAppearanceEnvelope = { kind: "mono-appearance", version: 1, skinId: "mono-ledger-v1", appearance: {
    ...extended, preset, palette: { enabled: palette.enabled, config },
    shape: normalizeMonoShapeMap({ [preset]: appearance.shape })[preset],
    optics: normalizeMonoGlassSettings(preset, record(appearance.optics) as Partial<MonoGlassSettings>),
    environment: { theme: environment.theme, background: environment.background },
  } };
  if (canonicalMonoAppearance(value) !== canonicalMonoAppearance(result)) throw invalid();
  if (palette.enabled && Object.values(config.themes).some(theme => !validateMonoPaletteApply(theme).valid))
    throw new MonoShareError("invalid", "Палитра не прошла проверку читаемости. Исправьте контраст перед созданием ссылки.");
  return result;
}

/** Extract only accepted appearance; caller resolves pending tool drafts before invoking this. */
export function createMonoAppearanceFromDocument(document: MonoWorkingDocument, preset?: MonoShapePreset): MonoAppearanceEnvelope {
  const presets = ["ledger", "frost", "mercury"] as const;
  const direction = preset ?? presets[document.palette.activeSlotId - 1];
  const selected = document.palette.slots[presets.indexOf(direction)].present;
  const config = { ...structuredClone(selected.config), seed: "mono-share", actionCounter: 0 };
  return normalizeMonoAppearanceEnvelope({ kind: "mono-appearance", version: 1, skinId: "mono-ledger-v1", appearance: {
    ...document.appearance[direction], preset: direction, palette: { enabled: selected.paletteEnabled === true, config },
    shape: document.shapes[direction], optics: document.optics[direction],
    environment: { theme: selected.mode, background: document.background },
  } });
}
