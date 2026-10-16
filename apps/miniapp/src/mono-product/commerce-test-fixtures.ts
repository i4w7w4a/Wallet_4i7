import type { BuySimulation, SwapSimulation } from "./commerce";
import type { ProductActivity } from "./demo-activity";

/** Complete synthetic domain records for tests; these do not offer routes or capabilities. */
export function createBuySimulationFixture(overrides: Partial<BuySimulation> = {}): BuySimulation {
  return {
    mode: "demo",
    kind: "buy",
    simulationId: "commerce-buy-fixture",
    idempotencyKey: "buy-attempt-fixture",
    quote: {
      kind: "buy",
      mode: "demo",
      id: "buy-quote-fixture",
      portId: "buy-port-fixture",
      expiresAt: 2_000_000_000_000,
      request: {
        route: {
          action: "buy", accountId: "demo-custody", accountKind: "custodial", accountLabel: "Основной",
          assetId: "usdc", symbol: "USDC", name: "USD Coin", networkId: "ethereum", networkLabel: "Ethereum",
        },
        methodId: "demo-payment-usd",
        fiat: { currency: "USD", amount: "100" },
      },
      terms: { decimals: 2, minimum: "10", maximum: "1000" },
      funding: { kind: "external-demo", methodId: "demo-payment-usd", currency: "USD", available: "2000" },
      payment: { kind: "fiat", currency: "USD", decimals: 2, amount: "100" },
      debit: { kind: "fiat", currency: "USD", decimals: 2, amount: "101" },
      credit: {
        kind: "crypto", accountId: "demo-custody", accountKind: "custodial", accountLabel: "Основной",
        assetId: "usdc", symbol: "USDC", name: "USD Coin", networkId: "ethereum", networkLabel: "Ethereum",
        decimals: 6, quantity: "100",
      },
      rate: { outputPerInput: "1", label: "Демо-курс: 1 USD = 1 USDC" },
      fee: { status: "known", amount: "1", unit: { kind: "fiat", currency: "USD", decimals: 2 } },
      feeFunding: { kind: "source" },
    },
    result: { mode: "demo", status: "simulated-success" },
    ...overrides,
  };
}

export function createSwapSimulationFixture(overrides: Partial<SwapSimulation> = {}): SwapSimulation {
  return {
    mode: "demo",
    kind: "swap",
    simulationId: "commerce-swap-fixture",
    idempotencyKey: "swap-attempt-fixture",
    quote: {
      kind: "swap",
      mode: "demo",
      id: "swap-quote-fixture",
      portId: "swap-port-fixture",
      expiresAt: 2_000_000_000_000,
      request: {
        route: {
          action: "swap", accountId: "demo-custody", accountKind: "custodial", accountLabel: "Основной",
          assetId: "usdc", symbol: "USDC", name: "USD Coin", networkId: "ethereum", networkLabel: "Ethereum",
        },
        pairId: "demo-usdc-eth-ethereum",
        destination: {
          accountId: "demo-custody", accountKind: "custodial", accountLabel: "Основной", assetId: "eth",
          symbol: "ETH", name: "Ethereum", networkId: "ethereum", networkLabel: "Ethereum",
        },
        sourceAmount: "100",
      },
      terms: { decimals: 6, minimum: "1", maximum: "500", available: "500" },
      source: {
        kind: "crypto", accountId: "demo-custody", accountKind: "custodial", accountLabel: "Основной",
        assetId: "usdc", symbol: "USDC", name: "USD Coin", networkId: "ethereum", networkLabel: "Ethereum",
        decimals: 6, quantity: "100",
      },
      debit: {
        kind: "crypto", accountId: "demo-custody", accountKind: "custodial", accountLabel: "Основной",
        assetId: "usdc", symbol: "USDC", name: "USD Coin", networkId: "ethereum", networkLabel: "Ethereum",
        decimals: 6, quantity: "101",
      },
      credit: {
        kind: "crypto", accountId: "demo-custody", accountKind: "custodial", accountLabel: "Основной",
        assetId: "eth", symbol: "ETH", name: "Ethereum", networkId: "ethereum", networkLabel: "Ethereum",
        decimals: 18, quantity: "0.04",
      },
      rate: { outputPerInput: "0.0004", label: "Демо-курс: 2500 USDC = 1 ETH" },
      fee: {
        status: "known", amount: "1", unit: {
          kind: "crypto", accountId: "demo-custody", accountKind: "custodial", accountLabel: "Основной",
          assetId: "usdc", symbol: "USDC", name: "USD Coin", networkId: "ethereum", networkLabel: "Ethereum", decimals: 6,
        },
      },
      feeFunding: { kind: "source" },
    },
    result: { mode: "demo", status: "simulated-success" },
    ...overrides,
  };
}

export function createBuyActivityFixture(overrides: Partial<ProductActivity> = {}): ProductActivity {
  return {
    id: "commerce-buy-fixture", accountId: "demo-custody", accountLabel: "Основной", direction: "incoming",
    status: "completed", mode: "simulation", assetId: "usdc", assetSymbol: "USDC", quantity: "100",
    networkId: "ethereum", networkLabel: "Ethereum", occurredAt: "2026-10-04T10:00:00.000Z",
    commerce: createBuySimulationFixture(),
    ...overrides,
  };
}

export function createSwapActivityFixture(overrides: Partial<ProductActivity> = {}): ProductActivity {
  return {
    id: "commerce-swap-fixture", accountId: "demo-custody", accountLabel: "Основной", direction: "exchange",
    status: "completed", mode: "simulation", assetId: "usdc", assetSymbol: "USDC", quantity: "101",
    networkId: "ethereum", networkLabel: "Ethereum", occurredAt: "2026-10-04T10:00:00.000Z",
    commerce: createSwapSimulationFixture(),
    ...overrides,
  };
}
