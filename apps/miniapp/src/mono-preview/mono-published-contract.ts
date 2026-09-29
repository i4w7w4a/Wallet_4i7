import { normalizeMonoAppearanceEnvelope, type MonoAppearanceEnvelope } from "./mono-preset-envelope";

export type MonoPublishedSlot = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type MonoPublishedRecord = Readonly<{
  slot: MonoPublishedSlot;
  revision: number;
  updatedAt: string;
  snapshot: MonoAppearanceEnvelope;
}>;

export const MAX_PUBLISH_BODY_BYTES = 200_000;
const MAX_JSON_DEPTH = 32;
const MAX_JSON_NODES = 20_000;

export class MonoPublishedError extends Error {
  constructor(message: string, readonly status: number) { super(message); this.name = "MonoPublishedError"; }
}

function record(input: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new MonoPublishedError("Недопустимый формат публикации.", 422);
  const actual = Object.keys(input);
  if (actual.length !== keys.length || actual.some(key => !keys.includes(key)))
    throw new MonoPublishedError("Публикация содержит неизвестные поля.", 422);
  return input as Record<string, unknown>;
}

export function parsePublishedSlot(raw: unknown): MonoPublishedSlot {
  if (typeof raw !== "string" || !/^[1-7]$/.test(raw))
    throw new MonoPublishedError("Адрес не найден.", 404);
  return Number(raw) as MonoPublishedSlot;
}

function checkDepth(value: unknown): void {
  const stack: Array<{ value: unknown; depth: number }> = [{ value, depth: 0 }];
  const seen = new WeakSet<object>();
  let nodes = 0;
  while (stack.length) {
    const current = stack.pop()!;
    if (++nodes > MAX_JSON_NODES || current.depth > MAX_JSON_DEPTH)
      throw new MonoPublishedError("Публикация слишком сложна.", 422);
    if (current.value && typeof current.value === "object") {
      if (seen.has(current.value)) throw new MonoPublishedError("Недопустимая структура публикации.", 422);
      seen.add(current.value);
      for (const item of Object.values(current.value)) stack.push({ value: item, depth: current.depth + 1 });
    }
  }
}

function snapshot(input: unknown): MonoAppearanceEnvelope {
  checkDepth(input);
  if (!input || typeof input !== "object" || (input as { version?: unknown }).version !== 4)
    throw new MonoPublishedError("Нужен полный снимок MONO версии 4.", 422);
  let serialized: string;
  try { serialized = JSON.stringify(input); }
  catch { throw new MonoPublishedError("Недопустимый снимок MONO.", 422); }
  if (new TextEncoder().encode(serialized).byteLength > MAX_PUBLISH_BODY_BYTES)
    throw new MonoPublishedError("Снимок слишком велик.", 413);
  try { return normalizeMonoAppearanceEnvelope(input); }
  catch { throw new MonoPublishedError("Снимок MONO не прошёл проверку.", 422); }
}

export function parsePublishBody(input: unknown): { expectedRevision: number; snapshot: MonoAppearanceEnvelope } {
  checkDepth(input);
  const body = record(input, ["expectedRevision", "snapshot"]);
  if (typeof body.expectedRevision !== "number" || !Number.isSafeInteger(body.expectedRevision) ||
      body.expectedRevision < 0 || body.expectedRevision >= Number.MAX_SAFE_INTEGER)
    throw new MonoPublishedError("Недопустимая ревизия публикации.", 422);
  return { expectedRevision: body.expectedRevision, snapshot: snapshot(body.snapshot) };
}

export function parsePublishedRecord(input: unknown, slot: MonoPublishedSlot): MonoPublishedRecord {
  checkDepth(input);
  const value = record(input, ["slot", "revision", "updatedAt", "snapshot"]);
  if (value.slot !== slot || typeof value.revision !== "number" || !Number.isSafeInteger(value.revision) || value.revision < 1 ||
      typeof value.updatedAt !== "string" || Number.isNaN(Date.parse(value.updatedAt)) ||
      new Date(value.updatedAt).toISOString() !== value.updatedAt) {
    throw new MonoPublishedError("Повреждённая запись публикации.", 503);
  }
  try { return { slot, revision: value.revision, updatedAt: value.updatedAt, snapshot: snapshot(value.snapshot) }; }
  catch { throw new MonoPublishedError("Повреждённая запись публикации.", 503); }
}
