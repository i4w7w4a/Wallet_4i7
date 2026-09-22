export type MonoShapePreset = "ledger" | "frost" | "mercury";
export type MonoShapeGroup = "quick-actions" | "bottom-navigation";
export type MonoShapeSettings = Record<MonoShapeGroup, number>;
export type MonoShapeMap = Record<MonoShapePreset, MonoShapeSettings>;

type StoragePort = Pick<Storage, "getItem" | "setItem">;

export const MONO_SHAPE_STORAGE_KEY = "wallet4i7.mono.shape-preview.v1";
export const MONO_SHAPE_RADIUS_BOUNDS = { min: 0, max: 24, step: 1 } as const;
const MONO_SHAPE_STORAGE_LIMIT = 5_000;

export function createMonoShapeDefaults(): MonoShapeMap {
  return {
    ledger: { "quick-actions": 12, "bottom-navigation": 0 },
    frost: { "quick-actions": 19, "bottom-navigation": 0 },
    mercury: { "quick-actions": 14, "bottom-navigation": 0 },
  };
}

export function normalizeMonoShapeRadius(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(MONO_SHAPE_RADIUS_BOUNDS.max,
    Math.max(MONO_SHAPE_RADIUS_BOUNDS.min, Math.round(value / MONO_SHAPE_RADIUS_BOUNDS.step) * MONO_SHAPE_RADIUS_BOUNDS.step));
}

export function normalizeMonoShapeMap(input: unknown): MonoShapeMap {
  const defaults = createMonoShapeDefaults();
  const source = record(input);
  for (const preset of ["ledger", "frost", "mercury"] as const) {
    const settings = record(source?.[preset]);
    for (const group of ["quick-actions", "bottom-navigation"] as const) {
      defaults[preset][group] = normalizeMonoShapeRadius(settings?.[group], defaults[preset][group]);
    }
  }
  return defaults;
}

export function loadMonoShapeCandidate(storage: StoragePort): MonoShapeMap {
  try {
    const raw = storage.getItem(MONO_SHAPE_STORAGE_KEY);
    if (!raw || raw.length > MONO_SHAPE_STORAGE_LIMIT) return createMonoShapeDefaults();
    const source = record(JSON.parse(raw) as unknown);
    if (source?.version !== 1 || source.skinId !== "mono-ledger-v1") return createMonoShapeDefaults();
    return normalizeMonoShapeMap(source.presets);
  } catch {
    return createMonoShapeDefaults();
  }
}

export function loadMonoShapeCandidateFrom(getStorage: () => StoragePort): MonoShapeMap {
  try {
    return loadMonoShapeCandidate(getStorage());
  } catch {
    return createMonoShapeDefaults();
  }
}

export function applyMonoShapeCandidate(storage: StoragePort, input: MonoShapeMap): MonoShapeMap {
  const presets = normalizeMonoShapeMap(input);
  storage.setItem(MONO_SHAPE_STORAGE_KEY, JSON.stringify({
    version: 1,
    skinId: "mono-ledger-v1",
    presets,
  }));
  return presets;
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}
