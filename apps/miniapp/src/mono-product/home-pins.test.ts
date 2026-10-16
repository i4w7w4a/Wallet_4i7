import { expect, it } from "vitest";
import type { ProductSnapshot } from "@wallet/core";
import { defaultHomePins, normalizeHomePins, parseHomePins, parseHomePinPreference, selectAccountGroups, toggleHomePinPreference } from "./home-pins";

const snapshot: ProductSnapshot = {
  fiatCurrency: "USD",
  accounts: [
    { id: "a", kind: "custodial", label: "A", status: "active", capabilities: [] },
    { id: "b", kind: "custodial", label: "B", status: "inactive", capabilities: [] },
    { id: "c", kind: "depositary", label: "C", status: "active", capabilities: [] },
    { id: "d", kind: "private", label: "D", status: "unavailable", capabilities: [] },
  ],
  holdings: [
    { id: "a-usdc", accountId: "a", assetId: "usdc", symbol: "USDC", name: "USD Coin", networkId: "sol", networkLabel: "Solana", quantity: "2", fiatMinor: 211 },
    { id: "b-usdc", accountId: "b", assetId: "usdc", symbol: "USDC", name: "USD Coin", networkId: "eth", networkLabel: "Ethereum", quantity: "3", fiatMinor: 322 },
    { id: "c-usdc", accountId: "c", assetId: "usdc", symbol: "USDC", name: "USD Coin", networkId: "eth", networkLabel: "Ethereum", quantity: "4", fiatMinor: 433 },
  ],
};

it("sums each group's own placements once, including inactive accounts without granting actions", () => {
  expect(selectAccountGroups(snapshot)).toEqual([
    { kind: "custodial", label: "Кастодиальные", accountIds: ["a", "b"], estimateMinor: 533, available: true },
    { kind: "depositary", label: "Депозитарные", accountIds: ["c"], estimateMinor: 433, available: true },
    { kind: "private", label: "Закрытый", accountIds: ["d"], estimateMinor: null, available: false },
  ]);
});

it("defaults only to present custodial and depositary groups, without placeholders", () => {
  expect(defaultHomePins(selectAccountGroups(snapshot))).toEqual(["custodial", "depositary"]);
  expect(defaultHomePins(selectAccountGroups({ ...snapshot, accounts: [snapshot.accounts[0]!], holdings: [] }))).toEqual(["custodial"]);
  expect(defaultHomePins(selectAccountGroups({ ...snapshot, accounts: [snapshot.accounts[3]!], holdings: [] }))).toEqual([]);
  expect(selectAccountGroups({ ...snapshot, accounts: [], holdings: [] })).toEqual([]);
});

it("normalizes the versioned allowlist, duplicates and limit while keeping explicit empty choices", () => {
  expect(normalizeHomePins(["private", "fiat", "private", "depositary", "custodial"])).toEqual(["private", "depositary"]);
  expect(parseHomePins('{"version":1,"groups":[]}')).toEqual([]);
  expect(parseHomePins('{"version":1,"groups":["fiat","custodial","custodial","depositary","private"]}')).toEqual(["custodial", "depositary"]);
  expect(parseHomePins('{"version":2,"groups":["private"]}')).toBeNull();
  expect(parseHomePins('{"version":1,"groups":"private"}')).toBeNull();
  expect(parseHomePins("broken")).toBeNull();
});

it("shows unavailable estimates instead of zero for missing prices or ambiguous identities", () => {
  expect(selectAccountGroups({ ...snapshot, holdings: [{ ...snapshot.holdings[0]!, fiatMinor: Number.NaN }] })[0]?.estimateMinor).toBeNull();
  expect(selectAccountGroups({ ...snapshot, accounts: [...snapshot.accounts, { ...snapshot.accounts[0]!, kind: "depositary" }] })[0]?.estimateMinor).toBeNull();
  expect(selectAccountGroups({ ...snapshot, holdings: [...snapshot.holdings, snapshot.holdings[0]!] })[0]?.estimateMinor).toBeNull();
});

it("migrates v1 choices and validates the independent total-only setting", () => {
  expect(parseHomePinPreference('{"version":1,"groups":["depositary","custodial"]}'))
    .toEqual({ groups: ["depositary", "custodial"], totalOnly: false });
  expect(parseHomePinPreference('{"version":2,"groups":["fiat","custodial","custodial"],"totalOnly":true}'))
    .toEqual({ groups: ["custodial"], totalOnly: true });
  expect(parseHomePinPreference('{"version":2,"groups":[],"totalOnly":false}'))
    .toEqual({ groups: [], totalOnly: false });
  expect(parseHomePinPreference('{"version":2,"groups":[],"totalOnly":"yes"}')).toBeNull();
});

it("replaces the oldest valid choice at the limit and appends reselections in FIFO order", () => {
  // Pure preference algorithm allows a future third valid kind; current UI disables private.
  const available = ["custodial", "depositary", "private"] as const;
  const first = toggleHomePinPreference({ groups: ["custodial", "depositary"], totalOnly: true }, "private", available);
  expect(first).toEqual({ groups: ["depositary", "private"], totalOnly: false });
  expect(toggleHomePinPreference(first!, "custodial", available)).toEqual({ groups: ["private", "custodial"], totalOnly: false });
  expect(toggleHomePinPreference({ groups: ["private", "custodial"], totalOnly: false }, "depositary", ["custodial", "depositary"]))
    .toEqual({ groups: ["custodial", "depositary"], totalOnly: false });
  expect(toggleHomePinPreference({ groups: [], totalOnly: true }, "private", ["custodial", "depositary"])).toBeNull();
});
