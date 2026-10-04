import { MULTI_ACCOUNT_DEMO, type ProductSnapshot } from "@wallet/core";
import { createSnapshotDemoActivities, type ProductActivity } from "./demo-activity";
import { createDemoReceiveDataPort, type DemoInternalReceiveBinding } from "./receive";
import { createMockSendPort } from "./send";
import { createDemoInternalTransferPort } from "./internal-transfer";
import { createDemoCommercePorts } from "./commerce";

/** Explicit synthetic binding; it does not infer a live transfer capability. */
export const MONO_DEMO_INTERNAL_BINDINGS: readonly DemoInternalReceiveBinding[] = [
  { destinationAccountId: "demo-depositary", sourceAccountId: "demo-custody", assetId: "usdc", networkId: "ethereum" },
];

export function createMonoDemoFlowPorts(snapshot: Readonly<ProductSnapshot>) {
  return {
    receive: createDemoReceiveDataPort(snapshot, MONO_DEMO_INTERNAL_BINDINGS),
    internalTransfer: createDemoInternalTransferPort(snapshot, MONO_DEMO_INTERNAL_BINDINGS),
    send: createMockSendPort(snapshot),
    ...createDemoCommercePorts(snapshot),
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
  activities: createSnapshotDemoActivities(MULTI_ACCOUNT_DEMO),
  batteryChargePercent: { "demo-ethereum-transfer-pool": 60 },
};
