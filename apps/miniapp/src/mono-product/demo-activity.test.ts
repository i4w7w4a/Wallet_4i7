import { MULTI_ACCOUNT_DEMO, type ProductSnapshot } from "@wallet/core";
import { afterEach, expect, it, vi } from "vitest";
import * as demoActivity from "./demo-activity";

afterEach(() => vi.useRealTimers());

it("keeps example history tied to four unique known snapshot placements", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-03T09:00:00.000Z"));
  const snapshot: ProductSnapshot = {
    ...MULTI_ACCOUNT_DEMO,
    accounts: MULTI_ACCOUNT_DEMO.accounts.map((account) => ({
      ...account,
      label: account.id === "demo-custody" ? "Выбранный счёт" : account.label,
    })),
    holdings: [
      { ...MULTI_ACCOUNT_DEMO.holdings[2], id: "orphan", accountId: "unknown-account" },
      MULTI_ACCOUNT_DEMO.holdings[0],
      { ...MULTI_ACCOUNT_DEMO.holdings[0], id: "duplicate-btc" },
      ...MULTI_ACCOUNT_DEMO.holdings.slice(1),
    ],
  };
  const before = structuredClone(snapshot);

  expect(demoActivity.createSnapshotDemoActivities).toBeTypeOf("function");
  const activities = demoActivity.createSnapshotDemoActivities(snapshot);
  expect(activities.map(({ accountId, accountLabel, assetId, assetSymbol, networkId, networkLabel }) => ({
    accountId, accountLabel, assetId, assetSymbol, networkId, networkLabel,
  }))).toEqual([
    { accountId: "demo-custody", accountLabel: "Выбранный счёт", assetId: "btc", assetSymbol: "BTC", networkId: "bitcoin", networkLabel: "Bitcoin" },
    { accountId: "demo-custody", accountLabel: "Выбранный счёт", assetId: "eth", assetSymbol: "ETH", networkId: "ethereum", networkLabel: "Ethereum" },
    { accountId: "demo-custody", accountLabel: "Выбранный счёт", assetId: "usdc", assetSymbol: "USDC", networkId: "ethereum", networkLabel: "Ethereum" },
    { accountId: "demo-custody", accountLabel: "Выбранный счёт", assetId: "usdc", assetSymbol: "USDC", networkId: "solana", networkLabel: "Solana" },
  ]);
  expect(new Set(activities.map(({ id }) => id)).size).toBe(4);
  expect(activities.map(({ direction, status }) => [direction, status])).toEqual([
    ["incoming", "completed"], ["outgoing", "completed"], ["incoming", "pending"], ["outgoing", "failed"],
  ]);
  expect(new Set(activities.map(activity => activity.quantity)).size).toBeGreaterThanOrEqual(3);
  const dates = activities.map(activity => Date.parse(activity.occurredAt));
  expect(dates.every((date, index) => index === 0 || date < dates[index - 1]!)).toBe(true);
  expect(activities.every(({ mode, occurredAt, feeLabel }) =>
    mode === "example" && !Number.isNaN(Date.parse(occurredAt)) && feeLabel === undefined,
  )).toBe(true);
  vi.setSystemTime(new Date("2026-10-04T09:00:00.000Z"));
  expect(demoActivity.createSnapshotDemoActivities(snapshot)).toEqual(activities);
  expect(demoActivity.createSnapshotDemoActivities({
    ...snapshot,
    holdings: [...snapshot.holdings].reverse().map((holding) => ({ ...holding, quantity: "999", fiatMinor: 99_900 })),
  })).toEqual(activities);
  expect(demoActivity.createSnapshotDemoActivities({ ...snapshot, accounts: [] })).toEqual([]);
  expect(snapshot).toEqual(before);
});

it.each(["unlisted-asset", "constructor"])("uses a small explicit demo quantity for unknown asset %s without inferring its balance or fee", assetId => {
  const snapshot: ProductSnapshot = { ...MULTI_ACCOUNT_DEMO, holdings: [
    { ...MULTI_ACCOUNT_DEMO.holdings[0], assetId, symbol: "OTHER", quantity: "9345.67" },
  ] };
  const [entry] = demoActivity.createSnapshotDemoActivities(snapshot);
  expect(entry).toMatchObject({ mode: "example", assetId, quantity: "0.1" });
  expect(entry!.feeLabel).toBeUndefined();
  expect(entry!.receipt).toBeUndefined();
});
