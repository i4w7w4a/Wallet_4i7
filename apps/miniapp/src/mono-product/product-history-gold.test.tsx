import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ProductActivity } from "./demo-activity";
import type { CommerceSimulation } from "./commerce";
import { buyQuote, swapQuote } from "./commerce/test-fixtures";
import { ProductHistory } from "./product-history";

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    if (this.hasAttribute("data-history-status-trigger")) return new DOMRect(246, 110, 44, 44);
    if (this.hasAttribute("data-history-status-filter")) return new DOMRect(246, 110, 128, 44);
    return new DOMRect();
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const incoming: ProductActivity = {
  id: "incoming-a", accountId: "account-a", accountLabel: "Основной", assetId: "usdc", assetSymbol: "USDC",
  networkId: "ethereum", networkLabel: "Ethereum", direction: "incoming", status: "completed",
  quantity: "31.456789", feeLabel: "0.004321 ETH", occurredAt: "2026-10-03T09:00:00Z",
};
const pending: ProductActivity = { ...incoming, id: "pending-a", direction: "outgoing", status: "pending",
  occurredAt: "2026-10-02T09:00:00Z" };
const failed: ProductActivity = { ...pending, id: "failed-a", status: "failed", occurredAt: "2026-10-01T09:00:00Z" };

function row(id: string, container: HTMLElement = document.body): HTMLButtonElement {
  return container.querySelector<HTMLButtonElement>(`[data-product-activity-id='${id}']`)!;
}
function rowIds(container: HTMLElement = document.body) {
  return [...container.querySelectorAll<HTMLElement>("[data-product-activity-id]")].map(element => element.dataset.productActivityId);
}
function dateHeadings() {
  return screen.queryAllByRole("heading", { level: 2 }).map(heading => heading.textContent);
}
function commerceActivity(kind: "buy" | "swap", status: "completed" | "failed" = "completed"): ProductActivity {
  const result = status === "failed"
    ? { mode: "demo" as const, status: "simulated-failure" as const, reason: "rejected" as const }
    : { mode: "demo" as const, status: "simulated-success" as const };
  const commerce: CommerceSimulation = kind === "buy"
    ? { mode: "demo", kind, simulationId: "history-buy", idempotencyKey: "history", quote: buyQuote(), result }
    : { mode: "demo", kind, simulationId: "history-swap", idempotencyKey: "history", quote: swapQuote(), result };
  return { ...incoming, id: commerce.simulationId, accountId: "demo-custody", mode: "simulation", status,
    direction: kind === "buy" ? "incoming" : "exchange", quantity: "987.654321", commerce };
}

it("groups the visible operations by their UTC date without merging years, losing invalid dates or changing order", () => {
  const activities = [incoming,
    { ...incoming, id: "same-utc-day", occurredAt: "2026-10-04T00:30:00+03:00" },
    { ...incoming, id: "previous-day", occurredAt: "2026-10-03T00:30:00+03:00" },
    { ...incoming, id: "previous-year", occurredAt: "2025-10-03T09:00:00Z" },
    { ...incoming, id: "invalid-date", occurredAt: "not-a-date" },
    { ...incoming, id: "missing-date", occurredAt: "" }];
  render(<ProductHistory presentation="gold" activities={activities} balanceHidden={false} />);
  expect(dateHeadings()).toEqual(["3 октября 2026 г.", "2 октября 2026 г.", "3 октября 2025 г.", "Дата не указана"]);
  expect(rowIds()).toEqual(["incoming-a", "same-utc-day", "previous-day", "previous-year", "invalid-date", "missing-date"]);
  expect(rowIds(screen.getByRole("group", { name: "3 октября 2026 г." }))).toEqual(["incoming-a", "same-utc-day"]);
  expect(rowIds(screen.getByRole("group", { name: "Дата не указана" }))).toEqual(["invalid-date", "missing-date"]);
  expect(screen.getByRole("heading", { name: "3 октября 2026 г." }).querySelector("time")).toHaveAttribute("datetime", "2026-10-03");
  expect(screen.getByRole("heading", { name: "Дата не указана" }).querySelector("time")).toBeNull();
});

