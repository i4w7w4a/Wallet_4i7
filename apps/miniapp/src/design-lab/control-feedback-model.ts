export type ControlEffectId = "baseline" | "material" | "magnetic";
export type LabView = "isolated" | "context";
export type PreviewWidth = 320 | 390 | 430 | 480;

export type ControlFeedbackConfig = {
  pressDepth: number;
  magneticTravel: number;
  settleMs: number;
};

export type ControlFeedbackPreset = {
  schemaVersion: 1;
  sceneId: "control-feedback-01";
  implementationVersion: 1;
  effectId: ControlEffectId;
  view: LabView;
  previewWidth: PreviewWidth;
  status: "draft";
  config: ControlFeedbackConfig;
};

export const STORAGE_KEY = "novex.motion-lab.control-feedback-01.v1";
export const DEFAULT_CONFIG: ControlFeedbackConfig = {
  pressDepth: 1.6,
  magneticTravel: 5,
  settleMs: 190,
};
export const PREVIEW_WIDTHS = [320, 390, 430, 480] as const;
const MAX_IMPORT_LENGTH = 8192;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && actual.every((key) => keys.includes(key));
}

function within(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

function validatePreset(value: unknown): ControlFeedbackPreset {
  if (!isRecord(value) || !exactKeys(value, [
    "schemaVersion", "sceneId", "implementationVersion", "effectId", "view",
    "previewWidth", "status", "config",
  ])) {
    throw new Error("Неизвестная структура пробы.");
  }
  if (value.schemaVersion !== 1 || value.sceneId !== "control-feedback-01" ||
      value.implementationVersion !== 1 || value.status !== "draft" ||
      (value.effectId !== "baseline" && value.effectId !== "material" && value.effectId !== "magnetic") ||
      (value.view !== "isolated" && value.view !== "context") ||
      !PREVIEW_WIDTHS.some((width) => width === value.previewWidth)) {
    throw new Error("Версия или поля пробы не поддерживаются.");
  }
  const config = value.config;
  if (!isRecord(config) || !exactKeys(config, ["pressDepth", "magneticTravel", "settleMs"]) ||
      !within(config.pressDepth, 0, 3) || !within(config.magneticTravel, 0, 8) ||
      !within(config.settleMs, 100, 320)) {
    throw new Error("Параметры пробы вне допустимых границ.");
  }
  return value as ControlFeedbackPreset;
}

export function parsePresetJson(json: string): ControlFeedbackPreset {
  if (json.length > MAX_IMPORT_LENGTH) {
    throw new Error("Файл пробы слишком велик.");
  }
  return validatePreset(JSON.parse(json) as unknown);
}

export function createPresetJson(preset: ControlFeedbackPreset): string {
  return JSON.stringify(validatePreset(preset), null, 2);
}

export function magneticOffset(
  point: { x: number; y: number },
  rect: { left: number; top: number; width: number; height: number },
  maxTravel: number,
): { x: number; y: number } {
  if (rect.width <= 0 || rect.height <= 0 ||
      point.x < rect.left || point.x > rect.left + rect.width ||
      point.y < rect.top || point.y > rect.top + rect.height) {
    return { x: 0, y: 0 };
  }
  const nx = (point.x - rect.left - rect.width / 2) / (rect.width / 2);
  const ny = (point.y - rect.top - rect.height / 2) / (rect.height / 2);
  const distance = Math.min(1, Math.hypot(nx, ny));
  const falloff = 1 - distance * 0.4;
  const travel = Math.max(0, Math.min(8, maxTravel));
  return {
    x: Math.max(-travel, Math.min(travel, nx * travel * falloff)),
    y: Math.max(-travel, Math.min(travel, ny * travel * falloff)),
  };
}
