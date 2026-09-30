import { MAX_PUBLISH_BODY_BYTES, MonoPublishedError, parsePublishBody, parsePublishedRecord,
  parsePublishedSlot, type MonoPublishedSlot } from "./mono-published-contract";
import type { MonoPublishRuntimeConfig } from "./mono-published-config";
import { MonoPublishedStore } from "./mono-published-store";

const UPSTREAM_TIMEOUT_MS = 5_000;
const MAX_RECORD_BYTES = MAX_PUBLISH_BODY_BYTES + 2_048;

function json(value: unknown, status = 200): Response {
  return Response.json(value, { status, headers: {
    "Cache-Control": "no-store, max-age=0", "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  } });
}

function fail(error: unknown): Response {
  if (error instanceof MonoPublishedError) return json({ error: error.message }, error.status);
  return json({ error: "Публикация временно недоступна." }, 503);
}

/** An Origin check avoids accidental browser cross-site writes; it is not authentication. */
function checkOrigin(request: Request, config: MonoPublishRuntimeConfig): void {
  if (request.headers.get("origin") !== config.editorOrigin ||
      (request.headers.has("sec-fetch-site") && request.headers.get("sec-fetch-site") !== "same-origin")) {
    throw new MonoPublishedError("Запрос не из редактора этого сайта.", 403);
  }
}

async function readBoundedJson(source: Request | Response, limit = MAX_PUBLISH_BODY_BYTES): Promise<unknown> {
  if (!/^application\/json(?:\s*;|$)/i.test(source.headers.get("content-type") ?? ""))
    throw new MonoPublishedError("Нужен JSON-запрос.", 422);
  const length = source.headers.get("content-length");
  if (length !== null) {
    if (!/^\d+$/.test(length)) throw new MonoPublishedError("Недопустимая длина запроса.", 422);
    if (Number(length) > limit) throw new MonoPublishedError("Запрос слишком велик.", 413);
  }
  if (!source.body) throw new MonoPublishedError("Пустой запрос.", 422);
  const reader = source.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.byteLength;
      if (size > limit) throw new MonoPublishedError("Запрос слишком велик.", 413);
      chunks.push(next.value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
  catch { throw new MonoPublishedError("Недопустимый JSON.", 422); }
}

/** Local development forwards to one operator-configured HTTPS origin; it never writes a local fallback. */
export function createMonoPublishedHttp(store: MonoPublishedStore, config: MonoPublishRuntimeConfig | null,
  fetchUpstream: typeof fetch = fetch) {
  const required = () => {
    if (!config) throw new MonoPublishedError("Публикация не настроена.", 503);
    return config;
  };
  const remoteUrl = (slot: MonoPublishedSlot, origin: string) => `${origin}/api/mono-published/${slot}`;
  async function upstreamRecord(response: Response, slot: MonoPublishedSlot) {
    try { return parsePublishedRecord(await readBoundedJson(response, MAX_RECORD_BYTES), slot); }
    catch { throw new MonoPublishedError("Основной сервер вернул неверную публикацию.", 503); }
  }

  async function get(rawSlot: string): Promise<Response> {
    try {
      const slot = parsePublishedSlot(rawSlot), runtime = required();
      if (runtime.remoteOrigin) {
        const response = await fetchUpstream(remoteUrl(slot, runtime.remoteOrigin), {
          method: "GET", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
          headers: { accept: "application/json" },
        });
        if (response.status === 404) return json({ error: "Публикация пока не создана." }, 404);
        if (!response.ok) throw new MonoPublishedError("Основной сервер недоступен.", 503);
        return json(await upstreamRecord(response, slot));
      }
      const value = await store.read(slot);
      return value ? json(value) : json({ error: "Публикация пока не создана." }, 404);
    } catch (error) { return fail(error); }
  }

  async function put(request: Request, rawSlot: string): Promise<Response> {
    try {
      const slot = parsePublishedSlot(rawSlot), runtime = required();
      checkOrigin(request, runtime);
      const body = parsePublishBody(await readBoundedJson(request));
      if (runtime.remoteOrigin) {
        const response = await fetchUpstream(remoteUrl(slot, runtime.remoteOrigin), {
          method: "PUT", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
          headers: { "content-type": "application/json", origin: runtime.remoteOrigin },
          body: JSON.stringify(body),
        });
        if (response.status === 409) return json({ error: "Публикация изменилась. Обновите статус." }, 409);
        if (response.status === 413) return json({ error: "Снимок слишком велик." }, 413);
        if (response.status === 422) return json({ error: "Снимок не прошёл проверку." }, 422);
        if (response.status === 403) return json({ error: "Основной сервер отклонил запрос." }, 403);
        if (!response.ok) throw new MonoPublishedError("Основной сервер не сохранил публикацию.", 503);
        return json(await upstreamRecord(response, slot));
      }
      return json(await store.publish(slot, body.expectedRevision, body.snapshot));
    } catch (error) { return fail(error); }
  }

  function publicConfig(): Response {
    try { return json({ publicOrigin: required().publicOrigin }); }
    catch (error) { return fail(error); }
  }

  return { get, put, config: publicConfig };
}
