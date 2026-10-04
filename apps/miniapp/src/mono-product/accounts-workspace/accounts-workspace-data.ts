import {
  resolveActionRoutes, selectFiatBalanceMinor, selectHoldings,
  type AccountContext, type ProductAccount, type ProductActionRoute, type ProductSnapshot,
} from "@wallet/core";
import { sumDecimalQuantities } from "../asset-workspace/asset-workspace-data";
import { productRouteKey } from "../product-controller";
import { formatQuantity } from "../product-format";

export const accountKindLabels: Record<ProductAccount["kind"], string> = {
  custodial: "Кастодиальный", depositary: "Депозитарный", private: "Приватный",
};
export const accountStatusLabels: Record<ProductAccount["status"], string> = {
  active: "Активен", inactive: "Неактивен", unavailable: "Недоступен",
};

/** Presentation only: value estimates never authorize an operation. */
export function selectAccountsWorkspace(snapshot: Readonly<ProductSnapshot>, context: AccountContext,
  selectedAccountId: string | null, allowedActions: readonly ProductActionRoute[]) {
  const accounts = snapshot.accounts.map(account => {
    const holdings = selectHoldings(snapshot, { kind: "account", accountId: account.id });
    return { account, holdings, estimateMinor: selectFiatBalanceMinor(holdings),
      current: context.kind === "account" && context.accountId === account.id };
  });
  const selected = accounts.find(entry => entry.account.id === selectedAccountId) ?? null;
  const permittedRoutes: ProductActionRoute[] = [];
  if (selected) {
    const allowed = new Set(allowedActions.map(productRouteKey));
    const seen = new Set<string>();
    for (const action of ["receive", "send", "buy", "swap"] as const) {
      const resolution = resolveActionRoutes(snapshot, { kind: "account", accountId: selected.account.id }, action);
      for (const route of resolution.routes) {
        const key = productRouteKey(route);
        if (!allowed.has(key) || seen.has(key)) continue;
        seen.add(key);
        permittedRoutes.push(route);
      }
    }
  }
  return { accounts, selected, permittedRoutes };
}

export function accountOperationsUnavailable(account: ProductAccount): string {
  if (account.status === "inactive") return "Счёт неактивен. Операции недоступны.";
  if (account.status === "unavailable") return "Счёт недоступен. Операции недоступны.";
  return "Операции для этого счёта сейчас недоступны.";
}

export function placementCountLabel(count: number): string {
  const last = count % 10, lastTwo = count % 100;
  const word = last === 1 && lastTwo !== 11 ? "размещение"
    : last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14) ? "размещения" : "размещений";
  return `${count} ${word}`;
}

export function holdingQuantityLabel(value: string | undefined, symbol: string, hidden: boolean): string {
  if (hidden) return "••••";
  const quantity = value === undefined ? null : sumDecimalQuantities([value]);
  return quantity === null ? "Нет данных" : `${formatQuantity(quantity)} ${symbol}`;
}
