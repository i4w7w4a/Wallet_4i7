import { importMonoPalettePreset, type MonoPalettePresetV1 } from "../mono-preview/mono-preset-codec";
import type { PresetView, PresetVisibility } from "./preset-types";

export type PresetRequestOptions = { signal?: AbortSignal };
export type PresetCreateInput = {
  name: string; description?: string; visibility?: PresetVisibility; preset: MonoPalettePresetV1;
};
export type PresetReviseInput = {
  expectedRevision: number; name?: string; description?: string; visibility?: PresetVisibility; preset?: MonoPalettePresetV1;
};
export type PresetForkInput = { name: string; preset?: MonoPalettePresetV1 };
export type PresetHttpErrorKind = "http" | "network" | "invalid-response" | "aborted";

export class PresetHttpError extends Error {
  constructor(message: string, readonly status: number | null, readonly kind: PresetHttpErrorKind) {
    super(message);
    this.name = "PresetHttpError";
  }
}

const has = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const invalid = (): never => { throw new PresetHttpError("Invalid preset server response", null, "invalid-response"); };
const slugPattern = /^[A-Za-z0-9_-]{32}$/;
const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const hashPattern = /^sha256-[0-9a-f]{64}$/;

function pathFor(slug: string): string {
  if (!slugPattern.test(slug)) throw new PresetHttpError("Invalid preset link", null, "invalid-response");
  return `/api/skin-presets/${slug}`;
}

async function requestJson(method: "GET" | "POST" | "PATCH", path: string, input?: unknown, options?: PresetRequestOptions): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(path, {
      method, credentials: "include", cache: "no-store",
      headers: input === undefined ? { Accept: "application/json" } : { Accept: "application/json", "Content-Type": "application/json" },
      ...(input === undefined ? {} : { body: JSON.stringify(input) }),
      signal: options?.signal,
    });
  } catch {
    if (options?.signal?.aborted) throw new PresetHttpError("Preset request cancelled", null, "aborted");
    throw new PresetHttpError("Preset service is unreachable", null, "network");
  }

  let body: unknown;
  try { body = await response.json(); }
  catch {
    if (!response.ok) throw new PresetHttpError("Preset service returned an error", response.status, "http");
    return invalid();
  }
  if (!response.ok) {
    const message = has(body) && typeof body.error === "string" && body.error.length <= 200 && !/[\u0000-\u001f\u007f<>]/u.test(body.error)
      ? body.error : "Preset service returned an error";
    throw new PresetHttpError(message, response.status, "http");
  }
  return body;
}

async function parseView(value: unknown): Promise<PresetView> {
  if (!has(value)) return invalid();
  const keys = ["id", "slug", "sourcePresetId", "currentRevision", "createdAt", "revision", "name", "description", "visibility", "preset", "contentHash"];
  if (Object.keys(value).length !== keys.length || keys.some(key => !(key in value))) return invalid();
  if (typeof value.id !== "string" || !idPattern.test(value.id) || typeof value.slug !== "string" || !slugPattern.test(value.slug)) return invalid();
  if (value.sourcePresetId !== null && (typeof value.sourcePresetId !== "string" || !idPattern.test(value.sourcePresetId))) return invalid();
  if (!Number.isSafeInteger(value.currentRevision) || (value.currentRevision as number) < 1 ||
      !Number.isSafeInteger(value.revision) || (value.revision as number) < 1 || (value.revision as number) > (value.currentRevision as number)) return invalid();
  if (typeof value.createdAt !== "string" || Number.isNaN(Date.parse(value.createdAt)) ||
      typeof value.name !== "string" || !value.name.trim() || typeof value.description !== "string" ||
      (value.visibility !== "unlisted" && value.visibility !== "public") ||
      typeof value.contentHash !== "string" || !hashPattern.test(value.contentHash)) return invalid();
  if (!has(value.preset) || value.preset.contentHash !== value.contentHash) return invalid();
  try { await importMonoPalettePreset(JSON.stringify(value.preset)); }
  catch { return invalid(); }
  return value as PresetView;
}

async function parseList(value: unknown, key: "presets" | "revisions"): Promise<PresetView[]> {
  if (!has(value) || Object.keys(value).length !== 1 || !Array.isArray(value[key])) return invalid();
  return Promise.all(value[key].map(parseView));
}

export const presetClient = {
  async listMine(options?: PresetRequestOptions): Promise<PresetView[]> {
    return parseList(await requestJson("GET", "/api/skin-presets", undefined, options), "presets");
  },
  async create(input: PresetCreateInput, options?: PresetRequestOptions): Promise<PresetView> {
    return parseView(await requestJson("POST", "/api/skin-presets", input, options));
  },
  async read(slug: string, options?: PresetRequestOptions): Promise<PresetView> {
    return parseView(await requestJson("GET", pathFor(slug), undefined, options));
  },
  async revise(slug: string, input: PresetReviseInput, options?: PresetRequestOptions): Promise<PresetView> {
    return parseView(await requestJson("PATCH", pathFor(slug), input, options));
  },
  async fork(slug: string, input: PresetForkInput, options?: PresetRequestOptions): Promise<PresetView> {
    return parseView(await requestJson("POST", `${pathFor(slug)}/fork`, input, options));
  },
  async history(slug: string, options?: PresetRequestOptions): Promise<PresetView[]> {
    return parseList(await requestJson("GET", `${pathFor(slug)}/history`, undefined, options), "revisions");
  },
};
