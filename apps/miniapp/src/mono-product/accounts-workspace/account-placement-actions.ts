import type { ProductActionRoute, ProductHolding } from "@wallet/core";
import { productRouteKey } from "../product-controller";

export type AccountsActionOrigin =
  | { kind: "holding-action"; holdingId: string; action: "send" | "receive" | "buy" | "swap"; routeKey: string }
  | { kind: "account-action"; entry: "receive" | "other"; action: "send" | "receive" | "buy" | "swap"; routeKey: string };

export type AccountPlacementActions = {
  byHoldingId: ReadonlyMap<string, readonly ProductActionRoute[]>;
  receiveRoutes: readonly ProductActionRoute[];
  otherUnplacedRoutes: readonly ProductActionRoute[];
};

/** Presentation only: callers supply the already-permitted routes. */
export function selectAccountPlacementActions(
  holdings: readonly ProductHolding[], routes: readonly ProductActionRoute[],
): AccountPlacementActions {
  const byHoldingId = new Map<string, ProductActionRoute[]>();
  const receiveRoutes: ProductActionRoute[] = [];
  const otherUnplacedRoutes: ProductActionRoute[] = [];
  const seen = new Set<string>();
  for (const holding of holdings) byHoldingId.set(holding.id, []);

  for (const route of routes) {
    const key = productRouteKey(route);
    if (seen.has(key)) continue;
    seen.add(key);

    let placed = false;
    for (const holding of holdings) {
      if (holding.accountId !== route.accountId || holding.assetId !== route.assetId ||
        holding.networkId !== route.networkId) continue;
      byHoldingId.get(holding.id)!.push(route);
      placed = true;
    }

    if (route.action === "receive") receiveRoutes.push(route);
    else if (!placed) otherUnplacedRoutes.push(route);
  }

  return { byHoldingId, receiveRoutes, otherUnplacedRoutes };
}
