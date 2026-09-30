import "@testing-library/jest-dom/vitest";
import { webcrypto } from "node:crypto";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MockWalletRepository } from "@wallet/core";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MonoPreview } from "./mono-preview";
import { MONO_SEVEN_PRESETS_KEY } from "./mono-working-presets";

type Call = { url: string; method: string; body?: Record<string, unknown> };
const calls: Call[] = [];

beforeEach(() => {
  localStorage.clear();
  calls.length = 0;
  vi.stubGlobal("crypto", webcrypto);
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduced-motion"), media: query,
    addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => setTimeout(() => callback(performance.now()), 0));
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input), method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : undefined;
    calls.push({ url, method, ...(body ? { body } : {}) });
    if (url === "/api/mono-published/config")
      return Response.json({ publicOrigin: "https://wallet.example" });
    if (url.startsWith("/api/mono-published/") && method === "GET")
      return Response.json({ error: "missing" }, { status: 404 });
    if (url.startsWith("/api/mono-published/") && method === "PUT")
      return Response.json({ slot: Number(url.split("/").at(-1)), revision: 1,
        updatedAt: "2026-09-29T00:00:00.000Z", snapshot: body?.snapshot });
    return Response.json({ error: "unavailable" }, { status: 503 });
  }));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

async function renderReady() {
  render(<MonoPreview snapshot={await new MockWalletRepository().getSnapshot()} />);
  await waitFor(() => expect(screen.getByRole("button", { name: /^Пресет 1:/ })).toBeEnabled());
  const controls = await screen.findByRole("region", { name: "Публикация пресета 1" });
  await waitFor(() => expect(within(controls).getByRole("button", { name: "Опубликовать" })).toBeEnabled());
  return controls;
}

it("publishes the selected accepted workspace only after its explicit command", async () => {
  const controls = await renderReady();
  expect(calls.filter(call => call.method === "PUT")).toHaveLength(0);
  fireEvent.click(within(controls).getByRole("button", { name: "Опубликовать" }));
  await waitFor(() => expect(calls.filter(call => call.method === "PUT")).toHaveLength(1));
  const request = calls.find(call => call.method === "PUT")!;
  expect(request.url).toBe("/api/mono-published/1");
  expect(request.body).toMatchObject({ expectedRevision: 0, snapshot: { kind: "mono-appearance", version: 4,
    appearance: { preset: "ledger" } } });
});

it("publishes preset 7 at its own address without leaking the First button material", async () => {
  await renderReady();
  fireEvent.click(screen.getByRole("button", { name: /^Пресет 7:/ }));
  const controls = await screen.findByRole("region", { name: "Публикация пресета 7" });
  await waitFor(() => expect(within(controls).getByRole("button", { name: "Опубликовать" })).toBeEnabled());
  expect(calls.some(call => call.method === "PUT")).toBe(false);
  fireEvent.click(within(controls).getByRole("button", { name: "Опубликовать" }));
  await waitFor(() => expect(calls.filter(call => call.method === "PUT")).toHaveLength(1));
  const request = calls.find(call => call.method === "PUT")!;
  expect(request.url).toBe("/api/mono-published/7");
  expect(request.body).toMatchObject({ expectedRevision: 0, snapshot: { material: { buttons: null } } });
  const library = JSON.parse(localStorage.getItem(MONO_SEVEN_PRESETS_KEY)!) as {
    slots: Array<{ document: { materials: { ledger: { buttons: { bindings: unknown[] } | null } } } }>;
  };
  expect(library.slots[0].document.materials.ledger.buttons?.bindings).toHaveLength(4);
  expect(library.slots[6].document.materials.ledger.buttons).toBeNull();
});

it("accepts a pending trial and then publishes its accepted snapshot once in the original slot", async () => {
  const controls = await renderReady();
  fireEvent.click(screen.getByRole("button", { name: "Баланс" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "Моргание глаза" }));
  fireEvent.click(within(controls).getByRole("button", { name: "Опубликовать" }));
  await waitFor(() => expect(within(controls).getByRole("status")).toHaveTextContent(/незавершённая проба/i));
  expect(calls.some(call => call.method === "PUT")).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Применить пробы и опубликовать" }));
  await waitFor(() => expect(calls.filter(call => call.method === "PUT")).toHaveLength(1));
  expect(calls.find(call => call.method === "PUT")).toMatchObject({
    url: "/api/mono-published/1", body: { expectedRevision: 0, snapshot: { appearance: { eye: { blinkEnabled: false } } } },
  });
});

it("does not publish when a pending trial is cancelled or the guard is dismissed", async () => {
  const controls = await renderReady();
  fireEvent.click(screen.getByRole("button", { name: "Баланс" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "Моргание глаза" }));
  fireEvent.click(within(controls).getByRole("button", { name: "Опубликовать" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Назад" })).toBeVisible());
  fireEvent.click(screen.getByRole("button", { name: "Назад" }));
  expect(calls.some(call => call.method === "PUT")).toBe(false);
  fireEvent.click(within(controls).getByRole("button", { name: "Опубликовать" }));
  fireEvent.click(screen.getByRole("button", { name: "Отменить пробы" }));
  expect(calls.some(call => call.method === "PUT")).toBe(false);
});
