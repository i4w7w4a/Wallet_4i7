import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";
import { normalizeMonoPaletteConfig } from "@wallet/ui";
import type { PresetView } from "../preset-library/preset-types";
import { exportMonoPalettePreset } from "./mono-preset-codec";
import { MonoPresetLibrary } from "./mono-preset-library";
import type { MonoColorLabState } from "./mono-color-lab";

const config = normalizeMonoPaletteConfig();
let preset: PresetView["preset"];
const own = (overrides: Partial<PresetView> = {}): PresetView => ({
  id: "11111111-1111-4111-8111-111111111111", slug: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", sourcePresetId: null, currentRevision: 1,
  createdAt: "2026-09-17T00:00:00.000Z", revision: 1, name: "Обсидиан",
  description: "", visibility: "unlisted", preset, contentHash: preset.contentHash,
  ...overrides,
});
function lab(overrides: Record<string, unknown> = {}) {
  return {
    ready: true, busy: false, present: { config, paletteEnabled: true },
    workspace: { compare: "draft" }, activeRemoteSource: null,
    previewRemotePreset: vi.fn(), status: "", setStatus: vi.fn(),
    ...overrides,
  } as unknown as MonoColorLabState;
}

beforeEach(async () => {
  vi.stubGlobal("crypto", webcrypto);
  preset = JSON.parse(await exportMonoPalettePreset(config)) as PresetView["preset"];
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); window.history.replaceState({}, "", "/"); });

