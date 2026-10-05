import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { ProductActivity } from "./demo-activity";
import { ProductHistory } from "./product-history";

afterEach(cleanup);

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
function search(input: HTMLInputElement, value: string) { fireEvent.change(input, { target: { value } }); }
function status(value: string) { fireEvent.change(screen.getByRole("combobox", { name: "Статус операций" }), { target: { value } }); }

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
  expect(screen.getByRole("combobox", { name: "Статус операций" })).toHaveValue("all");
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
  expect(screen.getByRole("combobox", { name: "Статус операций" })).toHaveValue("all");
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
  expect(screen.getByRole("combobox", { name: "Статус операций" })).toHaveValue("failed");
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
  rerender(<ProductHistory activities={activities} status="error" balanceHidden={false} onRetry={vi.fn()} />);
  expect(screen.getByRole("alert")).toHaveTextContent("Не удалось загрузить операции");
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Сбросить фильтры" })).not.toBeInTheDocument();
  rerender(<ProductHistory activities={[]} balanceHidden={false} />);
  expect(screen.getByText("Для этого счёта операций пока нет.")).toBeInTheDocument();
  expect(screen.queryByText("Нет совпадений")).not.toBeInTheDocument();
});
