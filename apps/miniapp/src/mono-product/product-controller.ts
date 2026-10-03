"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  groupHoldingsByAsset, resolveActionRoutes, resolveBatteryCoverage, selectBatteryPools, selectFiatBalanceMinor, selectHoldings,
  type AccountContext, type ActionRouteResolution, type AssetHoldingGroup, type BatteryCoverage, type BatteryPool,
  type ProductAccount, type ProductActionKind, type ProductActionRoute, type ProductSnapshot,
} from "@wallet/core";

import { MONO_DEMO_INTERNAL_BINDINGS, MONO_PRODUCT_DEMO_ADAPTER, type MonoProductAdapter } from "./demo-adapter";
import type { ProductActivity } from "./demo-activity";
import { normalizeOperationReceipt } from "./operation-receipt";
import type { SendDraft, SendSimulationResult } from "./send";
import { validateInternalTransferQuote, type InternalTransferDraft, type InternalTransferSimulation } from "./internal-transfer";
import { readNonNegativeDecimal } from "./internal-transfer/validation";

export type ProductSheetState =
  | { kind: "accounts" }
  | { kind: "battery" }
  | { kind: "intent"; action: ProductActionKind; route: ProductActionRoute | null; focusRouteKey?: string; placementId?: string }
  | null;

export type ProductBatteryActivity = { poolId: string; phase: "using" } | null;
export type ProductAssetWorkspaceState = { assetId: string; holdingId: string | null } | null;

export function productRouteKey(route: ProductActionRoute): string {
  return [route.action, route.accountId, route.assetId, route.networkId,
    route.action === "receive" ? route.receiveMode : ""].join(":");
}

export function sendDraftKey(route: { accountId: string; assetId: string; networkId: string }): string {
  return JSON.stringify([route.accountId, route.assetId, route.networkId]);
}

export function receiveRequestAmountKey(route: ProductActionRoute): string {
  return JSON.stringify([route.accountId, route.assetId, route.networkId, route.action === "receive" ? route.receiveMode : null]);
}

function internalTarget(snapshot: Readonly<ProductSnapshot>, identity: { accountId: string; assetId: string; networkId: string }) {
  if (snapshot.accounts.filter(account => account.id === identity.accountId).length !== 1) return null;
  if (!MONO_DEMO_INTERNAL_BINDINGS.some(binding => binding.destinationAccountId === identity.accountId &&
    binding.assetId === identity.assetId && binding.networkId === identity.networkId)) return null;
  const routes = resolveActionRoutes(snapshot, { kind: "account", accountId: identity.accountId }, "receive").routes
    .filter(route => route.action === "receive" && route.receiveMode === "internal-transfer" &&
      route.assetId === identity.assetId && route.networkId === identity.networkId);
  return routes.length === 1 ? routes[0]! : null;
}

function internalSource(snapshot: Readonly<ProductSnapshot>, target: ProductActionRoute, sourceAccountId: string) {
  if (snapshot.accounts.filter(account => account.id === sourceAccountId).length !== 1) return null;
  if (!MONO_DEMO_INTERNAL_BINDINGS.some(binding => binding.destinationAccountId === target.accountId &&
    binding.sourceAccountId === sourceAccountId && binding.assetId === target.assetId && binding.networkId === target.networkId)) return null;
  const routes = resolveActionRoutes(snapshot, { kind: "account", accountId: sourceAccountId }, "send").routes
    .filter(route => route.assetId === target.assetId && route.networkId === target.networkId);
  return routes.length === 1 && routes[0]!.symbol === target.symbol ? routes[0]! : null;
}

function resolveIntent(snapshot: Readonly<ProductSnapshot>, context: AccountContext, sheet: ProductSheetState) {
  if (sheet?.kind !== "intent") return null;
  if (!sheet.placementId) return resolveActionRoutes(snapshot, context, sheet.action);
  const holding = snapshot.holdings.find(candidate => candidate.id === sheet.placementId);
  if (!holding) return { routes: [], reason: "capability-unavailable" } as const;
  const result = resolveActionRoutes(snapshot, { kind: "account", accountId: holding.accountId }, sheet.action);
  return { ...result, routes: result.routes.filter(route => route.accountId === holding.accountId &&
    route.assetId === holding.assetId && route.networkId === holding.networkId) };
}

