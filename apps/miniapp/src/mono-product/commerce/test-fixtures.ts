import { MULTI_ACCOUNT_DEMO, type ProductSnapshot } from "@wallet/core";
import type { BuyQuote, BuyRoute, SwapQuote, SwapRoute } from "./types";

export const usdc = { accountId: "demo-custody", accountKind: "custodial" as const, accountLabel: "Основной",
  assetId: "usdc", symbol: "USDC", name: "USD Coin", networkId: "ethereum", networkLabel: "Ethereum" };
export const eth = { ...usdc, assetId: "eth", symbol: "ETH", name: "Ethereum" };
export const buyRoute: BuyRoute = { ...usdc, action: "buy" };
export const swapRoute: SwapRoute = { ...usdc, action: "swap" };

export function buyQuote(): BuyQuote {
  return {
    mode: "demo", kind: "buy", id: "buy-quote", portId: "buy-port", expiresAt: 61000,
    request: { route: { ...buyRoute }, methodId: "demo-payment-usd", fiat: { currency: "USD", amount: "100" } },
    terms: { decimals: 2, minimum: "10", maximum: "1000" },
    funding: { kind: "external-demo", methodId: "demo-payment-usd", currency: "USD", available: "2000" },
    payment: { kind: "fiat", currency: "USD", decimals: 2, amount: "100" },
    debit: { kind: "fiat", currency: "USD", decimals: 2, amount: "101" },
    credit: { ...usdc, kind: "crypto", decimals: 6, quantity: "100" },
    rate: { outputPerInput: "1", label: "Демо-курс: 1 USD = 1 USDC" },
    fee: { status: "known", amount: "1", unit: { kind: "fiat", currency: "USD", decimals: 2 } },
    feeFunding: { kind: "source" },
  };
}
export function swapQuote(): SwapQuote {
  return {
    mode: "demo", kind: "swap", id: "swap-quote", portId: "swap-port", expiresAt: 61000,
    request: { route: { ...swapRoute }, pairId: "demo-usdc-eth-ethereum", destination: { ...eth }, sourceAmount: "100" },
    terms: { decimals: 6, minimum: "1", maximum: "500", available: "500" },
    source: { ...usdc, kind: "crypto", decimals: 6, quantity: "100" },
    debit: { ...usdc, kind: "crypto", decimals: 6, quantity: "101" },
    credit: { ...eth, kind: "crypto", decimals: 18, quantity: "0.04" },
    rate: { outputPerInput: "0.0004", label: "Демо-курс: 2500 USDC = 1 ETH" },
    fee: { status: "known", amount: "1", unit: { ...usdc, kind: "crypto", decimals: 6 } },
    feeFunding: { kind: "source" },
  };
}
export function commerceSnapshot(): ProductSnapshot {
  const snapshot: ProductSnapshot = JSON.parse(JSON.stringify(MULTI_ACCOUNT_DEMO));
  const source = snapshot.accounts.find(account => account.id === "demo-custody")!;
  const capability = { assetId: "usdc", symbol: "USDC", name: "USD Coin", networkId: "ethereum", networkLabel: "Ethereum" };
  for (const action of ["buy", "swap"] as const) {
    if (!source.capabilities.some(value => value.action === action && value.assetId === "usdc" && value.networkId === "ethereum")) {
      source.capabilities = [...source.capabilities, { ...capability, action }];
    }
  }
  return snapshot;
}
