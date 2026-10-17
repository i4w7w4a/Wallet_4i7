import { getProductActivityLabels, productActivityCryptoLegs, type ProductActivity } from "./demo-activity";
import { getCommerceReceiptAmounts } from "./operation-receipt";
import { formatQuantity } from "./product-format";

const compactSimulationStatus: Record<ProductActivity["status"], string> = {
  pending: "В процессе", completed: "Завершено", failed: "Сбой",
};

const groupDateFormat = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
});

/** Preserve the supplied order, including a repeated date after a different group. */
export function groupHistoryActivitiesByDate(activities: readonly ProductActivity[]) {
  const groups: { key: string; date: string | undefined; label: string; activities: ProductActivity[] }[] = [];
  for (const activity of activities) {
    const time = typeof activity.occurredAt === "string" && activity.occurredAt.trim()
      ? new Date(activity.occurredAt) : null;
    const validTime = time !== null && !Number.isNaN(time.getTime());
    const date = validTime ? time.toISOString().slice(0, 10) : undefined;
    let group = groups.at(-1);
    if (!group || group.date !== date) {
      group = { key: `${date ?? "undated"}-${activity.id}`, date,
        label: validTime ? groupDateFormat.format(time) : "Дата не указана", activities: [] };
      groups.push(group);
    }
    group.activities.push(activity);
  }
  return groups;
}

/** Show placement context only where equal currency labels would hide a distinction. */
export function getGoldHistoryContexts(activities: readonly ProductActivity[]) {
  const placements = new Map<string, Set<string>>();
  const legs = (activity: ProductActivity) => activity.commerce ? productActivityCryptoLegs(activity) : [
    { symbol: activity.assetSymbol, assetId: activity.assetId, networkId: activity.networkId,
      networkLabel: activity.networkLabel, accountId: activity.accountId, accountLabel: activity.accountLabel },
  ];
  for (const activity of activities) {
    for (const leg of legs(activity)) {
      const identities = placements.get(leg.symbol) ?? new Set<string>();
      identities.add(JSON.stringify([leg.assetId, leg.networkId, leg.networkLabel, leg.accountId]));
      placements.set(leg.symbol, identities);
    }
  }
  return new Map(activities.map(activity => {
    const transfer = activity.internalTransfer;
    const context = transfer
      ? `${transfer.sourceAccountLabel} → ${transfer.destinationAccountLabel}`
      : legs(activity).some(leg => (placements.get(leg.symbol)?.size ?? 0) > 1)
        ? [...new Set(legs(activity).map(leg => `${leg.networkLabel?.trim() || "Сеть не указана"} · ${leg.accountLabel?.trim() || "Счёт не указан"}`))].join(" → ")
        : "";
    return [activity, context];
  }));
}

/** Build financial assistive text only after masking the display values. */
export function getHistoryPresentation(activity: ProductActivity, balanceHidden = false) {
  const labels = getProductActivityLabels(activity);
  const quote = activity.commerce?.quote;
  const commerceAmounts = activity.commerce
    ? getCommerceReceiptAmounts(activity.commerce).map(amount => ({
      ...amount, value: balanceHidden ? "••••" : formatQuantity(amount.value),
    })) : null;
  const legacyAmount = commerceAmounts ? null : balanceHidden ? "••••" : formatQuantity(activity.quantity);
  const networks = quote ? quote.kind === "swap"
    ? [quote.debit.networkLabel, quote.credit.networkLabel] : [quote.credit.networkLabel]
    : [activity.networkLabel];
  return {
    directionLabel: labels.directionLabel,
    statusLabel: activity.mode === "simulation" ? compactSimulationStatus[activity.status] : labels.statusLabel,
    accessibleStatusLabel: labels.statusLabel,
    assetLabel: commerceAmounts ? commerceAmounts.map(amount => amount.unit).join(" → ") : activity.assetSymbol,
    networkLabel: [...new Set(networks.map(label => label?.trim() || "Сеть не указана"))].join(" → "),
    commerceAmounts,
    legacyAmount,
    accessibleAmountLabel: commerceAmounts
      ? commerceAmounts.map(amount => `${amount.label}: ${balanceHidden ? "Сумма скрыта" : amount.value} ${amount.unit}`).join(", ")
      : balanceHidden ? "Сумма скрыта" : `${legacyAmount} ${activity.assetSymbol}`,
  };
}
