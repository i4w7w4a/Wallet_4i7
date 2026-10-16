import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { ProductActivity } from "./demo-activity";
import { createBuyActivityFixture, createSwapActivityFixture, createSwapSimulationFixture } from "./commerce-test-fixtures";
import { ProductPendingActivity } from "./product-pending-activity";
import { resolvePendingActivityEntry, selectPendingActivityIds } from "./pending-activity";

afterEach(cleanup);
const pending: ProductActivity = {
  id: "older", accountId: "account-a", accountLabel: "A", assetSymbol: "USDC", quantity: "31.456789",
  feeLabel: "0.004321 ETH", networkLabel: "Ethereum", status: "pending", direction: "outgoing", occurredAt: "2026-09-26T00:00:00Z",
};
const completed: ProductActivity = { ...pending, id: "latest", status: "completed", occurredAt: "2026-10-10T00:00:00Z" };

it.each([
  { label: "zero", activities: [completed], count: 0, target: undefined },
  { label: "one", activities: [completed, pending], count: 1, target: "older" },
  { label: "many", activities: [completed, pending, { ...pending, id: "other" }], count: 2, target: null },
])("N1 shows $label without money and sends an exact ID only for one event", ({ activities, count, target }) => {
  const open = vi.fn(() => "opened" as const);
  const { container } = render(<ProductPendingActivity activities={activities} status="ready" onOpen={open} />);
  if (!count) { expect(screen.queryByRole("button")).toBeNull(); return; }
  const entry = screen.getByRole("button", { name: `В процессе · ${count}` });
  expect(entry).toHaveAccessibleDescription(count === 1
    ? "Отправка USDC Ethereum · A Примеры и симуляции"
    : "USDC Ethereum Примеры и симуляции");
  expect(container.textContent).not.toMatch(/31[.,]456789|0[.,]004321|ETA|минут/);
  fireEvent.click(entry); expect(open).toHaveBeenCalledWith(target);
});

it.each(["loading", "error"] as const)("N1 honestly displays %s rather than a ready zero or stale counter", status => {
  const retry = vi.fn();
  render(<ProductPendingActivity activities={[pending]} status={status} onOpen={() => "opened"} onRetry={retry} />);
  expect(screen.queryByRole("button", { name: /В процессе/ })).toBeNull();
  expect(screen.getByRole("status")).toHaveTextContent(status === "loading" ? "Проверяем операции…" : "Операции сейчас недоступны");
  if (status === "error") { fireEvent.click(screen.getByRole("button", { name: "Повторить" })); expect(retry).toHaveBeenCalledOnce(); }
  else expect(screen.queryByRole("button", { name: "Повторить" })).toBeNull();
});

it("N1 offers no invented retry, and distinguishes a navigation guard from a vanished identity", () => {
  const open = vi.fn(() => "blocked" as "blocked" | "unavailable");
  const { rerender } = render(<ProductPendingActivity activities={[pending]} status="ready" onOpen={open} />);
  fireEvent.click(screen.getByRole("button", { name: "В процессе · 1" }));
  expect(screen.queryByRole("status")).toBeNull();
  open.mockReturnValue("unavailable");
  fireEvent.click(screen.getByRole("button", { name: "В процессе · 1" }));
  expect(screen.getByRole("status")).toHaveTextContent("Операции сейчас недоступны");
  expect(screen.queryByRole("button", { name: "Повторить" })).toBeNull();
  rerender(<ProductPendingActivity activities={[]} status="error" onOpen={open} />);
  expect(screen.queryByRole("button")).toBeNull();
  rerender(<ProductPendingActivity activities={[pending]} status="ready" onOpen={open} />);
  expect(screen.getByRole("button", { name: "В процессе · 1" })).toBeInTheDocument();
});

it("N1 counts internal and two-leg commerce events once globally, including repeated event IDs", () => {
  const internal: ProductActivity = { ...pending, id: "internal", internalTransfer: {
    sourceAccountId: "a", sourceAccountLabel: "A", destinationAccountId: "b", destinationAccountLabel: "B",
  } };
  const swap = createSwapActivityFixture({ status: "pending" });
  expect(selectPendingActivityIds([completed, internal, swap, internal])).toEqual(["internal", "commerce-swap-fixture"]);
});

