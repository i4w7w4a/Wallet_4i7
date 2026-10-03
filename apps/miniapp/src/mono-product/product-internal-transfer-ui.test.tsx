import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MockWalletRepository } from "@wallet/core";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MonoProductScene } from "../mono-preview/mono-product-scene";
import { createMonoAppearanceEnvelope } from "../mono-preview/mono-preset-envelope";
import { ProductRecentActivity } from "./product-recent-activity";
import type { ProductActivity } from "./demo-activity";

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduced-motion"), media: query,
    addEventListener() {}, removeEventListener() {} }));
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("restores only the internal draft across appearance/privacy, then opens one exact operation in both account histories", async () => {
  const wallet = await new MockWalletRepository().getSnapshot();
  const ledger = createMonoAppearanceEnvelope("ledger"), frost = createMonoAppearanceEnvelope("frost");
  const session = { balanceHidden: false, onBalanceHiddenChange: vi.fn(), period: "1D" as const, onPeriodChange: vi.fn() };
  const { container, rerender } = render(<MonoProductScene snapshot={wallet} appearance={ledger.appearance} material={ledger.material} session={session} />);
  const openFromAll = () => {
    fireEvent.click(screen.getByRole("button", { name: "Получить" }));
    fireEvent.click(screen.getByRole("button", { name: "Хранилище" }));
    fireEvent.click(screen.getByRole("button", { name: "USDC · USD Coin · Ethereum · Хранилище · Между счетами" }));
  };
  openFromAll();
  fireEvent.change(await screen.findByRole("textbox", { name: "Сумма пополнения" }), { target: { value: "0012,50" } });
  fireEvent.click(within(screen.getByRole("dialog", { name: "Получить" })).getByRole("button", { name: "Закрыть" }));
  openFromAll();
  expect(await screen.findByRole("textbox", { name: "Сумма пополнения" })).toHaveValue("0012,50");
  fireEvent.click(screen.getByRole("button", { name: "Рассчитать пример" }));
  await screen.findByRole("button", { name: "Подтвердить симуляцию" });
  rerender(<MonoProductScene snapshot={wallet} appearance={frost.appearance} material={frost.material}
    session={{ ...session, balanceHidden: true }} />);
  expect(screen.queryByRole("textbox", { name: "Сумма пополнения" })).toBeNull();
  expect(container.innerHTML).not.toContain("0012,50");
  // Appearance can keep the current modal mounted; close it to exercise restoration from session memory.
  fireEvent.click(within(screen.getByRole("dialog", { name: "Получить" })).getByRole("button", { name: "Закрыть" }));
  rerender(<MonoProductScene snapshot={wallet} appearance={frost.appearance} material={frost.material} session={session} />);
  openFromAll();
  expect(await screen.findByRole("textbox", { name: "Сумма пополнения" })).toHaveValue("0012,50");
  expect(screen.queryByRole("button", { name: "Подтвердить симуляцию" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Рассчитать пример" }));
  fireEvent.click(await screen.findByRole("button", { name: "Подтвердить симуляцию" }));
  fireEvent.click(await screen.findByRole("button", { name: "В истории" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(container.querySelector("[data-mono-preview]")).toHaveAttribute("data-mono-section", "history");
  const internalRows = () => [...container.querySelectorAll<HTMLButtonElement>('[data-product-activity-id^="internal-simulation:"]')];
  expect(internalRows()).toHaveLength(1);
  const id = internalRows()[0]!.dataset.productActivityId;
  expect(internalRows()[0]).toHaveAttribute("aria-expanded", "true");
  await waitFor(() => expect(internalRows()[0]).toHaveFocus());
  const receipt = within(screen.getByRole("region", { name: "Квитанция операции" }));
  expect(receipt.getByText("Откуда")).toBeVisible();
  expect(receipt.getByText("Куда")).toBeVisible();
  expect(receipt.getByText("Основной")).toBeVisible();
  expect(receipt.getByText("Хранилище")).toBeVisible();
  expect(receipt.getByText("Комиссия примера")).toBeVisible();
  expect(receipt.getByText("0 USDC")).toBeVisible();
  rerender(<MonoProductScene snapshot={wallet} appearance={frost.appearance} material={frost.material}
    session={{ ...session, balanceHidden: true }} />);
  expect(screen.getByRole("region", { name: "Квитанция операции" })).not.toHaveTextContent("12,5");
  expect(screen.getByRole("region", { name: "Квитанция операции" })).not.toHaveTextContent("0 USDC");
  rerender(<MonoProductScene snapshot={wallet} appearance={frost.appearance} material={frost.material} session={session} />);
  const selectAccount = (name: string) => {
    fireEvent.click(screen.getByRole("button", { name: /Выбрать счёт:/ }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "Выбор счёта" })).getByRole("button", { name: new RegExp(name) }));
  };
  selectAccount("Хранилище");
  expect(internalRows()).toHaveLength(1);
  expect(internalRows()[0]).toHaveAttribute("data-product-activity-id", id);
  expect(internalRows()[0]).toHaveAttribute("data-direction", "incoming");
  fireEvent.click(screen.getByRole("button", { name: "Получения" }));
  expect(internalRows()).toHaveLength(1);
  selectAccount("Основной");
  fireEvent.click(screen.getByRole("button", { name: "Все" }));
  expect(internalRows()[0]).toHaveAttribute("data-direction", "outgoing");
  expect(internalRows()[0]).toHaveAttribute("data-product-activity-id", id);
  selectAccount("Все счета");
  expect(internalRows()).toHaveLength(1);
  // A completed operation survives history, but its draft and confirmation do not reopen.
  fireEvent.click(screen.getByRole("button", { name: "Обзор" }));
  openFromAll();
  expect(await screen.findByRole("textbox", { name: "Сумма пополнения" })).toHaveValue("");
  expect(screen.queryByRole("button", { name: "Подтвердить симуляцию" })).toBeNull();
});

it("projects the recent internal operation for the destination and preserves its exact history ID", () => {
  const event: ProductActivity = { id: "internal-simulation:recent", accountId: "demo-custody", accountLabel: "Основной",
    mode: "simulation", direction: "outgoing", status: "completed", assetId: "usdc", assetSymbol: "USDC", quantity: "12.5",
    networkId: "ethereum", networkLabel: "Ethereum", occurredAt: "2026-10-03T12:00:00Z",
    internalTransfer: { sourceAccountId: "demo-custody", sourceAccountLabel: "Основной",
      destinationAccountId: "demo-depositary", destinationAccountLabel: "Хранилище" } };
  const onOpenActivity = vi.fn();
  const { rerender } = render(<ProductRecentActivity activities={[event]} accountId="demo-depositary" balanceHidden={false} onOpenActivity={onOpenActivity} />);
  const row = screen.getByRole("button", { name: /Между счетами · демо/ });
  expect(row).toHaveAttribute("data-direction", "incoming");
  fireEvent.click(row);
  expect(onOpenActivity).toHaveBeenCalledWith(event.id);
  rerender(<ProductRecentActivity activities={[event]} accountId="demo-custody" balanceHidden onOpenActivity={onOpenActivity} />);
  expect(screen.getByRole("button", { name: /Сумма скрыта/ })).toHaveAttribute("data-direction", "outgoing");
  expect(screen.queryByText("12,5")).toBeNull();
  expect(event.direction).toBe("outgoing");
});
