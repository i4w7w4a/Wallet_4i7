import type { ProductHolding } from "@wallet/core";
import { productActivityCryptoLegs, type ProductActivity } from "../demo-activity";
import { scopeProductActivities } from "../product-activity-scope";

/** Holdings are decimal data, not localized user input; unknown values invalidate the total. */
export function sumDecimalQuantities(values: readonly string[]): string | null {
  if (values.length === 0) return null;

  let total = 0n;
  let scale = 0;
  for (const value of values) {
    if (typeof value !== "string") return null;
    const match = /^([0-9]+)(?:\.([0-9]+))?$/.exec(value);
    if (!match || match[0] !== value) return null;

    const fraction = match[2] ?? "";
    const nextScale = fraction.length;
    if (nextScale > scale) {
      total *= 10n ** BigInt(nextScale - scale);
      scale = nextScale;
    }
    total += BigInt(match[1] + fraction) * 10n ** BigInt(scale - nextScale);
  }

  if (scale === 0) return total.toString();
  const digits = total.toString().padStart(scale + 1, "0");
  const integer = digits.slice(0, -scale);
  const fraction = digits.slice(-scale).replace(/0+$/, "");
  return fraction ? `${integer}.${fraction}` : integer;
}

export function selectAssetActivities(
  activities: readonly ProductActivity[],
  assetId: string,
  accountIds: readonly string[],
  selectedPlacement: Pick<ProductHolding, "accountId" | "networkId"> | null,
): ProductActivity[] {
  if (selectedPlacement && !accountIds.includes(selectedPlacement.accountId)) return [];
  const scopedAccountIds = selectedPlacement ? [selectedPlacement.accountId] : accountIds;
  const accounts = new Set(scopedAccountIds);
  const scoped = scopeProductActivities(activities, scopedAccountIds);
  return scoped.filter(activity => activity.commerce
    ? productActivityCryptoLegs(activity).some(leg => leg.assetId === assetId && !!leg.networkId &&
      accounts.has(leg.accountId) && (selectedPlacement === null || leg.networkId === selectedPlacement.networkId))
    : activity.assetId === assetId && !!activity.networkId &&
      (selectedPlacement === null || activity.networkId === selectedPlacement.networkId));
}
