import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MockWalletRepository, SINGLE_ACCOUNT_DEMO } from "@wallet/core";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { MonoProductScene } from "../mono-preview/mono-product-scene";
import { createMonoAppearanceEnvelope } from "../mono-preview/mono-preset-envelope";
import { MONO_PRODUCT_DEMO_ADAPTER } from "./demo-adapter";
import { useMonoProductController } from "./product-controller";
import { ProductBalance, ProductContextLine, ProductOverview } from "./product-home";
import { HomePinSettings } from "./accounts-workspace/home-pin-settings";
import { ProductOverlay } from "./product-sheet";

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

async function renderHome(props: Record<string, unknown> = {}) {
  const wallet = await new MockWalletRepository().getSnapshot();
  const envelope = createMonoAppearanceEnvelope("ledger");
  const view = render(<MonoProductScene snapshot={wallet} appearance={envelope.appearance}
    material={envelope.material} {...props} />);
  return { ...view, wallet, envelope };
}

it("keeps the overview global through total-only and privacy even with another working account", () => {
  function Host() {
    const { view, commands } = useMonoProductController(MONO_PRODUCT_DEMO_ADAPTER, { initialHidden: false });
    const { appearance } = createMonoAppearanceEnvelope("ledger");
    return <><button onClick={() => commands.selectContext({ kind: "account", accountId: "demo-depositary" })}>Другой счёт</button>
      <ProductContextLine view={view} commands={commands} overview />
      <ProductOverview view={view} commands={commands} appearance={appearance.balance} blinkEnabled={false} onOpenGroup={() => {}} />
      <HomePinSettings groups={view.accountGroups} pinnedKinds={view.homePinnedKinds} totalOnly={view.homeTotalOnly}
        onToggle={commands.toggleHomePin} onTotalOnlyChange={commands.setHomeTotalOnly} /></>;
  }
  render(<Host />);
  fireEvent.click(screen.getByRole("button", { name: "Другой счёт" }));
  const total = screen.getByRole("region", { name: "Общий баланс" });
  expect(total).toHaveTextContent(/12\s?840,75/);
  expect(total).toHaveTextContent("Оценка активов в USD");
  expect(screen.queryByText("Демо-режим")).toBeNull();
  fireEvent.click(screen.getByRole("checkbox", { name: "Только общий баланс" }));
  expect(screen.queryByRole("group", { name: "Закреплённые группы счетов" })).toBeNull();
  expect(total).toHaveTextContent(/12\s?840,75/);
  fireEvent.click(screen.getByRole("button", { name: "Скрыть баланс" }));
  expect(total).toHaveTextContent("••••••");
  fireEvent.click(screen.getByRole("checkbox", { name: "Только общий баланс" }));
  expect(screen.getAllByRole("button", { name: /Открыть группу/ })).toHaveLength(2);
  expect(screen.getByRole("group", { name: "Закреплённые группы счетов" })).toHaveTextContent("••••");
  expect(screen.getByRole("button", { name: "Показать баланс" })).toBeInTheDocument();
});

