import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { groupHoldingsByAsset, MULTI_ACCOUNT_DEMO, selectHoldings, SINGLE_ACCOUNT_DEMO, type ProductSnapshot } from "@wallet/core";
import { afterEach, expect, it, vi } from "vitest";
import { useMonoProductController } from "../product-controller";
import type { ProductActivity } from "../demo-activity";
import { ProductAssetWorkspace, type ProductAssetWorkspaceProps } from "./index";

afterEach(cleanup);

type Activity = ProductActivity & { assetId?: string; networkId?: string };
const baseActivity: Activity = {
  id: "eth-activity", assetId: "usdc", networkId: "ethereum", assetSymbol: "USDC",
  accountId: "demo-custody", accountLabel: "Основной", networkLabel: "Ethereum",
  direction: "incoming", status: "completed", quantity: "12.34", feeLabel: "0.07 ETH",
  occurredAt: "2026-10-03T08:00:00Z",
};
const activities: readonly Activity[] = [
  baseActivity,
  { ...baseActivity, id: "sol-activity", networkId: "solana", networkLabel: "Solana", quantity: "34.56" },
  { ...baseActivity, id: "vault-activity", accountId: "demo-depositary", accountLabel: "Хранилище", quantity: "23.45" },
  { ...baseActivity, id: "legacy-activity", assetId: undefined, networkId: undefined, quantity: "45.67" },
  { ...baseActivity, id: "same-symbol-other-asset", assetId: "another-usdc", quantity: "56.78" },
  { ...baseActivity, id: "unknown-network", networkId: undefined, quantity: "67.89" },
];

type HarnessProps = Omit<ProductAssetWorkspaceProps, "view"> & {
  snapshot?: ProductSnapshot;
  hidden?: boolean;
  scopeAccountId?: string;
  activities?: readonly Activity[];
  status?: "ready" | "loading" | "error";
  expandedActivityId?: string | null;
};

function Harness({ snapshot = MULTI_ACCOUNT_DEMO, hidden = false, scopeAccountId,
  activities: history = activities, status = "ready", expandedActivityId = null, ...props }: HarnessProps) {
  const { view } = useMonoProductController({ kind: "demo", snapshot, activities: history, activityStatus: status },
    { initialHidden: hidden, hidden });
  const context = scopeAccountId ? { kind: "account", accountId: scopeAccountId } as const : view.context;
  return <ProductAssetWorkspace {...props} view={{ ...view, context, expandedActivityId,
    account: context.kind === "account" ? snapshot.accounts.find(account => account.id === context.accountId) ?? null : null,
    holdings: groupHoldingsByAsset(selectHoldings(snapshot, context)),
  }} />;
}

function props(patch: Partial<HarnessProps> = {}): HarnessProps {
  return { assetId: "usdc", selectedHoldingId: null, onSelectHolding: vi.fn(), onBack: vi.fn(),
    onPlacementAction: vi.fn(), onExpandActivity: vi.fn(), ...patch };
}

it("keeps total ownership separate from a deliberately selected operation source", () => {
  const input = props();
  const { rerender } = render(<Harness {...input} />);
  expect(screen.getByRole("heading", { name: "USD Coin" })).toBeInTheDocument();
  expect(screen.getByLabelText("Общее количество USDC")).toHaveTextContent("900");
  expect(screen.queryByRole("button", { name: /^Отправить USDC/ })).not.toBeInTheDocument();
  expect(screen.getAllByRole("radio").every(radio => !(radio as HTMLInputElement).checked)).toBe(true);

  fireEvent.click(screen.getByRole("radio", { name: "Выбрать размещение: Основной · Solana" }));
  expect(input.onSelectHolding).toHaveBeenCalledWith("demo-usdc-sol");
  rerender(<Harness {...input} selectedHoldingId="demo-usdc-sol" />);
  expect(screen.getByRole("radio", { name: "Выбрать размещение: Основной · Solana" })).toBeChecked();
  expect(screen.getByLabelText("Доступное количество USDC")).toHaveTextContent("400 USDC");
  fireEvent.click(screen.getByRole("button", { name: "Отправить USDC · Основной · Solana" }));
  expect(input.onPlacementAction).toHaveBeenCalledWith("demo-usdc-sol", "send");
  fireEvent.click(screen.getByRole("button", { name: "Назад к активам" }));
  expect(input.onBack).toHaveBeenCalledTimes(1);
});

it("does not fall back to the first holding when a selection belongs to another asset or account scope", () => {
  const input = props({ selectedHoldingId: "demo-btc" });
  const { rerender } = render(<Harness {...input} />);
  expect(screen.queryByRole("button", { name: /^(Отправить|Получить) USDC/ })).not.toBeInTheDocument();
  rerender(<Harness {...input} scopeAccountId="demo-custody" selectedHoldingId="demo-inactive-usdc" />);
  expect(screen.queryByRole("button", { name: /^(Отправить|Получить) USDC/ })).not.toBeInTheDocument();
  expect(screen.getAllByRole("radio").every(radio => !(radio as HTMLInputElement).checked)).toBe(true);
});

