import { MAX_PUBLISH_BODY_BYTES, MonoPublishedError, parsePublishBody, parsePublishedSlot } from "./mono-published-contract";
import { attemptMonoPublishLogin, issueMonoPublishSession, monoPublishCookieFromRequest,
  monoPublishCookieHeader, monoPublishCsrfToken, verifyMonoPublishCsrf, verifyMonoPublishSession,
  type MonoPublishSecurity } from "./mono-published-auth";
import { MonoPublishedStore } from "./mono-published-store";

function json(value: unknown, status = 200, extra?: Record<string, string>): Response {
  return Response.json(value, { status, headers: {
    "Cache-Control": "no-store, max-age=0", "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer", ...extra,
  } });
}

function fail(error: unknown): Response {
  if (error instanceof MonoPublishedError) return json({ error: error.message }, error.status);
  return json({ error: "Публикация временно недоступна." }, 503);
}

function checkOrigin(request: Request, config: MonoPublishSecurity): void {
  if (request.headers.get("origin") !== config.origin ||
      (request.headers.has("sec-fetch-site") && request.headers.get("sec-fetch-site") !== "same-origin")) {
    throw new MonoPublishedError("Запрос не из редактора этого сайта.", 403);
  }
}

async function readBoundedJson(request: Request): Promise<unknown> {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") ?? ""))
    throw new MonoPublishedError("Нужен JSON-запрос.", 422);
  const length = request.headers.get("content-length");
  if (length !== null) {
    if (!/^\d+$/.test(length)) throw new MonoPublishedError("Недопустимая длина запроса.", 422);
    if (Number(length) > MAX_PUBLISH_BODY_BYTES) throw new MonoPublishedError("Запрос слишком велик.", 413);
  }
  if (!request.body) throw new MonoPublishedError("Пустой запрос.", 422);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.byteLength;
      if (size > MAX_PUBLISH_BODY_BYTES) throw new MonoPublishedError("Запрос слишком велик.", 413);
      chunks.push(next.value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
  catch { throw new MonoPublishedError("Недопустимый JSON.", 422); }
}

export function createMonoPublishedHttp(store: MonoPublishedStore, security: MonoPublishSecurity | null,
  now: () => number = Date.now) {
  const required = () => {
    if (!security) throw new MonoPublishedError("Публикация не настроена.", 503);
    return security;
  };
  const sessionCookie = (request: Request, config: MonoPublishSecurity) =>
    verifyMonoPublishSession(config.sessionSecret, monoPublishCookieFromRequest(request), now());

  async function get(rawSlot: string): Promise<Response> {
    try {
      const slot = parsePublishedSlot(rawSlot);
      const value = await store.read(slot);
      return value ? json(value) : json({ error: "Публикация пока не создана." }, 404);
    } catch (error) { return fail(error); }
  }

  async function put(request: Request, rawSlot: string): Promise<Response> {
    try {
      const slot = parsePublishedSlot(rawSlot), config = required();
      const cookie = sessionCookie(request, config);
      if (!cookie) throw new MonoPublishedError("Нужен вход владельца.", 401);
      checkOrigin(request, config);
      if (!verifyMonoPublishCsrf(config.sessionSecret, cookie, request.headers.get("x-mono-csrf")))
        throw new MonoPublishedError("Сессия публикации устарела.", 403);
      const body = parsePublishBody(await readBoundedJson(request));
      return json(await store.publish(slot, body.expectedRevision, body.snapshot));
    } catch (error) { return fail(error); }
  }

  async function session(request: Request): Promise<Response> {
    try {
      const config = required(), cookie = sessionCookie(request, config);
      return cookie ? json({ authenticated: true, csrfToken: monoPublishCsrfToken(config.sessionSecret, cookie) })
        : json({ authenticated: false });
    } catch (error) { return fail(error); }
  }

  async function login(request: Request): Promise<Response> {
    try {
      const config = required();
      checkOrigin(request, config);
      const body = await readBoundedJson(request);
      if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).join(",") !== "password" ||
          typeof (body as { password?: unknown }).password !== "string" ||
          (body as { password: string }).password.length > 512) {
        throw new MonoPublishedError("Недопустимый запрос входа.", 422);
      }
      const attempt = await attemptMonoPublishLogin(store, (body as { password: string }).password,
        config.passwordHash, now());
      if (attempt.retryAfter) return json({ error: "Вход временно ограничен. Повторите позже." }, 429,
        { "Retry-After": String(attempt.retryAfter) });
      if (!attempt.ok) return json({ error: "Неверный пароль публикации." }, 401);
      const issued = issueMonoPublishSession(config.sessionSecret, now());
      return json({ authenticated: true, csrfToken: issued.csrfToken }, 200,
        { "Set-Cookie": monoPublishCookieHeader(issued.cookie, config.origin) });
    } catch (error) { return fail(error); }
  }

  async function logout(request: Request): Promise<Response> {
    try {
      const config = required();
      checkOrigin(request, config);
      const cookie = sessionCookie(request, config);
      if (!cookie) throw new MonoPublishedError("Нужен вход владельца.", 401);
      if (!verifyMonoPublishCsrf(config.sessionSecret, cookie, request.headers.get("x-mono-csrf")))
        throw new MonoPublishedError("Сессия публикации устарела.", 403);
      return json({ authenticated: false }, 200,
        { "Set-Cookie": monoPublishCookieHeader("", config.origin, true) });
    } catch (error) { return fail(error); }
  }

  return { get, put, session, login, logout };
}
