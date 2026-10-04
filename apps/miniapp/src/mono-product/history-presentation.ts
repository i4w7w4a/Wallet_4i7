import { getProductActivityLabels, type ProductActivity } from "./demo-activity";
import { getCommerceReceiptAmounts } from "./operation-receipt";
import { formatQuantity } from "./product-format";

const compactSimulationStatus: Record<ProductActivity["status"], string> = {
  pending: "В процессе", completed: "Завершено", failed: "Сбой",
};

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
