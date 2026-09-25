import type { ParameterSchema } from "../../contracts";

export interface ParticleParams {
  particleColor: string;
  backgroundColor: string;
  timeScale: number;
  flipRatio: number;
  gravity: number;
  pointerForce: number;
  particleSize: number;
  initialFill: number;
  camera: "front" | "isometric" | "high";
}

export const PARTICLE_DEFAULTS: Readonly<ParticleParams> = Object.freeze({
  particleColor: "#408CFF", backgroundColor: "#F5FAFF", timeScale: 0.08,
  flipRatio: 0.99, gravity: 40, pointerForce: 3, particleSize: 1,
  initialFill: 0.375, camera: "isometric",
});

export const PARTICLE_BOUNDS = Object.freeze({
  timeScale: { min: 0.005, max: 1, step: 0.005 },
  flipRatio: { min: 0.5, max: 0.99, step: 0.01 },
  gravity: { min: 0, max: 80, step: 1 },
  pointerForce: { min: 0, max: 8, step: 0.1 },
  particleSize: { min: 0.6, max: 1.4, step: 0.05 },
  initialFill: { min: 0.2, max: 0.65, step: 0.025 },
});

export function parseParticleParams(input: unknown): ParticleParams | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const prototype = Object.getPrototypeOf(input);
  if (prototype !== Object.prototype && prototype !== null) return null;
  const value = input as Record<string, unknown>;
  const keys = Object.keys(value);
  if (keys.length !== Object.keys(PARTICLE_DEFAULTS).length
    || keys.some(key => !Object.hasOwn(PARTICLE_DEFAULTS, key))) return null;
  for (const key of Object.keys(PARTICLE_BOUNDS) as (keyof typeof PARTICLE_BOUNDS)[]) {
    const number = value[key];
    const { min, max } = PARTICLE_BOUNDS[key];
    if (typeof number !== "number" || !Number.isFinite(number) || number < min || number > max) return null;
  }
  for (const key of ["particleColor", "backgroundColor"] as const) {
    if (typeof value[key] !== "string" || !/^#[0-9a-fA-F]{6}$/.test(value[key])) return null;
  }
  if (value.camera !== "front" && value.camera !== "isometric" && value.camera !== "high") return null;
  return {
    particleColor: (value.particleColor as string).toUpperCase(),
    backgroundColor: (value.backgroundColor as string).toUpperCase(),
    timeScale: value.timeScale as number, flipRatio: value.flipRatio as number,
    gravity: value.gravity as number, pointerForce: value.pointerForce as number,
    particleSize: value.particleSize as number, initialFill: value.initialFill as number,
    camera: value.camera,
  };
}

export const particleSchema: ParameterSchema<ParticleParams> = {
  defaults: PARTICLE_DEFAULTS,
  controls: [
    { key: "particleColor", kind: "color", group: "color", label: "Цвет частиц" },
    { key: "backgroundColor", kind: "color", group: "color", label: "Цвет фона" },
    { key: "timeScale", kind: "range", group: "motion", label: "Скорость времени", description: "Сохраняет частоту кадров; 0.005 — очень медленное растекание. Без подпитки жидкость может успокоиться.", ...PARTICLE_BOUNDS.timeScale },
    { key: "particleSize", kind: "range", group: "surface", label: "Размер сфер", ...PARTICLE_BOUNDS.particleSize },
    { key: "initialFill", kind: "range", group: "surface", label: "Начальное заполнение", description: "Ширина стартового объёма; применяется при Перезапуске.", ...PARTICLE_BOUNDS.initialFill },
    { key: "flipRatio", kind: "range", group: "physics", label: "Характер течения", description: "0.5 ближе к PIC, 0.99 ближе к FLIP.", ...PARTICLE_BOUNDS.flipRatio },
    { key: "gravity", kind: "range", group: "physics", label: "Гравитация", ...PARTICLE_BOUNDS.gravity },
    { key: "pointerForce", kind: "range", group: "physics", label: "Сила курсора", description: "Реакция на движение fine pointer; без захвата прокрутки и drag.", ...PARTICLE_BOUNDS.pointerForce },
    { key: "camera", kind: "select", group: "precise", label: "Камера", options: [
      { value: "front", label: "Фронт" }, { value: "isometric", label: "Объём" }, { value: "high", label: "Сверху" },
    ] },
  ],
  parse(input) {
    const value = parseParticleParams(input);
    return value ? { ok: true, value } : { ok: false, issues: [{ code: "invalid-fluid-particles-params", message: "Параметры объёмной жидкости вне допустимой схемы." }] };
  },
};
