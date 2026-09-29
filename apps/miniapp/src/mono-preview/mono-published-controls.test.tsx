import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { createMonoAppearanceEnvelope } from "./mono-preset-envelope";
import { MonoPublishedPresetControls } from "./mono-published-controls";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function fakeFetch(log: Array<{ url: string; method: string; body?: unknown }>, putStatus = 200) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input), method = init?.method ?? "GET";
    log.push({ url, method, ...(init?.body ? { body: JSON.parse(String(init.body)) } : {}) });
    if (url.endsWith("/session") && method === "GET") return Response.json({ authenticated: false });
    if (url.endsWith("/session") && method === "POST") return Response.json({ authenticated: true, csrfToken: "csrf" });
    if (method === "PUT") return Response.json(putStatus === 409 ? { error: "conflict" } : {
      slot: 1, revision: 1, updatedAt: "2026-09-29T00:00:00.000Z", snapshot: createMonoAppearanceEnvelope(),
    }, { status: putStatus });
    return Response.json({ error: "missing" }, { status: 404 });
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

it("does not publish on mount, login, or selection; a deliberate click submits one accepted snapshot", async () => {
  const calls: Array<{ url: string; method: string; body?: unknown }> = [];
  vi.stubGlobal("fetch", fakeFetch(calls));
  const getSnapshot = vi.fn(async () => createMonoAppearanceEnvelope());
  render(<MonoPublishedPresetControls slot={1} getSnapshot={getSnapshot} />);
  await waitFor(() => expect(calls.some(call => call.url.endsWith("/1") && call.method === "GET")).toBe(true));
  expect(getSnapshot).not.toHaveBeenCalled();
  expect(calls.some(call => call.method === "PUT")).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: /Опубликовать/ }));
  expect(screen.getByLabelText("Пароль публикации")).toBeVisible();
  expect(getSnapshot).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Пароль публикации"), { target: { value: "secret" } });
  fireEvent.click(screen.getByRole("button", { name: "Войти для публикации" }));
  await waitFor(() => expect(screen.queryByLabelText("Пароль публикации")).toBeNull());
  expect(getSnapshot).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: /Опубликовать/ }));
  await waitFor(() => expect(calls.filter(call => call.method === "PUT")).toHaveLength(1));
  expect(getSnapshot).toHaveBeenCalledTimes(1);
  expect(calls.find(call => call.method === "PUT")?.body).toMatchObject({ expectedRevision: 0,
    snapshot: { kind: "mono-appearance", version: 4 } });
  expect(screen.getByRole("link", { name: "Открыть готовый кошелёк" })).toHaveAttribute("href", "/p/1");
  expect(screen.getByRole("link", { name: "Открыть готовый кошелёк" })).toHaveAttribute("title", "Открыть готовый кошелёк");
  expect(screen.getByRole("button", { name: "Скопировать ссылку" })).toHaveAttribute("title", "Скопировать ссылку");
});

it("does not publish an unfinished trial or a snapshot resolved after slot changed", async () => {
  const calls: Array<{ url: string; method: string; body?: unknown }> = [];
  const fetch = fakeFetch(calls);
  fetch.mockImplementation(async (input, init) => {
    const url = String(input), method = init?.method ?? "GET";
    calls.push({ url, method });
    if (url.endsWith("/session")) return Response.json({ authenticated: true, csrfToken: "csrf" });
    return Response.json({ error: "missing" }, { status: 404 });
  });
  vi.stubGlobal("fetch", fetch);
  const getSnapshot = vi.fn(async () => null);
  const { rerender } = render(<MonoPublishedPresetControls slot={1} getSnapshot={getSnapshot} />);
  await waitFor(() => expect(calls.filter(call => call.method === "GET")).toHaveLength(2));
  fireEvent.click(screen.getByRole("button", { name: /Опубликовать/ }));
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/незаверш/));
  expect(calls.some(call => call.method === "PUT")).toBe(false);

  let finish!: (snapshot: ReturnType<typeof createMonoAppearanceEnvelope>) => void;
  const pending = new Promise<ReturnType<typeof createMonoAppearanceEnvelope>>(resolve => { finish = resolve; });
  rerender(<MonoPublishedPresetControls slot={1} getSnapshot={() => pending} />);
  fireEvent.click(screen.getByRole("button", { name: /Опубликовать/ }));
  rerender(<MonoPublishedPresetControls slot={2} getSnapshot={() => pending} />);
  await act(async () => { finish(createMonoAppearanceEnvelope()); await pending; });
  expect(calls.some(call => call.method === "PUT")).toBe(false);
  await waitFor(() => expect(screen.getByRole("button", { name: /Опубликовать/ })).toBeEnabled());
});

