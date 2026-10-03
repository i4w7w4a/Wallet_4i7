"use client";

import { useMemo, useState } from "react";
import {
  groupHoldingsByAsset, resolveActionRoutes, resolveBatteryCoverage, selectBatteryPools, selectFiatBalanceMinor, selectHoldings,
  type AccountContext, type ActionRouteResolution, type AssetHoldingGroup, type BatteryCoverage, type BatteryPool,
  type ProductAccount, type ProductActionKind, type ProductActionRoute, type ProductSnapshot,
} from "@wallet/core";

import type { MonoProductAdapter } from "./demo-adapter";
import type { ProductActivity } from "./demo-activity";

export type ProductSheetState =
  | { kind: "accounts" }
  | { kind: "battery" }
  | { kind: "intent"; action: ProductActionKind; route: ProductActionRoute | null }
  | null;

export type MonoProductView = {
  snapshot: Readonly<ProductSnapshot>;
  activities: readonly ProductActivity[];
  context: AccountContext;
  account: ProductAccount | null;
  holdings: readonly AssetHoldingGroup[];
  balanceMinor: number;
  batteryPools: readonly BatteryPool[];
  balanceHidden: boolean;
  fundsExpanded: boolean;
  expandedAssetIds: ReadonlySet<string>;
  sheet: ProductSheetState;
  intent: ActionRouteResolution | null;
  coverage: BatteryCoverage | null;
};

export type MonoProductCommands = {
  setBalanceHidden(hidden: boolean): void;
  openAccounts(): void;
  selectContext(context: AccountContext): void;
  openBattery(): void;
  openIntent(action: ProductActionKind): void;
  selectRoute(route: ProductActionRoute): void;
  toggleFunds(): void;
  toggleAsset(assetId: string): void;
  closeSheet(): void;
};

export type MonoProductController = { view: MonoProductView; commands: MonoProductCommands };

export function useMonoProductController(adapter: MonoProductAdapter, privacy: {
  initialHidden: boolean;
  hidden?: boolean;
  onHiddenChange?: (hidden: boolean) => void;
}): MonoProductController {
  const { snapshot } = adapter;
  const [context, setContext] = useState<AccountContext>(() => snapshot.accounts.length === 1
    ? { kind: "account", accountId: snapshot.accounts[0]!.id } : { kind: "all" });
  const [localHidden, setLocalHidden] = useState(privacy.initialHidden);
  const [fundsExpanded, setFundsExpanded] = useState(false);
  const [expandedAssetIds, setExpandedAssetIds] = useState<ReadonlySet<string>>(() => new Set());
  const [sheet, setSheet] = useState<ProductSheetState>(null);
  const balanceHidden = privacy.hidden ?? localHidden;
  const account = context.kind === "account"
    ? snapshot.accounts.find(candidate => candidate.id === context.accountId) ?? null : null;
  const effectiveContext = context.kind === "account" && !account
    ? { kind: "all" } as const : context;
  const selectedHoldings = useMemo(() => selectHoldings(snapshot, effectiveContext), [snapshot, effectiveContext]);
  const holdings = useMemo(() => groupHoldingsByAsset(selectedHoldings), [selectedHoldings]);
  const balanceMinor = useMemo(() => selectFiatBalanceMinor(selectedHoldings), [selectedHoldings]);
  const batteryPools = useMemo(() => selectBatteryPools(snapshot.batteryPools, effectiveContext), [snapshot, effectiveContext]);
  const intent = sheet?.kind === "intent"
    ? resolveActionRoutes(snapshot, effectiveContext, sheet.action) : null;
  const coverage = sheet?.kind === "intent" && sheet.route
    ? resolveBatteryCoverage(snapshot.batteryPools, sheet.route) : null;

  return {
    view: { snapshot, activities: adapter.activities ?? [], context: effectiveContext, account, holdings, balanceMinor, batteryPools,
      balanceHidden, fundsExpanded, expandedAssetIds, sheet, intent, coverage },
    commands: {
      setBalanceHidden(hidden) {
        if (privacy.onHiddenChange) privacy.onHiddenChange(hidden);
        else setLocalHidden(hidden);
      },
      openAccounts() { if (snapshot.accounts.length > 1) setSheet({ kind: "accounts" }); },
      selectContext(next) { setContext(next); setSheet(null); },
      openBattery() { setSheet({ kind: "battery" }); },
      openIntent(action) { setSheet({ kind: "intent", action, route: null }); },
      selectRoute(route) { setSheet(current => current?.kind === "intent" ? { ...current, route } : current); },
      toggleFunds() { setFundsExpanded(value => !value); },
      toggleAsset(assetId) {
        setExpandedAssetIds(current => {
          const next = new Set(current);
          if (next.has(assetId)) next.delete(assetId);
          else next.add(assetId);
          return next;
        });
      },
      closeSheet() { setSheet(null); },
    },
  };
}