it("N1 opens an updated result, rejects missing or ambiguous IDs, and never chooses the first event for many", () => {
  expect(resolvePendingActivityEntry([{ ...pending, status: "completed" }], "older"))
    .toEqual({ kind: "single", activityId: "older", status: "all" });
  expect(resolvePendingActivityEntry([{ ...pending, status: "failed" }], "older"))
    .toEqual({ kind: "single", activityId: "older", status: "all" });
  expect(resolvePendingActivityEntry([completed], "older")).toEqual({ kind: "unavailable" });
  expect(resolvePendingActivityEntry([pending, pending], "older")).toEqual({ kind: "unavailable" });
  expect(resolvePendingActivityEntry([pending, pending, { ...pending, id: "another" }], null)).toEqual({ kind: "unavailable" });
  expect(resolvePendingActivityEntry([pending], null)).toEqual({ kind: "many" });
  expect(resolvePendingActivityEntry([completed], null)).toEqual({ kind: "unavailable" });
});

it("N1 does not turn an unknown status or missing identity into a confirmed zero", () => {
  expect(selectPendingActivityIds([{ ...pending, status: "unknown" } as unknown as ProductActivity])).toBeNull();
  expect(selectPendingActivityIds([{ ...pending, id: "" }])).toBeNull();
});

it("N1 metadata identifies the exact single pending without exposing its money in visible or assistive text", () => {
  const open = vi.fn(() => "opened" as const);
  render(<ProductPendingActivity activities={[
    { ...completed, assetId: "btc", assetSymbol: "BTC", networkLabel: "Bitcoin", accountLabel: "Другой счёт" },
    { ...pending, assetId: "usdc", direction: "incoming", accountLabel: "Основной" },
  ]} status="ready" onOpen={open} />);
  const entry = screen.getByRole("button", { name: "В процессе · 1" });
  expect(screen.getByText("Получение USDC")).toBeVisible();
  expect(screen.getByText("Ethereum · Основной")).toBeVisible();
  expect(entry).toHaveAccessibleDescription("Получение USDC Ethereum · Основной Примеры и симуляции");
  expect(entry.querySelector("img")).toHaveAttribute("src", "/media/currency-logos/usdc.svg");
  expect(entry.outerHTML).not.toMatch(/31[.,]456789|0[.,]004321|Bitcoin|Другой счёт|BTC|ETA|минут/);
  fireEvent.click(entry);
  expect(open).toHaveBeenCalledWith("older");
});

it("N1 metadata retains the buy identity and uses its canonical crypto logo rather than a fiat or legacy logo", () => {
  render(<ProductPendingActivity activities={[createBuyActivityFixture({
    status: "pending", assetId: "btc", assetSymbol: "BTC", networkLabel: "Bitcoin", accountLabel: "Устаревший счёт",
  })]} status="ready" onOpen={() => "opened"} />);
  const entry = screen.getByRole("button", { name: "В процессе · 1" });
  expect(screen.getByText("Демо-покупка USD → USDC")).toBeVisible();
  expect(entry).toHaveAccessibleDescription("Демо-покупка USD → USDC Ethereum · Основной Примеры и симуляции");
  expect(entry.querySelector("img")).toHaveAttribute("src", "/media/currency-logos/usdc.svg");
  expect(entry.outerHTML).not.toMatch(/101|100|Демо-курс|Bitcoin|Устаревший счёт|btc\.svg/);
});

it("N1 metadata retains both swap assets, networks and supplied participant accounts", () => {
  const commerce = createSwapSimulationFixture();
  commerce.quote.credit = { ...commerce.quote.credit,
    networkId: "solana", networkLabel: "Solana", accountId: "vault", accountLabel: "Хранилище" };
  commerce.quote.request.destination = { ...commerce.quote.credit };
  render(<ProductPendingActivity activities={[createSwapActivityFixture({ status: "pending", commerce })]}
    status="ready" onOpen={() => "opened"} />);
  const entry = screen.getByRole("button", { name: "В процессе · 1" });
  expect(screen.getByText("Демо-обмен USDC → ETH")).toBeVisible();
  expect(screen.getByText("Ethereum → Solana · Основной → Хранилище")).toBeVisible();
  expect(entry).toHaveAccessibleDescription("Демо-обмен USDC → ETH Ethereum → Solana · Основной → Хранилище Примеры и симуляции");
  expect([...entry.querySelectorAll("img")].map(image => image.getAttribute("src")))
    .toEqual(["/media/currency-logos/usdc.svg", "/media/currency-logos/eth.svg"]);
  expect(entry.outerHTML).not.toMatch(/101|100|0[.,]04|2500|Демо-курс|Получение/);
});

