import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { WalletProfile } from "@wallet/core";
import { afterEach, expect, it, vi } from "vitest";
import { createDemoActivities, type ProductActivity } from "./demo-activity";
import { ProductHistory } from "./product-history";
import { ProductProfile } from "./product-profile";

afterEach(cleanup);

const profile: WalletProfile = {
  name: "Александр",
  shortAddress: "0x4i7…A91F",
  avatarUrl: null,
};

const activities: readonly ProductActivity[] = [
  {
    id: "pending-a",
    accountId: "account-a",
    accountLabel: "Основной счёт",
    direction: "outgoing",
    status: "pending",
    assetSymbol: "USDT",
    quantity: "12.345",
    networkLabel: "TON",
    occurredAt: "2026-10-01T12:00:00.000Z",
    feeLabel: "0.05 TON",
  },
  {
    id: "completed-a",
    accountId: "account-a",
    accountLabel: "Основной счёт",
    direction: "incoming",
    status: "completed",
    assetSymbol: "ETH",
    quantity: "2.5",
    networkLabel: "Ethereum",
    occurredAt: "2026-09-30T11:00:00.000Z",
  },
  {
    id: "failed-b",
    accountId: "account-b",
    accountLabel: "Другой счёт",
    direction: "outgoing",
    status: "failed",
    assetSymbol: "BTC",
    quantity: "0.75",
    networkLabel: "Bitcoin",
    occurredAt: "2026-09-29T10:00:00.000Z",
  },
];

it("creates three stable demo states for the supplied account", () => {
  const first = createDemoActivities("account-a", "Основной счёт");
  expect(first).toHaveLength(3);
  expect(first.map((activity) => activity.status)).toEqual(["pending", "completed", "failed"]);
  expect(first.every((activity) => activity.accountId === "account-a" && activity.accountLabel === "Основной счёт")).toBe(true);
  expect(createDemoActivities("account-a", "Основной счёт")).toEqual(first);
  expect(first.every((activity) => !Number.isNaN(Date.parse(activity.occurredAt)))).toBe(true);
});

it("shows only the selected account's operations and its own empty state", () => {
  const { rerender } = render(<ProductHistory activities={activities} balanceHidden={false} accountId="account-a" accountLabel="Основной счёт" />);
  expect(screen.getByRole("button", { name: /USDT/ })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /ETH/ })).toBeInTheDocument();
  expect(screen.queryByText("BTC")).not.toBeInTheDocument();

  rerender(<ProductHistory activities={activities} balanceHidden={false} accountId="account-c" accountLabel="Пустой счёт" />);
  expect(screen.getByText(/операций пока нет/i)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /USDT|ETH|BTC/ })).not.toBeInTheDocument();
});

it("exposes each operation status and expands network, account, time and known fee", () => {
  render(<ProductHistory activities={activities} balanceHidden={false} />);
  expect(screen.getByText("В обработке")).toBeInTheDocument();
  expect(screen.getByText("Выполнено")).toBeInTheDocument();
  expect(screen.getByText("Не выполнено")).toBeInTheDocument();

  const row = screen.getByRole("button", { name: /USDT/ });
  expect(row).toHaveAttribute("aria-expanded", "false");
  expect(document.getElementById(row.getAttribute("aria-controls") ?? "")).toHaveAttribute("hidden");
  expect(screen.queryByText("0.05 TON")).not.toBeInTheDocument();
  fireEvent.click(row);
  expect(row).toHaveAttribute("aria-expanded", "true");
  expect(document.getElementById(row.getAttribute("aria-controls") ?? "")).not.toHaveAttribute("hidden");
  expect(screen.getByText("TON")).toBeInTheDocument();
  expect(screen.getByText("Основной счёт")).toBeInTheDocument();
  expect(screen.getByText("0.05 TON")).toBeInTheDocument();
  expect(screen.getByText(/1 октября 2026/i)).toBeInTheDocument();
});

it("hides quantities and fees from visible and accessible details when privacy is on", () => {
  const { container } = render(<ProductHistory activities={[activities[0]]} balanceHidden />);
  fireEvent.click(screen.getByRole("button", { name: /USDT/ }));
  expect(screen.getByText("TON")).toBeInTheDocument();
  expect(container.innerHTML).not.toMatch(/12\.345|0\.05/);
  expect(screen.getByText("Комиссия")).toBeInTheDocument();
  expect(screen.getAllByText("••••").length).toBeGreaterThan(0);
});

it("keeps an unknown fee unknown instead of calling it zero", () => {
  render(<ProductHistory activities={[activities[1]]} balanceHidden={false} />);
  fireEvent.click(screen.getByRole("button", { name: /ETH/ }));
  expect(screen.getByText(/комиссия не указана/i)).toBeInTheDocument();
  expect(screen.queryByText(/0(?:[.,]0+)?\s*ETH/)).not.toBeInTheDocument();
});

