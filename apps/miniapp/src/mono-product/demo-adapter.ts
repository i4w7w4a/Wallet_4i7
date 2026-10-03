import { MULTI_ACCOUNT_DEMO, type ProductSnapshot } from "@wallet/core";
import { createDemoActivities, type ProductActivity } from "./demo-activity";
import { createDemoReceiveDataPort } from "./receive";
import { createMockSendPort } from "./send";

/** Explicit synthetic binding; it does not infer a live transfer capability. */
export function createMonoDemoFlowPorts(snapshot: Readonly<ProductSnapshot>) {
  return {
    receive: createDemoReceiveDataPort(snapshot, [{ destinationAccountId: "demo-depositary",
      sourceAccountId: "demo-custody", assetId: "usdc", networkId: "ethereum" }]),
    send: createMockSendPort(snapshot),
  };
}

/** Replace this data port with an API-backed snapshot when product endpoints exist. */
export type MonoProductAdapter = {
  readonly kind: "demo";
  readonly snapshot: Readonly<ProductSnapshot>;
  readonly activities?: readonly ProductActivity[];
  readonly activityStatus?: "ready" | "loading" | "error";
  readonly retryActivities?: () => void;
  /** Display metadata supplied explicitly; never derived from remainingTransfers. */
  readonly batteryChargePercent?: Readonly<Record<string, number | null>>;
};

export const MONO_PRODUCT_DEMO_ADAPTER: MonoProductAdapter = {
  kind: "demo",
  snapshot: MULTI_ACCOUNT_DEMO,
  activities: createDemoActivities(MULTI_ACCOUNT_DEMO.accounts[0].id, MULTI_ACCOUNT_DEMO.accounts[0].label),
  batteryChargePercent: { "demo-ethereum-transfer-pool": 60 },
};