it("keeps a completed Gold row compact with its amount and currency together and its full accessible identity", () => {
  render(<ProductHistory presentation="gold" activities={[incoming]} balanceHidden={false} />);
  const button = row(incoming.id);
  expect(button).not.toHaveTextContent(/Выполнено|Завершено|Ethereum|3 окт/);
  expect(button.querySelector("time")).toBeNull();
  expect(within(button).getByText("USDC").closest("strong")).toHaveTextContent("31,456789 USDC");
  expect(button).toHaveAccessibleName("Получение · USDC · Ethereum, Выполнено, 31,456789 USDC");
  expect(button.querySelector("[data-history-direction-icon='incoming'] svg")).toBeInTheDocument();
});

it.each([
  { activity: pending, label: "В обработке", icon: "pending" },
  { activity: failed, label: "Не выполнено", icon: "failed" },
  { activity: { ...pending, mode: "simulation" as const }, label: "В процессе", icon: "pending" },
  { activity: { ...failed, mode: "simulation" as const }, label: "Сбой", icon: "failed" },
])("keeps $icon explicit in Gold with text and its own icon, without a row date or a settled-balance sign", ({ activity, label, icon }) => {
  render(<ProductHistory presentation="gold" activities={[activity]} balanceHidden={false} />);
  const button = row(activity.id);
  expect(button.querySelector("time")).toBeNull();
  expect(within(button).getByText(label)).toBeVisible();
  expect(button.querySelector(`[data-history-status-icon='${icon}']`)).toBeInTheDocument();
  expect(button.textContent).not.toMatch(/[+−-]31/);
});

it("does not interpret an unknown Gold status as a failure or a completed operation", () => {
  const activity = { ...incoming, status: "unknown-from-source" } as unknown as ProductActivity;
  render(<ProductHistory presentation="gold" activities={[activity]} balanceHidden={false} />);
  const button = row(activity.id);
  expect(within(button).getByText("Статус неизвестен")).toBeVisible();
  expect(button).toHaveAccessibleName(/Статус неизвестен/);
  expect(button.querySelector("[data-history-status-icon='failed'], [data-history-status-icon='completed']")).toBeNull();
  expect(button).not.toHaveAccessibleName(/undefined|Не выполнено|Выполнено/);
});

it("groups only search and direction/status matches, removes empty groups and keeps reset usable", () => {
  render(<ProductHistory presentation="gold" activities={[incoming, pending, failed]} balanceHidden={false} />);
  expect(dateHeadings()).toHaveLength(3);
  fireEvent.click(screen.getByRole("button", { name: "Поиск по операциям" }));
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Ethereum Основной" } });
  fireEvent.click(screen.getByRole("button", { name: "Отправки" }));
  fireEvent.click(screen.getByRole("button", { name: "Фильтр статуса" }));
  fireEvent.click(screen.getByRole("button", { name: "Ожидают" }));
  expect(rowIds()).toEqual(["pending-a"]);
  expect(dateHeadings()).toEqual(["2 октября 2026 г."]);
  expect(screen.getByRole("button", { name: "Поиск по операциям" })).toHaveAccessibleDescription("Поисковый фильтр применён");
  expect(screen.getByRole("button", { name: "Фильтр статуса" })).toHaveAccessibleDescription(/Ожидают/);
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "нет такой сети" } });
  expect(screen.getByText("Нет совпадений")).toBeVisible();
  expect(dateHeadings()).toEqual([]);
  fireEvent.click(screen.getByRole("button", { name: "Сбросить фильтры" }));
  expect(rowIds()).toEqual(["incoming-a", "pending-a", "failed-a"]);
  expect(dateHeadings()).toHaveLength(3);
});

it.each([
  { kind: "buy" as const, debitLabel: "Оплата", debit: "101 USD", credit: "100 USDC" },
  { kind: "swap" as const, debitLabel: "Списание", debit: "101 USDC", credit: "0,04 ETH" },
])("keeps both accepted $kind legs in their original units inside a compact row", ({ kind, debitLabel, debit, credit }) => {
  const activity = commerceActivity(kind);
  render(<ProductHistory presentation="gold" activities={[activity]} balanceHidden={false} />);
  const button = row(activity.id);
  expect(button).not.toHaveTextContent(/Завершено|Выполнено/);
  expect(within(button).getByText(debitLabel).nextElementSibling).toHaveTextContent(debit);
  expect(within(button).getByText("Получение").nextElementSibling).toHaveTextContent(credit);
  expect(button).toHaveAccessibleName(new RegExp(`${debitLabel}: ${debit}`));
  expect(button).toHaveAccessibleName(new RegExp(`Получение: ${credit}`));
  expect(button).not.toHaveTextContent(/987[.,]654321|0[.,]0404|102 USD/);
  expect(button.querySelector(`[data-history-direction-icon='${activity.direction}']`)).toBeInTheDocument();
});

