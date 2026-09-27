import type { ButtonTargetId } from "@wallet/ui";

export type MonoActionArtworkV1 = {
  version: 1;
  packId: "original" | "volume-v1" | "contour-v1";
  energy: { enabled: boolean; intensity: number; durationMs: number; width: number };
};

export type MonoActionArtworkMap = Record<ButtonTargetId, MonoActionArtworkV1>;

export const ACTION_ARTWORK_TARGETS = ["quick.send", "quick.receive", "quick.swap", "quick.buy"] as const satisfies readonly ButtonTargetId[];

const PACK_IDS: readonly MonoActionArtworkV1["packId"][] = ["original", "volume-v1", "contour-v1"];

function record(input: unknown, path: string): Record<string, unknown> {
  if (input === null || typeof input !== "object" || Array.isArray(input) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(input))) {
    throw new TypeError(`${path}: нужен объект.`);
  }
  return input as Record<string, unknown>;
}

function exactKeys(input: Record<string, unknown>, keys: readonly string[], path: string): void {
  const actual = Reflect.ownKeys(input);
  if (actual.length !== keys.length || actual.some(key => typeof key !== "string" || !keys.includes(key))) {
    throw new TypeError(`${path}: состав полей не поддерживается.`);
  }
}

function bounded(value: unknown, min: number, max: number, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`${path}: допустимо от ${min} до ${max}.`);
  }
  return value;
}

export function createDefaultActionArtwork(): MonoActionArtworkV1 {
  return { version: 1, packId: "original", energy: {
    enabled: true, intensity: 0.35, durationMs: 700, width: 0.28,
  } };
}

export function parseMonoActionArtwork(input: unknown): MonoActionArtworkV1 {
  const value = record(input, "artwork");
  exactKeys(value, ["version", "packId", "energy"], "artwork");
  if (value.version !== 1) throw new TypeError("artwork.version: неизвестная версия.");
  if (typeof value.packId !== "string" || !PACK_IDS.includes(value.packId as MonoActionArtworkV1["packId"])) {
    throw new TypeError("artwork.packId: неизвестный набор.");
  }
  const energy = record(value.energy, "artwork.energy");
  exactKeys(energy, ["enabled", "intensity", "durationMs", "width"], "artwork.energy");
  if (typeof energy.enabled !== "boolean") throw new TypeError("artwork.energy.enabled: нужно true или false.");
  return { version: 1, packId: value.packId as MonoActionArtworkV1["packId"], energy: {
    enabled: energy.enabled,
    intensity: bounded(energy.intensity, 0, 1, "artwork.energy.intensity"),
    durationMs: bounded(energy.durationMs, 400, 1200, "artwork.energy.durationMs"),
    width: bounded(energy.width, 0.12, 0.55, "artwork.energy.width"),
  } };
}

export function createDefaultActionArtworkMap(): MonoActionArtworkMap {
  return {
    "quick.send": createDefaultActionArtwork(),
    "quick.receive": createDefaultActionArtwork(),
    "quick.swap": createDefaultActionArtwork(),
    "quick.buy": createDefaultActionArtwork(),
  };
}

export function parseMonoActionArtworkMap(input: unknown): MonoActionArtworkMap {
  const value = record(input, "artwork map");
  exactKeys(value, ACTION_ARTWORK_TARGETS, "artwork map");
  return {
    "quick.send": parseMonoActionArtwork(value["quick.send"]),
    "quick.receive": parseMonoActionArtwork(value["quick.receive"]),
    "quick.swap": parseMonoActionArtwork(value["quick.swap"]),
    "quick.buy": parseMonoActionArtwork(value["quick.buy"]),
  };
}
