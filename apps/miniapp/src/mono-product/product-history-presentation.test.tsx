import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { ProductActivity } from "./demo-activity";
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
  expect(screen.getByText("Получений пока нет")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Показать все" }));
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
