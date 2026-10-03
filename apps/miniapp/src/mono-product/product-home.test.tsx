import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MockWalletRepository, SINGLE_ACCOUNT_DEMO } from "@wallet/core";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { MonoProductScene } from "../mono-preview/mono-product-scene";
import { createMonoAppearanceEnvelope } from "../mono-preview/mono-preset-envelope";

beforeEach(() => {
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

async function renderHome(props: Record<string, unknown> = {}) {
  const wallet = await new MockWalletRepository().getSnapshot();
  const envelope = createMonoAppearanceEnvelope("ledger");
  const view = render(<MonoProductScene snapshot={wallet} appearance={envelope.appearance}
    material={envelope.material} {...props} />);
  return { ...view, wallet, envelope };
}

it("switches account context and offers only that account's receive route", async () => {
  await renderHome();
  expect(screen.getByRole("heading", { name: "Общая стоимость" })).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /Все счета/ }));
  const accountSheet = screen.getByRole("dialog", { name: "Выбор счёта" });
  fireEvent.click(within(accountSheet).getByRole("button", { name: /Хранилище/ }));
  expect(screen.getByRole("heading", { name: "Баланс счёта" })).toBeInTheDocument();
  expect(screen.getByRole("region", { name: "Баланс счёта" })).toHaveTextContent("0,00");

  fireEvent.click(screen.getByRole("button", { name: "Отправить" }));
  expect(screen.getByRole("dialog", { name: "Отправить" })).toHaveTextContent(/отправка недоступна/i);
  fireEvent.click(within(screen.getByRole("dialog", { name: "Отправить" }))
    .getByRole("button", { name: "Закрыть" }));
  fireEvent.click(screen.getByRole("button", { name: "Получить" }));
  const receiveSheet = screen.getByRole("dialog", { name: "Получить" });
  expect(receiveSheet).toHaveTextContent("Между счетами");
  expect(receiveSheet).not.toHaveAttribute("aria-modal", "true");
  expect(receiveSheet).toHaveTextContent("Ethereum");
  expect(receiveSheet).not.toHaveTextContent("Solana");
});

it("reveals each asset's separate account and network placements", async () => {
  await renderHome();
  expect(screen.queryByText("Solana")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /Мои средства/ }));
  const usdc = screen.getByRole("button", { name: /USD Coin/ });
  expect(usdc).toHaveAttribute("aria-expanded", "false");
  fireEvent.click(usdc);
  expect(usdc).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByText("Solana")).toBeInTheDocument();
  expect(screen.getAllByText("Ethereum").length).toBeGreaterThanOrEqual(1);
  expect(screen.getByText("400 USDC")).toBeInTheDocument();
  expect(screen.getByText("500 USDC")).toBeInTheDocument();
});

it("shows a single shared network battery pool and returns focus after Escape", async () => {
  await renderHome();
  const balance = screen.getByRole("region", { name: "Общая стоимость" });
  const trigger = within(balance).getByRole("button", { name: /Батарейка.*Ethereum.*60%/ });
  expect(trigger).toHaveAttribute("data-charge-state", "charged");
  expect(trigger.querySelector("svg")).toBeInTheDocument();
  trigger.focus();
  fireEvent.click(trigger);
  const sheet = screen.getByRole("dialog", { name: "Батарейка" });
  expect(within(sheet).getAllByText(/Ethereum/)).toHaveLength(1);
  expect(sheet).toHaveTextContent(/общий пул/i);
  expect(sheet).toHaveTextContent(/3 перевода/);
  fireEvent.keyDown(sheet, { key: "Escape" });
  expect(screen.queryByRole("dialog", { name: "Батарейка" })).toBeNull();
  expect(trigger).toHaveFocus();
});

it("masks account sheet money and keeps context and privacy when appearance changes", async () => {
  const { rerender, wallet, envelope } = await renderHome();
  fireEvent.click(screen.getByRole("button", { name: /Все счета/ }));
  fireEvent.click(within(screen.getByRole("dialog", { name: "Выбор счёта" }))
    .getByRole("button", { name: /Основной/ }));
  fireEvent.click(screen.getByRole("button", { name: "Скрыть баланс" }));
  fireEvent.click(screen.getByRole("button", { name: /Основной/ }));
  const sheet = screen.getByRole("dialog", { name: "Выбор счёта" });
  expect(sheet).toHaveTextContent("Значения скрыты");
  expect(sheet).not.toHaveTextContent(/12\s?840,75/);
  fireEvent.click(within(sheet).getByRole("button", { name: "Закрыть" }));

  const frost = createMonoAppearanceEnvelope("frost");
  rerender(<MonoProductScene snapshot={wallet} appearance={frost.appearance}
    material={envelope.material} />);
  expect(screen.getByRole("button", { name: /Основной/ })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Показать баланс" })).toBeInTheDocument();
  expect(screen.getByRole("region", { name: "Баланс счёта" })).toHaveTextContent("••••••");
});

it("shows a single account without a redundant account selector", async () => {
  await renderHome({ productAdapter: { kind: "demo", snapshot: SINGLE_ACCOUNT_DEMO } });
  expect(screen.queryByRole("button", { name: /Выбрать счёт/ })).toBeNull();
  expect(screen.getByRole("heading", { name: "Баланс счёта" })).toBeInTheDocument();
  expect(screen.getByRole("img", { name: /1\s?250,00/ })).toBeInTheDocument();
  expect(within(screen.getByRole("region", { name: "Баланс счёта" }))
    .getByRole("button", { name: /Батарейка.*правила неизвестны/i })).toHaveAttribute("data-charge-state", "unknown");
});

it("scopes demo history to the chosen account instead of inventing activity for an empty account", async () => {
  await renderHome();
  const navigation = screen.getByRole("navigation", { name: "Разделы кошелька" });
  fireEvent.click(within(navigation).getByRole("button", { name: "История" }));
  expect(screen.getByText("В обработке")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Все счета/ }));
  fireEvent.click(within(screen.getByRole("dialog", { name: "Выбор счёта" }))
    .getByRole("button", { name: /Хранилище/ }));
  expect(screen.getByText("Для этого счёта операций пока нет.")).toBeInTheDocument();
  expect(screen.queryByText("В обработке")).toBeNull();
});