it("keeps the overview total global after choosing a working account in Assets", async () => {
  await renderHome();
  expect(screen.getByRole("heading", { name: "Общий баланс" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Активы" }));
  fireEvent.click(screen.getByRole("button", { name: /Все счета/ }));
  const accountSheet = screen.getByRole("dialog", { name: "Выбор счёта" });
  fireEvent.click(within(accountSheet).getByRole("button", { name: /Хранилище/ }));
  expect(screen.getByRole("heading", { name: "Все активы" })).toBeInTheDocument();
  expect(screen.getByText("0,00 $", { exact: false })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Обзор" }));
  expect(screen.getByRole("region", { name: "Общий баланс" })).toHaveTextContent(/12\s?840,75/);
  expect(screen.queryByRole("button", { name: /Выбрать счёт:/ })).toBeNull();
});

it("reveals each asset's separate account and network placements", async () => {
  await renderHome();
  expect(screen.queryByText("Solana")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /Мои средства/ }));
  const usdc = screen.getByRole("button", { name: "Показать размещения USDC" });
  expect(usdc).toHaveAttribute("aria-expanded", "false");
  fireEvent.click(usdc);
  expect(usdc).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByText("Solana")).toBeInTheDocument();
  expect(screen.getAllByText("Ethereum").length).toBeGreaterThanOrEqual(1);
  expect(screen.getByText("400 USDC")).toBeInTheDocument();
  expect(screen.getByText("500 USDC")).toBeInTheDocument();
});

it("omits the home battery focus target while preserving the total, pins and privacy control", async () => {
  const { container } = await renderHome();
  const balance = screen.getByRole("region", { name: "Общий баланс" });
  expect(within(balance).queryByRole("button", { name: /Батарейка/ })).toBeNull();
  expect(container.querySelector("[data-mono-product-battery-trigger]")).toBeNull();
  expect(balance).not.toHaveTextContent("60%");
  expect(balance).toHaveTextContent(/12\s?840,75/);
  expect(screen.getByRole("group", { name: "Закреплённые группы счетов" })).toBeInTheDocument();
  expect(screen.getAllByRole("button", { name: /Открыть группу/ })).toHaveLength(2);
  fireEvent.click(within(balance).getByRole("button", { name: "Скрыть баланс" }));
  expect(balance).toHaveTextContent("••••••");
  expect(within(balance).getByRole("button", { name: "Показать баланс" })).toBeInTheDocument();
  expect(within(screen.getByRole("group", { name: "Закреплённые группы счетов" })).getAllByText("••••")).toHaveLength(2);
  expect(container.querySelector("[data-mono-product-battery-trigger]")).toBeNull();
});

function NonHomeBalance() {
  const { view, commands } = useMonoProductController(MONO_PRODUCT_DEMO_ADAPTER, { initialHidden: false });
  const { appearance } = createMonoAppearanceEnvelope("ledger");
  return <div data-mono-preview>
    <ProductBalance view={view} commands={commands} appearance={appearance.balance} blinkEnabled={false} />
    <ProductOverlay view={view} commands={commands} />
  </div>;
}

it("keeps a non-home shared network battery pool and returns focus after Escape", () => {
  render(<NonHomeBalance />);
  const balance = screen.getByRole("region", { name: "Общий баланс" });
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
  fireEvent.click(screen.getByRole("button", { name: "Активы" }));
  fireEvent.click(screen.getByRole("button", { name: /Все счета/ }));
  fireEvent.click(within(screen.getByRole("dialog", { name: "Выбор счёта" }))
    .getByRole("button", { name: /Основной/ }));
  fireEvent.click(screen.getByRole("button", { name: "Обзор" }));
  fireEvent.click(screen.getByRole("button", { name: "Скрыть баланс" }));
  fireEvent.click(screen.getByRole("button", { name: "Активы" }));
  fireEvent.click(screen.getByRole("button", { name: /Основной/ }));
  const sheet = screen.getByRole("dialog", { name: "Выбор счёта" });
  expect(sheet).toHaveTextContent("Значения скрыты");
  expect(sheet).not.toHaveTextContent(/12\s?840,75/);
  fireEvent.keyDown(sheet, { key: "Escape" });

  const frost = createMonoAppearanceEnvelope("frost");
  rerender(<MonoProductScene snapshot={wallet} appearance={frost.appearance}
    material={envelope.material} />);
  expect(screen.getByRole("button", { name: /Основной/ })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Обзор" }));
  expect(screen.getByRole("button", { name: "Показать баланс" })).toBeInTheDocument();
  expect(screen.getByRole("region", { name: "Общий баланс" })).toHaveTextContent("••••••");
});

it("shows a single account without a redundant account selector", async () => {
  await renderHome({ productAdapter: { kind: "demo", snapshot: SINGLE_ACCOUNT_DEMO } });
  expect(screen.queryByRole("button", { name: /Выбрать счёт/ })).toBeNull();
  expect(screen.getAllByRole("button", { name: /Открыть группу/ })).toHaveLength(1);
  expect(screen.getByRole("heading", { name: "Общий баланс" })).toBeInTheDocument();
  expect(screen.getByRole("img", { name: /1\s?250,00/ })).toBeInTheDocument();
  expect(within(screen.getByRole("region", { name: "Общий баланс" }))
    .queryByRole("button", { name: /Батарейка/i })).toBeNull();
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
