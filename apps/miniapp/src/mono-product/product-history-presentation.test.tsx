import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { ProductActivity } from "./demo-activity";
import type { CommerceSimulation } from "./commerce";
import { buyQuote, swapQuote } from "./commerce/test-fixtures";
import { ProductHistory } from "./product-history";

afterEach(cleanup);

const incoming: ProductActivity = {
  id: "incoming-a", accountId: "account-a", accountLabel: "Основной", assetId: "usdc", assetSymbol: "USDC",
  networkId: "ethereum", networkLabel: "Ethereum", direction: "incoming", status: "completed",
  quantity: "31.456789", feeLabel: "0.004321 ETH", occurredAt: "2026-10-03T09:00:00Z",
};
const outgoing: ProductActivity = { ...incoming, id: "outgoing-a", direction: "outgoing", status: "failed",
  networkId: "solana", networkLabel: "Solana", quantity: "7.91" };
const activities = [incoming, outgoing, { ...incoming, id: "incoming-b", accountId: "account-b" }];

function commerceActivity(kind: "buy" | "swap", status: "completed" | "failed" = "completed"): ProductActivity {
  const result = status === "completed" ? { mode: "demo" as const, status: "simulated-success" as const }
    : { mode: "demo" as const, status: "simulated-failure" as const, reason: "rejected" as const };
  const commerce: CommerceSimulation = kind === "buy"
    ? { mode: "demo", kind, simulationId: "history-buy", idempotencyKey: "history", quote: buyQuote(), result }
    : { mode: "demo", kind, simulationId: "history-swap", idempotencyKey: "history", quote: swapQuote(), result };
  return { ...incoming, id: commerce.simulationId, accountId: "demo-custody", mode: "simulation", status,
    direction: kind === "buy" ? "incoming" : "exchange", quantity: "987.654321", commerce };
}

function rowIds(container: HTMLElement): string[] {
  return [...container.querySelectorAll<HTMLButtonElement>("[data-product-activity-id]")].map(row => row.dataset.productActivityId!);
}

it("combines direction and account filtering, while every external opening remains visible", () => {
  const change = vi.fn();
  const { container, rerender } = render(<ProductHistory activities={activities} accountId="account-a" balanceHidden={false}
    expandedActivityId={null} onExpandedActivityChange={change} />);
  fireEvent.click(screen.getByRole("button", { name: "Получения" }));
  expect(rowIds(container)).toEqual(["incoming-a"]);
  const originalDetailsId = container.querySelector("[data-product-activity-id='incoming-a']")?.getAttribute("aria-controls");

  rerender(<ProductHistory activities={activities} accountId="account-a" balanceHidden={false}
    expandedActivityId="outgoing-a" onExpandedActivityChange={change} />);
  expect(screen.getByRole("button", { name: "Все" })).toHaveAttribute("aria-pressed", "true");
  expect(rowIds(container)).toEqual(["incoming-a", "outgoing-a"]);
  expect(container.querySelector("[data-product-activity-id='outgoing-a']")).toHaveAttribute("aria-expanded", "true");
  expect(container.querySelector("[data-product-activity-id='incoming-a']")).toHaveAttribute("aria-controls", originalDetailsId);

  rerender(<ProductHistory activities={activities} accountId="account-a" balanceHidden={false}
    expandedActivityId={null} onExpandedActivityChange={change} />);
  fireEvent.click(screen.getByRole("button", { name: "Получения" }));
  rerender(<ProductHistory activities={activities} accountId="account-a" balanceHidden={false}
    expandedActivityId="outgoing-a" onExpandedActivityChange={change} />);
  expect(container.querySelector("[data-product-activity-id='outgoing-a']")).toHaveAttribute("aria-expanded", "true");
  expect(rowIds(container)).not.toContain("incoming-b");
});

