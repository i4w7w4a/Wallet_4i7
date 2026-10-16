import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ProductActivity } from "./demo-activity";
import { ProductHistory } from "./product-history";

beforeEach(() => {
  // JSDOM supplies no layout; keep the real filter and only supply its anchor geometry.
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    if (this.hasAttribute("data-history-status-trigger")) return new DOMRect(246, 110, 44, 44);
    if (this.hasAttribute("data-history-status-filter")) return new DOMRect(246, 110, 128, 44);
    return new DOMRect();
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const pending: ProductActivity = {
  id: "pending-eth", accountId: "main", accountLabel: "Основной", assetId: "usdc", assetSymbol: "USDC",
  networkId: "ethereum", networkLabel: "Ethereum", direction: "incoming", status: "pending",
  quantity: "31.456789", feeLabel: "0.004321 ETH", occurredAt: "2026-10-03T10:00:00Z",
};
const completed: ProductActivity = { ...pending, id: "completed-eth", direction: "outgoing", status: "completed" };
const failed: ProductActivity = { ...pending, id: "failed-sol", networkId: "solana", networkLabel: "Solana", status: "failed" };
const foreign: ProductActivity = { ...failed, id: "foreign-sol", accountId: "foreign", accountLabel: "Другой" };
const activities = [pending, completed, failed, foreign];

function rowIds(container: HTMLElement) {
  return [...container.querySelectorAll<HTMLButtonElement>("[data-product-activity-id]")].map(row => row.dataset.productActivityId);
}
function searchInput() {
  fireEvent.click(screen.getByRole("button", { name: "Поиск по операциям" }));
  return screen.getByRole<HTMLInputElement>("searchbox", { name: "Валюта, сеть или счёт" });
}
function search(input: HTMLInputElement, value: string) {
  act(() => input.focus());
  fireEvent.change(input, { target: { value } });
}
function status(value: "all" | "pending" | "completed" | "failed") {
  const labels = { all: "Все статусы", pending: "Ожидают", completed: "Завершены", failed: "Ошибки" };
  fireEvent.click(screen.getByRole("button", { name: "Фильтр статуса" }));
  fireEvent.click(screen.getByRole("button", { name: labels[value] }));
}
function expectStatus(label: string) {
  expect(screen.getByRole("button", { name: "Фильтр статуса" })).toHaveAccessibleDescription(`Текущий статус: ${label}`);
}

it("N1 applies an explicit pending request once, retains manual filters on rerender, and reapplies on a new entry", () => {
  const { container, rerender } = render(<ProductHistory activities={activities} balanceHidden={false} />);
  const input = searchInput();
  search(input, "Solana"); fireEvent.click(screen.getByRole("button", { name: "Получения" })); status("failed");
  rerender(<ProductHistory activities={activities} balanceHidden={false} filterRequest={{ revision: 1, status: "pending" }} />);
  expect(rowIds(container)).toEqual(["pending-eth"]);
  expectStatus("Ожидают");
  expect(screen.getByRole("button", { name: "Все" })).toHaveAttribute("aria-pressed", "true");
  const freshInput = searchInput(); search(freshInput, "Solana"); status("failed");
  rerender(<ProductHistory activities={activities} balanceHidden filterRequest={{ revision: 1, status: "pending" }} />);
  expect(freshInput).toHaveValue("Solana"); expectStatus("Ошибки");
  expect(rowIds(container)).toEqual(["failed-sol", "foreign-sol"]);
  rerender(<ProductHistory activities={activities} balanceHidden filterRequest={{ revision: 2, status: "pending" }} />);
  expect(rowIds(container)).toEqual(["pending-eth"]); expectStatus("Ожидают");
});

it("N1 reveals an exact ID under the requested status without widening a supplied account scope", () => {
  const { container, rerender } = render(<ProductHistory activities={activities} accountId="main" balanceHidden={false}
    expandedActivityId={null} />);
  status("failed");
  rerender(<ProductHistory activities={activities} accountId="main" balanceHidden={false} expandedActivityId="pending-eth"
    filterRequest={{ revision: 1, status: "pending" }} />);
  expect(rowIds(container)).toEqual(["pending-eth"]);
  expect(container.querySelector("[data-product-activity-id='pending-eth']")).toHaveAttribute("aria-expanded", "true");
  rerender(<ProductHistory activities={activities} accountId="main" balanceHidden={false} expandedActivityId="foreign-sol"
    filterRequest={{ revision: 2, status: "all" }} />);
  expect(rowIds(container)).toEqual(["pending-eth", "completed-eth", "failed-sol"]);
  expect(screen.queryByRole("region", { name: "Квитанция операции" })).toBeNull();
});

it("opens status settings at the current choice and resets only status within query and direction", () => {
  const { container } = render(<ProductHistory activities={activities} accountId="main" balanceHidden={false} />);
  const input = searchInput();
  search(input, "USDC Ethereum");
  fireEvent.click(screen.getByRole("button", { name: "Получения" }));
  const trigger = screen.getByRole("button", { name: "Фильтр статуса" });
  trigger.focus();
  fireEvent.click(trigger, { detail: 0 });
  expect(screen.getByRole("button", { name: "Все статусы", pressed: true })).toHaveFocus();
  fireEvent.click(screen.getByRole("button", { name: "Ошибки" }));
  expect(screen.getByText("Нет совпадений")).toBeInTheDocument();
  expect(trigger).toHaveFocus();
  fireEvent.click(screen.getByRole("button", { name: "Сбросить фильтр статуса" }));
  expect(input).toHaveValue("USDC Ethereum");
  expect(screen.getByRole("button", { name: "Получения" })).toHaveAttribute("aria-pressed", "true");
  expect(rowIds(container)).toEqual(["pending-eth"]);
  expect(screen.queryByRole("button", { name: "Сбросить фильтр статуса" })).not.toBeInTheDocument();
});

it("combines query, direction and status without merging USDC networks or leaking another account", () => {
  const { container } = render(<ProductHistory activities={activities} accountId="main" balanceHidden={false} />);
  const input = searchInput();
  search(input, "  usdc   ETHereum основ  ");
  expect(rowIds(container)).toEqual(["pending-eth", "completed-eth"]);
  fireEvent.click(screen.getByRole("button", { name: "Получения" }));
  status("pending");
  expect(rowIds(container)).toEqual(["pending-eth"]);
  status("failed");
  expect(screen.getByText("Нет совпадений")).toBeInTheDocument();
  search(input, "USDC Solana основ");
  expect(rowIds(container)).toEqual(["failed-sol"]);
  expect(input).toHaveFocus();
});

it("resets local filters without broadening a supplied asset/network/account scope", () => {
  const { container } = render(<ProductHistory activities={[pending, failed]} accountId="main" accountLabel="Основной"
    balanceHidden={false} />);
  const input = searchInput();
  search(input, "bitcoin");
  fireEvent.click(screen.getByRole("button", { name: "Отправки" }));
  status("failed");
  expect(screen.getByText("Нет совпадений")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Сбросить фильтры" }));
  expect(input).toHaveValue("");
  expectStatus("Все статусы");
  expect(screen.getByRole("button", { name: "Все" })).toHaveAttribute("aria-pressed", "true");
  expect(rowIds(container)).toEqual(["pending-eth", "failed-sol"]);
});

it("reveals a new external target once, then respects manual narrowing even before controlled close is acknowledged", () => {
  const change = vi.fn();
  const { container, rerender } = render(<ProductHistory activities={activities} accountId="main" balanceHidden={false}
    expandedActivityId={null} onExpandedActivityChange={change} />);
  const input = searchInput();
  search(input, "Solana");
  fireEvent.click(screen.getByRole("button", { name: "Получения" }));
  status("failed");
  rerender(<ProductHistory activities={activities} accountId="main" balanceHidden={false}
    expandedActivityId="completed-eth" onExpandedActivityChange={change} />);
  expect(rowIds(container)).toEqual(["pending-eth", "completed-eth", "failed-sol"]);
  expect(container.querySelector("[data-product-activity-id='completed-eth']")).toHaveAttribute("aria-expanded", "true");
  expect(input).toHaveValue("");
  expectStatus("Все статусы");
  search(input, "Solana");
  expect(change).toHaveBeenLastCalledWith(null);
  expect(rowIds(container)).toEqual(["failed-sol"]);
  expect(screen.queryByRole("region", { name: "Квитанция операции" })).not.toBeInTheDocument();
  search(input, "bitcoin");
  fireEvent.click(screen.getByRole("button", { name: "Сбросить фильтры" }));
  expect(container.querySelector("[data-product-activity-id='completed-eth']")).toHaveAttribute("aria-expanded", "false");
  rerender(<ProductHistory activities={activities} accountId="main" balanceHidden={false}
    expandedActivityId={null} onExpandedActivityChange={change} />);
  search(input, "Solana");
  rerender(<ProductHistory activities={activities} accountId="main" balanceHidden={false}
    expandedActivityId="completed-eth" onExpandedActivityChange={change} />);
  expect(container.querySelector("[data-product-activity-id='completed-eth']")).toHaveAttribute("aria-expanded", "true");
});

it("keeps a manually opened filtered row filtered when the controlled parent acknowledges it", () => {
  const change = vi.fn();
  const { container, rerender } = render(<ProductHistory activities={activities} accountId="main" balanceHidden={false}
    expandedActivityId={null} onExpandedActivityChange={change} />);
  const input = searchInput();
  search(input, "Solana");
  status("failed");
  fireEvent.click(screen.getByRole("button", { name: /Получение.*Solana/ }));
  rerender(<ProductHistory activities={activities} accountId="main" balanceHidden={false}
    expandedActivityId="failed-sol" onExpandedActivityChange={change} />);
  expect(input).toHaveValue("Solana");
  expectStatus("Ошибки");
  expect(rowIds(container)).toEqual(["failed-sol"]);
  expect(screen.getByRole("region", { name: "Квитанция операции" })).toBeInTheDocument();
});

it("never finds hidden amounts or fees and keeps row and receipt accessible names masked", () => {
  const { container } = render(<ProductHistory activities={[pending]} balanceHidden />);
  const input = searchInput();
  search(input, "31.456789");
  expect(rowIds(container)).toEqual([]);
  search(input, "0.004321");
  expect(rowIds(container)).toEqual([]);
  search(input, "USDC");
  const row = screen.getByRole("button", { name: /Получение.*USDC.*Сумма скрыта/ });
  fireEvent.click(row);
  expect(screen.getByRole("region", { name: "Квитанция операции" })).toHaveTextContent("••••");
  expect(container.innerHTML).not.toMatch(/31[.,]456789|0[.,]004321/);
});

it("keeps typing focused, bounds query input and clears Escape without closing its parent", () => {
  const parentKeyDown = vi.fn();
  render(<div onKeyDown={parentKeyDown}><ProductHistory activities={activities} balanceHidden={false} /></div>);
  const input = searchInput();
  expect(input).toHaveAttribute("maxlength", "80");
  search(input, "u".repeat(90));
  expect(input.value).toHaveLength(80);
  expect(input).toHaveFocus();
  fireEvent.keyDown(input, { key: "Escape" });
  expect(input).toHaveValue("");
  expect(input).toHaveFocus();
  expect(parentKeyDown).not.toHaveBeenCalled();
  search(input, "USDC");
  fireEvent.click(screen.getByRole("button", { name: "Очистить поиск" }));
  expect(input).toHaveValue("");
  expect(input).toHaveFocus();
});

it("keeps loading, empty history and load failure distinct from local no matches", () => {
  const { rerender } = render(<ProductHistory activities={activities} status="loading" balanceHidden={false} />);
  expect(screen.getByRole("status")).toHaveTextContent("Загружаем операции");
  expect(screen.queryByRole("button", { name: "Поиск по операциям" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Фильтр статуса" })).not.toBeInTheDocument();
  rerender(<ProductHistory activities={activities} status="error" balanceHidden={false} onRetry={vi.fn()} />);
  expect(screen.getByRole("alert")).toHaveTextContent("Не удалось загрузить операции");
  expect(screen.queryByRole("button", { name: "Фильтр статуса" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Сбросить фильтры" })).not.toBeInTheDocument();
  rerender(<ProductHistory activities={[]} balanceHidden={false} />);
  expect(screen.getByText("Для этого счёта операций пока нет.")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Фильтр статуса" })).not.toBeInTheDocument();
  expect(screen.queryByText("Нет совпадений")).not.toBeInTheDocument();
});

it("dismisses an incompatible receipt on status selection and keeps it closed after status reset", () => {
  const change = vi.fn();
  const { container } = render(<ProductHistory activities={activities} accountId="main" balanceHidden={false}
    expandedActivityId="completed-eth" onExpandedActivityChange={change} />);
  expect(screen.getByRole("region", { name: "Квитанция операции" })).toBeInTheDocument();
  status("pending");
  expect(rowIds(container)).toEqual(["pending-eth"]);
  expect(screen.queryByRole("region", { name: "Квитанция операции" })).not.toBeInTheDocument();
  expect(change).toHaveBeenLastCalledWith(null);
  fireEvent.click(screen.getByRole("button", { name: "Сбросить фильтр статуса" }));
  expect(container.querySelector("[data-product-activity-id='completed-eth']")).toHaveAttribute("aria-expanded", "false");
});

it("closes a status panel on account and supplied asset/network scope changes without clearing query", () => {
  const { rerender } = render(<ProductHistory activities={activities} accountId="main" balanceHidden={false} />);
  const input = searchInput();
  search(input, "USDC");
  fireEvent.click(screen.getByRole("button", { name: "Фильтр статуса" }));
  rerender(<ProductHistory activities={activities} accountId="foreign" balanceHidden={false} />);
  expect(screen.queryByRole("dialog", { name: "Статус операций" })).not.toBeInTheDocument();
  expect(input).toHaveValue("USDC");
  fireEvent.click(screen.getByRole("button", { name: "Фильтр статуса" }));
  rerender(<ProductHistory activities={[pending]} accountId="main" balanceHidden={false} />);
  expect(screen.queryByRole("dialog", { name: "Статус операций" })).not.toBeInTheDocument();
  expect(input).toHaveValue("USDC");
});
