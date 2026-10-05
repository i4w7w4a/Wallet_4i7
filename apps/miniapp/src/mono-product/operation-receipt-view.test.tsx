import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { ProductActivity } from "./demo-activity";
import type { CommerceSimulation } from "./commerce";
import { buyQuote, swapQuote } from "./commerce/test-fixtures";
import type { SendQuoteReceipt } from "./operation-receipt";
import { OperationReceiptView } from "./operation-receipt-view";
import { ProductHistory } from "./product-history";

afterEach(cleanup);

const receipt: SendQuoteReceipt = {
  assetDebit: "24.456789", networkFee: { status: "known", amount: "0.000003", symbol: "ETH" },
  feeFunding: { kind: "battery", poolId: "eth-pool", networkLabel: "Ethereum", charges: 17 },
  estimatedCompletionSeconds: 90,
};
const activity: ProductActivity = {
  id: "simulation-receipt", accountId: "account-a", accountLabel: "Основной", assetId: "usdc", assetSymbol: "USDC",
  networkId: "ethereum", networkLabel: "Ethereum", direction: "outgoing", status: "pending", mode: "simulation",
  quantity: "23.456789", occurredAt: "2026-10-03T08:00:00Z", receipt,
};

function commerceActivity(kind: "buy" | "swap", failed = false): ProductActivity {
  const result = failed ? { mode: "demo" as const, status: "simulated-failure" as const, reason: "rejected" as const }
    : { mode: "demo" as const, status: "simulated-success" as const };
  const commerce: CommerceSimulation = kind === "buy"
    ? { mode: "demo", kind, simulationId: "receipt-buy", idempotencyKey: "receipt", quote: buyQuote(), result }
    : { mode: "demo", kind, simulationId: "receipt-swap", idempotencyKey: "receipt", quote: swapQuote(), result };
  return { ...activity, id: commerce.simulationId, accountId: "demo-custody", direction: kind === "buy" ? "incoming" : "exchange",
    quantity: "987.654321", status: failed ? "failed" : "completed", failureReason: "expired", commerce };
}

it.each([
  { seconds: undefined, expected: "Время уточняется" },
  { seconds: Number.POSITIVE_INFINITY, expected: "Время уточняется" },
  { seconds: 0, expected: "Меньше минуты" },
  { seconds: 90, expected: "Около 2 мин" },
])("shows a pending estimate of $seconds without treating zero as completion", ({ seconds, expected }) => {
  render(<OperationReceiptView activity={{ ...activity, receipt: { ...receipt, estimatedCompletionSeconds: seconds } }} balanceHidden={false} />);
  expect(screen.getByText("Оценка ожидания").nextElementSibling).toHaveTextContent(expected);
  expect(screen.getByText("Симуляция выполняется")).toBeInTheDocument();
  expect(screen.queryByText("Симуляция завершена")).not.toBeInTheDocument();
});

it.each(["completed", "failed"] as const)("never displays an old wait estimate for %s", status => {
  render(<OperationReceiptView activity={{ ...activity, status }} balanceHidden={false} />);
  expect(screen.queryByText("Оценка ожидания")).not.toBeInTheDocument();
  expect(screen.queryByText("Время уточняется")).not.toBeInTheDocument();
});

it("labels a completed simulation and keeps debit, quote fee and battery calculation separate", () => {
  render(<OperationReceiptView activity={{ ...activity, status: "completed" }} balanceHidden={false} />);
  expect(screen.getByText("Симуляция завершена")).toBeInTheDocument();
  expect(screen.getByText(/Демонстрация.*средства и заряд батарейки не списаны/i)).toBeInTheDocument();
  expect(screen.getByText("Списание по расчёту").nextElementSibling).toHaveTextContent("24,456789 USDC");
  expect(screen.getByText("Расчёт комиссии").nextElementSibling).toHaveTextContent("0,000003 ETH");
  expect(screen.getByText("Оплата по расчёту").nextElementSibling).toHaveTextContent("Батарейка · Ethereum");
  expect(screen.getByText(/17 зарядов/)).toBeInTheDocument();
  expect(screen.queryByText(/бесплатно|подтверждено сетью/i)).not.toBeInTheDocument();
});

