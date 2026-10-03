import { describe, expect, it } from "vitest";
import type { ProductActivity } from "../demo-activity";
import { selectAssetActivities, sumDecimalQuantities } from "./asset-workspace-data";

function activity(id: string, overrides: Partial<ProductActivity> = {}): ProductActivity {
  return Object.freeze({
    id,
    accountId: "account-a",
    accountLabel: "Основной",
    direction: "incoming",
    status: "completed",
    assetId: "usdt",
    assetSymbol: "USDT",
    quantity: "1",
    networkId: "ton",
    networkLabel: "TON",
    occurredAt: "2026-10-01T12:00:00.000Z",
    ...overrides,
  });
}

describe("sumDecimalQuantities", () => {
  it.each([
    { values: ["0.1", "0.2"], expected: "0.3" },
    { values: ["1.20", "0.003", "0.00004"], expected: "1.20304" },
    {
      values: ["9007199254740993.000000000000000001", "1.000000000000000009"],
      expected: "9007199254740994.00000000000000001",
    },
    {
      values: ["0.000000000000000000000000000001", "0.000000000000000000000000000001"],
      expected: "0.000000000000000000000000000002",
    },
    { values: ["0001.2000", "0.3000"], expected: "1.5" },
    { values: ["999.999", "0.001"], expected: "1000" },
    { values: ["00.000", "0"], expected: "0" },
  ])("adds $values exactly as $expected", ({ values, expected }) => {
    expect(sumDecimalQuantities(Object.freeze(values))).toBe(expected);
  });

  it.each([
    [],
    ["1", "unknown"],
    ["1", ""],
    ["1", "-1"],
    ["1", "+1"],
    ["1", "1e3"],
    ["1", "NaN"],
    ["1", "1,2"],
    ["1", "1."],
    ["1", ".5"],
    ["1", " 1"],
    ["1", "1\n"],
  ].map(values => ({ values })))("keeps absent or invalid quantities unknown: $values", ({ values }) => {
    expect(sumDecimalQuantities(values)).toBeNull();
  });
});

describe("selectAssetActivities", () => {
  const activities: readonly ProductActivity[] = Object.freeze([
    activity("ethereum-account-b", {
      accountId: "account-b", networkId: "ethereum", networkLabel: "Ethereum",
      occurredAt: "2026-09-01T12:00:00.000Z",
    }),
    activity("ton-account-a"),
    activity("same-symbol-other-asset", { assetId: "wrapped-usdt" }),
    activity("wrong-account", { accountId: "account-c" }),
    activity("similar-account-id", { accountId: "account-a-extra" }),
    activity("legacy-missing-asset", { assetId: undefined }),
    activity("legacy-missing-network", { networkId: undefined }),
    activity("legacy-missing-both", { assetId: undefined, networkId: undefined }),
    activity("empty-network", { networkId: "" }),
  ]);

  it("uses exact asset and scoped accounts, requires identity, and preserves supplied order", () => {
    const selected = selectAssetActivities(activities, "usdt", ["account-a", "account-b"], null);

    expect(selected.map(entry => entry.id)).toEqual(["ethereum-account-b", "ton-account-a"]);
    expect(selected[0]).toBe(activities[0]);
    expect(selected[1]).toBe(activities[1]);
    expect(activities.map(entry => entry.id)).toEqual([
      "ethereum-account-b", "ton-account-a", "same-symbol-other-asset", "wrong-account",
      "similar-account-id", "legacy-missing-asset", "legacy-missing-network",
      "legacy-missing-both", "empty-network",
    ]);
  });

  it("restricts a selected placement to its exact account and network", () => {
    const placements = [
      activity("selected-ton-account-a"),
      activity("ethereum-account-a", { networkId: "ethereum", networkLabel: "Ethereum" }),
      activity("ton-account-b", { accountId: "account-b" }),
      activity("wrong-network-with-ton-label", { networkId: "ethereum" }),
    ];

    expect(selectAssetActivities(placements, "usdt", ["account-a", "account-b"], {
      accountId: "account-a", networkId: "ton",
    }).map(entry => entry.id)).toEqual(["selected-ton-account-a"]);
  });

  it("keeps account scope authoritative even for a selected placement", () => {
    expect(selectAssetActivities(activities, "usdt", ["account-a"], {
      accountId: "account-b", networkId: "ethereum",
    })).toEqual([]);
    expect(selectAssetActivities(activities, "usdt", [], null)).toEqual([]);
  });
});