describe("remote preset library", () => {
  it("shows owned palette metadata and saves only after explicit action", async () => {
    const writes: unknown[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (!init || init.method === "GET") return Response.json({ presets: [own()] });
      writes.push(JSON.parse(String(init.body)));
      return Response.json(own({ id: "22222222-2222-4222-8222-222222222222", slug: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", name: "Мрамор" }), { status: 201 });
    }));
    render(<MonoPresetLibrary lab={lab()} />);
    const card = await screen.findByRole("article", { name: "Обсидиан" });
    expect(within(card).getByText("Ревизия 1")).toBeInTheDocument();
    expect(within(card).getByText("По ссылке")).toBeInTheDocument();
    expect(within(card).getByLabelText("Dark палитра")).toBeInTheDocument();
    expect(within(card).getByLabelText("Light палитра")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Название для сервера" }), { target: { value: "Мрамор" } });
    expect(writes).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Сохранить на сервере" }));
    await waitFor(() => expect(screen.getByRole("article", { name: "Мрамор" })).toBeInTheDocument());
    expect(within(screen.getByRole("article", { name: "Мрамор" })).queryByRole("button", { name: "Новая ревизия" })).not.toBeInTheDocument();
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({ name: "Мрамор", visibility: "unlisted", preset: { contentHash: preset.contentHash } });
  });

  it("opens foreign link for preview and forks its edited draft without granting revision", async () => {
    const foreign = own({ id: "ffffffff-ffff-4fff-8fff-ffffffffffff", slug: "ffffffffffffffffffffffffffffffff", name: "Чужой свет" });
    const requests: Array<{ url: string; method: string; body?: unknown }> = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      requests.push({ url, method: init?.method ?? "GET", body: init?.body ? JSON.parse(String(init.body)) : undefined });
      if (url === "/api/skin-presets") return Response.json({ presets: [] });
      if (url === `/api/skin-presets/${foreign.slug}/fork` && init?.method === "POST")
        return Response.json(own({ id: "33333333-3333-4333-8333-333333333333", slug: "cccccccccccccccccccccccccccccccc", sourcePresetId: foreign.id, name: "Мой вариант" }), { status: 201 });
      return Response.json(foreign);
    }));
    const state = lab({ activeRemoteSource: { id: foreign.id, slug: foreign.slug } });
    render(<MonoPresetLibrary lab={state} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Открыть пресет" })).toBeEnabled());
    fireEvent.change(screen.getByRole("textbox", { name: "Ссылка или код пресета" }), { target: { value: `https://example.test/mono?preset=${foreign.slug}` } });
    fireEvent.click(screen.getByRole("button", { name: "Открыть пресет" }));
    const card = await screen.findByRole("article", { name: "Чужой свет" });
    expect(within(card).queryByRole("button", { name: "Новая ревизия" })).not.toBeInTheDocument();
    fireEvent.change(within(card).getByRole("combobox", { name: "Скопировать часть" }), { target: { value: "background" } });
    expect(state.previewRemotePreset).toHaveBeenCalledWith(foreign, "background");
    fireEvent.change(screen.getByRole("textbox", { name: "Название для сервера" }), { target: { value: "Мой вариант" } });
    fireEvent.click(within(card).getByRole("button", { name: "Создать ответвление" }));
    await waitFor(() => expect(requests.some(request => request.method === "POST")).toBe(true));
    expect(requests.find(request => request.method === "POST")?.body).toMatchObject({
      name: "Мой вариант", preset: { contentHash: preset.contentHash },
    });
  });

  it("rechecks ownership before revision and refuses to overwrite after cookie loss", async () => {
    let listReads = 0;
    const requests: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      requests.push(`${init?.method ?? "GET"} ${url}`);
      if (url === "/api/skin-presets") return Response.json({ presets: listReads++ === 0 ? [own()] : [] });
      return Response.json(own());
    }));
    render(<MonoPresetLibrary lab={lab()} />);
    const card = await screen.findByRole("article", { name: "Обсидиан" });
    fireEvent.click(within(card).getByRole("button", { name: "Новая ревизия" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/владени/));
    expect(requests).not.toContain("PUT /api/skin-presets/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
  });

  it("leaves local work available when server is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: "Preset service unavailable" }, { status: 503 })));
    const state = lab();
    render(<MonoPresetLibrary lab={state} />);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/серверная библиотека пока недоступна/i));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Сохранить на сервере" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Открыть пресет" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Повторить соединение" })).toBeEnabled();
    expect(state.previewRemotePreset).not.toHaveBeenCalled();
  });

  it("restores server actions after a successful reconnect", async () => {
    let available = false;
    vi.stubGlobal("fetch", vi.fn(async () => available
      ? Response.json({ presets: [own()] })
      : Response.json({ error: "Preset service unavailable" }, { status: 503 })));
    render(<MonoPresetLibrary lab={lab()} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Повторить соединение" })).toBeEnabled());
    available = true;
    fireEvent.click(screen.getByRole("button", { name: "Повторить соединение" }));
    expect(await screen.findByRole("article", { name: "Обсидиан" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Сохранить на сервере" })).toBeEnabled();
    expect(screen.queryByText(/серверная библиотека пока недоступна/i)).not.toBeInTheDocument();
  });

  it("opens a shared link on entry without changing or previewing the draft", async () => {
    const foreign = own({ id: "ffffffff-ffff-4fff-8fff-ffffffffffff", slug: "ffffffffffffffffffffffffffffffff", name: "Тихий металл" });
    window.history.replaceState({}, "", `/mono?preset=${foreign.slug}`);
    vi.stubGlobal("fetch", vi.fn(async (url: string) => url === "/api/skin-presets"
      ? Response.json({ presets: [] }) : Response.json(foreign)));
    const state = lab();
    render(<MonoPresetLibrary lab={state} />);
    expect(await screen.findByRole("article", { name: "Тихий металл" })).toBeInTheDocument();
    expect(state.previewRemotePreset).not.toHaveBeenCalled();
    expect(state.present.config).toBe(config);
  });

  it("shares only the preset code, never unrelated page parameters", async () => {
    window.history.replaceState({}, "", "/mono?private=keep-here");
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ presets: [own()] })));
    render(<MonoPresetLibrary lab={lab()} />);
    const card = await screen.findByRole("article", { name: "Обсидиан" });
    fireEvent.click(within(card).getByRole("button", { name: "Ссылка" }));
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Ссылка для передачи" })).toHaveValue(
      "http://localhost:3000/mono?preset=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"));
  });
});
