import type { ProductHolding, ProductSnapshot } from "@wallet/core";
import type { SendQuoteReceipt } from "./operation-receipt";

export type ProductActivity = {
  id: string;
  accountId: string;
  accountLabel: string;
  direction: "incoming" | "outgoing";
  status: "pending" | "completed" | "failed";
  /** Undefined is an example. Simulations are session-only UI events, never a balance ledger. */
  mode?: "example" | "simulation";
  assetId?: string;
  assetSymbol: string;
  quantity: string;
  networkId?: string;
  networkLabel: string;
  occurredAt: string;
  feeLabel?: string;
  receipt?: SendQuoteReceipt;
  failureReason?: "rejected" | "expired" | "unavailable";
};

const EXAMPLE_STATUS_LABEL: Record<ProductActivity["status"], string> = {
  pending: "В обработке",
  completed: "Выполнено",
  failed: "Не выполнено",
};

const SIMULATION_STATUS_LABEL: Record<ProductActivity["status"], string> = {
  pending: "Симуляция выполняется",
  completed: "Симуляция завершена",
  failed: "Симуляция не выполнена",
};

export function getProductActivityLabels(activity: ProductActivity) {
  const incoming = activity.direction === "incoming";
  const simulation = activity.mode === "simulation";
  return {
    directionLabel: simulation
      ? incoming ? "Демо-получение" : "Демо-отправка"
      : incoming ? "Получение" : "Отправка",
    statusLabel: (simulation ? SIMULATION_STATUS_LABEL : EXAMPLE_STATUS_LABEL)[activity.status],
  };
}

/** Fee labels are display text; localize only a decimal amount at the start. */
export function formatProductActivityFee(feeLabel?: string): string {
  if (!feeLabel?.trim()) return "Комиссия не указана";
  return feeLabel.replace(/^(\d+)\.(\d+)(?=\s|$)/, "$1,$2");
}

/** Illustrative states only. These entries are never a balance or transaction ledger. */
export function createDemoActivities(accountId: string, accountLabel: string): readonly ProductActivity[] {
  return [
    {
      id: `demo-${accountId}-pending`,
      accountId,
      accountLabel,
      direction: "outgoing",
      status: "pending",
      assetSymbol: "USDT",
      quantity: "12.345",
      networkLabel: "TON",
      occurredAt: "2026-09-27T12:00:00.000Z",
    },
    {
      id: `demo-${accountId}-completed`,
      accountId,
      accountLabel,
      direction: "incoming",
      status: "completed",
      assetSymbol: "USDT",
      quantity: "48.2",
      networkLabel: "TON",
      occurredAt: "2026-09-26T09:30:00.000Z",
      feeLabel: "0.01 TON",
    },
    {
      id: `demo-${accountId}-failed`,
      accountId,
      accountLabel,
      direction: "outgoing",
      status: "failed",
      assetSymbol: "TON",
      quantity: "2.5",
      networkLabel: "TON",
      occurredAt: "2026-09-25T18:45:00.000Z",
    },
  ];
}

const SNAPSHOT_EXAMPLES = [
  { direction: "incoming", status: "completed", occurredAt: "2026-09-27T12:00:00.000Z" },
  { direction: "outgoing", status: "completed", occurredAt: "2026-09-27T10:15:00.000Z" },
  { direction: "incoming", status: "pending", occurredAt: "2026-09-26T17:30:00.000Z" },
  { direction: "outgoing", status: "failed", occurredAt: "2026-09-25T08:45:00.000Z" },
] as const;
const EXAMPLE_QUANTITIES = new Map<string, readonly [string, string]>([
  ["btc", ["0.0042", "0.0011"]], ["eth", ["0.35", "0.12"]], ["usdc", ["48.2", "12.345"]],
]);

/** Synthetic examples for snapshot placements, never recovered history or balance changes. */
export function createSnapshotDemoActivities(snapshot: ProductSnapshot): readonly ProductActivity[] {
  const accounts = new Map(snapshot.accounts.map((account) => [account.id, account]));
  const placements = new Map<string, ProductHolding>();

  for (const holding of snapshot.holdings) {
    if (!accounts.has(holding.accountId)) continue;
    const placementKey = JSON.stringify([holding.accountId, holding.assetId, holding.networkId]);
    if (!placements.has(placementKey)) placements.set(placementKey, holding);
  }

  return [...placements]
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .slice(0, 4)
    .map<ProductActivity>(([placementKey, holding], index) => ({
      id: `demo-placement-${encodeURIComponent(placementKey)}`,
      accountId: holding.accountId,
      accountLabel: accounts.get(holding.accountId)!.label,
      ...SNAPSHOT_EXAMPLES[index]!,
      mode: "example",
      assetId: holding.assetId,
      assetSymbol: holding.symbol,
      // Deliberately independent of the holding's current or available balance.
      quantity: (EXAMPLE_QUANTITIES.get(holding.assetId) ?? ["0.1", "0.25"])[index % 2]!,
      networkId: holding.networkId,
      networkLabel: holding.networkLabel,
    }));
}
