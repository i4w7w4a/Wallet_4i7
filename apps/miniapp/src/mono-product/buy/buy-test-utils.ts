import { MULTI_ACCOUNT_DEMO, type ProductSnapshot } from "@wallet/core";
import { createDemoCommercePorts, type BuyFlowProps, type BuyPort, type BuyRoute } from "../commerce";

export const buyRoute: BuyRoute = {
  action: "buy", accountId: "demo-custody", accountKind: "custodial", accountLabel: "Основной",
  assetId: "usdc", symbol: "USDC", name: "USD Coin", networkId: "ethereum", networkLabel: "Ethereum",
};

/** Add the exact test capability only when absent; never duplicate a ready route. */
export function buySnapshot(): ProductSnapshot {
  return {
    ...MULTI_ACCOUNT_DEMO,
    accounts: MULTI_ACCOUNT_DEMO.accounts.map(account => account.id === "demo-custody" &&
      !account.capabilities.some(value => value.action === "buy" && value.assetId === "usdc" && value.networkId === "ethereum")
      ? { ...account, capabilities: [...account.capabilities, {
        action: "buy" as const, assetId: "usdc", symbol: "USDC", name: "USD Coin", networkId: "ethereum", networkLabel: "Ethereum",
      }] }
      : account),
  };
}

export function realBuyPort(): BuyPort {
  return createDemoCommercePorts(buySnapshot(), { loadDelayMs: 0, quoteDelayMs: 0, submitDelayMs: 0 }).buy;
}

export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

export function flowProps(port: BuyPort, extra: Partial<BuyFlowProps> = {}): BuyFlowProps {
  return {
    route: buyRoute, port, privacy: false,
    onBack: () => {}, onClose: () => {}, onSimulationResult: () => {}, onSubmitBusyChange: () => {},
    ...extra,
  };
}
