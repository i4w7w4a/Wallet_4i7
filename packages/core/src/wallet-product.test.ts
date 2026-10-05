import { describe, expect, it } from "vitest";

import {
  groupHoldingsByAsset,
  resolveActionRoutes,
  resolveBatteryCoverage,
  selectBatteryPools,
  selectFiatBalanceMinor,
  selectHoldings,
  type ProductActionRoute,
  type ProductSnapshot,
} from "./wallet-product";
import { MULTI_ACCOUNT_DEMO, SINGLE_ACCOUNT_DEMO } from "./wallet-product-demo";

describe("wallet product selectors", () => {
  it("keeps a single account as the only route source in both contexts", () => {
    const accountId = SINGLE_ACCOUNT_DEMO.accounts[0].id;
    const selected = resolveActionRoutes(
      SINGLE_ACCOUNT_DEMO,
      { kind: "account", accountId },
      "send",
    );
    const all = resolveActionRoutes(SINGLE_ACCOUNT_DEMO, { kind: "all" }, "send");

    expect(selected.reason).toBeNull();
    expect(selected.routes.map(({ accountId: id }) => id)).toEqual([accountId]);
    expect(all.routes).toEqual(selected.routes);
    expect(selectHoldings(SINGLE_ACCOUNT_DEMO, { kind: "account", accountId })).toEqual(
      SINGLE_ACCOUNT_DEMO.holdings,
    );
  });

  it("uses real accounts rather than All as a spend source", () => {
    const result = resolveActionRoutes(MULTI_ACCOUNT_DEMO, { kind: "all" }, "send");

    expect(result.reason).toBeNull();
    expect(result.routes.length).toBeGreaterThan(0);
    expect(new Set(result.routes.map((route) => route.accountId))).toEqual(
      new Set(["demo-custody"]),
    );
    expect(result.routes.every((route) => route.accountId !== "all")).toBe(true);
    expect(result.routes.every((route) => route.assetId && route.networkId)).toBe(true);
  });

  it("closes inactive and unavailable accounts despite declared capabilities", () => {
    for (const [accountId, reason] of [
      ["demo-inactive", "account-inactive"],
      ["demo-private", "account-unavailable"],
    ] as const) {
      expect(
        resolveActionRoutes(MULTI_ACCOUNT_DEMO, { kind: "account", accountId }, "receive"),
      ).toEqual({ routes: [], reason });
    }

    expect(
      resolveActionRoutes(
        MULTI_ACCOUNT_DEMO,
        { kind: "account", accountId: "missing" },
        "receive",
      ),
    ).toEqual({ routes: [], reason: "account-not-found" });
  });

  it("fails closed for missing capabilities and excludes unavailable receive variants", () => {
    const context = { kind: "account", accountId: "demo-depositary" } as const;
    const receive = resolveActionRoutes(MULTI_ACCOUNT_DEMO, context, "receive");

    expect(receive.reason).toBeNull();
    expect(
      receive.routes.map((route) =>
        route.action === "receive" ? route.receiveMode : null,
      ),
    ).toEqual(["internal-transfer"]);
    expect(resolveActionRoutes(MULTI_ACCOUNT_DEMO, context, "send")).toEqual({
      routes: [],
      reason: "capability-unavailable",
    });
  });

  it("preserves separate placements when a symbol appears on two networks", () => {
    const holdings = selectHoldings(MULTI_ACCOUNT_DEMO, {
      kind: "account",
      accountId: "demo-custody",
    });
    const usdc = groupHoldingsByAsset(holdings).find((group) => group.symbol === "USDC");

    expect(usdc?.placements.map(({ id, networkId, quantity }) => ({ id, networkId, quantity }))).toEqual([
      { id: "demo-usdc-eth", networkId: "ethereum", quantity: "500" },
      { id: "demo-usdc-sol", networkId: "solana", quantity: "400" },
    ]);
    expect(usdc?.fiatMinor).toBe(90_000);
    expect(selectFiatBalanceMinor(MULTI_ACCOUNT_DEMO.holdings)).toBe(1_284_075);
  });

  it("sums only supplied holdings and rejects unsafe minor units", () => {
    expect(selectFiatBalanceMinor(MULTI_ACCOUNT_DEMO.holdings.slice(0, 1))).toBe(804_025);
    expect(() =>
      selectFiatBalanceMinor([{ ...MULTI_ACCOUNT_DEMO.holdings[0], fiatMinor: Number.MAX_SAFE_INTEGER + 1 }]),
    ).toThrow(RangeError);
  });
});

describe("network battery pool", () => {
  const ethereumSend = resolveActionRoutes(
    MULTI_ACCOUNT_DEMO,
    { kind: "account", accountId: "demo-custody" },
    "send",
  ).routes.find((route) => route.networkId === "ethereum")!;

  it("covers only the matching eligible account, network, and action", () => {
    expect(resolveBatteryCoverage(MULTI_ACCOUNT_DEMO.batteryPools, ethereumSend).status).toBe(
      "covered",
    );
    expect(
      resolveBatteryCoverage(MULTI_ACCOUNT_DEMO.batteryPools, {
        ...ethereumSend,
        accountId: "demo-private",
      }).status,
    ).toBe("not-applicable");
    expect(
      resolveBatteryCoverage(MULTI_ACCOUNT_DEMO.batteryPools, {
        ...ethereumSend,
        networkId: "solana",
      }).status,
    ).toBe("not-applicable");
    expect(
      resolveBatteryCoverage(MULTI_ACCOUNT_DEMO.batteryPools, {
        ...ethereumSend,
        action: "withdraw",
      } as ProductActionRoute).status,
    ).toBe("not-applicable");
  });

  it("exposes one shared pool to both eligible accounts without doubling it in All", () => {
    const pools = MULTI_ACCOUNT_DEMO.batteryPools;
    const custody = selectBatteryPools(pools, { kind: "account", accountId: "demo-custody" });
    const depositary = selectBatteryPools(pools, { kind: "account", accountId: "demo-depositary" });

    expect(custody.map(({ id }) => id)).toEqual(["demo-ethereum-transfer-pool"]);
    expect(depositary.map(({ id }) => id)).toEqual(["demo-ethereum-transfer-pool"]);
    expect(selectBatteryPools(pools, { kind: "all" }).map(({ id }) => id)).toEqual([
      "demo-ethereum-transfer-pool",
    ]);
  });

  it("never treats unknown coverage as free", () => {
    const unknownPool = {
      ...MULTI_ACCOUNT_DEMO.batteryPools[0],
      remainingTransfers: "unknown" as const,
    };

    expect(resolveBatteryCoverage([unknownPool], ethereumSend).status).toBe("unknown");
    expect(resolveBatteryCoverage(undefined, ethereumSend).status).toBe("unknown");
    expect(resolveBatteryCoverage([], ethereumSend).status).toBe("not-applicable");
    expect(
      resolveBatteryCoverage([{ ...unknownPool, remainingTransfers: 0 }], ethereumSend).status,
    ).toBe("exhausted");
  });

  it("refuses to sum ambiguous matching pools", () => {
    const pool = MULTI_ACCOUNT_DEMO.batteryPools[0];
    const snapshot: ProductSnapshot = {
      ...MULTI_ACCOUNT_DEMO,
      batteryPools: [pool, { ...pool, id: "duplicate-ethereum-pool" }],
    };

    expect(resolveBatteryCoverage(snapshot.batteryPools, ethereumSend).status).toBe("unknown");
  });
});
