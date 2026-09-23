/** Experimental presentation data. Legacy iris/tide/strata remain a separate axis. */
export type MonoBackgroundRecipeId = "baseline" | "obsidian" | "aperture";
export type MonoBackgroundRecipeConfig = {
  version: 1;
  recipe: MonoBackgroundRecipeId;
  intensity: number;
  /** Speed of a finite pointer settle, never an ambient loop rate. */
  speed: number;
  pointerResponse: number;
  character: "fluid" | "precise";
  calm: boolean;
};

export const MONO_BACKGROUND_DEFAULTS: Readonly<Record<MonoBackgroundRecipeId, Readonly<MonoBackgroundRecipeConfig>>> = {
  baseline: { version: 1, recipe: "baseline", intensity: 1, speed: .5, pointerResponse: 1, character: "fluid", calm: false },
  obsidian: { version: 1, recipe: "obsidian", intensity: .6, speed: .45, pointerResponse: .55, character: "fluid", calm: false },
  aperture: { version: 1, recipe: "aperture", intensity: .58, speed: .6, pointerResponse: .5, character: "precise", calm: false },
};

export const MONO_BACKGROUND_CONTROLS = [
  { key: "intensity", label: "Интенсивность", min: 0, max: 1, step: .01 },
  { key: "speed", label: "Отклик", min: 0, max: 1, step: .01 },
  { key: "pointerResponse", label: "Реакция указателя", min: 0, max: 1, step: .01 },
] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isRecipe = (value: unknown): value is MonoBackgroundRecipeId =>
  value === "baseline" || value === "obsidian" || value === "aperture";
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function normalizeMonoBackgroundRecipe(value: unknown): MonoBackgroundRecipeConfig {
  if (!isRecord(value) || value.version !== 1 || !isRecipe(value.recipe)) return { ...MONO_BACKGROUND_DEFAULTS.obsidian };
  const config = { ...MONO_BACKGROUND_DEFAULTS[value.recipe] };
  for (const { key, min, max } of MONO_BACKGROUND_CONTROLS) {
    const input = value[key];
    if (typeof input === "number" && Number.isFinite(input)) config[key] = clamp(input, min, max);
  }
  if (value.character === "fluid" || value.character === "precise") config.character = value.character;
  if (typeof value.calm === "boolean") config.calm = value.calm;
  return config;
}

/** Strict import: recovery is deliberately not used to silently accept partial data. */
export function parseMonoBackgroundRecipe(json: string): MonoBackgroundRecipeConfig {
  if (json.length > 4096) throw new Error("Проба слишком большая.");
  let input: unknown;
  try { input = JSON.parse(json); } catch { throw new Error("Некорректный JSON пробы."); }
  const keys = Object.keys(MONO_BACKGROUND_DEFAULTS.obsidian);
  if (!isRecord(input) || Object.keys(input).length !== keys.length || !keys.every(key => Object.hasOwn(input, key))) {
    throw new Error("Нужна полная конфигурация атмосферы без дополнительных полей.");
  }
  const normalized = normalizeMonoBackgroundRecipe(input);
  if (!keys.every(key => input[key] === normalized[key as keyof MonoBackgroundRecipeConfig])) {
    throw new Error("Версия или параметры пробы не поддерживаются.");
  }
  return normalized;
}

export function monoBackgroundPointer(x: number, y: number, width: number, height: number, config: MonoBackgroundRecipeConfig) {
  if (config.calm || ![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return { x: 0, y: 0, angle: 0 };
  const nx = clamp(x / width * 2 - 1, -1, 1);
  const ny = clamp(y / height * 2 - 1, -1, 1);
  const strength = clamp(config.pointerResponse, 0, 1);
  return { x: nx * 28 * strength, y: ny * 20 * strength, angle: nx * 5 * strength };
}

export function monoBackgroundTiming(config: MonoBackgroundRecipeConfig) {
  const fluid = config.character === "fluid";
  return {
    durationMs: Math.round((fluid ? 740 : 420) - config.speed * (fluid ? 480 : 260)),
    easing: fluid ? "cubic-bezier(0.16, 1, 0.3, 1)" : "cubic-bezier(0.2, 0, 0, 1)",
  };
}
