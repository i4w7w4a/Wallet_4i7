import type { ProductAccount, ProductAccountKind } from "@wallet/core";

// UI-only slot: the key is not a financial account ID or an AccountContext.
export const UNAVAILABLE_ACCOUNT_SLOTS = [
  { key: "private", label: "Приватный", iconKind: "private", explanation: "Пока недоступен" },
] as const;

export function selectCatalogueAccounts<T extends { account: ProductAccount }>(accounts: readonly T[], kind?: ProductAccountKind): readonly T[] {
  return accounts.filter(item => item.account.kind !== "private" && (!kind || item.account.kind === kind));
}
