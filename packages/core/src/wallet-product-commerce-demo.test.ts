import { expect, it } from "vitest";
import { MULTI_ACCOUNT_DEMO } from "./wallet-product-demo";
import { resolveActionRoutes } from "./wallet-product";

it.each(["buy", "swap"] as const)("offers %s only on the explicit USDC Ethereum demo placement", action => {
  const routes = resolveActionRoutes(MULTI_ACCOUNT_DEMO, { kind: "all" }, action).routes;
  expect(routes.map(route => [route.accountId, route.assetId, route.networkId])).toEqual([
    ["demo-custody", "usdc", "ethereum"],
  ]);
  for (const accountId of ["demo-depositary", "demo-inactive", "demo-private"]) {
    expect(resolveActionRoutes(MULTI_ACCOUNT_DEMO, { kind: "account", accountId }, action).routes).toEqual([]);
  }
});

it("retains the exact external ETH receive destination for the offered swap pair", () => {
  const destination = resolveActionRoutes(MULTI_ACCOUNT_DEMO, { kind: "account", accountId: "demo-custody" }, "receive")
    .routes.filter(route => route.assetId === "eth" && route.networkId === "ethereum");
  expect(destination).toMatchObject([{ action: "receive", receiveMode: "external-address", accountId: "demo-custody" }]);
});
