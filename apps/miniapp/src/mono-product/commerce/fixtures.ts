/** Explicit synthetic allowlists; they do not grant capabilities by themselves. */
export const DEMO_BUY_ROUTES = [
  { accountId: "demo-custody", accountKind: "custodial", assetId: "usdc", networkId: "ethereum", decimals: 6 },
] as const;
export const DEMO_BUY_METHOD = {
  id: "demo-payment-usd",
  label: "Демо-оплата",
  currency: "USD",
  terms: { decimals: 2, minimum: "10", maximum: "1000" },
  funding: { kind: "external-demo", methodId: "demo-payment-usd", currency: "USD", available: "2000" },
  rate: { outputPerInput: "1", label: "Демо-курс: 1 USD = 1 USDC" },
  feeAmount: "1",
} as const;
export const DEMO_SWAP_PAIRS = [
  {
    id: "demo-usdc-eth-ethereum",
    source: { accountId: "demo-custody", accountKind: "custodial", assetId: "usdc", networkId: "ethereum", decimals: 6 },
    destination: { accountId: "demo-custody", accountKind: "custodial", assetId: "eth", networkId: "ethereum", decimals: 18 },
    terms: { decimals: 6, minimum: "1", maximum: "500" },
    rate: { outputPerInput: "0.0004", label: "Демо-курс: 2500 USDC = 1 ETH" },
    feeAmount: "1",
  },
] as const;
export const DEMO_COMMERCE_QUOTE_TTL_MS = 60_000;