it("opens a controlled activity and requests collapse without overriding the parent", () => {
  const onExpandedActivityChange = vi.fn();
  const { rerender } = render(<ProductHistory activities={activities} balanceHidden={false}
    accountId="account-a" expandedActivityId="pending-a" onExpandedActivityChange={onExpandedActivityChange} />);
  const row = screen.getByRole("button", { name: /USDT/ });
  expect(row).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByText("0.05 TON")).toBeInTheDocument();

  fireEvent.click(row);
  expect(onExpandedActivityChange).toHaveBeenCalledExactlyOnceWith(null);
  expect(row).toHaveAttribute("aria-expanded", "true");

  rerender(<ProductHistory activities={activities} balanceHidden={false}
    accountId="account-a" expandedActivityId={null} onExpandedActivityChange={onExpandedActivityChange} />);
  expect(row).toHaveAttribute("aria-expanded", "false");
  expect(screen.queryByText("0.05 TON")).not.toBeInTheDocument();
  fireEvent.click(row);
  expect(onExpandedActivityChange).toHaveBeenLastCalledWith("pending-a");
});

it("does not expand a controlled record from another account", () => {
  const { rerender } = render(<ProductHistory activities={activities} balanceHidden={false}
    accountId="account-a" expandedActivityId="pending-a" />);
  expect(screen.getByText("0.05 TON")).toBeInTheDocument();

  rerender(<ProductHistory activities={activities} balanceHidden={false}
    accountId="account-b" expandedActivityId="pending-a" />);
  expect(screen.getByRole("button", { name: /BTC/ })).toHaveAttribute("aria-expanded", "false");
  expect(screen.queryByText("0.05 TON")).not.toBeInTheDocument();
  expect(screen.queryByText("Основной счёт")).not.toBeInTheDocument();
});

it("announces loading and suppresses stale rows and expanded details until ready", () => {
  const { container, rerender } = render(<ProductHistory activities={activities} balanceHidden={false}
    expandedActivityId="pending-a" status="loading" />);
  expect(screen.getByRole("status")).toHaveTextContent(/загружаем операции/i);
  expect(screen.queryByRole("list")).not.toBeInTheDocument();
  expect(container.innerHTML).not.toMatch(/12\.345|0\.05/);
  expect(screen.queryByText(/операций пока нет/i)).not.toBeInTheDocument();

  rerender(<ProductHistory activities={activities} balanceHidden={false}
    expandedActivityId="pending-a" status="ready" />);
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: /USDT/ })).toHaveAttribute("aria-expanded", "true");
});

it("shows a safe error and exposes the supplied retry instead of stale rows", () => {
  const onRetry = vi.fn();
  const { container } = render(<ProductHistory activities={activities} balanceHidden={false}
    expandedActivityId="pending-a" status="error" onRetry={onRetry} />);
  expect(screen.getByRole("alert")).toHaveTextContent(/не удалось загрузить операции/i);
  expect(screen.queryByRole("list")).not.toBeInTheDocument();
  expect(container.innerHTML).not.toMatch(/12\.345|0\.05/);
  fireEvent.click(screen.getByRole("button", { name: "Повторить" }));
  expect(onRetry).toHaveBeenCalledOnce();
});

it("does not offer a retry when no retry command was supplied", () => {
  render(<ProductHistory activities={[]} balanceHidden status="error" />);
  expect(screen.getByRole("alert")).toBeInTheDocument();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  expect(screen.queryByText(/операций пока нет/i)).not.toBeInTheDocument();
});

it("requests a controlled privacy change from the profile", () => {
  const onBalanceHiddenChange = vi.fn();
  const { rerender } = render(<ProductProfile profile={profile} balanceHidden={false} onBalanceHiddenChange={onBalanceHiddenChange} />);
  expect(screen.getByText("Идентификатор демо-профиля")).toBeInTheDocument();
  const privacy = screen.getByRole("button", { name: "Скрыть суммы" });
  const settings = screen.getByRole("button", { name: "Настройки" });
  expect(document.getElementById(settings.getAttribute("aria-controls") ?? "")).toHaveAttribute("hidden");
  fireEvent.click(privacy);
  expect(onBalanceHiddenChange).toHaveBeenCalledExactlyOnceWith(true);
  expect(privacy).toHaveAttribute("aria-pressed", "false");

  rerender(<ProductProfile profile={profile} balanceHidden onBalanceHiddenChange={onBalanceHiddenChange} />);
  expect(screen.getByRole("button", { name: "Показать суммы" })).toHaveAttribute("aria-pressed", "true");
});
