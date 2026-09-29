import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createMonoAppearanceEnvelope } from "./mono-preset-envelope";
import { hashMonoPublishPassword } from "./mono-published-auth";
import { createMonoPublishedHttp } from "./mono-published-http";
import { MonoPublishedStore } from "./mono-published-store";

const origin = "https://wallet.example";
let root: string;
let now: number;
let store: MonoPublishedStore;
let security: { origin: string; passwordHash: string; sessionSecret: string };

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "novex-published-http-test-"));
  store = new MonoPublishedStore(root);
  now = Date.parse("2026-09-29T06:00:00.000Z");
  security = { origin, passwordHash: await hashMonoPublishPassword("only-owner-knows-this"),
    sessionSecret: Buffer.alloc(32, 17).toString("base64url") };
});
afterEach(async () => { await rm(root, { recursive: true, force: true }); });

function request(method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Request {
  return new Request(`${origin}${path}`, { method, headers: {
    ...(body === undefined ? {} : { "content-type": "application/json" }), ...headers,
  }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}

async function authenticated() {
  const http = createMonoPublishedHttp(store, security, () => now);
  const response = await http.login(request("POST", "/api/mono-published/session", {
    password: "only-owner-knows-this",
  }, { origin }));
  expect(response.status).toBe(200);
  const { csrfToken } = await response.json();
  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  expect(cookie).toBeTruthy();
  return { http, csrfToken: csrfToken as string, cookie: cookie! };
}

describe("published MONO HTTP boundary", () => {
  it("serves a stable public path with no auth and no caching after each explicit revision", async () => {
    const { http, csrfToken, cookie } = await authenticated();
    const missing = await http.get("1");
    expect(missing.status).toBe(404);
    expect(missing.headers.get("cache-control")).toContain("no-store");
    const first = await http.put(request("PUT", "/api/mono-published/1", {
      expectedRevision: 0, snapshot: createMonoAppearanceEnvelope(),
    }, { origin, cookie, "x-mono-csrf": csrfToken }), "1");
    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({ slot: 1, revision: 1 });
    const second = await http.put(request("PUT", "/api/mono-published/1", {
      expectedRevision: 1, snapshot: createMonoAppearanceEnvelope("frost"),
    }, { origin, cookie, "x-mono-csrf": csrfToken }), "1");
    expect(second.status).toBe(200);
    expect((await (await http.get("1")).json()).snapshot.appearance.preset).toBe("frost");
    expect((await http.get("2")).status).toBe(404);
  });

  it("keeps writes closed without an authenticated session, origin and CSRF token", async () => {
    const http = createMonoPublishedHttp(store, security, () => now);
    const payload = { expectedRevision: 0, snapshot: createMonoAppearanceEnvelope() };
    expect((await http.put(request("PUT", "/api/mono-published/1", payload, { origin }), "1")).status).toBe(401);
    const { csrfToken, cookie } = await authenticated();
    expect((await http.put(request("PUT", "/api/mono-published/1", payload, { cookie, "x-mono-csrf": csrfToken }), "1")).status).toBe(403);
    expect((await http.put(request("PUT", "/api/mono-published/1", payload,
      { origin: "https://evil.example", cookie, "x-mono-csrf": csrfToken }), "1")).status).toBe(403);
    expect((await http.put(request("PUT", "/api/mono-published/1", payload,
      { origin, cookie, "x-mono-csrf": csrfToken, "sec-fetch-site": "cross-site" }), "1")).status).toBe(403);
    expect((await http.put(request("PUT", "/api/mono-published/1", payload, { origin, cookie }), "1")).status).toBe(403);
    expect(await store.read(1)).toBeNull();
  });

  it("limits wrong passwords persistently and issues an expiring HttpOnly HTTPS session", async () => {
    const http = createMonoPublishedHttp(store, security, () => now);
    for (let attempt = 0; attempt < 5; attempt++) {
      const rejected = await http.login(request("POST", "/api/mono-published/session", { password: "wrong" }, { origin }));
      expect(rejected.status).toBe(401);
      expect(rejected.headers.get("set-cookie")).toBeNull();
    }
    const fresh = createMonoPublishedHttp(new MonoPublishedStore(root), security, () => now);
    const blocked = await fresh.login(request("POST", "/api/mono-published/session", {
      password: "only-owner-knows-this",
    }, { origin }));
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("retry-after"))).toBeGreaterThan(0);
    now += 5 * 60_000 + 1;
    const accepted = await fresh.login(request("POST", "/api/mono-published/session", {
      password: "only-owner-knows-this",
    }, { origin }));
    expect(accepted.status).toBe(200);
    const cookie = accepted.headers.get("set-cookie")!;
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");
    expect(cookie).toContain("Secure");
    expect(cookie).not.toContain("only-owner-knows-this");
    const session = await fresh.session(request("GET", "/api/mono-published/session", undefined, { cookie: cookie.split(";")[0]! }));
    expect(await session.json()).toMatchObject({ authenticated: true, csrfToken: expect.any(String) });
    now += 3 * 60 * 60_000;
    const expired = await fresh.session(request("GET", "/api/mono-published/session", undefined, { cookie: cookie.split(";")[0]! }));
    expect(await expired.json()).toEqual({ authenticated: false });
  });

  it("rejects oversized/malformed/unknown payloads, stale revisions and unsupported slots", async () => {
    const { http, csrfToken, cookie } = await authenticated();
    const auth = { origin, cookie, "x-mono-csrf": csrfToken };
    expect((await http.get("01")).status).toBe(404);
    expect((await http.put(request("PUT", "/api/mono-published/8", {
      expectedRevision: 0, snapshot: createMonoAppearanceEnvelope(),
    }, auth), "8")).status).toBe(404);
    expect((await http.put(request("PUT", "/api/mono-published/1", {
      expectedRevision: 0, snapshot: { ...createMonoAppearanceEnvelope(), secret: "x" },
    }, auth), "1")).status).toBe(422);
    expect((await http.put(request("PUT", "/api/mono-published/1", {
      expectedRevision: 0, snapshot: createMonoAppearanceEnvelope(), extra: true,
    }, auth), "1")).status).toBe(422);
    expect((await http.put(request("PUT", "/api/mono-published/1", {
      expectedRevision: 0, snapshot: createMonoAppearanceEnvelope(), padding: "x".repeat(250_000),
    }, auth), "1")).status).toBe(413);
    const malformed = new Request(`${origin}/api/mono-published/1`, { method: "PUT",
      headers: { ...auth, "content-type": "application/json" }, body: "{" });
    expect((await http.put(malformed, "1")).status).toBe(422);
    const deep = JSON.parse("[".repeat(40) + "0" + "]".repeat(40));
    expect((await http.put(request("PUT", "/api/mono-published/1", {
      expectedRevision: 0, snapshot: deep,
    }, auth), "1")).status).toBe(422);
    expect((await http.put(request("PUT", "/api/mono-published/1", {
      expectedRevision: 0, snapshot: createMonoAppearanceEnvelope(),
    }, auth), "1")).status).toBe(200);
    expect((await http.put(request("PUT", "/api/mono-published/1", {
      expectedRevision: 0, snapshot: createMonoAppearanceEnvelope("frost"),
    }, auth), "1")).status).toBe(409);
  });

  it("fails closed when publishing secrets are unconfigured while keeping reads public", async () => {
    const http = createMonoPublishedHttp(store, null, () => now);
    expect((await http.login(request("POST", "/api/mono-published/session", { password: "x" }, { origin }))).status).toBe(503);
    expect((await http.put(request("PUT", "/api/mono-published/1", {
      expectedRevision: 0, snapshot: createMonoAppearanceEnvelope(),
    }, { origin }), "1")).status).toBe(503);
    expect((await http.get("1")).status).toBe(404);
  });

  it("rejects login without the configured origin and rejects a tampered session cookie", async () => {
    const http = createMonoPublishedHttp(store, security, () => now);
    expect((await http.login(request("POST", "/api/mono-published/session", {
      password: "only-owner-knows-this",
    }))).status).toBe(403);
    expect((await http.login(request("POST", "/api/mono-published/session", {
      password: "only-owner-knows-this",
    }, { origin: "https://evil.example" }))).status).toBe(403);
    const { cookie, csrfToken } = await authenticated();
    const tampered = `${cookie.slice(0, -1)}${cookie.endsWith("A") ? "B" : "A"}`;
    expect((await http.put(request("PUT", "/api/mono-published/1", {
      expectedRevision: 0, snapshot: createMonoAppearanceEnvelope(),
    }, { origin, cookie: tampered, "x-mono-csrf": csrfToken }), "1")).status).toBe(401);
    expect(await store.read(1)).toBeNull();
  });
});
