import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MockWalletRepository, MULTI_ACCOUNT_DEMO } from "@wallet/core";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MonoProductScene } from "../mono-preview/mono-product-scene";
import { createMonoAppearanceEnvelope } from "../mono-preview/mono-preset-envelope";

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduced-motion"), media: query,
    addEventListener() {}, removeEventListener() {} }));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

async function home() {
  const wallet = await new MockWalletRepository().getSnapshot();
  const envelope = createMonoAppearanceEnvelope("ledger");
  const result = render(<MonoProductScene snapshot={wallet} appearance={envelope.appearance} material={envelope.material} />);
  return { ...result, wallet, envelope };
}

it("commerce wiring completes Buy and Swap through accepted pending into one two-leg history record each", async () => {
  const { container, rerender, wallet, envelope } = await home();
  const originalBalance = within(screen.getByRole("region", { name: "Общая стоимость" })).getByRole("img").getAttribute("aria-label");
  fireEvent.click(screen.getByRole("button", { name: "Купить" }));
  const buy = screen.getByRole("dialog", { name: "Купить" });
  fireEvent.click(await within(buy).findByRole("button", { name: "Продолжить" }));
  fireEvent.change(await within(buy).findByRole("textbox", { name: "Сумма, USD" }), { target: { value: "100" } });
  fireEvent.click(within(buy).getByRole("button", { name: "Проверить покупку" }));
  fireEvent.click(await within(buy).findByRole("button", { name: "Подтвердить симуляцию" }));
  expect(within(buy).getByRole("heading", { name: "Симуляция выполняется" })).toBeInTheDocument();
  expect(within(buy).getAllByRole("button", { name: "Закрыть" })).toHaveLength(1);
  fireEvent.click(within(buy).getByRole("button", { name: "Закрыть" }));
  expect(within(buy).getByRole("status", { name: "Состояние симуляции" })).toHaveTextContent(/Дождитесь результата/);
  fireEvent.click(screen.getByRole("button", { name: "История", hidden: true }));
  expect(container.querySelector("[data-mono-preview]")).toHaveAttribute("data-mono-section", "overview");
  fireEvent.click(await within(buy).findByRole("button", { name: "В истории" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(container.querySelectorAll('[data-product-activity-id^="commerce-simulation:"]')).toHaveLength(1);
  let receipt = screen.getByRole("region", { name: "Квитанция операции" });
  expect(receipt).toHaveTextContent("Демо-покупка");
  expect(within(receipt).getByText("101 USD")).toBeInTheDocument();
  expect(within(receipt).getByText("100 USDC")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Обзор" }));
  expect(within(screen.getByRole("region", { name: "Общая стоимость" })).getByRole("img").getAttribute("aria-label")).toBe(originalBalance);
  fireEvent.click(screen.getByRole("button", { name: "Обмен" }));
  const swap = screen.getByRole("dialog", { name: "Обмен" });
  fireEvent.change(await within(swap).findByRole("textbox", { name: "Отдаю, USDC" }), { target: { value: "100" } });
  fireEvent.change(within(swap).getByRole("combobox", { name: "Актив получения" }), { target: { value: "demo-usdc-eth-ethereum" } });
  fireEvent.click(within(swap).getByRole("button", { name: "Рассчитать обмен" }));
  fireEvent.click(await within(swap).findByRole("button", { name: "Подтвердить симуляцию" }));
  expect(within(swap).getByRole("heading", { name: "Обмен в обработке" })).toBeInTheDocument();
  fireEvent.keyDown(swap, { key: "Escape" });
  expect(screen.getByRole("dialog", { name: "Обмен" })).toBe(swap);
  fireEvent.click(await within(swap).findByRole("button", { name: "В истории" }));
  expect(container.querySelectorAll('[data-product-activity-id^="commerce-simulation:"]')).toHaveLength(2);
  receipt = screen.getByRole("region", { name: "Квитанция операции" });
  expect(receipt).toHaveTextContent("Демо-обмен");
  expect(within(receipt).getByText("101 USDC")).toBeInTheDocument();
  expect(within(receipt).getByText("0,04 ETH")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Обмены" }));
  expect(container.querySelectorAll('[data-product-activity-id^="commerce-simulation:"]')).toHaveLength(1);
  rerender(<MonoProductScene snapshot={wallet} appearance={envelope.appearance} material={envelope.material}
    session={{ balanceHidden: true, onBalanceHiddenChange() {}, period: "1D", onPeriodChange() {} }} />);
  receipt = screen.getByRole("region", { name: "Квитанция операции" });
  expect(receipt).not.toHaveTextContent("101 USDC");
  expect(receipt).not.toHaveTextContent("0,04 ETH");
  const row = container.querySelector<HTMLButtonElement>('[data-product-activity-id^="commerce-simulation:"]')!;
  expect(row.getAttribute("aria-label")).not.toMatch(/101 USDC|0,04 ETH/);
});

it("commerce wiring restores only the placement Buy raw draft across appearance and close without restoring a quote", async () => {
  const { rerender, wallet, envelope } = await home();
  fireEvent.click(screen.getByRole("button", { name: /Мои средства/ }));
  fireEvent.click(screen.getByRole("button", { name: "Открыть актив USD Coin (USDC)" }));
  fireEvent.click(screen.getByRole("radio", { name: "Выбрать размещение: Основной · Ethereum" }));
  const launcher = screen.getByRole("button", { name: "Купить USDC · Основной · Ethereum" });
  fireEvent.click(launcher);
  fireEvent.click(await screen.findByRole("button", { name: "Продолжить" }));
  fireEvent.change(await screen.findByRole("textbox", { name: "Сумма, USD" }), { target: { value: "23," } });
  const frost = createMonoAppearanceEnvelope("frost");
  rerender(<MonoProductScene snapshot={wallet} appearance={frost.appearance} material={envelope.material} />);
  expect(screen.getByRole("textbox", { name: "Сумма, USD" })).toHaveValue("23,");
  fireEvent.click(within(screen.getByRole("dialog", { name: "Купить" })).getByRole("button", { name: "Закрыть" }));
  await waitFor(() => expect(launcher).toHaveFocus());
  fireEvent.click(launcher);
  fireEvent.click(await screen.findByRole("button", { name: "Продолжить" }));
  expect(await screen.findByRole("textbox", { name: "Сумма, USD" })).toHaveValue("23,");
  expect(screen.queryByRole("button", { name: "Подтвердить симуляцию" })).toBeNull();
});

it("commerce wiring explains a main action with no offered route instead of selecting another account", async () => {
  const { rerender, wallet, envelope } = await home();
  const snapshot = { ...MULTI_ACCOUNT_DEMO, accounts: MULTI_ACCOUNT_DEMO.accounts.map(account => ({ ...account,
    capabilities: account.capabilities.filter(capability => capability.action !== "buy" && capability.action !== "swap") })) };
  rerender(<MonoProductScene snapshot={wallet} appearance={envelope.appearance} material={envelope.material}
    productAdapter={{ kind: "demo", snapshot }} />);
  fireEvent.click(screen.getByRole("button", { name: "Купить" }));
  const dialog = screen.getByRole("dialog", { name: "Купить" });
  expect(dialog).toHaveTextContent("Доступных маршрутов");
  expect(within(dialog).queryByRole("button", { name: "Подтвердить симуляцию" })).toBeNull();
  fireEvent.click(within(dialog).getByRole("button", { name: "Закрыть" }));
  expect(screen.getByRole("button", { name: /Выбрать счёт: Все счета/ })).toBeInTheDocument();
});
