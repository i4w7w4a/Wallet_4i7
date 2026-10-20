import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ProductActivity } from "./demo-activity";
import { ProductHistory } from "./product-history";

const completed: ProductActivity = {
  id: "completed", accountId: "a", accountLabel: "Основной", assetId: "usdc", assetSymbol: "USDC",
  networkId: "ethereum", networkLabel: "Ethereum", direction: "incoming", status: "completed", quantity: "31.456789",
  feeLabel: "0.004321 ETH", occurredAt: "2026-10-03T09:00:00Z",
};
const pending: ProductActivity = { ...completed, id: "pending", direction: "outgoing", status: "pending",
  occurredAt: "2026-10-03T00:30:00+03:00" };
const failed: ProductActivity = { ...pending, id: "failed", status: "failed", occurredAt: "2026-10-01T09:00:00Z" };
function row(id: string) { return document.querySelector<HTMLButtonElement>(`[data-product-activity-id='${id}']`)!; }
function ids() {
  return [...document.querySelectorAll<HTMLElement>("[data-product-activity-id]")].map(element => element.dataset.productActivityId);
}
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    if (this.hasAttribute("data-history-status-trigger")) return new DOMRect(246, 110, 44, 44);
    if (this.hasAttribute("data-history-status-filter")) return new DOMRect(246, 110, 128, 44);
    return new DOMRect();
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

// Falling back to ordinary rows loses UTC groups and repeats completed metadata.
it("groups compact neutral rows by UTC date with amount/currency together and explicit noncompleted status", () => {
  render(<ProductHistory presentation="compact" activities={[completed, pending, failed]} balanceHidden={false} />);
  expect(screen.getAllByRole("heading", { level: 2 }).map(heading => heading.textContent))
    .toEqual(["3 октября 2026 г.", "2 октября 2026 г.", "1 октября 2026 г."]);
  expect(row("completed")).not.toHaveTextContent(/Выполнено|Ethereum|3 окт/);
  expect(row("completed")).toHaveAccessibleName("Получение · USDC · Ethereum, Выполнено, 31,456789 USDC");
  expect(within(row("completed")).getByText("USDC").closest("strong")).toHaveTextContent("31,456789 USDC");
  expect(row("pending")).toHaveTextContent("В обработке");
  expect(row("failed")).toHaveTextContent("Не выполнено");
  expect(row("pending").querySelector("[data-history-status-icon]")).not.toBeNull();
  expect(row("failed").querySelector("[data-history-status-icon]")).not.toBeNull();
});

it("keeps compact search, direction/status filters, empty reset and the existing inline receipt", () => {
  render(<ProductHistory presentation="compact" activities={[completed, pending, failed]} balanceHidden={false} />);
  fireEvent.click(row("completed"));
  expect(screen.getByRole("region", { name: "Квитанция операции" })).toHaveTextContent("31,456789 USDC");
  fireEvent.click(screen.getByRole("button", { name: "Отправки" }));
  expect(screen.queryByRole("region", { name: "Квитанция операции" })).toBeNull();
  expect(ids()).toEqual(["pending", "failed"]);
  fireEvent.click(screen.getByRole("button", { name: "Поиск по операциям" }));
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "never-found" } });
  expect(screen.getByText("Нет совпадений")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Сбросить фильтры" }));
  expect(ids()).toEqual(["completed", "pending", "failed"]);
  fireEvent.click(screen.getByRole("button", { name: "Фильтр статуса" }));
  fireEvent.click(screen.getByRole("button", { name: "Ожидают" }));
  expect(ids()).toEqual(["pending"]);
  expect(screen.getByRole("heading", { name: "2 октября 2026 г." })).toBeVisible();
});

it("masks compact row names and receipt fields without hiding the direction or unknown status", () => {
  const unknown = { ...completed, id: "unknown", status: "future-status" } as unknown as ProductActivity;
  const result = render(<ProductHistory presentation="compact" activities={[unknown]} balanceHidden />);
  expect(row("unknown")).toHaveTextContent("Статус неизвестен");
  expect(row("unknown")).toHaveAccessibleName(/Получение.*Статус неизвестен.*Сумма скрыта/);
  fireEvent.click(row("unknown"));
  expect(result.container.innerHTML).not.toMatch(/31[.,]456789|0[.,]004321/);
});

it("retains compact empty, loading, error and retry resource states", () => {
  let attempts = 0;
  const retry = () => { attempts += 1; };
  const view = render(<ProductHistory presentation="compact" activities={[]} balanceHidden={false} status="loading" />);
  expect(screen.getByRole("status")).toHaveTextContent("Загружаем операции…");
  view.rerender(<ProductHistory presentation="compact" activities={[]} balanceHidden={false} status="error" onRetry={retry} />);
  expect(screen.getByRole("alert")).toHaveTextContent("Не удалось загрузить операции.");
  fireEvent.click(screen.getByRole("button", { name: "Повторить" }));
  expect(attempts).toBe(1);
  view.rerender(<ProductHistory presentation="compact" activities={[]} balanceHidden={false} />);
  expect(screen.getByText("Для этого счёта операций пока нет.")).toBeVisible();
});