it.each([
  { reason: "rejected" as const, explanation: "Симуляция отклонена." },
  { reason: "expired" as const, explanation: "Срок действия расчёта истёк." },
  { reason: "unavailable" as const, explanation: "Сервис симуляции недоступен." },
])("explains a failed simulation from the known $reason code", ({ reason, explanation }) => {
  render(<OperationReceiptView activity={{ ...activity, status: "failed", failureReason: reason }} balanceHidden={false} />);
  expect(screen.getByText("Симуляция не выполнена")).toBeInTheDocument();
  expect(screen.getByText(explanation)).toBeInTheDocument();
  expect(screen.getByText(/средства и заряд батарейки не списаны/i)).toBeInTheDocument();
});

it("keeps examples neutral, preserves a legacy fee and never echoes an unknown failure reason", () => {
  const example = { ...activity, receipt: undefined, mode: "example", status: "failed", feeLabel: "0.050 ETH",
    failureReason: "provider says send credentials to support" } as unknown as ProductActivity;
  const { container } = render(<OperationReceiptView activity={example} balanceHidden={false} />);
  expect(screen.getByText(/Пример состояния операции/)).toBeInTheDocument();
  expect(screen.getByText("Комиссия").nextElementSibling).toHaveTextContent("0,050 ETH");
  expect(container).not.toHaveTextContent(/provider|credentials|подтверждено сетью/);
});

it("keeps unknown quote fields explicit and suppresses a numerically identical debit", () => {
  render(<OperationReceiptView activity={{ ...activity, quantity: "001.2000", receipt: {
    assetDebit: "1.2", networkFee: { status: "unknown" }, feeFunding: { kind: "unknown" },
  } }} balanceHidden={false} />);
  expect(screen.queryByText("Списание по расчёту")).not.toBeInTheDocument();
  expect(screen.getByText("Расчёт комиссии").nextElementSibling).toHaveTextContent("Комиссия уточняется");
  expect(screen.getByText("Оплата по расчёту").nextElementSibling).toHaveTextContent("Неизвестно");
});

it("hides quantity, debit, fees and battery charges throughout an expanded receipt", () => {
  const { container, rerender } = render(<ProductHistory activities={[activity]} balanceHidden expandedActivityId={activity.id} />);
  const details = screen.getByRole("region", { name: "Квитанция операции" });
  const secret = /23[.,]456789|24[.,]456789|0[.,]000003|17/;
  expect(details.textContent).not.toMatch(secret);
  expect(details).toHaveTextContent("••••");
  for (const element of container.querySelectorAll("[aria-label], [title], [hidden]")) {
    expect(`${element.getAttribute("aria-label")} ${element.getAttribute("title")} ${element.textContent}`).not.toMatch(secret);
  }
  rerender(<ProductHistory activities={[activity]} balanceHidden expandedActivityId={null} />);
  expect(screen.queryByRole("region", { name: "Квитанция операции" })).not.toBeInTheDocument();
  expect(container.innerHTML).not.toMatch(/23[.,]456789|24[.,]456789|0[.,]000003/);
});