it("N1 metadata distinguishes internal movement and preserves the supplied source and destination", () => {
  render(<ProductPendingActivity activities={[{ ...pending, assetId: "usdc", accountLabel: "Устаревший счёт",
    internalTransfer: { sourceAccountId: "a", sourceAccountLabel: "Основной",
      destinationAccountId: "b", destinationAccountLabel: "Хранилище" },
  }]} status="ready" onOpen={() => "opened"} />);
  const entry = screen.getByRole("button", { name: "В процессе · 1" });
  expect(screen.getByText("Между счетами · демо · USDC")).toBeVisible();
  expect(screen.getByText("Ethereum · Основной → Хранилище")).toBeVisible();
  expect(entry).toHaveAccessibleDescription("Между счетами · демо · USDC Ethereum · Основной → Хранилище Примеры и симуляции");
  expect(entry.outerHTML).not.toMatch(/31[.,]456789|0[.,]004321|Устаревший счёт|Отправка/);
});

it("N1 metadata bounds the many-event asset summary while retaining the full unique count and pending route", () => {
  const open = vi.fn(() => "opened" as const);
  const usdc = { ...pending, assetId: "usdc", accountLabel: "Не выделять этот счёт" };
  render(<ProductPendingActivity activities={[completed, usdc, { ...usdc, id: "second-usdc" },
    createSwapActivityFixture({ status: "pending" }),
    { ...pending, id: "bitcoin-pending", assetId: "btc", assetSymbol: "BTC", networkLabel: "Bitcoin" }, usdc,
  ]} status="ready" onOpen={open} />);
  const entry = screen.getByRole("button", { name: "В процессе · 4" });
  expect(screen.getByText("USDC · USDC → ETH · …")).toBeVisible();
  expect(entry).toHaveAccessibleDescription("USDC · USDC → ETH · … Ethereum Примеры и симуляции");
  expect(entry.outerHTML).not.toMatch(/BTC|Bitcoin|Отправка|Не выделять этот счёт|31[.,]456789|0[.,]004321|101|100|0[.,]04/);
  fireEvent.click(entry);
  expect(open).toHaveBeenCalledWith(null);
});

it.each([undefined, "unknown-usdc"])("N1 metadata uses a neutral logo for unknown canonical identity %s", assetId => {
  render(<ProductPendingActivity activities={[{ ...pending, assetId }]}
    status="ready" onOpen={() => "opened"} />);
  const entry = screen.getByRole("button", { name: "В процессе · 1" });
  expect(screen.getByText("Отправка USDC")).toBeVisible();
  expect(entry.querySelector('[data-currency-logo="generic"]')).not.toBeNull();
  expect(entry.querySelector("img")).toBeNull();
});

it("N1 metadata does not recognize an arbitrary record when a single pending ID is ambiguous", () => {
  const open = vi.fn(() => "unavailable" as const);
  render(<ProductPendingActivity activities={[
    { ...pending, assetId: "usdc" },
    { ...pending, assetId: "btc", assetSymbol: "BTC", accountLabel: "Другой счёт", networkLabel: "Bitcoin" },
  ]} status="ready" onOpen={open} />);
  const entry = screen.getByRole("button", { name: "В процессе · 1" });
  expect(entry).toHaveAccessibleDescription("Сведения операции недоступны Примеры и симуляции");
  expect(entry.outerHTML).not.toMatch(/USDC|BTC|Ethereum|Bitcoin|Другой счёт/);
  expect(entry.querySelector('[data-currency-logo="generic"]')).not.toBeNull();
  fireEvent.click(entry);
  expect(open).toHaveBeenCalledWith("older");
  expect(screen.getByRole("status")).toHaveTextContent("Операции сейчас недоступны");
});