it("can clear an empty direction filter within an already asset-filtered input", () => {
  const change = vi.fn();
  const { container } = render(<ProductHistory activities={[outgoing]} balanceHidden={false} onExpandedActivityChange={change} />);
  fireEvent.click(screen.getByRole("button", { name: /Отправка.*USDC/ }));
  expect(change).toHaveBeenCalledWith("outgoing-a");
  fireEvent.click(screen.getByRole("button", { name: "Получения" }));
  expect(change).toHaveBeenLastCalledWith(null);
  expect(rowIds(container)).toEqual([]);
  expect(screen.getByText("Нет совпадений")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Сбросить фильтры" }));
  expect(rowIds(container)).toEqual(["outgoing-a"]);
  expect(container.querySelector("[data-product-activity-id='outgoing-a']")).toHaveAttribute("aria-expanded", "false");
});

it("keeps private quantity and fee masked after filtering and expanding", () => {
  const { container } = render(<ProductHistory activities={activities} balanceHidden />);
  fireEvent.click(screen.getByRole("button", { name: "Получения" }));
  const row = container.querySelector<HTMLButtonElement>("[data-product-activity-id='incoming-a']")!;
  fireEvent.click(row);
  expect(row).toHaveAccessibleName(/Сумма скрыта/);
  expect(container.innerHTML).not.toMatch(/31[.,]456789|0[.,]004321/);
  expect(screen.getByRole("region", { name: "Квитанция операции" })).toHaveTextContent("••••");
});

it.each([
  { direction: "incoming" as const, status: "failed" as const, label: "Не выполнено" },
  { direction: "outgoing" as const, status: "completed" as const, label: "Выполнено" },
  { direction: "outgoing" as const, status: "pending" as const, label: "В обработке" },
])("separates the $direction form from the $status outcome", ({ direction, status, label }) => {
  const { container } = render(<ProductHistory activities={[{ ...incoming, direction, status }]} balanceHidden={false} />);
  const row = container.querySelector<HTMLButtonElement>("[data-product-activity-id]")!;
  expect(row).toHaveAttribute("data-direction", direction);
  expect(row).toHaveAttribute("data-status", status);
  expect(row.querySelector(`[data-history-direction-icon='${direction}']`)).toHaveAttribute("data-status", status);
  expect(row.querySelector(`[data-history-status-icon='${status}']`)).toBeInTheDocument();
  expect(within(row).getByText(label)).toBeInTheDocument();
  expect(within(row).getByText("31,456789")).toBeInTheDocument();
  expect(row).toHaveAccessibleName(new RegExp(label));
});

it("keeps full simulation semantics accessible without repeating the status inside its receipt", () => {
  const simulation: ProductActivity = { ...incoming, mode: "simulation" };
  const { container } = render(<ProductHistory activities={[simulation]} balanceHidden={false} expandedActivityId={simulation.id} />);
  const row = container.querySelector<HTMLButtonElement>("[data-product-activity-id]")!;
  expect(row).toHaveAccessibleName(/Симуляция завершена/);
  expect(within(row).getByText("Завершено")).toBeInTheDocument();
  const receipt = screen.getByRole("region", { name: "Квитанция операции" });
  expect(receipt).not.toHaveTextContent("Симуляция завершена");
  expect(receipt).toHaveTextContent("средства и заряд батарейки не списаны");
});

it.each([
  { kind: "buy" as const, label: "Демо-покупка", debitLabel: "Оплата", debit: "101 USD", credit: "100 USDC" },
  { kind: "swap" as const, label: "Демо-обмен", debitLabel: "Списание", debit: "101 USDC", credit: "0,04 ETH" },
])("renders one $kind row with the accepted debit and net credit in their own units", ({ kind, label, debitLabel, debit, credit }) => {
  const activity = commerceActivity(kind);
  const { container } = render(<ProductHistory activities={[activity]} balanceHidden={false} />);
  const row = screen.getByRole("button", { name: new RegExp(label) });
  expect(rowIds(container)).toEqual([activity.id]);
  expect(within(row).getByText(debitLabel).nextElementSibling).toHaveTextContent(debit);
  expect(within(row).getByText("Получение").nextElementSibling).toHaveTextContent(credit);
  expect(row).toHaveAccessibleName(new RegExp(`${debitLabel}: ${debit}`));
  expect(row).toHaveAccessibleName(new RegExp(`Получение: ${credit}`));
  expect(container.innerHTML).not.toMatch(/987[.,]654321|0[.,]0404|102 USD/);
});

it("keeps a failed swap as an exchange when direction and status filters are combined", () => {
  const failed = commerceActivity("swap", "failed");
  const completed = { ...commerceActivity("swap"), id: "completed-swap" };
  const { container } = render(<ProductHistory activities={[failed, completed, outgoing]} balanceHidden={false} />);
  fireEvent.click(screen.getByRole("button", { name: "Обмены" }));
  expect(rowIds(container)).toEqual([failed.id, completed.id]);
  fireEvent.change(screen.getByRole("combobox", { name: "Статус операций" }), { target: { value: "failed" } });
  expect(rowIds(container)).toEqual([failed.id]);
  const row = screen.getByRole("button", { name: /Демо-обмен.*Симуляция не выполнена/ });
  expect(row).toHaveAttribute("data-direction", "exchange");
  expect(row.querySelector("[data-history-direction-icon='exchange']")).toBeInTheDocument();
  expect(row.querySelector("[data-history-direction-icon='outgoing']")).not.toBeInTheDocument();
  expect(row.querySelector("[data-history-status-icon='failed']")).toBeInTheDocument();
  expect(row).not.toHaveAccessibleName(/Демо-отправка/);
});

it.each(["buy", "swap"] as const)("removes both %s legs and fees from DOM and attributes when privacy changes and the receipt reopens", kind => {
  const activity = commerceActivity(kind);
  if (activity.commerce?.kind === "buy") {
    activity.commerce.quote.debit.amount = "101.23";
    activity.commerce.quote.fee = { status: "known", amount: "1.23", unit: { kind: "fiat", currency: "USD", decimals: 2 } };
  } else if (activity.commerce?.kind === "swap") {
    activity.commerce.quote.debit.quantity = "101.234567";
    activity.commerce.quote.fee = { status: "known", amount: "1.234567", unit: activity.commerce.quote.debit };
  }
  const { container, rerender } = render(<ProductHistory activities={[activity]} balanceHidden={false} />);
  const row = container.querySelector<HTMLButtonElement>("[data-product-activity-id]")!;
  fireEvent.click(row);
  expect(screen.getByRole("region", { name: "Квитанция операции" })).toBeInTheDocument();
  rerender(<ProductHistory activities={[activity]} balanceHidden />);
  const secret = /101[.,]23(?:4567)?|1[.,]23(?:4567)?|100 USDC|0[.,]04|987[.,]654321|0[.,]004321/;
  expect(container.innerHTML).not.toMatch(secret);
  expect(row).toHaveAccessibleName(/Сумма скрыта/);
  expect(row).toHaveAccessibleName(/Получение: Сумма скрыта/);
  fireEvent.click(row);
  expect(screen.queryByRole("region", { name: "Квитанция операции" })).not.toBeInTheDocument();
  fireEvent.click(row);
  expect(screen.getByRole("region", { name: "Квитанция операции" })).toHaveTextContent("••••");
  expect(container.innerHTML).not.toMatch(secret);
  for (const element of container.querySelectorAll("[aria-label], [title], [hidden]")) {
    expect(`${element.getAttribute("aria-label")} ${element.getAttribute("title")} ${element.textContent}`).not.toMatch(secret);
  }
});
