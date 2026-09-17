import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { normalizeMonoPaletteConfig } from "@wallet/ui";
import { exportMonoPalettePreset } from "../mono-preview/mono-preset-codec";
import { MemoryPresetRepository } from "./preset-service";
import { createPresetHttpHandlers } from "./preset-http";

const origin = "https://wallet.example";
async function validPreset() { return JSON.parse(await exportMonoPalettePreset(normalizeMonoPaletteConfig())); }
function request(path: string, method = "GET", body?: unknown, cookie?: string, extra: Record<string, string> = {}) {
  return new NextRequest(`${origin}${path}`, {
    method,
    headers: { ...(body === undefined ? {} : { "content-type": "application/json", origin }),
      ...(cookie ? { cookie } : {}), ...extra },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
function cookieFrom(response: Response) { return response.headers.get("set-cookie")?.split(";")[0] ?? ""; }

describe("preset HTTP boundary", () => {
  it("creates a private anonymous owner, then lists only that visitor's presets", async () => {
    const repository = new MemoryPresetRepository();
    const api = createPresetHttpHandlers(repository);
    const createdResponse = await api.create(request("/api/skin-presets", "POST", { name: "Графит", preset: await validPreset() }));
    expect(createdResponse.status).toBe(201);
    const cookie = cookieFrom(createdResponse);
    expect(cookie).toMatch(/^wallet4i7_preset_owner=/);
    expect(createdResponse.headers.get("set-cookie")).toMatch(/HttpOnly/);
    expect(createdResponse.headers.get("set-cookie")).toMatch(/SameSite=lax/i);
    const created = await createdResponse.json();
    expect(created.ownerId).toBeUndefined();
    expect(created.slug).toMatch(/^[A-Za-z0-9_-]{32}$/);
    const mine = await api.list(request("/api/skin-presets", "GET", undefined, cookie));
    expect((await mine.json()).presets.map((item: { id: string }) => item.id)).toEqual([created.id]);
    expect((await (await api.list(request("/api/skin-presets"))).json()).presets).toEqual([]);
  });

  it("rejects cross-origin, non-JSON and oversized writes before minting an owner", async () => {
    const repository = new MemoryPresetRepository();
    const inserted = vi.spyOn(repository, "insertOwner");
    const api = createPresetHttpHandlers(repository);
    const body = { name: "Safe", preset: await validPreset() };
    const crossOrigin = await api.create(request("/api/skin-presets", "POST", body, undefined, { origin: "https://attacker.example" }));
    expect(crossOrigin.status).toBe(403);
    expect(crossOrigin.headers.get("set-cookie")).toBeNull();
    const text = await api.create(request("/api/skin-presets", "POST", body, undefined, { "content-type": "text/plain" }));
    expect(text.status).toBe(415);
    const oversized = await api.create(request("/api/skin-presets", "POST", { ...body, padding: "x".repeat(140_000) }));
    expect(oversized.status).toBe(413);
    const invalidName = await api.create(request("/api/skin-presets", "POST", { ...body, name: " " }));
    expect(invalidName.status).toBe(400);
    expect(invalidName.headers.get("set-cookie")).toBeNull();
    expect(inserted).not.toHaveBeenCalled();
  });

  it("reads an unlisted link, denies lost-cookie revision, and allows a fork", async () => {
    const api = createPresetHttpHandlers(new MemoryPresetRepository());
    const sourceResponse = await api.create(request("/api/skin-presets", "POST", { name: "Source", preset: await validPreset() }));
    const source = await sourceResponse.json();
    const sourceCookie = cookieFrom(sourceResponse);
    const opened = await api.read(request(`/api/skin-presets/${source.slug}`), source.slug);
    expect((await opened.json()).id).toBe(source.id);
    const foreignPatch = await api.revise(request(`/api/skin-presets/${source.slug}`, "PATCH", { expectedRevision: 1, name: "Stolen" }), source.slug);
    expect(foreignPatch.status).toBe(403);
    const forkResponse = await api.fork(request(`/api/skin-presets/${source.slug}/fork`, "POST", { name: "My version" }), source.slug);
    expect(forkResponse.status).toBe(201);
    const fork = await forkResponse.json();
    expect(fork.sourcePresetId).toBe(source.id);
    expect(fork.id).not.toBe(source.id);
    const revised = await api.revise(request(`/api/skin-presets/${source.slug}`, "PATCH", { expectedRevision: 1, name: "Updated" }, sourceCookie), source.slug);
    expect(revised.status).toBe(200);
    expect((await revised.json()).revision).toBe(2);
    expect((await api.revise(request(`/api/skin-presets/${source.slug}`, "PATCH", { expectedRevision: 1 }, sourceCookie), source.slug)).status).toBe(409);
    expect((await (await api.history(request(`/api/skin-presets/${source.slug}/history`), source.slug)).json()).revisions).toHaveLength(2);
  });
});