export type MonoProductView = {
  snapshot: Readonly<ProductSnapshot>;
  activities: readonly ProductActivity[];
  activityStatus: "ready" | "loading" | "error";
  expandedActivityId: string | null;
  sendDrafts: Readonly<Record<string, SendDraft>>;
  receiveRequestAmounts: Readonly<Record<string, string>>;
  internalTransferDrafts: Readonly<Record<string, InternalTransferDraft>>;
  usesDefaultDemoChart: boolean;
  context: AccountContext;
  account: ProductAccount | null;
  holdings: readonly AssetHoldingGroup[];
  balanceMinor: number;
  batteryPools: readonly BatteryPool[];
  balanceHidden: boolean;
  fundsExpanded: boolean;
  expandedAssetIds: ReadonlySet<string>;
  assetWorkspace: ProductAssetWorkspaceState;
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
  openPlacementAction(holdingId: string, action: "send" | "receive"): void;
  openAsset(assetId: string): void;
  selectAssetHolding(holdingId: string): void;
  closeAsset(): void;
  selectRoute(route: ProductActionRoute): void;
  backToRoutes(route: ProductActionRoute): void;
  setBatteryActivity(activity: ProductBatteryActivity): void;
  expandActivity(id: string | null): void;
  retryActivities?: () => void;
  saveSendDraft(route: ProductActionRoute, draft: SendDraft | null): void;
  saveReceiveRequestAmount(route: ProductActionRoute, rawAmount: string): void;
  recordSendSimulation(event: SendSimulationResult): string | null;
  saveInternalTransferDraft(route: ProductActionRoute, draft: InternalTransferDraft | null): void;
  recordInternalTransferSimulation(event: InternalTransferSimulation): string | null;
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
  const [assetWorkspace, setAssetWorkspace] = useState<ProductAssetWorkspaceState>(null);
  const [expandedActivityId, setExpandedActivityId] = useState<string | null>(null);
  const [sendDrafts, setSendDrafts] = useState<Record<string, SendDraft>>({});
  const [receiveRequestAmounts, setReceiveRequestAmounts] = useState<Record<string, string>>({});
  const [internalTransferDrafts, setInternalTransferDrafts] = useState<Record<string, InternalTransferDraft>>({});
  const [simulations, setSimulations] = useState<readonly ProductActivity[]>([]);
  const recordedSimulations = useRef(new Set<string>());
  const recordedInternalSimulations = useRef(new Set<string>());
  const saveSendDraft = useCallback((route: ProductActionRoute, draft: SendDraft | null) => {
    if (route.action !== "send" || (draft && sendDraftKey(draft.route) !== sendDraftKey(route))) return;
    const key = sendDraftKey(route);
    const clean: SendDraft | null = draft ? { route: { accountId: route.accountId, assetId: route.assetId, networkId: route.networkId },
      recipient: { address: draft.recipient.address, ...(draft.recipient.memo !== undefined ? { memo: draft.recipient.memo } : {}) },
      amount: draft.amount } : null;
    setSendDrafts(current => {
      if (JSON.stringify(current[key] ?? null) === JSON.stringify(clean)) return current;
      const next = { ...current };
      if (clean) next[key] = clean;
      else delete next[key];
      return next;
    });
  }, []);
  const saveReceiveRequestAmount = useCallback((route: ProductActionRoute, rawAmount: string) => {
    if (route.action !== "receive" || route.receiveMode !== "external-address" ||
      typeof rawAmount !== "string" || rawAmount.length > 128) return;
    const key = receiveRequestAmountKey(route);
    const valid = resolveActionRoutes(snapshot, { kind: "account", accountId: route.accountId }, "receive").routes
      .some(candidate => receiveRequestAmountKey(candidate) === key);
    if (!valid) return;
    // Partial input belongs to this session. The Receive module validates the actual request.
    setReceiveRequestAmounts(current => {
      if ((current[key] ?? "") === rawAmount) return current;
      const next = { ...current };
      if (rawAmount) next[key] = rawAmount;
      else delete next[key];
      return next;
    });
  }, [snapshot]);
  const saveInternalTransferDraft = useCallback((route: ProductActionRoute, draft: InternalTransferDraft | null) => {
    if (route.action !== "receive" || route.receiveMode !== "internal-transfer" || !internalTarget(snapshot, route)) return;
    if (draft && (typeof draft.amount !== "string" || draft.amount.length > 128 ||
      (draft.sourceAccountId !== null && !internalSource(snapshot, route, draft.sourceAccountId)))) return;
    const key = receiveRequestAmountKey(route);
    const clean = draft ? { sourceAccountId: draft.sourceAccountId, amount: draft.amount } : null;
    setInternalTransferDrafts(current => {
      if ((current[key] ?? null)?.sourceAccountId === clean?.sourceAccountId &&
        (current[key] ?? null)?.amount === clean?.amount) return current;
      const next = { ...current };
      if (clean) next[key] = clean;
      else delete next[key];
      return next;
    });
  }, [snapshot]);
  const recordInternalTransferSimulation = useCallback((event: InternalTransferSimulation): string | null => {
    const quote = event?.quote, request = quote?.request;
    if (typeof event?.simulationId !== "string" || !event.simulationId.trim() || !request ||
      event.result?.mode !== "demo" || !["simulated-success", "simulated-failure"].includes(event.result.status) ||
      (event.result.status === "simulated-failure" && !["rejected", "expired", "unavailable"].includes(event.result.reason))) return null;
    // UI and port enforce freshness before submit. An accepted terminal response may arrive later.
    if (validateInternalTransferQuote(request, quote, quote.expiresAt - 1)) return null;
    const target = internalTarget(snapshot, { accountId: request.destinationAccountId, assetId: request.assetId, networkId: request.networkId });
    const source = target && internalSource(snapshot, target, request.sourceAccountId);
    if (!target || !source || quote.symbol !== target.symbol) return null;
    const holdings = snapshot.holdings.filter(holding => holding.accountId === source.accountId &&
      holding.assetId === source.assetId && holding.networkId === source.networkId);
    const available = holdings.length === 1 ? readNonNegativeDecimal(holdings[0]!.availableQuantity) : null;
    if (available === null || available !== readNonNegativeDecimal(quote.available)) return null;
    const id = `internal-simulation:${event.simulationId}`;
    if (recordedInternalSimulations.current.has(event.simulationId)) return id;
    recordedInternalSimulations.current.add(event.simulationId);
    const succeeded = event.result.status === "simulated-success";
    const entry: ProductActivity = { id, mode: "simulation", direction: "outgoing", status: succeeded ? "completed" : "failed",
      accountId: source.accountId, accountLabel: source.accountLabel, assetId: target.assetId, assetSymbol: target.symbol,
      networkId: target.networkId, networkLabel: target.networkLabel, quantity: request.amount, occurredAt: new Date().toISOString(),
      internalTransfer: { sourceAccountId: source.accountId, sourceAccountLabel: source.accountLabel,
        destinationAccountId: target.accountId, destinationAccountLabel: target.accountLabel },
      receipt: { assetDebit: quote.assetDebit, networkFee: { status: "known", amount: quote.fee.amount, symbol: target.symbol },
        feeFunding: { kind: "unknown" } },
      ...(event.result.status === "simulated-failure" ? { failureReason: event.result.reason } : {}) };
    setSimulations(current => [entry, ...current]);
    if (succeeded) saveInternalTransferDraft(target, null);
    return id;
  }, [snapshot, saveInternalTransferDraft]);
  const recordSendSimulation = useCallback((event: SendSimulationResult): string | null => {
    if (!event.simulationId || event.route.action !== "send" || event.result.mode !== "demo" ||
      !["simulated-success", "simulated-failure"].includes(event.result.status)) return null;
    const route = resolveActionRoutes(snapshot, { kind: "account", accountId: event.route.accountId }, "send")
      .routes.find(candidate => productRouteKey(candidate) === productRouteKey(event.route));
    if (!route) return null;
    const id = `simulation:${event.simulationId}`;
    if (recordedSimulations.current.has(event.simulationId)) return id;
    recordedSimulations.current.add(event.simulationId);
    const succeeded = event.result.status === "simulated-success";
    const receipt = normalizeOperationReceipt(event.receipt);
    const failureReason = event.result.status === "simulated-failure" &&
      ["rejected", "expired", "unavailable"].includes(event.result.reason) ? event.result.reason : undefined;
    const entry: ProductActivity = { id, mode: "simulation", direction: "outgoing", status: succeeded ? "completed" : "failed",
      accountId: route.accountId, accountLabel: route.accountLabel, assetId: route.assetId, assetSymbol: route.symbol,
      networkId: route.networkId, networkLabel: route.networkLabel,
      quantity: event.quantity, occurredAt: new Date().toISOString(),
      ...(receipt ? { receipt } : {}), ...(failureReason ? { failureReason } : {}) };
    setSimulations(current => [entry, ...current]);
    if (succeeded) saveSendDraft(route, null);
    return id;
  }, [snapshot, saveSendDraft]);
  const activities = useMemo(() => [...simulations, ...(adapter.activities ?? [])], [simulations, adapter.activities]);
  const [batteryActivity, updateBatteryActivity] = useState<ProductBatteryActivity>(null);
  const setBatteryActivity = useCallback((activity: ProductBatteryActivity) => {
    updateBatteryActivity(current => current?.poolId === activity?.poolId && current?.phase === activity?.phase
      ? current : activity);
  }, []);
  const closeSheet = useCallback(() => { setSheet(null); updateBatteryActivity(null); }, []);
  const closeAsset = useCallback(() => { setAssetWorkspace(null); closeSheet(); }, [closeSheet]);
  const balanceHidden = privacy.hidden ?? localHidden;
  const account = context.kind === "account"
    ? snapshot.accounts.find(candidate => candidate.id === context.accountId) ?? null : null;
  const effectiveContext = context.kind === "account" && !account
    ? { kind: "all" } as const : context;
  const selectedHoldings = useMemo(() => selectHoldings(snapshot, effectiveContext), [snapshot, effectiveContext]);
  const holdings = useMemo(() => groupHoldingsByAsset(selectedHoldings), [selectedHoldings]);
  const workspaceGroup = assetWorkspace ? holdings.find(group => group.assetId === assetWorkspace.assetId) : null;
  // Discard stale source state before rendering a flow against a changed snapshot.
  if (assetWorkspace && (!workspaceGroup || (assetWorkspace.holdingId &&
    !workspaceGroup.placements.some(holding => holding.id === assetWorkspace.holdingId)))) {
    setAssetWorkspace(workspaceGroup ? { ...assetWorkspace, holdingId: null } : null);
    closeSheet();
  }
  const balanceMinor = useMemo(() => selectFiatBalanceMinor(selectedHoldings), [selectedHoldings]);
  const batteryPools = useMemo(() => selectBatteryPools(snapshot.batteryPools, effectiveContext), [snapshot, effectiveContext]);
  const batteryChargePercent = useMemo(() => Object.fromEntries((snapshot.batteryPools ?? []).map(pool => {
    const percent = adapter.batteryChargePercent?.[pool.id];
    return [pool.id, typeof percent === "number" && Number.isFinite(percent) && percent >= 0 && percent <= 100
      ? percent : null];
  })), [snapshot, adapter.batteryChargePercent]);
  const intent = resolveIntent(snapshot, effectiveContext, sheet);
  const coverage = sheet?.kind === "intent" && sheet.route
    ? resolveBatteryCoverage(snapshot.batteryPools, sheet.route) : null;

  return {
    view: { snapshot, activities, activityStatus: adapter.activityStatus ?? "ready", expandedActivityId, sendDrafts, receiveRequestAmounts, internalTransferDrafts,
      usesDefaultDemoChart: adapter === MONO_PRODUCT_DEMO_ADAPTER,
      context: effectiveContext, account, holdings, balanceMinor, batteryPools,
      balanceHidden, fundsExpanded, expandedAssetIds, assetWorkspace, sheet, intent, coverage, batteryActivity, batteryChargePercent },
    commands: {
      setBalanceHidden(hidden) {
        if (privacy.onHiddenChange) privacy.onHiddenChange(hidden);
        else setLocalHidden(hidden);
      },
      openAccounts() { if (snapshot.accounts.length > 1) { updateBatteryActivity(null); setSheet({ kind: "accounts" }); } },
      selectContext(next) { setContext(next); setExpandedActivityId(null); closeAsset(); },
      openBattery() { updateBatteryActivity(null); setSheet(current => current?.kind === "battery" ? null : { kind: "battery" }); },
      openIntent(action) {
        const routes = resolveActionRoutes(snapshot, effectiveContext, action).routes;
        updateBatteryActivity(null);
        setSheet(current => action === "receive" && current?.kind === "intent" && current.action === "receive" &&
          current.route === null && !current.placementId ? null :
          { kind: "intent", action, route: action !== "receive" && routes.length === 1 ? routes[0]! : null });
      },
      openPlacementAction(holdingId, action) {
        const holding = snapshot.holdings.find(candidate => candidate.id === holdingId);
        if (!holding) return;
        if (assetWorkspace && (assetWorkspace.holdingId !== holdingId ||
          !workspaceGroup?.placements.some(candidate => candidate.id === holdingId))) return;
        const nextContext: AccountContext = { kind: "account", accountId: holding.accountId };
        const nextSheet: ProductSheetState = { kind: "intent", action, route: null, placementId: holdingId };
        const routes = resolveIntent(snapshot, nextContext, nextSheet)?.routes ?? [];
        if (!assetWorkspace) setContext(nextContext);
        setExpandedActivityId(null); updateBatteryActivity(null);
        setSheet({ ...nextSheet, route: routes.length === 1 ? routes[0]! : null });
      },
      openAsset(assetId) {
        const group = holdings.find(candidate => candidate.assetId === assetId);
        if (!group) return;
        closeSheet(); setExpandedActivityId(null);
        setAssetWorkspace({ assetId, holdingId: group.placements.length === 1 ? group.placements[0]!.id : null });
      },
      selectAssetHolding(holdingId) {
        if (!assetWorkspace || !workspaceGroup?.placements.some(holding => holding.id === holdingId)) return;
        closeSheet(); setExpandedActivityId(null);
        setAssetWorkspace({ ...assetWorkspace, holdingId });
      },
      closeAsset,
      selectRoute(route) { updateBatteryActivity(null); setSheet(current => {
        const valid = resolveIntent(snapshot, effectiveContext, current)?.routes
          .find(candidate => productRouteKey(candidate) === productRouteKey(route));
        return current?.kind === "intent" && valid ? { ...current, route: valid } : current;
      }); },
      backToRoutes(route) { updateBatteryActivity(null); setSheet(current => {
        if (current?.kind !== "intent" || current.action !== route.action) return current;
        if ((current.placementId || current.action !== "receive") &&
          (resolveIntent(snapshot, effectiveContext, current)?.routes.length ?? 0) <= 1) return null;
        return { ...current, route: null, focusRouteKey: productRouteKey(route) };
      }); },
      setBatteryActivity,
      expandActivity: setExpandedActivityId,
      retryActivities: adapter.retryActivities,
      saveSendDraft,
      saveReceiveRequestAmount,
      recordSendSimulation,
      saveInternalTransferDraft,
      recordInternalTransferSimulation,
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