it("exposes network in a history row and preserves controlled disclosure with a single receipt", () => {
  const change = vi.fn();
  const { rerender } = render(<ProductHistory activities={[activity]} balanceHidden={false}
    expandedActivityId={null} onExpandedActivityChange={change} />);
  const row = screen.getByRole("button", { name: /Демо-отправка.*USDC.*Ethereum/ });
  expect(within(row).getByText("Ethereum")).toBeInTheDocument();
  fireEvent.click(row);
  expect(change).toHaveBeenCalledWith(activity.id);
  expect(row).toHaveAttribute("aria-expanded", "false");
  expect(document.getElementById(row.getAttribute("aria-controls")!)).toHaveAttribute("hidden");

  rerender(<ProductHistory activities={[activity]} balanceHidden={false}
    expandedActivityId={activity.id} onExpandedActivityChange={change} />);
  expect(screen.getAllByRole("region", { name: "Квитанция операции" })).toHaveLength(1);
  expect(screen.getAllByText("Количество")).toHaveLength(1);
  expect(document.getElementById(row.getAttribute("aria-controls")!)).not.toHaveAttribute("hidden");
  fireEvent.click(row);
  expect(change).toHaveBeenLastCalledWith(null);
  expect(row).toHaveAttribute("aria-expanded", "false");
  expect(screen.queryByRole("region", { name: "Квитанция операции" })).not.toBeInTheDocument();
});

it.each([
  { kind: "buy" as const, debitLabel: "Оплата по расчёту", debit: "101 USD", credit: "100 USDC", fee: "1 USD" },
  { kind: "swap" as const, debitLabel: "Списание по расчёту", debit: "101 USDC", credit: "0,04 ETH", fee: "1 USDC" },
])("shows the accepted $kind legs and fee in separate units without a mixed currency total", ({ kind, debitLabel, debit, credit, fee }) => {
  const { container } = render(<OperationReceiptView activity={commerceActivity(kind)} balanceHidden={false} />);
  expect(screen.getByText(debitLabel).nextElementSibling).toHaveTextContent(debit);
  expect(screen.getByText("Получение по расчёту").nextElementSibling).toHaveTextContent(credit);
  expect(screen.getByText("Расчёт комиссии").nextElementSibling).toHaveTextContent(fee);
  expect(screen.queryByText("Сумма операции")).not.toBeInTheDocument();
  expect(screen.queryByText("Количество")).not.toBeInTheDocument();
  expect(container.innerHTML).not.toMatch(/987[.,]654321|24[.,]456789|0[.,]000003|17 зарядов|0[.,]0404|102 USD/);
  expect(screen.getByText("Счёт получения").nextElementSibling).toHaveTextContent("Основной");
  expect(screen.getByText("Сеть получения").nextElementSibling).toHaveTextContent("Ethereum");
});

it("explains a failed exchange from its accepted simulation while retaining exchange semantics", () => {
  render(<OperationReceiptView activity={commerceActivity("swap", true)} balanceHidden={false} />);
  expect(screen.getByText("Демо-обмен")).toBeInTheDocument();
  expect(screen.getByText("Симуляция не выполнена")).toBeInTheDocument();
  expect(screen.getByText("Симуляция отклонена.")).toBeInTheDocument();
  expect(screen.queryByText("Срок действия расчёта истёк.")).not.toBeInTheDocument();
  expect(screen.getByText("Списание по расчёту").nextElementSibling).toHaveTextContent("101 USDC");
  expect(screen.getByText("Получение по расчёту").nextElementSibling).toHaveTextContent("0,04 ETH");
});

it("preserves the legacy internal transfer quantity, account context and example fee", () => {
  render(<OperationReceiptView activity={{ ...activity, status: "completed", quantity: "25", receipt: undefined, feeLabel: "0 USDC",
    internalTransfer: { sourceAccountId: "source", sourceAccountLabel: "Отправляющий", destinationAccountId: "destination",
      destinationAccountLabel: "Принимающий" } }} balanceHidden={false} />);
  expect(screen.getByText("Количество").nextElementSibling).toHaveTextContent("25 USDC");
  expect(screen.getByText("Комиссия примера").nextElementSibling).toHaveTextContent("0 USDC");
  expect(screen.getByText("Откуда").nextElementSibling).toHaveTextContent("Отправляющий");
  expect(screen.getByText("Куда").nextElementSibling).toHaveTextContent("Принимающий");
  expect(screen.queryByText("Получение по расчёту")).not.toBeInTheDocument();
});
