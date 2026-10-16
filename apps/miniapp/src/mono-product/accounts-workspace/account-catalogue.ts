import type { ProductAccount, ProductAccountKind } from "@wallet/core";

// UI slots only: neither key is a financial account ID or an AccountContext.
export const UNAVAILABLE_ACCOUNT_SLOTS = [
  { key: "closed", label: "Закрытый", iconKind: "private", explanation: "Пока недоступен" },
  { key: "fiat", label: "Фиатный", iconKind: null, explanation: "Пока недоступен" },
] as const;

export function selectCatalogueAccounts<T extends { account: ProductAccount }>(accounts: readonly T[], kind?: ProductAccountKind): readonly T[] {
  return accounts.filter(item => item.account.kind !== "private" && (!kind || item.account.kind === kind));
}
