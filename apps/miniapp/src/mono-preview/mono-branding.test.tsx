import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MockWalletRepository } from "@wallet/core";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { MonoPreview } from "./mono-preview";

beforeEach(() => {
  localStorage.clear();
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