it("shows both internal-transfer accounts without presenting a single external debit", () => {
  const activity: ProductActivity = { ...incoming, id: "own-transfer", direction: "outgoing", mode: "simulation",
    internalTransfer: { sourceAccountId: "account-a", sourceAccountLabel: "Основной",
      destinationAccountId: "account-b", destinationAccountLabel: "Хранилище" } };
  render(<ProductHistory presentation="gold" activities={[activity]} balanceHidden={false} />);
  const button = row(activity.id);
  expect(button).toHaveTextContent("Основной → Хранилище");
  expect(button).toHaveAccessibleName(/Основной → Хранилище/);
  expect(button).toHaveTextContent("Между счетами · демо");
  expect(button.textContent).not.toMatch(/[+−-]31/);
  fireEvent.click(button);
  const receipt = screen.getByRole("region", { name: "Квитанция операции" });
  expect(within(receipt).getByText("Откуда").nextElementSibling).toHaveTextContent("Основной");
  expect(within(receipt).getByText("Куда").nextElementSibling).toHaveTextContent("Хранилище");
});

it("retains visible placement distinctions for the same currency while suppressing redundant context", () => {
  const solana: ProductActivity = { ...incoming, id: "same-symbol-solana", networkId: "solana", networkLabel: "Solana" };
  const vault: ProductActivity = { ...incoming, id: "same-symbol-vault", accountId: "account-b", accountLabel: "Хранилище" };
  const bitcoin: ProductActivity = { ...incoming, id: "unique-bitcoin", assetId: "btc", assetSymbol: "BTC", networkId: "bitcoin", networkLabel: "Bitcoin" };
  render(<ProductHistory presentation="gold" activities={[incoming, solana, vault, bitcoin]} balanceHidden={false} />);
  expect(row(incoming.id)).toHaveTextContent("Ethereum · Основной");
  expect(row(solana.id)).toHaveTextContent("Solana · Основной");
  expect(row(vault.id)).toHaveTextContent("Ethereum · Хранилище");
  expect(row(bitcoin.id)).not.toHaveTextContent(/Bitcoin|Основной|Выполнено/);
  expect(row(bitcoin.id)).toHaveAccessibleName(/Bitcoin/);
});

it.each(["buy", "swap"] as const)("masks every %s amount before grouped accessible text and keeps the existing inline receipt private", kind => {
  const activity = commerceActivity(kind);
  const { container, rerender } = render(<ProductHistory presentation="gold" activities={[activity]} balanceHidden={false} />);
  expect(dateHeadings()).toEqual(["3 октября 2026 г."]);
  fireEvent.click(row(activity.id));
  rerender(<ProductHistory presentation="gold" activities={[activity]} balanceHidden />);
  const secret = /101 USD|101 USDC|100 USDC|0[.,]04|987[.,]654321|0[.,]004321/;
  expect(container.innerHTML).not.toMatch(secret);
  expect(row(activity.id)).toHaveAccessibleName(/Сумма скрыта/);
  expect(row(activity.id)).toHaveAccessibleName(/Получение: Сумма скрыта/);
  expect(screen.getByRole("region", { name: "Квитанция операции" })).toHaveTextContent("••••");
  fireEvent.click(row(activity.id));
  expect(screen.queryByRole("region", { name: "Квитанция операции" })).toBeNull();
  fireEvent.click(row(activity.id));
  expect(container.innerHTML).not.toMatch(secret);
});

