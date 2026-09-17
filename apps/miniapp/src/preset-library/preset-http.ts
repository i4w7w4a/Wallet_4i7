import { NextResponse, type NextRequest } from "next/server";
import { PRESET_OWNER_COOKIE_NAME, getOrCreatePresetOwner, ownerCookieOptions, resolvePresetOwner } from "./preset-owner";
import { createPresetService, validatePresetEnvelope, validatePresetMetadata } from "./preset-service";
import { PresetServiceError, type PresetRepository } from "./preset-types";

const MAX_BODY_BYTES = 150_000;
const SLUG = /^[A-Za-z0-9_-]{32}$/;
type JsonObject = Record<string, unknown>;

function json(value: unknown, status = 200): NextResponse {
  const response = NextResponse.json(value, { status });
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("X-Content-Type-Options", "nosniff");
  return response;
}

function fail(error: unknown): NextResponse {
  if (error instanceof PresetServiceError) {
    const response = json({ error: error.message }, error.status);
    if (error.status === 429) response.headers.set("Retry-After", "3600");
    return response;
  }
  return json({ error: "Preset service unavailable" }, 503);
}

function checkOrigin(request: NextRequest): void {
  const origin = request.headers.get("origin");
  if ((origin && origin !== request.nextUrl.origin) || request.headers.get("sec-fetch-site") === "cross-site")
    throw new PresetServiceError("Cross-origin write is not allowed", 403);
}

async function readBody(request: NextRequest, allowed: readonly string[]): Promise<JsonObject> {
  checkOrigin(request);
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") ?? ""))
    throw new PresetServiceError("JSON content type is required", 415);
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_BODY_BYTES) throw new PresetServiceError("Request body is too large", 413);
  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) throw new PresetServiceError("Request body is too large", 413);
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new PresetServiceError("Invalid JSON body", 400); }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new PresetServiceError("Invalid JSON body", 400);
  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new PresetServiceError(`Unknown field ${key}`, 400);
  return value as JsonObject;
}

function slugOrThrow(slug: string): string {
  if (!SLUG.test(slug)) throw new PresetServiceError("Preset not found", 404);
  return slug;
}

function revisionQuery(request: NextRequest): number | undefined {
  const raw = request.nextUrl.searchParams.get("revision");
  if (raw === null) return undefined;
  const number = Number(raw);
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(number) || number < 1) throw new PresetServiceError("Invalid revision", 400);
  return number;
}

export function createPresetHttpHandlers(repository: PresetRepository) {
  const service = createPresetService(repository);
  const cookieValue = (request: NextRequest) => request.cookies.get(PRESET_OWNER_COOKIE_NAME)?.value;
  const owner = (request: NextRequest) => resolvePresetOwner(repository, cookieValue(request));
  const issueCookie = (response: NextResponse, value: string) =>
    response.cookies.set(PRESET_OWNER_COOKIE_NAME, value, ownerCookieOptions(process.env.NODE_ENV));

  async function list(request: NextRequest): Promise<NextResponse> {
    try { return json({ presets: await service.listMine((await owner(request)) ?? "") }); }
    catch (error) { return fail(error); }
  }

  async function create(request: NextRequest): Promise<NextResponse> {
    try {
      const body = await readBody(request, ["name", "description", "visibility", "preset"]);
      validatePresetMetadata(body);
      await validatePresetEnvelope(body.preset);
      const identity = await getOrCreatePresetOwner(repository, cookieValue(request));
      const preset = await service.create({ ownerId: identity.ownerId, name: body.name as string,
        description: body.description as string | undefined, visibility: body.visibility as "unlisted" | "public" | undefined,
        preset: body.preset });
      const response = json(preset, 201);
      if (identity.issued) issueCookie(response, identity.cookieValue);
      return response;
    } catch (error) { return fail(error); }
  }

  async function read(request: NextRequest, slug: string): Promise<NextResponse> {
    try {
      const preset = await service.read(slugOrThrow(slug), revisionQuery(request));
      return preset ? json(preset) : json({ error: "Preset not found" }, 404);
    } catch (error) { return fail(error); }
  }

  async function revise(request: NextRequest, slug: string): Promise<NextResponse> {
    try {
      const body = await readBody(request, ["expectedRevision", "name", "description", "visibility", "preset"]);
      const ownerId = await owner(request);
      if (!ownerId) throw new PresetServiceError("This preset belongs to another visitor", 403);
      const source = await service.read(slugOrThrow(slug));
      if (!source) throw new PresetServiceError("Preset not found", 404);
      return json(await service.revise({ id: source.id, ownerId, expectedRevision: body.expectedRevision as number,
        name: body.name as string | undefined, description: body.description as string | undefined,
        visibility: body.visibility as "unlisted" | "public" | undefined, preset: body.preset }));
    } catch (error) { return fail(error); }
  }

  async function fork(request: NextRequest, slug: string): Promise<NextResponse> {
    try {
      const body = await readBody(request, ["name"]);
      validatePresetMetadata(body);
      const sourceSlug = slugOrThrow(slug);
      if (!await service.read(sourceSlug)) throw new PresetServiceError("Preset not found", 404);
      const identity = await getOrCreatePresetOwner(repository, cookieValue(request));
      const preset = await service.fork({ slug: sourceSlug, ownerId: identity.ownerId, name: body.name as string });
      const response = json(preset, 201);
      if (identity.issued) issueCookie(response, identity.cookieValue);
      return response;
    } catch (error) { return fail(error); }
  }

  async function history(_request: NextRequest, slug: string): Promise<NextResponse> {
    try { return json({ revisions: await service.history(slugOrThrow(slug)) }); }
    catch (error) { return fail(error); }
  }

  async function remove(request: NextRequest, slug: string): Promise<NextResponse> {
    try {
      checkOrigin(request);
      const ownerId = await owner(request);
      if (!ownerId) throw new PresetServiceError("This preset belongs to another visitor", 403);
      const source = await service.read(slugOrThrow(slug));
      if (!source) throw new PresetServiceError("Preset not found", 404);
      await service.remove({ id: source.id, ownerId });
      return json({ deleted: true });
    } catch (error) { return fail(error); }
  }

  return { list, create, read, revise, fork, history, remove };
}
