import { MULTI_ACCOUNT_DEMO, type ProductSnapshot } from "@wallet/core";
import { createDemoActivities, type ProductActivity } from "./demo-activity";

/** Replace this data port with an API-backed snapshot when product endpoints exist. */
export type MonoProductAdapter = {
  readonly kind: "demo";
  readonly snapshot: Readonly<ProductSnapshot>;
  readonly activities?: readonly ProductActivity[];
};

export const MONO_PRODUCT_DEMO_ADAPTER: MonoProductAdapter = {
  kind: "demo",
  snapshot: MULTI_ACCOUNT_DEMO,
  activities: createDemoActivities(MULTI_ACCOUNT_DEMO.accounts[0].id, MULTI_ACCOUNT_DEMO.accounts[0].label),
};
