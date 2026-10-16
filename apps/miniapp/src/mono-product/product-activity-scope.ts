import { productActivityCryptoLegs, type ProductActivity } from "./demo-activity";

export function scopeProductActivities(
  activities: readonly ProductActivity[],
  accountIds?: readonly string[],
): ProductActivity[] {
  if (accountIds === undefined) return [...activities];

  const accounts = new Set(accountIds);
  const scoped: ProductActivity[] = [];

  for (const activity of activities) {
    if (activity.commerce) {
      const leg = productActivityCryptoLegs(activity).find(({ accountId }) => accounts.has(accountId));
      if (!leg) continue;
      scoped.push({
        ...activity,
        accountId: leg.accountId,
        accountLabel: leg.accountLabel,
        assetId: leg.assetId,
        assetSymbol: leg.symbol,
        quantity: leg.quantity,
        networkId: leg.networkId,
        networkLabel: leg.networkLabel,
      });
      continue;
    }

    const transfer = activity.internalTransfer;
    if (!transfer) {
      if (accounts.has(activity.accountId)) scoped.push(activity);
      continue;
    }

    const sourceIncluded = accounts.has(transfer.sourceAccountId);
    if (!sourceIncluded && !accounts.has(transfer.destinationAccountId)) continue;

    scoped.push({
      ...activity,
      accountId: sourceIncluded ? transfer.sourceAccountId : transfer.destinationAccountId,
      accountLabel: sourceIncluded ? transfer.sourceAccountLabel : transfer.destinationAccountLabel,
      direction: sourceIncluded ? "outgoing" : "incoming",
    });
  }

  return scoped;
}