it("reports a revision conflict without retrying or silently overwriting", async () => {
  const calls: Array<{ url: string; method: string; body?: unknown }> = [];
  const fetch = fakeFetch(calls, 409);
  fetch.mockImplementation(async (input, init) => {
    const url = String(input), method = init?.method ?? "GET";
    calls.push({ url, method });
    if (url.endsWith("/session")) return Response.json({ authenticated: true, csrfToken: "csrf" });
    if (method === "PUT") return Response.json({ error: "conflict" }, { status: 409 });
    return Response.json({ error: "missing" }, { status: 404 });
  });
  vi.stubGlobal("fetch", fetch);
  render(<MonoPublishedPresetControls slot={1} getSnapshot={async () => createMonoAppearanceEnvelope()} />);
  await waitFor(() => expect(calls.filter(call => call.method === "GET")).toHaveLength(2));
  fireEvent.click(screen.getByRole("button", { name: /Опубликовать/ }));
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/другом окне/));
  expect(calls.filter(call => call.method === "PUT")).toHaveLength(1);
});

it("offers a read retry after a temporary outage instead of stranding publication", async () => {
  let reads = 0;
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/session")) return Response.json({ authenticated: true, csrfToken: "csrf" });
    reads++;
    return Response.json({ error: "unavailable" }, { status: reads === 1 ? 503 : 404 });
  }));
  render(<MonoPublishedPresetControls slot={1} getSnapshot={async () => createMonoAppearanceEnvelope()} />);
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/недоступна/));
  fireEvent.click(screen.getByRole("button", { name: "Обновить статус" }));
  await waitFor(() => expect(screen.getByRole("button", { name: /Опубликовать/ })).toBeEnabled());
  expect(reads).toBe(2);
});

it("ignores a late PUT JSON body after the selected number changes", async () => {
  const responseBody = deferred<unknown>();
  let puts = 0;
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/session")) return Response.json({ authenticated: true, csrfToken: "csrf" });
    if (init?.method === "PUT") {
      puts++;
      return { ok: true, status: 200, json: () => responseBody.promise } as Response;
    }
    return Response.json({ error: "missing" }, { status: 404 });
  }));
  const { rerender } = render(<MonoPublishedPresetControls slot={1} getSnapshot={async () => createMonoAppearanceEnvelope()} />);
  await waitFor(() => expect(screen.getByRole("button", { name: /Опубликовать/ })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: /Опубликовать/ }));
  await waitFor(() => expect(puts).toBe(1));
  rerender(<MonoPublishedPresetControls slot={2} getSnapshot={async () => createMonoAppearanceEnvelope()} />);
  await act(async () => responseBody.resolve({ slot: 1, revision: 1 }));
  await waitFor(() => expect(screen.getByRole("button", { name: /Опубликовать/ })).toBeEnabled());
  expect(screen.queryByRole("link", { name: "Открыть готовый кошелёк" })).toBeNull();
});

it("does not let a late session probe undo a successful login in the same number", async () => {
  const initialSession = deferred<unknown>();
  let puts = 0;
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/session") && !init?.method)
      return { ok: true, json: () => initialSession.promise } as Response;
    if (url.endsWith("/session") && init?.method === "POST")
      return Response.json({ authenticated: true, csrfToken: "csrf" });
    if (init?.method === "PUT") { puts++; return Response.json({ slot: 1, revision: 1 }); }
    return Response.json({ error: "missing" }, { status: 404 });
  }));
  render(<MonoPublishedPresetControls slot={1} getSnapshot={async () => createMonoAppearanceEnvelope()} />);
  await waitFor(() => expect(screen.getByRole("button", { name: /Опубликовать/ })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: /Опубликовать/ }));
  fireEvent.change(screen.getByLabelText("Пароль публикации"), { target: { value: "secret" } });
  fireEvent.click(screen.getByRole("button", { name: "Войти для публикации" }));
  await waitFor(() => expect(screen.queryByLabelText("Пароль публикации")).toBeNull());
  await act(async () => initialSession.resolve({ authenticated: false }));
  fireEvent.click(screen.getByRole("button", { name: /Опубликовать/ }));
  await waitFor(() => expect(puts).toBe(1));
});

it("ignores a late login JSON body after the selected number changes", async () => {
  const loginBody = deferred<unknown>();
  let posts = 0;
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/session") && init?.method === "POST") {
      posts++;
      return { ok: true, status: 200, json: () => loginBody.promise } as Response;
    }
    if (url.endsWith("/session")) return Response.json({ authenticated: false });
    return Response.json({ error: "missing" }, { status: 404 });
  }));
  const getSnapshot = vi.fn(async () => createMonoAppearanceEnvelope());
  const { rerender } = render(<MonoPublishedPresetControls slot={1} getSnapshot={getSnapshot} />);
  await waitFor(() => expect(screen.getByRole("button", { name: /Опубликовать/ })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: /Опубликовать/ }));
  fireEvent.change(screen.getByLabelText("Пароль публикации"), { target: { value: "secret" } });
  fireEvent.click(screen.getByRole("button", { name: "Войти для публикации" }));
  await waitFor(() => expect(posts).toBe(1));
  rerender(<MonoPublishedPresetControls slot={2} getSnapshot={getSnapshot} />);
  await act(async () => loginBody.resolve({ authenticated: true, csrfToken: "old-slot" }));
  await waitFor(() => expect(screen.getByRole("button", { name: /Опубликовать/ })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: /Опубликовать/ }));
  expect(screen.getByLabelText("Пароль публикации")).toBeVisible();
  expect(getSnapshot).not.toHaveBeenCalled();
});