it("opens and closes the exact existing receipt with one click and keeps its live row focused", () => {
  const other = { ...incoming, id: "other-operation", quantity: "7.91", feeLabel: "0.02 ETH" };
  render(<ProductHistory presentation="gold" activities={[incoming, other]} balanceHidden={false} />);
  expect(dateHeadings()).toEqual(["3 октября 2026 г."]);
  const button = row(other.id);
  const detailsId = button.getAttribute("aria-controls")!;
  button.focus();
  fireEvent.click(button);
  expect(button).toHaveAttribute("aria-expanded", "true");
  const receipt = screen.getByRole("region", { name: "Квитанция операции" });
  expect(receipt).toHaveAttribute("data-embedded", "true");
  expect(receipt.parentElement).toHaveAttribute("id", detailsId);
  expect(receipt).toHaveTextContent("7,91 USDC");
  expect(receipt).not.toHaveTextContent("31,456789");
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.queryByRole("button", { name: "Подробнее" })).toBeNull();
  fireEvent.click(button);
  expect(button).toHaveAttribute("aria-expanded", "false");
  expect(document.getElementById(detailsId)).toHaveAttribute("hidden");
  expect(screen.queryByRole("region", { name: "Квитанция операции" })).toBeNull();
  expect(button).toHaveFocus();
});

it.each([false, true])("preserves the live button, receipt and focus when an operation is prepended to its date block (repeated date: %s)", repeatedDate => {
  const second = { ...incoming, id: "focused-operation", quantity: "7.91" };
  const previousDay = { ...incoming, id: "previous-day", occurredAt: "2026-10-02T09:00:00Z" };
  const prepended = { ...incoming, id: "new-operation", occurredAt: "2026-10-03T10:00:00Z" };
  const activities = repeatedDate ? [incoming, previousDay, second] : [incoming, second];
  const { rerender } = render(<ProductHistory presentation="gold" activities={activities} balanceHidden={false} />);
  const button = row(second.id);
  button.focus();
  fireEvent.click(button);
  const receipt = screen.getByRole("region", { name: "Квитанция операции" });

  const next = repeatedDate ? [incoming, previousDay, prepended, second] : [prepended, incoming, second];
  rerender(<ProductHistory presentation="gold" activities={next} balanceHidden={false} />);
  expect(row(second.id)).toBe(button);
  expect(button).toHaveFocus();
  expect(button).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByRole("region", { name: "Квитанция операции" })).toBe(receipt);
  expect(rowIds()).toEqual(repeatedDate
    ? ["incoming-a", "previous-day", "new-operation", "focused-operation"]
    : ["new-operation", "incoming-a", "focused-operation"]);
  expect(dateHeadings()).toEqual(repeatedDate
    ? ["3 октября 2026 г.", "2 октября 2026 г.", "3 октября 2026 г."]
    : ["3 октября 2026 г."]);
});

it("keeps controlled expansion and manual filters intact through Gold grouping and privacy rerenders", () => {
  function Controlled({ hidden = false }: { hidden?: boolean }) {
    const [expanded, setExpanded] = useState<string | null>(pending.id);
    return <ProductHistory presentation="gold" activities={[incoming, pending]} balanceHidden={hidden}
      expandedActivityId={expanded} onExpandedActivityChange={setExpanded} />;
  }
  const { rerender } = render(<Controlled />);
  expect(dateHeadings()).toHaveLength(2);
  expect(row(pending.id)).toHaveAttribute("aria-expanded", "true");
  fireEvent.click(row(pending.id));
  expect(row(pending.id)).toHaveAttribute("aria-expanded", "false");
  fireEvent.click(row(incoming.id));
  expect(row(incoming.id)).toHaveAttribute("aria-expanded", "true");
  fireEvent.click(screen.getByRole("button", { name: "Получения" }));
  rerender(<Controlled hidden />);
  expect(rowIds()).toEqual([incoming.id]);
  expect(row(incoming.id)).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByRole("button", { name: "Получения" })).toHaveAttribute("aria-pressed", "true");
  expect(row(incoming.id)).toHaveAccessibleName(/Сумма скрыта/);
});

it("keeps the ordinary MONO history unchanged when the Gold opt-in is removed", () => {
  const { rerender } = render(<ProductHistory presentation="gold" activities={[incoming]} balanceHidden={false} />);
  expect(within(row(incoming.id)).queryByText("Выполнено")).toBeNull();
  rerender(<ProductHistory activities={[incoming]} balanceHidden={false} />);
  expect(dateHeadings()).toEqual([]);
  expect(within(row(incoming.id)).getByText("Выполнено")).toBeVisible();
  expect(within(row(incoming.id)).getByText("Ethereum")).toBeVisible();
  expect(row(incoming.id).querySelector("time")).toHaveTextContent("3 окт.");
  expect(row(incoming.id)).toHaveAccessibleName("Получение · USDC · Ethereum, Выполнено, 31,456789 USDC");
});
