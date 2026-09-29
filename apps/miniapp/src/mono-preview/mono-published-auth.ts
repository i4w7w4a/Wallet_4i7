import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { open } from "node:fs/promises";
import { join } from "node:path";
import { MonoPublishedError } from "./mono-published-contract";
import { MonoPublishedStore, writePublishedAtomic } from "./mono-published-store";

const COST = 16_384;
const SESSION_MS = 2 * 60 * 60_000;
const LOCKOUT_MS = 5 * 60_000;
const ATTEMPT_LIMIT = 5;
export const MONO_PUBLISH_COOKIE = "mono_publish_session";

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => scryptCallback(password, salt, 32,
    { N: COST, r: 8, p: 1 }, (error, result) => error ? reject(error) : resolve(result)));
}

export type MonoPublishSecurity = Readonly<{ origin: string; passwordHash: string; sessionSecret: string }>;

function decodeSecret(secret: string): Buffer | null {
  if (!/^[A-Za-z0-9_-]{43}$/.test(secret)) return null;
  const bytes = Buffer.from(secret, "base64url");
  return bytes.length === 32 && bytes.toString("base64url") === secret ? bytes : null;
}

function passwordHashParts(raw: string): { salt: Buffer; hash: Buffer } | null {
  const parts = raw.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt" || parts[1] !== String(COST) ||
      parts[2] !== "8" || parts[3] !== "1") return null;
  const salt = Buffer.from(parts[4]!, "base64url"), hash = Buffer.from(parts[5]!, "base64url");
  if (salt.length !== 16 || hash.length !== 32 || salt.toString("base64url") !== parts[4] ||
      hash.toString("base64url") !== parts[5]) return null;
  return { salt, hash };
}

export function parseMonoPublishSecurity(env: NodeJS.ProcessEnv = process.env): MonoPublishSecurity | null {
  const origin = env.MONO_PUBLISH_ORIGIN, passwordHash = env.MONO_PUBLISH_PASSWORD_SCRYPT,
    sessionSecret = env.MONO_PUBLISH_SESSION_SECRET;
  if (!origin || !passwordHash || !sessionSecret || !passwordHashParts(passwordHash) || !decodeSecret(sessionSecret)) return null;
  let parsed: URL;
  try { parsed = new URL(origin); } catch { return null; }
  if (parsed.origin !== origin || parsed.pathname !== "/" || parsed.search || parsed.hash || parsed.username || parsed.password ||
      (parsed.protocol !== "https:" && !(env.NODE_ENV !== "production" && parsed.protocol === "http:" &&
      (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1")))) return null;
  return { origin, passwordHash, sessionSecret };
}

export async function hashMonoPublishPassword(password: string, salt = randomBytes(16)): Promise<string> {
  if (typeof password !== "string" || password.length < 12 || password.length > 512 || salt.length !== 16)
    throw new TypeError("Invalid publication password input.");
  const hash = await derive(password, salt);
  return `scrypt$${COST}$8$1$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const parts = passwordHashParts(encoded);
  if (!parts || password.length < 1 || password.length > 512) return false;
  const candidate = await derive(password, parts.salt);
  return timingSafeEqual(candidate, parts.hash);
}

type Attempts = { failures: number; blockedUntil: number };
async function readAttempts(directory: string): Promise<Attempts> {
  const path = join(directory, "auth-attempts.json");
  let file;
  try { file = await open(path, "r"); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { failures: 0, blockedUntil: 0 };
    throw new MonoPublishedError("Защита публикации недоступна.", 503);
  }
  try {
    if ((await file.stat()).size > 512) throw new Error("Oversized throttle state");
    const value: unknown = JSON.parse(await file.readFile("utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value) ||
        Object.keys(value).sort().join(",") !== "blockedUntil,failures") throw new Error("Invalid throttle state");
    const state = value as Attempts;
    if (!Number.isSafeInteger(state.failures) || state.failures < 0 || !Number.isSafeInteger(state.blockedUntil) || state.blockedUntil < 0)
      throw new Error("Invalid throttle state");
    return state;
  } catch { throw new MonoPublishedError("Защита публикации недоступна.", 503); }
  finally { await file.close(); }
}

export async function attemptMonoPublishLogin(store: MonoPublishedStore, password: string,
  encodedHash: string, now: number): Promise<{ ok: boolean; retryAfter?: number }> {
  return store.withLock(async directory => {
    const path = join(directory, "auth-attempts.json");
    const before = await readAttempts(directory);
    if (before.blockedUntil > now) return { ok: false, retryAfter: Math.ceil((before.blockedUntil - now) / 1000) };
    const matched = await verifyPassword(password, encodedHash);
    if (matched) {
      await writePublishedAtomic(path, JSON.stringify({ failures: 0, blockedUntil: 0 }));
      return { ok: true };
    }
    const failures = before.blockedUntil <= now && before.blockedUntil !== 0 ? 1 : before.failures + 1;
    await writePublishedAtomic(path, JSON.stringify({ failures,
      blockedUntil: failures >= ATTEMPT_LIMIT ? now + LOCKOUT_MS : 0 }));
    return { ok: false };
  });
}

function mac(secret: string, value: string): string {
  return createHmac("sha256", decodeSecret(secret)!).update(value).digest("base64url");
}

export function issueMonoPublishSession(secret: string, now: number): { cookie: string; csrfToken: string } {
  const payload = `v1.${Math.floor(now)}.${randomBytes(16).toString("base64url")}`;
  const cookie = `${payload}.${mac(secret, payload)}`;
  return { cookie, csrfToken: mac(secret, `csrf:${cookie}`) };
}

export function verifyMonoPublishSession(secret: string, cookie: string | null, now: number): string | null {
  const match = cookie?.match(/^(v1\.(\d{13})\.[A-Za-z0-9_-]{22})\.([A-Za-z0-9_-]{43})$/);
  if (!match || !decodeSecret(secret)) return null;
  const issued = Number(match[2]);
  if (!Number.isSafeInteger(issued) || issued > now + 60_000 || now - issued >= SESSION_MS) return null;
  const expected = Buffer.from(mac(secret, match[1]!), "base64url"), supplied = Buffer.from(match[3]!, "base64url");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected) ? cookie! : null;
}

export function monoPublishCsrfToken(secret: string, cookie: string): string { return mac(secret, `csrf:${cookie}`); }

export function verifyMonoPublishCsrf(secret: string, cookie: string, supplied: string | null): boolean {
  if (!supplied || !/^[A-Za-z0-9_-]{43}$/.test(supplied)) return false;
  const expected = Buffer.from(monoPublishCsrfToken(secret, cookie), "base64url");
  const candidate = Buffer.from(supplied, "base64url");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

export function monoPublishCookieHeader(value: string, origin: string, clear = false): string {
  return `${MONO_PUBLISH_COOKIE}=${clear ? "" : value}; Path=/api/mono-published; HttpOnly; SameSite=Strict; ` +
    `${origin.startsWith("https:") ? "Secure; " : ""}Max-Age=${clear ? 0 : SESSION_MS / 1000}`;
}

export function monoPublishCookieFromRequest(request: Request): string | null {
  const prefix = `${MONO_PUBLISH_COOKIE}=`;
  const matches = (request.headers.get("cookie") ?? "").split(";").map(part => part.trim()).filter(part => part.startsWith(prefix));
  return matches.length === 1 ? matches[0]!.slice(prefix.length) : null;
}
