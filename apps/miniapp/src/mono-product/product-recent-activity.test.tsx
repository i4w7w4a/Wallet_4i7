import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { ProductActivity } from "./demo-activity";
import { ProductHistory } from "./product-history";
import { ProductRecentActivity } from "./product-recent-activity";

afterEach(cleanup);

const activities: readonly ProductActivity[] = Object.freeze([
  {
    id: "older-a",
    accountId: "account-a",
    accountLabel: "Основной счёт",
    direction: "outgoing",
    status: "pending",
    assetSymbol: "USDT",
    quantity: "12.345",
    networkLabel: "TON",
    occurredAt: "2026-09-30T12:00:00.000Z",
  },
  {
    id: "latest-b",
    accountId: "account-b",
    accountLabel: "Другой счёт",
    direction: "outgoing",
    status: "failed",
    assetSymbol: "BTC",
    quantity: "0.75",
    networkLabel: "Bitcoin",
    occurredAt: "2026-10-02T12:00:00.000Z",
  },
  {
    id: "latest-a",
    accountId: "account-a",
    accountLabel: "Основной счёт",
    direction: "incoming",
    status: "completed",
    assetSymbol: "ETH",
    quantity: "2.5",
    networkLabel: "Ethereum",
    occurredAt: "2026-10-01T12:00:00.000Z",
    feeLabel: "0.005 ETH",
  },
]);

it("offers only the newest selected-account activity without reordering the input", () => {
  const onOpenActivity = vi.fn();
  render(<ProductRecentActivity activities={activities} balanceHidden={false}
    accountId="account-a" onOpenActivity={onOpenActivity} />);
  const row = screen.getByRole("button", { name: /Получение.*ETH.*Выполнено.*2,5/i });
  expect(row.querySelector("[data-history-direction-icon='incoming']")).toBeInTheDocument();
  expect(row.querySelector("[data-history-status-icon='completed']")).toBeInTheDocument();
  expect(row).toHaveAttribute("data-product-activity-id", "latest-a");
  expect(screen.getAllByRole("button")).toHaveLength(1);
  expect(screen.queryByText(/USDT|BTC/)).not.toBeInTheDocument();
  fireEvent.click(row);
  expect(onOpenActivity).toHaveBeenCalledExactlyOnceWith("latest-a");
  expect(activities.map((activity) => activity.id)).toEqual(["older-a", "latest-b", "latest-a"]);
});

it("uses the newest activity across accounts when no account scope is supplied", () => {
  const onOpenActivity = vi.fn();
  render(<ProductRecentActivity activities={activities} balanceHidden={false} onOpenActivity={onOpenActivity} />);
  fireEvent.click(screen.getByRole("button", { name: /Отправка.*BTC.*Не выполнено/i }));
  expect(onOpenActivity).toHaveBeenCalledExactlyOnceWith("latest-b");
});

it("renders no invented activity for an empty selected account", () => {
  const onOpenActivity = vi.fn();
  const { container, rerender } = render(<ProductRecentActivity activities={activities} balanceHidden={false}
    accountId="empty-account" onOpenActivity={onOpenActivity} />);
  expect(container).toBeEmptyDOMElement();

  rerender(<ProductRecentActivity activities={[]} balanceHidden={false} onOpenActivity={onOpenActivity} />);
  expect(container).toBeEmptyDOMElement();
});

it("masks recent quantity in both visible and accessible text and exposes no fee", () => {
  const { container, rerender } = render(<ProductRecentActivity activities={activities} balanceHidden
    accountId="account-a" onOpenActivity={() => undefined} />);
  expect(screen.getByText(/••••/)).toBeInTheDocument();
  const row = screen.getByRole("button", { name: /Получение.*ETH/i });
  expect(row).not.toHaveAccessibleName(/2[.,]5|0[.,]005/);
  expect(container.innerHTML).not.toMatch(/2[.,]5|0[.,]005/);

  rerender(<ProductRecentActivity activities={activities} balanceHidden={false}
    accountId="account-a" onOpenActivity={() => undefined} />);
  expect(row).toHaveAccessibleName(/2,5/);
  expect(container.innerHTML).not.toMatch(/0[.,]005/);
});

it.each([
  { status: "completed" as const, label: "Симуляция завершена" },
  { status: "failed" as const, label: "Симуляция не выполнена" },
])("keeps recent $status simulation labels and decimal precision consistent with private history", ({ status, label }) => {
  const simulation: ProductActivity = {
    ...activities[0],
    id: "simulation-a",
    mode: "simulation",
    status,
    quantity: "0.123456789012345678",
    occurredAt: "2026-10-03T09:00:00.000Z",
  };
  const onOpenActivity = vi.fn();
  const { container, rerender } = render(<ProductRecentActivity activities={[simulation]} balanceHidden
    accountId="account-a" onOpenActivity={onOpenActivity} />);
  const row = screen.getByRole("button", { name: /Демо-отправка.*USDT/ });
  expect(row).toHaveAccessibleName(new RegExp(label));
  expect(row).toHaveAccessibleName(/сумма скрыта/i);
  expect(container.innerHTML).not.toContain("123456789012345678");
  expect(screen.queryByText("Выполнено")).not.toBeInTheDocument();
  fireEvent.click(row);
  expect(onOpenActivity).toHaveBeenCalledExactlyOnceWith("simulation-a");

  rerender(<ProductRecentActivity activities={[simulation]} balanceHidden={false}
    accountId="account-a" onOpenActivity={onOpenActivity} />);
  expect(row).toHaveAccessibleName(/0,123456789012345678/);
  expect(container).toHaveTextContent("0,123456789012345678");
});

it("opens the selected history detail from recent activity and permits collapsing it", () => {
  function Scenario() {
    const [expandedActivityId, setExpandedActivityId] = useState<string | null>(null);
    return <>
      <ProductRecentActivity activities={activities} balanceHidden={false}
        accountId="account-a" onOpenActivity={setExpandedActivityId} />
      <ProductHistory activities={activities} balanceHidden={false} accountId="account-a"
        expandedActivityId={expandedActivityId} onExpandedActivityChange={setExpandedActivityId} />
    </>;
  }

  render(<Scenario />);
  const recent = within(screen.getByRole("region", { name: "Последняя операция" }));
  const history = within(screen.getByRole("region", { name: "История операций" }));
  fireEvent.click(recent.getByRole("button"));
  const historyRow = history.getByRole("button", { name: /ETH/ });
  expect(historyRow).toHaveAttribute("aria-expanded", "true");
  expect(within(history.getByRole("region", { name: "Квитанция операции" })).getByText("Ethereum")).toBeInTheDocument();
  fireEvent.click(historyRow);
  expect(historyRow).toHaveAttribute("aria-expanded", "false");
  expect(history.queryByRole("region", { name: "Квитанция операции" })).not.toBeInTheDocument();
  expect(within(historyRow).getByText("Ethereum")).toBeInTheDocument();
});
