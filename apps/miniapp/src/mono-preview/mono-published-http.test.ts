import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMonoAppearanceEnvelope } from "./mono-preset-envelope";
import type { MonoPublishRuntimeConfig } from "./mono-published-config";
import { createMonoPublishedHttp } from "./mono-published-http";
import { MonoPublishedStore } from "./mono-published-store";

const primary = "https://wallet.example";
const local = "http://127.0.0.1:3184";
const direct: MonoPublishRuntimeConfig = { editorOrigin: primary, publicOrigin: primary, remoteOrigin: null };
const proxy: MonoPublishRuntimeConfig = { editorOrigin: local, publicOrigin: primary, remoteOrigin: primary };
let roots: string[];
beforeEach(() => { roots = []; });
afterEach(async () => { await Promise.all(roots.map(root => rm(root, { recursive: true, force: true }))); vi.restoreAllMocks(); });
async function store() {
  const root = await mkdtemp(join(tmpdir(), "novex-publish-http-"));
  roots.push(root);
  return new MonoPublishedStore(root);
}
function request(origin: string, slot: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(`${origin}/api/mono-published/${slot}`, { method: "PUT",
    headers: { origin, "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
}
const body = (revision = 0) => ({ expectedRevision: revision, snapshot: createMonoAppearanceEnvelope() });

describe("password-free published MONO HTTP boundary", () => {
  it("stores only an explicit same-origin PUT with no credentials and preserves CAS and durable history", async () => {
    const saved = await store();
    const http = createMonoPublishedHttp(saved, direct);
    expect((await http.get("1")).status).toBe(404);
    const first = await http.put(request(primary, "1", body()), "1");
    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({ slot: 1, revision: 1 });
    expect((await http.put(request(primary, "1", body()), "1")).status).toBe(409);
    expect((await http.put(request(primary, "1", body(1)), "1")).status).toBe(200);
    const current = await http.get("1");
    expect(current.headers.get("cache-control")).toContain("no-store");
    expect(current.headers.get("access-control-allow-origin")).toBeNull();
    expect((await current.json()).revision).toBe(2);
    expect((await saved.read(1))?.revision).toBe(2);
  });

  it("rejects cross-origin, invalid slot, malformed, unknown and oversized bodies before storing", async () => {
    const saved = await store();
    const http = createMonoPublishedHttp(saved, direct);
    expect((await http.put(request(primary, "1", body(), { origin: "https://evil.example" }), "1")).status).toBe(403);
    expect((await http.put(request(primary, "1", body(), { "sec-fetch-site": "cross-site" }), "1")).status).toBe(403);
    expect((await http.put(request(primary, "8", body()), "8")).status).toBe(404);
    expect((await http.put(request(primary, "1", { ...body(), extra: true }), "1")).status).toBe(422);
    expect((await http.put(request(primary, "1", { ...body(), padding: "x".repeat(250_000) }), "1")).status).toBe(413);
    const malformed = new Request(`${primary}/api/mono-published/1`, { method: "PUT",
      headers: { origin: primary, "content-type": "application/json" }, body: "{" });
    expect((await http.put(malformed, "1")).status).toBe(422);
    expect(await saved.read(1)).toBeNull();
  });

  it("proxies local reads and writes only to the fixed HTTPS primary, without forwarding cookies or auth", async () => {
    const localStore = await store(), remoteStore = await store();
    const upstreamHttp = createMonoPublishedHttp(remoteStore, direct);
    const forwarded: Array<{ url: string; init: RequestInit }> = [];
    const upstream = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = String(input);
      forwarded.push({ url, init: init! });
      if (init?.method === "PUT") return upstreamHttp.put(new Request(url, init), "2");
      return upstreamHttp.get("2");
    });
    const http = createMonoPublishedHttp(localStore, proxy, upstream);
    expect(await (await http.config()).json()).toEqual({ publicOrigin: primary });
    expect((await http.get("2")).status).toBe(404);
    expect((await http.put(request(local, "2", body()), "2")).status).toBe(200);
    expect((await http.get("2")).status).toBe(200);
    expect(await localStore.read(2)).toBeNull();
    expect((await remoteStore.read(2))?.revision).toBe(1);
    expect(forwarded.every(call => call.url === `${primary}/api/mono-published/2`)).toBe(true);
    expect(forwarded.every(call => call.init.redirect === "error" && call.init.cache === "no-store")).toBe(true);
    expect(forwarded.every(call => !new Headers(call.init.headers).has("cookie") &&
      !new Headers(call.init.headers).has("authorization") && !new Headers(call.init.headers).has("x-mono-csrf"))).toBe(true);
  });

  it("validates locally before proxying and never falls back to local storage on upstream outage", async () => {
    const localStore = await store();
    const upstream = vi.fn(async (): Promise<Response> => { throw new Error("offline"); });
    const http = createMonoPublishedHttp(localStore, proxy, upstream);
    expect((await http.put(request(local, "2", { ...body(), secret: true }), "2")).status).toBe(422);
    expect(upstream).not.toHaveBeenCalled();
    expect((await http.put(request(local, "2", body()), "2")).status).toBe(503);
    expect((await http.get("2")).status).toBe(503);
    expect(await localStore.read(2)).toBeNull();
  });

  it("refuses redirects and mismatched upstream records instead of serving another slot", async () => {
    const saved = await store();
    const redirected = createMonoPublishedHttp(saved, proxy, vi.fn(async () => Response.redirect("https://evil.example")));
    expect((await redirected.put(request(local, "2", body()), "2")).status).toBe(503);
    const wrong = createMonoPublishedHttp(saved, proxy, vi.fn(async () => Response.json({ slot: 1, revision: 1,
      updatedAt: "2026-09-29T00:00:00.000Z", snapshot: createMonoAppearanceEnvelope() })));
    expect((await wrong.get("2")).status).toBe(503);
    expect(await saved.read(2)).toBeNull();
  });

  it("keeps an explicit local test fixture isolated from the primary", async () => {
    const saved = await store();
    const fixture: MonoPublishRuntimeConfig = { editorOrigin: local, publicOrigin: local, remoteOrigin: null };
    const http = createMonoPublishedHttp(saved, fixture);
    expect(await (await http.config()).json()).toEqual({ publicOrigin: local });
    expect((await http.put(request(local, "7", body()), "7")).status).toBe(200);
    expect((await saved.read(7))?.revision).toBe(1);
  });
});