it("shows exact asset/account history and narrows it to the selected network without legacy guesses", () => {
  const input = props({ scopeAccountId: "demo-custody" });
  const { rerender } = render(<Harness {...input} />);
  const history = screen.getByRole("region", { name: "История операций" });
  expect(within(within(history).getByRole("list")).getAllByRole("button")).toHaveLength(2);
  expect(history).toHaveTextContent("12,34");
  expect(history).toHaveTextContent("34,56");
  expect(history).not.toHaveTextContent(/23,45|45,67|56,78|67,89/);

  rerender(<Harness {...input} selectedHoldingId="demo-usdc-eth" />);
  expect(history).not.toHaveTextContent("34,56");
  fireEvent.click(within(history).getByRole("button", { name: /12,34 USDC/ }));
  expect(input.onExpandActivity).toHaveBeenCalledWith("eth-activity");
});

it("masks the total, placements, available quantity and expanded history including accessible names", () => {
  const { container } = render(<Harness {...props({ hidden: true, selectedHoldingId: "demo-usdc-eth",
    expandedActivityId: "eth-activity" })} />);
  expect(screen.getByLabelText("Общее количество USDC")).toHaveTextContent("••••");
  expect(screen.getByLabelText("Доступное количество USDC")).toHaveTextContent("••••");
  const secret = /900|500|400|12[.,]34|0[.,]07/;
  expect(container.textContent).not.toMatch(secret);
  for (const element of container.querySelectorAll("[aria-label], [title]")) {
    expect(`${element.getAttribute("aria-label")} ${element.getAttribute("title")}`).not.toMatch(secret);
  }
  expect(screen.getByText("Комиссия").nextElementSibling).toHaveTextContent("••••");
});

it("keeps unknown ownership and available quantity explicit", () => {
  const snapshot: ProductSnapshot = { ...SINGLE_ACCOUNT_DEMO,
    holdings: [{ ...SINGLE_ACCOUNT_DEMO.holdings[0], quantity: "unknown", availableQuantity: undefined }] };
  render(<Harness {...props({ snapshot, selectedHoldingId: "demo-single-usdc" })} />);
  expect(screen.getByLabelText("Общее количество USDC")).toHaveTextContent("Количество неизвестно");
  expect(screen.getByLabelText("Доступное количество USDC")).toHaveTextContent("Нет данных");
  expect(screen.queryByText("0 USDC")).not.toBeInTheDocument();
});

it("explains an inactive or unsupported placement without offering a fake action", () => {
  const input = props({ selectedHoldingId: "demo-inactive-usdc" });
  const { rerender } = render(<Harness {...input} />);
  expect(screen.getByText("Счёт не активирован. Операции недоступны.")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /^(Отправить|Получить) USDC/ })).not.toBeInTheDocument();

  const snapshot: ProductSnapshot = { ...SINGLE_ACCOUNT_DEMO, accounts: [{ ...SINGLE_ACCOUNT_DEMO.accounts[0],
    capabilities: [{ ...SINGLE_ACCOUNT_DEMO.accounts[0].capabilities[1], receiveMode: "unavailable" }] }] };
  rerender(<Harness {...input} snapshot={snapshot} selectedHoldingId="demo-single-usdc" />);
  expect(screen.queryByRole("button", { name: /^(Отправить|Получить) USDC/ })).not.toBeInTheDocument();
  expect(screen.getByText("Для этого размещения отправка и получение недоступны.")).toBeInTheDocument();
});

it("handles loading, retry only when connected, and the asset-specific empty history", () => {
  const retry = vi.fn();
  const input = props({ activities: [], status: "loading", onRetryActivities: retry });
  const { rerender } = render(<Harness {...input} />);
  expect(screen.getByRole("status")).toHaveTextContent("Загружаем операции");
  rerender(<Harness {...input} status="error" />);
  expect(screen.getByRole("alert")).toHaveTextContent("Не удалось загрузить операции");
  fireEvent.click(screen.getByRole("button", { name: "Повторить" }));
  expect(retry).toHaveBeenCalledTimes(1);
  rerender(<Harness {...input} status="error" onRetryActivities={undefined} />);
  expect(screen.queryByRole("button", { name: "Повторить" })).not.toBeInTheDocument();
  rerender(<Harness {...input} status="ready" />);
  expect(screen.getByText("По этому активу операций пока нет")).toBeInTheDocument();
  expect(screen.queryByText("Для этого счёта операций пока нет.")).not.toBeInTheDocument();
});
