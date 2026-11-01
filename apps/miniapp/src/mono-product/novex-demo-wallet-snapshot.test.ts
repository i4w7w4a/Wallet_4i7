import { MULTI_ACCOUNT_DEMO, SINGLE_ACCOUNT_DEMO, resolveActionRoutes, selectFiatBalanceMinor } from "@wallet/core";
import { describe, expect, it } from "vitest";
import { createMonoDemoFlowPorts, MONO_PRODUCT_DEMO_ADAPTER } from "./demo-adapter";
import { createSnapshotDemoActivities } from "./demo-activity";

const context = (accountId: string) => ({ kind: "account" as const, accountId });
const call = () => ({ signal: new AbortController().signal });

describe("default Novex demo wallet snapshot", () => {
  it("exposes only the three explicit demo IDs while preserving the underlying data and original fixtures", () => {
    const snapshot = MONO_PRODUCT_DEMO_ADAPTER.snapshot;
    expect(snapshot.accounts.map(({ id, kind, label, status }) => ({ id, kind, label, status }))).toEqual([
      { id: "demo-custody", kind: "custodial", label: "Кастодиальный", status: "active" },
      { id: "demo-depositary", kind: "depositary", label: "Депозитарный", status: "active" },
      { id: "demo-private", kind: "private", label: "Приватный", status: "unavailable" },
    ]);
    for (const account of snapshot.accounts) {
      const original = MULTI_ACCOUNT_DEMO.accounts.find(item => item.id === account.id)!;
      expect(account).toEqual({ ...original, label: account.label });
      expect(account).not.toBe(original);
      expect(account.capabilities).not.toBe(original.capabilities);
      expect(account.capabilities[0]).not.toBe(original.capabilities[0]);
    }
    expect(snapshot.holdings).toEqual(MULTI_ACCOUNT_DEMO.holdings.filter(holding => holding.accountId === "demo-custody"));
    expect(snapshot.holdings.map(holding => holding.id)).toEqual(["demo-btc", "demo-eth", "demo-usdc-eth", "demo-usdc-sol"]);
    expect(selectFiatBalanceMinor(snapshot.holdings)).toBe(1_284_075);
    expect(snapshot.holdings[0]).not.toBe(MULTI_ACCOUNT_DEMO.holdings[0]);
    expect(snapshot.batteryPools).toEqual(MULTI_ACCOUNT_DEMO.batteryPools);
    expect(snapshot.batteryPools?.[0]).not.toBe(MULTI_ACCOUNT_DEMO.batteryPools[0]);
    expect(snapshot.batteryPools?.[0]?.eligibleAccountIds).not.toBe(MULTI_ACCOUNT_DEMO.batteryPools[0].eligibleAccountIds);
    expect(MULTI_ACCOUNT_DEMO.accounts.map(({ id, label }) => [id, label])).toEqual([
      ["demo-custody", "Основной"], ["demo-depositary", "Хранилище"],
      ["demo-inactive", "Размещение"], ["demo-private", "Приватный"],
    ]);
    expect(MULTI_ACCOUNT_DEMO.holdings).toHaveLength(5);
    expect(SINGLE_ACCOUNT_DEMO.accounts[0].label).toBe("Основной");
  });

  it("keeps the exact capabilities and makes the unavailable private account non-operational", () => {
    const snapshot = MONO_PRODUCT_DEMO_ADAPTER.snapshot;
    for (const accountId of ["demo-custody", "demo-depositary"]) {
      for (const action of ["receive", "send", "buy", "swap", "withdraw"] as const) {
        const original = resolveActionRoutes(MULTI_ACCOUNT_DEMO, context(accountId), action);
        const current = resolveActionRoutes(snapshot, context(accountId), action);
        expect(current).toEqual({ ...original, routes: original.routes.map(route => ({
          ...route, accountLabel: accountId === "demo-custody" ? "Кастодиальный" : "Депозитарный",
        })) });
      }
    }
    for (const action of ["receive", "send", "buy", "swap", "withdraw"] as const) {
      expect(resolveActionRoutes(snapshot, context("demo-private"), action)).toEqual({ routes: [], reason: "account-unavailable" });
    }
    expect(snapshot.holdings.some(holding => holding.accountId === "demo-private")).toBe(false);
  });

  it("derives example history from the same placements with canonical account labels", () => {
    const snapshot = MONO_PRODUCT_DEMO_ADAPTER.snapshot;
    const activities = MONO_PRODUCT_DEMO_ADAPTER.activities!;
    const original = createSnapshotDemoActivities(MULTI_ACCOUNT_DEMO);
    expect(activities).toHaveLength(4);
    expect(activities).toEqual(original.map(activity => ({ ...activity, accountLabel: "Кастодиальный" })));
    for (const activity of activities) {
      expect(snapshot.accounts.find(account => account.id === activity.accountId)?.label).toBe(activity.accountLabel);
      expect(snapshot.holdings.some(holding => holding.accountId === activity.accountId &&
        holding.assetId === activity.assetId && holding.networkId === activity.networkId)).toBe(true);
    }
  });

  it("uses that snapshot for receive, transfer, send and commerce ports", async () => {
    const snapshot = MONO_PRODUCT_DEMO_ADAPTER.snapshot;
    const ports = createMonoDemoFlowPorts(snapshot);
    const opts = call();
    expect(await ports.receive.load({ accountId: "demo-custody", assetId: "usdc", networkId: "ethereum", receiveMode: "external-address" }, opts))
      .toMatchObject({ status: "ready", data: { accountId: "demo-custody", assetId: "usdc", networkId: "ethereum", safety: "demo-non-payable" } });
    const request = { accountId: "demo-depositary", assetId: "usdc", networkId: "ethereum", receiveMode: "internal-transfer" as const };
    expect(await ports.receive.load(request, opts)).toMatchObject({ status: "ready", data: { sources: [
      { accountId: "demo-custody", accountLabel: "Кастодиальный", status: "available" },
    ] } });
    expect(await ports.receive.load({ ...request, accountId: "demo-private", receiveMode: "external-address" }, opts))
      .toEqual({ status: "unavailable", reason: "account-unavailable" });
    expect(await ports.internalTransfer.quote({ sourceAccountId: "demo-custody", destinationAccountId: "demo-depositary",
      assetId: "usdc", networkId: "ethereum", amount: "1" }, opts)).toMatchObject({ status: "quoted", quote: {
        sourceAccountLabel: "Кастодиальный", destinationAccountLabel: "Депозитарный", available: "500",
      } });
    const send = resolveActionRoutes(snapshot, context("demo-custody"), "send").routes.find(route => route.assetId === "usdc" && route.networkId === "ethereum");
    const buy = resolveActionRoutes(snapshot, context("demo-custody"), "buy").routes.find(route => route.assetId === "usdc" && route.networkId === "ethereum");
    const swap = resolveActionRoutes(snapshot, context("demo-custody"), "swap").routes.find(route => route.assetId === "usdc" && route.networkId === "ethereum");
    if (!send || send.action !== "send" || !buy || buy.action !== "buy" || !swap || swap.action !== "swap") throw new Error("Demo routes missing");
    expect(await ports.send.loadRoute(send, opts)).toMatchObject({ terms: { available: "500" } });
    expect(await ports.buy.loadRoute({ ...buy, action: "buy" }, opts)).toMatchObject({ status: "ready", data: { route: { accountId: "demo-custody", accountLabel: "Кастодиальный" } } });
    expect(await ports.swap.loadRoute({ ...swap, action: "swap" }, opts)).toMatchObject({ status: "ready", data: { source: { accountId: "demo-custody", accountLabel: "Кастодиальный" } } });
  });

  it("does not rewrite an explicitly supplied custom snapshot", async () => {
    const custom = { ...MULTI_ACCOUNT_DEMO, accounts: MULTI_ACCOUNT_DEMO.accounts.map(account =>
      account.id === "demo-custody" ? { ...account, label: "Клиентский тест" } : account) };
    const before = JSON.stringify(custom);
    const ports = createMonoDemoFlowPorts(custom);
    expect(await ports.receive.load({ accountId: "demo-depositary", assetId: "usdc", networkId: "ethereum", receiveMode: "internal-transfer" }, call()))
      .toMatchObject({ status: "ready", data: { sources: [{ accountId: "demo-custody", accountLabel: "Клиентский тест" }] } });
    expect(JSON.stringify(custom)).toBe(before);
    expect(custom.accounts.some(account => account.id === "demo-inactive")).toBe(true);
  });
});
