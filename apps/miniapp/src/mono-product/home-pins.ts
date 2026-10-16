import { selectFiatBalanceMinor, type ProductAccountKind, type ProductSnapshot } from "@wallet/core";

export const HOME_PINS_STORAGE_KEY = "wallet4i7.mono.home-pins.v2";
export const LEGACY_HOME_PINS_STORAGE_KEY = "wallet4i7.mono.home-pins.v1";
export const HOME_PIN_LIMIT = 2;
export const ACCOUNT_GROUP_KINDS = ["custodial", "depositary", "private"] as const;
export const accountGroupLabels: Record<ProductAccountKind, string> = {
  custodial: "Кастодиальные", depositary: "Депозитарные", private: "Закрытый",
};
export type AccountGroup = {
  kind: ProductAccountKind;
  label: string;
  accountIds: readonly string[];
  estimateMinor: number | null;
  available: boolean;
};
export type HomePinPreference = { groups: readonly ProductAccountKind[]; totalOnly: boolean };

export function selectAccountGroups(snapshot: Readonly<ProductSnapshot>): readonly AccountGroup[] {
  return ACCOUNT_GROUP_KINDS.flatMap(kind => {
    const accounts = snapshot.accounts.filter(account => account.kind === kind);
    if (!accounts.length) return [];
    const accountIds = [...new Set(accounts.map(account => account.id))];
    const holdings = snapshot.holdings.filter(holding => accountIds.includes(holding.accountId));
    const ambiguous = accountIds.some(id => snapshot.accounts.filter(account => account.id === id).length !== 1) ||
      new Set(holdings.map(holding => holding.id)).size !== holdings.length;
    let estimateMinor: number | null = null;
    if (!ambiguous) {
      try { estimateMinor = selectFiatBalanceMinor(holdings); }
      catch (error) { if (!(error instanceof RangeError)) throw error; }
    }
    const available = kind !== "private" && accounts.some(account => account.status !== "unavailable");
    return [{ kind, label: accountGroupLabels[kind], accountIds, estimateMinor: available ? estimateMinor : null, available }];
  });
}

export function defaultHomePins(groups: readonly AccountGroup[]): readonly ProductAccountKind[] {
  return groups.filter(group => group.available).map(group => group.kind).slice(0, HOME_PIN_LIMIT);
}

export function normalizeHomePins(values: readonly unknown[], availableKinds: readonly ProductAccountKind[] = ACCOUNT_GROUP_KINDS): ProductAccountKind[] {
  return [...new Set(values.filter((kind): kind is ProductAccountKind =>
    ACCOUNT_GROUP_KINDS.some(allowed => allowed === kind) && availableKinds.some(allowed => allowed === kind)))].slice(0, HOME_PIN_LIMIT);
}

export function parseHomePinPreference(raw: string | null, availableKinds: readonly ProductAccountKind[] = ACCOUNT_GROUP_KINDS): HomePinPreference | null {
  if (!raw || raw.length > 2048) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || !("version" in value) ||
      !("groups" in value) || !Array.isArray(value.groups)) return null;
    if (value.version === 1) return { groups: normalizeHomePins(value.groups, availableKinds), totalOnly: false };
    if (value.version !== 2 || !("totalOnly" in value) || typeof value.totalOnly !== "boolean") return null;
    return { groups: normalizeHomePins(value.groups, availableKinds), totalOnly: value.totalOnly };
  } catch { return null; }
}

export function toggleHomePinPreference(preference: HomePinPreference, kind: ProductAccountKind,
  availableKinds: readonly ProductAccountKind[]): HomePinPreference | null {
  if (!availableKinds.includes(kind)) return null;
  const selected = normalizeHomePins(preference.groups, availableKinds);
  if (selected.includes(kind)) return { groups: selected.filter(candidate => candidate !== kind), totalOnly: preference.totalOnly };
  return { groups: [...selected, kind].slice(-HOME_PIN_LIMIT), totalOnly: false };
}

export function parseHomePins(raw: string | null): ProductAccountKind[] | null {
  if (!raw || raw.length > 2048) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || !("version" in value) || value.version !== 1 ||
      !("groups" in value) || !Array.isArray(value.groups)) return null;
    return normalizeHomePins(value.groups);
  } catch { return null; }
}
