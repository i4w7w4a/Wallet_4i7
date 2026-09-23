import "@testing-library/jest-dom/vitest";
import { webcrypto } from "node:crypto";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MockWalletRepository } from "@wallet/core";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { MonoPreview } from "./mono-preview";
import { MONO_WORKING_PRESETS_KEY } from "./mono-working-presets";

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("crypto", webcrypto);
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

it("shows the supplied Novex identity while preserving the account name and demo state", async () => {
  render(<MonoPreview snapshot={await new MockWalletRepository().getSnapshot()} />);

  const header = within(document.querySelector<HTMLElement>(".mono-app-header")!);
  expect(header.getByRole("img", { name: "Novex Wallet" })).toBeVisible();
  expect(header.getByText("Демо пользователь")).toBeVisible();
  expect(header.getByLabelText("Визуальный прототип, демо-данные")).toHaveTextContent("DEMO");
  expect(header.queryByText(/WALLET_4I7|^W$/)).not.toBeInTheDocument();
  expect(screen.getByText("NOVEX WALLET / PRIVATE")).toBeVisible();
  expect(document.querySelector(".mono-promo__seal")).not.toHaveTextContent("4i7");
});

it("switches between a bare logo and a plaque without changing the account header", async () => {
  render(<MonoPreview snapshot={await new MockWalletRepository().getSnapshot()} />);
  await waitFor(() => expect(screen.getByRole("button", { name: /Пресет оформления:/ })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Логотип" }));

  const preview = document.querySelector<HTMLElement>("[data-mono-preview]")!;
  const bare = screen.getByRole("button", { name: "Логотип без плашки" });
  const plaque = screen.getByRole("button", { name: "Логотип с плашкой" });
  expect(preview).toHaveAttribute("data-mono-logo-variant", "bare");
  expect(bare).toHaveAttribute("aria-pressed", "true");

  fireEvent.click(plaque);
  expect(preview).toHaveAttribute("data-mono-logo-variant", "plaque");
  expect(plaque).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("img", { name: "Novex Wallet" })).toBeVisible();
  expect(within(document.querySelector<HTMLElement>(".mono-app-header")!).getByText("Демо пользователь")).toBeVisible();

  fireEvent.click(bare);
  expect(preview).toHaveAttribute("data-mono-logo-variant", "bare");
});

it("keeps the brand colors until a separate emblem hue is enabled and remembers the applied choice", async () => {
  const snapshot = await new MockWalletRepository().getSnapshot();
  const first = render(<MonoPreview snapshot={snapshot} />);
  await waitFor(() => expect(screen.getByRole("button", { name: /Пресет оформления:/ })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Логотип" }));
  const preview = document.querySelector<HTMLElement>("[data-mono-preview]")!;
  const custom = screen.getByRole("checkbox", { name: "Свой цвет эмблемы" });

  expect(custom).not.toBeChecked();
  expect(screen.queryByRole("slider", { name: "Тон знака Novex" })).not.toBeInTheDocument();
  fireEvent.click(custom);
  const hue = screen.getByRole("slider", { name: "Тон знака Novex" });
  fireEvent.change(hue, { target: { value: "330" } });

  expect(preview).toHaveAttribute("data-mono-logo-custom", "true");
  expect(hue).toHaveValue("330");
  expect(preview.style.getPropertyValue("--mono-logo-custom-dark-primary")).toMatch(/^#[0-9a-f]{6}$/);
  expect(preview.style.getPropertyValue("--mono-logo-custom-light-primary")).toMatch(/^#[0-9a-f]{6}$/);
  expect(localStorage.getItem("wallet4i7.mono.logo-preview.v1")).toBeNull();
  expect(localStorage.getItem(MONO_WORKING_PRESETS_KEY)).toBeNull();

  fireEvent.click(custom);
  expect(preview).toHaveAttribute("data-mono-logo-custom", "false");
  expect(screen.queryByRole("slider", { name: "Тон знака Novex" })).not.toBeInTheDocument();
  fireEvent.click(custom);
  expect(screen.getByRole("slider", { name: "Тон знака Novex" })).toHaveValue("330");
  fireEvent.click(screen.getByRole("button", { name: "Применить настройку" }));
  expect(JSON.parse(localStorage.getItem(MONO_WORKING_PRESETS_KEY)!).records[0].document.appearance.ledger.logo.hue).toBe(330);
  expect(localStorage.getItem("wallet4i7.mono.logo-preview.v1")).toBeNull();

  first.unmount();
  render(<MonoPreview snapshot={snapshot} />);
  await waitFor(() => expect(screen.getByRole("button", { name: /Пресет оформления:/ })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Логотип" }));
  await waitFor(() => expect(screen.getByRole("checkbox", { name: "Свой цвет эмблемы" })).toBeChecked());
  expect(screen.getByRole("slider", { name: "Тон знака Novex" })).toHaveValue("330");
});
