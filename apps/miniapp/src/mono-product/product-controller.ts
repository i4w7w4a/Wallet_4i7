"use client";

import { useCallback, useMemo, useState } from "react";
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
  | { kind: "intent"; action: ProductActionKind; route: ProductActionRoute | null; focusRouteKey?: string }
  | null;

export type ProductBatteryActivity = { poolId: string; phase: "using" } | null;

export function productRouteKey(route: ProductActionRoute): string {
  return [route.action, route.accountId, route.assetId, route.networkId,
    route.action === "receive" ? route.receiveMode : ""].join(":");
}

export type MonoProductView = {
  snapshot: Readonly<ProductSnapshot>;
  activities: readonly ProductActivity[];
  activityStatus: "ready" | "loading" | "error";
  expandedActivityId: string | null;
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
  batteryActivity: ProductBatteryActivity;
  batteryChargePercent: Readonly<Record<string, number | null>>;
};

export type MonoProductCommands = {
  setBalanceHidden(hidden: boolean): void;
  openAccounts(): void;
  selectContext(context: AccountContext): void;
  openBattery(): void;
  openIntent(action: ProductActionKind): void;
  selectRoute(route: ProductActionRoute): void;
  backToRoutes(route: ProductActionRoute): void;
  setBatteryActivity(activity: ProductBatteryActivity): void;
  expandActivity(id: string | null): void;
  retryActivities?: () => void;
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
  const [expandedActivityId, setExpandedActivityId] = useState<string | null>(null);
  const [batteryActivity, updateBatteryActivity] = useState<ProductBatteryActivity>(null);
  const setBatteryActivity = useCallback((activity: ProductBatteryActivity) => {
    updateBatteryActivity(current => current?.poolId === activity?.poolId && current?.phase === activity?.phase
      ? current : activity);
  }, []);
  const closeSheet = useCallback(() => { setSheet(null); updateBatteryActivity(null); }, []);
  const balanceHidden = privacy.hidden ?? localHidden;
  const account = context.kind === "account"
    ? snapshot.accounts.find(candidate => candidate.id === context.accountId) ?? null : null;
  const effectiveContext = context.kind === "account" && !account
    ? { kind: "all" } as const : context;
  const selectedHoldings = useMemo(() => selectHoldings(snapshot, effectiveContext), [snapshot, effectiveContext]);
  const holdings = useMemo(() => groupHoldingsByAsset(selectedHoldings), [selectedHoldings]);
  const balanceMinor = useMemo(() => selectFiatBalanceMinor(selectedHoldings), [selectedHoldings]);
  const batteryPools = useMemo(() => selectBatteryPools(snapshot.batteryPools, effectiveContext), [snapshot, effectiveContext]);
  const batteryChargePercent = useMemo(() => Object.fromEntries((snapshot.batteryPools ?? []).map(pool => {
    const percent = adapter.batteryChargePercent?.[pool.id];
    return [pool.id, typeof percent === "number" && Number.isFinite(percent) && percent >= 0 && percent <= 100
      ? percent : null];
  })), [snapshot, adapter.batteryChargePercent]);
  const intent = sheet?.kind === "intent"
    ? resolveActionRoutes(snapshot, effectiveContext, sheet.action) : null;
  const coverage = sheet?.kind === "intent" && sheet.route
    ? resolveBatteryCoverage(snapshot.batteryPools, sheet.route) : null;

  return {
    view: { snapshot, activities: adapter.activities ?? [], activityStatus: adapter.activityStatus ?? "ready", expandedActivityId,
      context: effectiveContext, account, holdings, balanceMinor, batteryPools,
      balanceHidden, fundsExpanded, expandedAssetIds, sheet, intent, coverage, batteryActivity, batteryChargePercent },
    commands: {
      setBalanceHidden(hidden) {
        if (privacy.onHiddenChange) privacy.onHiddenChange(hidden);
        else setLocalHidden(hidden);
      },
      openAccounts() { if (snapshot.accounts.length > 1) { updateBatteryActivity(null); setSheet({ kind: "accounts" }); } },
      selectContext(next) { setContext(next); setExpandedActivityId(null); closeSheet(); },
      openBattery() { updateBatteryActivity(null); setSheet(current => current?.kind === "battery" ? null : { kind: "battery" }); },
      openIntent(action) { updateBatteryActivity(null); setSheet({ kind: "intent", action, route: null }); },
      selectRoute(route) { updateBatteryActivity(null); setSheet(current => current?.kind === "intent" &&
        current.action === route.action ? { ...current, route } : current); },
      backToRoutes(route) { updateBatteryActivity(null); setSheet({ kind: "intent", action: route.action,
        route: null, focusRouteKey: productRouteKey(route) }); },
      setBatteryActivity,
      expandActivity: setExpandedActivityId,
      retryActivities: adapter.retryActivities,
      toggleFunds() { setFundsExpanded(value => !value); },
      toggleAsset(assetId) {
        setExpandedAssetIds(current => {
          const next = new Set(current);
          if (next.has(assetId)) next.delete(assetId);
          else next.add(assetId);
          return next;
        });
      },
      closeSheet,
    },
  };
}
