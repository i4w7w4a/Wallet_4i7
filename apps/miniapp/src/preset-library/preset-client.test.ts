import { afterEach, describe, expect, it, vi } from "vitest";
import { normalizeMonoPaletteConfig } from "@wallet/ui";
import { exportMonoPalettePreset } from "../mono-preview/mono-preset-codec";
import { PresetHttpError, presetClient } from "./preset-client";

async function presetView() {
  const preset = JSON.parse(await exportMonoPalettePreset(normalizeMonoPaletteConfig()));
  return {
    id: "00000000-0000-4000-8000-000000000001",
    slug: "a".repeat(32),
    sourcePresetId: null,
    currentRevision: 1,
    createdAt: "2026-09-17T10:00:00.000Z",
    revision: 1,
    name: "Графит",
    description: "Тихая палитра",
    visibility: "unlisted" as const,
    preset,
    contentHash: preset.contentHash as string,
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("preset browser client", () => {
  it("lists only the server-owned presets with a credentialed uncached request", async () => {
    const item = await presetView();
    const fetcher = vi.fn(async () => Response.json({ presets: [item] }));
    vi.stubGlobal("fetch", fetcher);
    const controller = new AbortController();

    const listed = await presetClient.listMine({ signal: controller.signal });

    expect(listed).toEqual([item]);
    expect(fetcher).toHaveBeenCalledWith("/api/skin-presets", {
      method: "GET", credentials: "include", cache: "no-store",
      headers: { Accept: "application/json" }, signal: controller.signal,
    });
  });

  it("creates a named preset with the complete envelope in one explicit POST", async () => {
    const item = await presetView();
    const fetcher = vi.fn(async () => Response.json(item, { status: 201 }));
    vi.stubGlobal("fetch", fetcher);

    const created = await presetClient.create({ name: "Графит", description: "Тихая палитра", preset: item.preset });

    expect(created.id).toBe(item.id);
    expect(fetcher).toHaveBeenCalledWith("/api/skin-presets", {
      method: "POST", credentials: "include", cache: "no-store",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Графит", description: "Тихая палитра", preset: item.preset }),
      signal: undefined,
    });
  });

  it("reads a shared preset by its unguessable slug without claiming ownership", async () => {
    const item = await presetView();
    const fetcher = vi.fn(async () => Response.json(item));
    vi.stubGlobal("fetch", fetcher);

    const read = await presetClient.read(item.slug);

    expect(read).toEqual(item);
    expect(fetcher).toHaveBeenCalledWith(`/api/skin-presets/${item.slug}`, {
      method: "GET", credentials: "include", cache: "no-store",
      headers: { Accept: "application/json" }, signal: undefined,
    });
  });

  it("revises a preset with an explicit expected revision and full edited snapshot", async () => {
    const item = await presetView();
    const revised = { ...item, revision: 2, currentRevision: 2, name: "Новая версия" };
    const fetcher = vi.fn(async () => Response.json(revised));
    vi.stubGlobal("fetch", fetcher);

    const result = await presetClient.revise(item.slug, { expectedRevision: 1, name: "Новая версия", preset: item.preset });

    expect(result.revision).toBe(2);
    expect(fetcher).toHaveBeenCalledWith(`/api/skin-presets/${item.slug}`, {
      method: "PATCH", credentials: "include", cache: "no-store",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ expectedRevision: 1, name: "Новая версия", preset: item.preset }),
      signal: undefined,
    });
  });

  it("forks a foreign preset while sending the visitor's edited envelope", async () => {
    const item = await presetView();
    const forked = { ...item, id: "00000000-0000-4000-8000-000000000002", sourcePresetId: item.id };
    const fetcher = vi.fn(async () => Response.json(forked, { status: 201 }));
    vi.stubGlobal("fetch", fetcher);

    const result = await presetClient.fork(item.slug, { name: "Моя версия", preset: item.preset });

    expect(result.sourcePresetId).toBe(item.id);
    expect(fetcher).toHaveBeenCalledWith(`/api/skin-presets/${item.slug}/fork`, {
      method: "POST", credentials: "include", cache: "no-store",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Моя версия", preset: item.preset }),
      signal: undefined,
    });
  });

  it("returns immutable revisions from the history endpoint", async () => {
    const item = await presetView();
    const fetcher = vi.fn(async () => Response.json({ revisions: [item, { ...item, revision: 2, currentRevision: 2 }] }));
    vi.stubGlobal("fetch", fetcher);

    const revisions = await presetClient.history(item.slug);

    expect(revisions.map(entry => entry.revision)).toEqual([1, 2]);
    expect(fetcher).toHaveBeenCalledWith(`/api/skin-presets/${item.slug}/history`, {
      method: "GET", credentials: "include", cache: "no-store",
      headers: { Accept: "application/json" }, signal: undefined,
    });
  });

  it("preserves the HTTP status of a revision conflict", async () => {
    const item = await presetView();
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: "Preset revision conflict" }, { status: 409 })));

    await expect(presetClient.revise(item.slug, { expectedRevision: 1 })).rejects.toMatchObject({
      name: "PresetHttpError", status: 409, message: "Preset revision conflict",
    });
  });

  it("rejects malformed success payloads instead of passing them into the editor", async () => {
    const item = await presetView();
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ presets: [{ ...item, contentHash: "wrong" }] })));

    await expect(presetClient.listMine()).rejects.toBeInstanceOf(PresetHttpError);
  });

  it("turns a network failure into a typed non-HTTP error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));

    await expect(presetClient.listMine()).rejects.toMatchObject({ name: "PresetHttpError", status: null });
  });

  it("does not expose a non-JSON proxy error page as a preset or raw markup", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>gateway down</html>", { status: 502, headers: { "Content-Type": "text/html" } })));

    await expect(presetClient.listMine()).rejects.toMatchObject({ name: "PresetHttpError", status: 502 });
  });
});
