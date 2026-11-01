import "@testing-library/jest-dom/vitest";
import { webcrypto } from "node:crypto";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MockWalletRepository } from "@wallet/core";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { MonoPreview } from "../mono-preview/mono-preview";
import { MonoScene } from "../mono-preview/mono-scene";
import { createMonoAppearanceEnvelope } from "../mono-preview/mono-preset-envelope";

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("crypto", webcrypto);
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: "unconfigured" }, { status: 503 })));
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("reduced-motion"), media: query,
    addEventListener() {}, removeEventListener() {},
  }));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("keeps prototype-only actions unavailable while allowing feedback", async () => {
  const snapshot = await new MockWalletRepository().getSnapshot();
  render(<MonoScene snapshot={snapshot} appearance={createMonoAppearanceEnvelope("ledger").appearance} />);

  const names = ["Отправить", "Получить", "Обмен", "Купить"];
  for (const name of names) {
    const control = await screen.findByRole("button", { name: new RegExp(`^${name}.*операция недоступна`) });
    expect(control).toBeEnabled();
    fireEvent.click(control);
    expect(screen.getByRole("status", { name: "Статус быстрых действий" }))
      .toHaveTextContent(`${name} — операция недоступна в демо.`);
  }
});

it("keeps the prototype's approved material response on all four actions", async () => {
  const snapshot = await new MockWalletRepository().getSnapshot();
  render(<MonoScene snapshot={snapshot} appearance={createMonoAppearanceEnvelope("ledger").appearance} />);

  for (const name of ["Отправить", "Получить", "Обмен", "Купить"]) {
    const control = await screen.findByRole("button", { name: new RegExp(`^${name}.*операция недоступна`) });
    expect(control).toHaveAttribute("data-control-effect", "material");
    expect(control).toHaveStyle({ "--press-depth": "2.7px", "--settle-ms": "270ms" });
  }
});

it("opens the real demo actions from the workbench product host", async () => {
  const snapshot = await new MockWalletRepository().getSnapshot();
  render(<MonoPreview snapshot={snapshot} />);
  const actions = [
    { name: "Отправить", close: "Закрыть отправку" },
    { name: "Получить", close: "Закрыть получение" },
    { name: "Обмен", close: "Закрыть" },
    { name: "Купить", close: "Закрыть" },
  ];
  expect(await screen.findByRole("status", { name: "Статус быстрых действий" }, { timeout: 5000 })).toHaveTextContent("Демо · операции не выполняются");
  for (const { name, close } of actions) {
    const control = await screen.findByRole("button", { name });
    expect(control).toBeEnabled();
    expect(control).toHaveAttribute("data-control-effect", "material");
    expect(control).toHaveStyle({ "--press-depth": "1px", "--settle-ms": "190ms" });
    fireEvent.click(control);
    const dialog = await screen.findByRole("dialog", { name });
    expect(dialog).toBeVisible();
    fireEvent.click(within(dialog).getByRole("button", { name: close }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name })).not.toBeInTheDocument());
  }
});
