import { MULTI_ACCOUNT_DEMO, resolveActionRoutes, type ProductActionRoute, type ProductHolding } from "@wallet/core";
import { describe, expect, it } from "vitest";
import { productRouteKey } from "../product-controller";
import { selectAccountPlacementActions, type AccountPlacementActions } from "./account-placement-actions";

const usdcEthereum = {
  assetId: "usdc", symbol: "USDC", name: "USD Coin", networkId: "ethereum", networkLabel: "Ethereum",
};
const mainAccount = { accountId: "main", accountLabel: "Основной", accountKind: "custodial" } as const;
const holding: ProductHolding = {
  ...usdcEthereum, id: "main-usdc-eth", accountId: "main", quantity: "50", availableQuantity: "7", fiatMinor: 5000,
};
const sendRoute: ProductActionRoute = { ...usdcEthereum, ...mainAccount, action: "send" };
const externalReceive: ProductActionRoute = {
  ...usdcEthereum, ...mainAccount, action: "receive", receiveMode: "external-address",
};
const internalReceive: ProductActionRoute = {
  ...usdcEthereum, ...mainAccount, action: "receive", receiveMode: "internal-transfer",
};
const buyRoute: ProductActionRoute = { ...usdcEthereum, ...mainAccount, action: "buy" };
const swapRoute: ProductActionRoute = { ...usdcEthereum, ...mainAccount, action: "swap" };

function reachableKeys(placementActions: AccountPlacementActions): Set<string> {
  return new Set([
    ...[...placementActions.byHoldingId.values()].flat(),
    ...placementActions.receiveRoutes,
    ...placementActions.otherUnplacedRoutes,
  ].map(productRouteKey));
}

describe("selectAccountPlacementActions", () => {
  it("keeps every permitted demo route reachable, including the empty Vault receive placement", () => {
    const routes = (["send", "receive", "buy", "swap"] as const).flatMap(action =>
      resolveActionRoutes(MULTI_ACCOUNT_DEMO, { kind: "all" }, action).routes);

    const result = selectAccountPlacementActions(MULTI_ACCOUNT_DEMO.holdings, routes);

    expect(reachableKeys(result)).toEqual(new Set([
      "send:demo-custody:btc:bitcoin:",
      "send:demo-custody:eth:ethereum:",
      "send:demo-custody:usdc:ethereum:",
      "send:demo-custody:usdc:solana:",
      "receive:demo-custody:btc:bitcoin:external-address",
      "receive:demo-custody:eth:ethereum:external-address",
      "receive:demo-custody:usdc:ethereum:external-address",
      "receive:demo-custody:usdc:solana:external-address",
      "receive:demo-depositary:usdc:ethereum:internal-transfer",
      "buy:demo-custody:usdc:ethereum:",
      "swap:demo-custody:usdc:ethereum:",
    ]));
    expect(result.receiveRoutes.map(productRouteKey)).toContain(
      "receive:demo-depositary:usdc:ethereum:internal-transfer");
  });

  it("matches all three placement identities without merging the same asset across networks", () => {
    const solana = { networkId: "solana", networkLabel: "Solana" };
    const solanaHolding: ProductHolding = { ...holding, ...solana, id: "main-usdc-sol" };
    const solanaSend: ProductActionRoute = { ...sendRoute, ...solana };
    const differentAsset: ProductActionRoute = { ...sendRoute, assetId: "eth", symbol: "ETH", name: "Ethereum" };
    const differentAccount: ProductActionRoute = {
      ...sendRoute, accountId: "vault", accountLabel: "Хранилище", accountKind: "depositary",
    };
    const differentNetwork: ProductActionRoute = { ...sendRoute, networkId: "polygon", networkLabel: "Polygon" };

    const result = selectAccountPlacementActions([holding, solanaHolding], [
      sendRoute, solanaSend, differentAsset, differentAccount, differentNetwork,
    ]);

    expect(result.byHoldingId.get(holding.id)).toEqual([sendRoute]);
    expect(result.byHoldingId.get(solanaHolding.id)).toEqual([solanaSend]);
    expect(result.otherUnplacedRoutes).toEqual([differentAsset, differentAccount, differentNetwork]);
    expect(result.receiveRoutes).toEqual([]);
  });

  it("deduplicates only complete keys and retains both receive modes and each permitted action", () => {
    const routes = [externalReceive, internalReceive, sendRoute, buyRoute, swapRoute,
      { ...externalReceive, accountLabel: "Повторный источник" }, { ...sendRoute }, { ...internalReceive }];

    const result = selectAccountPlacementActions([holding], routes);

    expect(result.byHoldingId.get(holding.id)).toEqual([
      externalReceive, internalReceive, sendRoute, buyRoute, swapRoute,
    ]);
    expect(result.receiveRoutes).toEqual([externalReceive, internalReceive]);
    expect(result.otherUnplacedRoutes).toEqual([]);
    expect(reachableKeys(result)).toEqual(new Set([
      "receive:main:usdc:ethereum:external-address",
      "receive:main:usdc:ethereum:internal-transfer",
      "send:main:usdc:ethereum:",
      "buy:main:usdc:ethereum:",
      "swap:main:usdc:ethereum:",
    ]));
  });

  it("exposes all receive and non-receive operations even when there are no holdings", () => {
    const vaultReceive: ProductActionRoute = {
      ...internalReceive, accountId: "vault", accountLabel: "Хранилище", accountKind: "depositary",
    };

    const result = selectAccountPlacementActions([], [
      externalReceive, vaultReceive, sendRoute, buyRoute, swapRoute, { ...sendRoute },
    ]);

    expect(result.byHoldingId.size).toBe(0);
    expect(result.receiveRoutes).toEqual([externalReceive, vaultReceive]);
    expect(result.otherUnplacedRoutes).toEqual([sendRoute, buyRoute, swapRoute]);
  });

  it.each([
    { label: "zero", quantity: "0", availableQuantity: "0" },
    { label: "unknown availability", quantity: "50", availableQuantity: undefined },
  ])("retains authorized preparation routes for $label balances", ({ quantity, availableQuantity }) => {
    const result = selectAccountPlacementActions([{ ...holding, quantity, availableQuantity }], [sendRoute]);

    expect(result.byHoldingId.get(holding.id)).toEqual([sendRoute]);
    expect(result.otherUnplacedRoutes).toEqual([]);
  });

  it("does not infer any capability from a holding or its available quantity", () => {
    const result = selectAccountPlacementActions([holding], []);

    expect(result.byHoldingId.get(holding.id) ?? []).toEqual([]);
    expect(result.receiveRoutes).toEqual([]);
    expect(result.otherUnplacedRoutes).toEqual([]);
    expect(reachableKeys(result).size).toBe(0);
  });
});
