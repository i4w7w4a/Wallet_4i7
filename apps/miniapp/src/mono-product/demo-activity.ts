export type ProductActivity = {
  id: string;
  accountId: string;
  accountLabel: string;
  direction: "incoming" | "outgoing";
  status: "pending" | "completed" | "failed";
  assetSymbol: string;
  quantity: string;
  networkLabel: string;
  occurredAt: string;
  feeLabel?: string;
};

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
