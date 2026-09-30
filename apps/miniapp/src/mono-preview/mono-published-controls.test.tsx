import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { createMonoAppearanceEnvelope } from "./mono-preset-envelope";
import { MonoPublishedPresetControls } from "./mono-published-controls";

type Call = { url: string; method: string; body?: unknown; headers?: HeadersInit };
const publicOrigin = "https://wallet.example";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function fakeFetch(calls: Call[], putStatus = 200) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input), method = init?.method ?? "GET";
    calls.push({ url, method, ...(init?.body ? { body: JSON.parse(String(init.body)) } : {}), headers: init?.headers });
    if (url === "/api/mono-published/config") return Response.json({ publicOrigin });
    if (method === "PUT") return Response.json(putStatus === 409 ? { error: "conflict" } : {
      slot: Number(url.split("/").at(-1)), revision: 1, updatedAt: "2026-09-29T00:00:00.000Z",
      snapshot: createMonoAppearanceEnvelope(),
    }, { status: putStatus });
    return Response.json({ error: "missing" }, { status: 404 });
  });
}

it("publishes one accepted snapshot without credentials and links to the configured public HTTPS host", async () => {
  const calls: Call[] = [];
  const copy = vi.fn(async () => {});
  vi.stubGlobal("fetch", fakeFetch(calls));
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: copy } });
  const getSnapshot = vi.fn(async () => createMonoAppearanceEnvelope());
  render(<MonoPublishedPresetControls slot={1} getSnapshot={getSnapshot} />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Опубликовать" })).toBeEnabled());
  expect(calls.some(call => call.method === "PUT")).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Опубликовать" }));
  await waitFor(() => expect(calls.filter(call => call.method === "PUT")).toHaveLength(1));
  expect(getSnapshot).toHaveBeenCalledTimes(1);
  expect(calls.some(call => call.url.endsWith("/session"))).toBe(false);
  expect(calls.find(call => call.method === "PUT")).toMatchObject({
    url: "/api/mono-published/1", body: { expectedRevision: 0, snapshot: { kind: "mono-appearance", version: 4 } },
    headers: { "content-type": "application/json" },
  });
  expect(screen.queryByLabelText("Пароль публикации")).toBeNull();
  const open = await screen.findByRole("link", { name: "Открыть готовый кошелёк" });
  expect(open).toHaveAttribute("href", `${publicOrigin}/p/1`);
  fireEvent.click(screen.getByRole("button", { name: "Скопировать ссылку" }));
  await waitFor(() => expect(copy).toHaveBeenCalledWith(`${publicOrigin}/p/1`));
});

it("never submits a snapshot that resolves after its selected slot changes", async () => {
  const calls: Call[] = [];
  vi.stubGlobal("fetch", fakeFetch(calls));
  let finish!: (value: ReturnType<typeof createMonoAppearanceEnvelope>) => void;
  const pending = new Promise<ReturnType<typeof createMonoAppearanceEnvelope>>(resolve => { finish = resolve; });
  const { rerender } = render(<MonoPublishedPresetControls slot={1} getSnapshot={() => pending} />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Опубликовать" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Опубликовать" }));
  rerender(<MonoPublishedPresetControls slot={2} getSnapshot={() => pending} />);
  await act(async () => { finish(createMonoAppearanceEnvelope()); await pending; });
  expect(calls.some(call => call.method === "PUT")).toBe(false);
  await waitFor(() => expect(screen.getByRole("button", { name: "Опубликовать" })).toBeEnabled());
});

it("shows a revision conflict without retrying or overwriting", async () => {
  const calls: Call[] = [];
  vi.stubGlobal("fetch", fakeFetch(calls, 409));
  render(<MonoPublishedPresetControls slot={1} getSnapshot={async () => createMonoAppearanceEnvelope()} />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Опубликовать" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Опубликовать" }));
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/другом окне/));
  expect(calls.filter(call => call.method === "PUT")).toHaveLength(1);
  expect(screen.getByRole("button", { name: "Опубликовать" })).toBeDisabled();
});

it("disables publication when public-origin config is unavailable and recovers on refresh", async () => {
  let configReads = 0;
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    if (String(input) === "/api/mono-published/config") {
      configReads++;
      return configReads === 1 ? Response.json({ error: "offline" }, { status: 503 }) : Response.json({ publicOrigin });
    }
    return Response.json({ error: "missing" }, { status: 404 });
  }));
  render(<MonoPublishedPresetControls slot={1} getSnapshot={async () => createMonoAppearanceEnvelope()} />);
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/недоступна/));
  expect(screen.getByRole("button", { name: "Опубликовать" })).toBeDisabled();
  expect(screen.queryByRole("link", { name: "Открыть готовый кошелёк" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Обновить статус" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Опубликовать" })).toBeEnabled());
  expect(configReads).toBe(2);
});
