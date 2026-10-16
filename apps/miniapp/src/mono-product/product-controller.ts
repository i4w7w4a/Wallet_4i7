"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  groupHoldingsByAsset, resolveActionRoutes, resolveBatteryCoverage, selectBatteryPools, selectFiatBalanceMinor, selectHoldings,
  type AccountContext, type ActionRouteResolution, type AssetHoldingGroup, type BatteryCoverage, type BatteryPool,
  type ProductAccount, type ProductAccountKind, type ProductActionKind, type ProductActionRoute, type ProductSnapshot,
} from "@wallet/core";

import { createMonoDemoFlowPorts, MONO_DEMO_INTERNAL_BINDINGS, MONO_PRODUCT_DEMO_ADAPTER, type MonoProductAdapter } from "./demo-adapter";
import type { ProductActivity } from "./demo-activity";
import { useHomePins } from "./use-home-pins";
import type { AccountGroup } from "./home-pins";
import { normalizeOperationReceipt } from "./operation-receipt";
import type { SendDraft, SendSimulationResult } from "./send";
import { validateInternalTransferQuote, type InternalTransferDraft, type InternalTransferSimulation } from "./internal-transfer";
import { readNonNegativeDecimal } from "./internal-transfer/validation";
import type { InternalReceiveSubmitState } from "./receive/receive-types";
import {
  commerceRouteKey, commerceOperationId, validateBuyQuote, validateSwapQuote, validateCommerceSimulation,
  type BuyRoute, type SwapRoute, type BuyDraft, type SwapDraft, type CommerceAcceptedSubmit,
  type CommerceSimulation, type CommerceSubmitState,
} from "./commerce";

export type ProductSendMode = "external" | "internal";
type ProductSendInternalHandoff = {
  source: ProductActionRoute & { action: "send" };
  destination: Extract<ProductActionRoute, { action: "receive" }>;
  ports: ReturnType<typeof createMonoDemoFlowPorts>;
};

export type ProductSheetState =
  | { kind: "accounts" }
  | { kind: "battery"; scope?: AccountContext }
  | { kind: "intent"; action: ProductActionKind; route: ProductActionRoute | null; scope?: AccountContext; focusRouteKey?: string; placementId?: string; returnToAccountId?: string;
      sendMode?: ProductSendMode; internalSend?: ProductSendInternalHandoff; focusSendMode?: boolean }
  | null;

export type ProductBatteryActivity = { poolId: string; phase: "using" } | null;
export type ProductAssetWorkspaceState = { assetId: string; holdingId: string | null; scope?: AccountContext } | null;
export type ProductAccountsWorkspaceState = { accountId: string | null; groupKind?: ProductAccountKind } | null;
export type ProductPlacementAction = "send" | "receive" | "buy" | "swap";

type CommerceFlowLease = { ports: ReturnType<typeof createMonoDemoFlowPorts>; route: BuyRoute | SwapRoute };

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

function sendInternalDestination(snapshot: Readonly<ProductSnapshot>, source: ProductActionRoute) {
  if (source.action !== "send" || snapshot.holdings.filter(holding => holding.accountId === source.accountId &&
    holding.assetId === source.assetId && holding.networkId === source.networkId).length !== 1) return null;
  const destinations = MONO_DEMO_INTERNAL_BINDINGS.filter(binding => binding.sourceAccountId === source.accountId &&
    binding.assetId === source.assetId && binding.networkId === source.networkId).flatMap(binding => {
      const destination = internalTarget(snapshot, { accountId: binding.destinationAccountId,
        assetId: binding.assetId, networkId: binding.networkId });
      const canonicalSource = destination && internalSource(snapshot, destination, source.accountId);
      return destination?.action === "receive" && canonicalSource && productRouteKey(canonicalSource) === productRouteKey(source)
        ? [destination] : [];
    });
  return destinations.length === 1 ? destinations[0]! : null;
}

function resolveIntent(snapshot: Readonly<ProductSnapshot>, context: AccountContext, sheet: ProductSheetState) {
  if (sheet?.kind !== "intent") return null;
  if (!sheet.placementId) return resolveActionRoutes(snapshot, sheet.scope ?? context, sheet.action);
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
  buyDrafts: Readonly<Record<string, BuyDraft>>;
  swapDrafts: Readonly<Record<string, SwapDraft>>;
  flowPorts: ReturnType<typeof createMonoDemoFlowPorts>;
  commerceBusy: boolean;
  commerceGuardMessage: string | null;
  sendInternalBusy?: boolean;
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
  accountsWorkspace: ProductAccountsWorkspaceState;
  sheet: ProductSheetState;
  intent: ActionRouteResolution | null;
  coverage: BatteryCoverage | null;
  batteryActivity: ProductBatteryActivity;
  batteryChargePercent: Readonly<Record<string, number | null>>;
  overview: ProductScopeView;
  accountGroups: readonly AccountGroup[];
  homePinnedKinds: readonly ProductAccountKind[];
  homeTotalOnly: boolean;
};

type ProductScopeView = Pick<MonoProductView, "context" | "account" | "holdings" | "balanceMinor" | "batteryPools">;
export const ALL_WALLET_CONTEXT: AccountContext = { kind: "all" };

function selectProductScope(snapshot: Readonly<ProductSnapshot>, context: AccountContext): ProductScopeView {
  const selected = selectHoldings(snapshot, context);
  return { context, account: context.kind === "account" ? snapshot.accounts.find(account => account.id === context.accountId) ?? null : null,
    holdings: groupHoldingsByAsset(selected), balanceMinor: selectFiatBalanceMinor(selected),
    batteryPools: selectBatteryPools(snapshot.batteryPools, context) };
}

export function productViewForScope(view: MonoProductView, scope?: AccountContext): MonoProductView {
  if (!scope || scope === view.context) return view;
  return { ...view, ...(scope.kind === "all" ? view.overview : selectProductScope(view.snapshot, scope)) };
}

export type MonoProductCommands = {
  setBalanceHidden(hidden: boolean): void;
  openAccounts(): void;
  openAccountsWorkspace(groupKind?: ProductAccountKind): boolean;
  toggleHomePin(kind: ProductAccountKind): boolean;
  setHomeTotalOnly(totalOnly: boolean): boolean;
  inspectAccount(accountId: string): boolean;
  backAccountsWorkspace(): boolean;
  closeAccountsWorkspace(): boolean;
  useAccount(accountId: string): boolean;
  openAccountRoute(route: ProductActionRoute): boolean;
  openAccountHolding(accountId: string, holdingId: string): boolean;
  selectContext(context: AccountContext): void;
  openBattery(scope?: AccountContext): void;
  openIntent(action: ProductActionKind, scope?: AccountContext): void;
  openPlacementAction(holdingId: string, action: ProductPlacementAction): void;
  openAsset(assetId: string, scope?: AccountContext): void;
  selectAssetHolding(holdingId: string): void;
  closeAsset(): void;
  selectRoute(route: ProductActionRoute): void;
  setSendMode(mode: ProductSendMode): void;
  backToSendSources(): void;
  saveSendInternalDraft(draft: InternalTransferDraft | null): void;
  setSendInternalSubmitState(state: InternalReceiveSubmitState): void;
  recordSendInternalSimulation(event: InternalTransferSimulation): string | null;
  backToRoutes(route: ProductActionRoute): void;
  setBatteryActivity(activity: ProductBatteryActivity): void;
  expandActivity(id: string | null): void;
  retryActivities?: () => void;
  saveSendDraft(route: ProductActionRoute, draft: SendDraft | null): void;
  saveReceiveRequestAmount(route: ProductActionRoute, rawAmount: string): void;
  recordSendSimulation(event: SendSimulationResult): string | null;
  saveInternalTransferDraft(route: ProductActionRoute, draft: InternalTransferDraft | null): void;
  recordInternalTransferSimulation(event: InternalTransferSimulation): string | null;
  saveBuyDraft(route: BuyRoute, draft: BuyDraft | null): void;
  saveSwapDraft(route: SwapRoute, draft: SwapDraft | null): void;
  setCommerceSubmitState(route: BuyRoute | SwapRoute, state: CommerceSubmitState): void;
  recordCommerceSimulation(event: CommerceSimulation): string | null;
  requestContextChange(): boolean;
  toggleFunds(): void;
  toggleAsset(assetId: string): void;
  closeSheet(): void;
};

export type MonoProductController = { view: MonoProductView; commands: MonoProductCommands };

export function useMonoProductController(adapter: MonoProductAdapter, privacy: {
  initialHidden: boolean;
  hidden?: boolean;
  onHiddenChange?: (hidden: boolean) => void;
}, options: { viewerPreferencesEnabled?: boolean } = {}): MonoProductController {
  const { snapshot } = adapter;
  const homePins = useHomePins(snapshot, options.viewerPreferencesEnabled ?? true);
  const [context, setContext] = useState<AccountContext>(() => snapshot.accounts.length === 1
    ? { kind: "account", accountId: snapshot.accounts[0]!.id } : { kind: "all" });
  const [localHidden, setLocalHidden] = useState(privacy.initialHidden);
  const [fundsExpanded, setFundsExpanded] = useState(false);
  const [expandedAssetIds, setExpandedAssetIds] = useState<ReadonlySet<string>>(() => new Set());
  const [sheet, setSheet] = useState<ProductSheetState>(null);
  const homePinSheetRef = useRef(sheet);
  homePinSheetRef.current = sheet;
  const [assetWorkspace, setAssetWorkspace] = useState<ProductAssetWorkspaceState>(null);
  const [accountsWorkspace, setAccountsWorkspace] = useState<ProductAccountsWorkspaceState>(null);
  const accountsWorkspaceRef = useRef(accountsWorkspace);
  accountsWorkspaceRef.current = accountsWorkspace;
  const accountsSource = useRef({ adapter, snapshot });
  const accountsAdapterChanged = accountsSource.current.adapter !== adapter;
  accountsSource.current = { adapter, snapshot };
  const [expandedActivityId, setExpandedActivityId] = useState<string | null>(null);
  const [sendDrafts, setSendDrafts] = useState<Record<string, SendDraft>>({});
  const [receiveRequestAmounts, setReceiveRequestAmounts] = useState<Record<string, string>>({});
  const [internalTransferDrafts, setInternalTransferDrafts] = useState<Record<string, InternalTransferDraft>>({});
  const [buyDrafts, setBuyDrafts] = useState<Record<string, BuyDraft>>({});
  const [swapDrafts, setSwapDrafts] = useState<Record<string, SwapDraft>>({});
  // Adapter identity is a data/port session boundary, even when its snapshot object is reused.
  const flowPorts = useMemo(() => createMonoDemoFlowPorts(snapshot), [adapter, snapshot]);
  const currentFlowPorts = useRef(flowPorts);
  currentFlowPorts.current = flowPorts;
  const account = context.kind === "account"
    ? snapshot.accounts.find(candidate => candidate.id === context.accountId) ?? null : null;
  const effectiveContext = useMemo(() => context.kind === "account" && !account
    ? { kind: "all" } as const : context, [context, account]);
  const intent = useMemo(() => resolveIntent(snapshot, effectiveContext, sheet), [snapshot, effectiveContext, sheet]);
  const sheetRoute = sheet?.kind === "intent" ? sheet.route : null;
  const activeRoute = sheetRoute ? intent?.routes.find(route => productRouteKey(route) === productRouteKey(sheetRoute)) : null;
  const handoff = sheet?.kind === "intent" && sheet.action === "send" ? sheet.internalSend : undefined;
  const sendHandoff = handoff && handoff.ports === flowPorts && activeRoute &&
    productRouteKey(activeRoute) === productRouteKey(handoff.source) ? handoff : null;
  if (sheet?.kind === "intent" && sheet.route && !activeRoute) setSheet({ ...sheet, route: null, internalSend: undefined });
  else if (handoff && !sendHandoff && sheet?.kind === "intent") {
    setSheet({ ...sheet, internalSend: undefined, sendMode: "external", focusSendMode: true });
  }
  const currentSendHandoff = useRef(sendHandoff);
  currentSendHandoff.current = sendHandoff;
  const acceptedSendInternal = useRef<{ handoff: ProductSendInternalHandoff; quote: string } | null>(null);
  const [sendInternalBusy, setSendInternalBusy] = useState(false);
  const commerceLease = useMemo<CommerceFlowLease | null>(() => activeRoute &&
    (activeRoute.action === "buy" || activeRoute.action === "swap")
    ? { ports: flowPorts, route: activeRoute as BuyRoute | SwapRoute } : null, [flowPorts, sheet, activeRoute]);
  const currentLease = useRef(commerceLease);
  currentLease.current = commerceLease;
  const mounted = useRef(true);
  const acceptedCommerce = useRef<{ lease: CommerceFlowLease; attempt: CommerceAcceptedSubmit } | null>(null);
  const [commerceBusy, setCommerceBusy] = useState(false);
  const [commerceGuardMessage, setCommerceGuardMessage] = useState<string | null>(null);
  if (acceptedSendInternal.current && acceptedSendInternal.current.handoff !== sendHandoff) {
    acceptedSendInternal.current = null;
    if (sendInternalBusy) setSendInternalBusy(false);
    if (commerceGuardMessage) setCommerceGuardMessage(null);
  }
  if (acceptedCommerce.current && acceptedCommerce.current.lease !== commerceLease) {
    acceptedCommerce.current = null;
    if (commerceBusy) setCommerceBusy(false);
    if (commerceGuardMessage) setCommerceGuardMessage(null);
  }
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; acceptedCommerce.current = null; acceptedSendInternal.current = null; };
  }, []);
  const ownsCommerceRoute = useCallback((route: BuyRoute | SwapRoute) => mounted.current && commerceLease !== null &&
    currentLease.current === commerceLease && commerceRouteKey(commerceLease.route) === commerceRouteKey(route), [commerceLease]);
  const saveBuyDraft = useCallback((route: BuyRoute, draft: BuyDraft | null) => {
    if (!ownsCommerceRoute(route) || route.action !== "buy" || acceptedCommerce.current) return;
    const key = commerceRouteKey(route);
    if (draft && (!draft.route || commerceRouteKey(draft.route) !== key ||
      typeof draft.fiatAmount !== "string" || draft.fiatAmount.length > 128 ||
      (draft.methodId !== null && typeof draft.methodId !== "string"))) return;
    const clean: BuyDraft | null = draft ? { route: { ...route }, methodId: draft.methodId, fiatAmount: draft.fiatAmount } : null;
    setBuyDrafts(current => {
      if (JSON.stringify(current[key] ?? null) === JSON.stringify(clean)) return current;
      const next = { ...current };
      if (clean) next[key] = clean; else delete next[key];
      return next;
    });
  }, [ownsCommerceRoute]);
  const saveSwapDraft = useCallback((route: SwapRoute, draft: SwapDraft | null) => {
    if (!ownsCommerceRoute(route) || route.action !== "swap" || acceptedCommerce.current) return;
    const key = commerceRouteKey(route);
    if (draft && (!draft.route || commerceRouteKey(draft.route) !== key ||
      typeof draft.sourceAmount !== "string" || draft.sourceAmount.length > 128 ||
      (draft.pairId !== null && typeof draft.pairId !== "string"))) return;
    const clean: SwapDraft | null = draft ? { route: { ...route }, pairId: draft.pairId, sourceAmount: draft.sourceAmount } : null;
    setSwapDrafts(current => {
      if (JSON.stringify(current[key] ?? null) === JSON.stringify(clean)) return current;
      const next = { ...current };
      if (clean) next[key] = clean; else delete next[key];
      return next;
    });
  }, [ownsCommerceRoute]);
  const setCommerceSubmitState = useCallback((route: BuyRoute | SwapRoute, state: CommerceSubmitState) => {
    if (!ownsCommerceRoute(route) || !commerceLease) return;
    if (!state.busy) {
      if (acceptedCommerce.current?.lease !== commerceLease || acceptedCommerce.current.attempt.operationId !== state.operationId) return;
      acceptedCommerce.current = null;
      setCommerceBusy(false); setCommerceGuardMessage(null);
      return;
    }
    if (acceptedCommerce.current) return;
    const attempt = state.attempt, quote = attempt?.quote;
    if (!quote || !attempt.operationId || attempt.kind !== route.action || quote.kind !== attempt.kind ||
      attempt.operationId !== commerceOperationId(quote, attempt.idempotencyKey)) return;
    const issue = quote.kind === "buy"
      ? validateBuyQuote({ ...quote.request, route: commerceLease.route as BuyRoute }, quote, Date.now(), commerceLease.ports.buy.id)
      : validateSwapQuote({ ...quote.request, route: commerceLease.route as SwapRoute }, quote, Date.now(), commerceLease.ports.swap.id);
    if (issue) return;
    acceptedCommerce.current = { lease: commerceLease, attempt: structuredClone(attempt) };
    setCommerceBusy(true); setCommerceGuardMessage(null);
  }, [ownsCommerceRoute, commerceLease]);
  const recordedCommerceSimulations = useRef(new Map<string, string>());
  const recordCommerceSimulation = useCallback((event: CommerceSimulation): string | null => {
    const accepted = acceptedCommerce.current;
    if (!mounted.current || !commerceLease || currentLease.current !== commerceLease || accepted?.lease !== commerceLease ||
      accepted.attempt.operationId !== event?.simulationId || event?.kind !== commerceLease.route.action ||
      validateCommerceSimulation(accepted.attempt.quote, event, accepted.attempt.idempotencyKey)) return null;
    const prior = recordedCommerceSimulations.current.get(event.simulationId);
    if (prior) return prior;
    const checked = structuredClone(event);
    const quote = checked.quote;
    const primary = quote.kind === "buy" ? quote.credit : quote.debit;
    const succeeded = checked.result.status === "simulated-success";
    const id = `commerce-simulation:${checked.simulationId}`;
    const entry: ProductActivity = { id, mode: "simulation", direction: checked.kind === "swap" ? "exchange" : "incoming",
      status: succeeded ? "completed" : "failed", accountId: primary.accountId, accountLabel: primary.accountLabel,
      assetId: primary.assetId, assetSymbol: primary.symbol, networkId: primary.networkId, networkLabel: primary.networkLabel,
      quantity: primary.quantity, occurredAt: new Date().toISOString(), commerce: checked,
      ...(checked.result.status === "simulated-failure" ? { failureReason: checked.result.reason } : {}) };
    recordedCommerceSimulations.current.set(checked.simulationId, id);
    setSimulations(current => [entry, ...current]);
    if (succeeded) {
      const key = commerceRouteKey(commerceLease.route);
      if (checked.kind === "buy") setBuyDrafts(current => { const next = { ...current }; delete next[key]; return next; });
      else setSwapDrafts(current => { const next = { ...current }; delete next[key]; return next; });
    }
    return id;
  }, [commerceLease]);
  const requestContextChange = useCallback(() => {
    if ((acceptedCommerce.current && currentLease.current === acceptedCommerce.current.lease) ||
      (acceptedSendInternal.current && currentSendHandoff.current === acceptedSendInternal.current.handoff)) {
      setCommerceGuardMessage("Симуляция выполняется. Дождитесь результата.");
      return false;
    }
    setCommerceGuardMessage(null);
    return true;
  }, []);
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
  const ownsSendHandoff = useCallback(() => mounted.current && sendHandoff !== null &&
    currentSendHandoff.current === sendHandoff, [sendHandoff]);
  const saveSendInternalDraft = useCallback((draft: InternalTransferDraft | null) => {
    if (!ownsSendHandoff() || !sendHandoff || (draft && (acceptedSendInternal.current ||
      draft.sourceAccountId !== sendHandoff.source.accountId))) return;
    saveInternalTransferDraft(sendHandoff.destination, draft);
  }, [ownsSendHandoff, sendHandoff, saveInternalTransferDraft]);
  const setSendInternalSubmitState = useCallback((state: InternalReceiveSubmitState) => {
    if (!ownsSendHandoff() || !sendHandoff) return;
    if (state.busy) {
      const quote = state.quote, request = quote.request;
      if (acceptedSendInternal.current || request.sourceAccountId !== sendHandoff.source.accountId ||
        request.destinationAccountId !== sendHandoff.destination.accountId || request.assetId !== sendHandoff.source.assetId ||
        request.networkId !== sendHandoff.source.networkId || validateInternalTransferQuote(request, quote, Date.now())) return;
      acceptedSendInternal.current = { handoff: sendHandoff, quote: JSON.stringify(quote) };
      setSendInternalBusy(true);
    } else {
      if (acceptedSendInternal.current?.handoff !== sendHandoff) return;
      acceptedSendInternal.current = null;
      setSendInternalBusy(false);
    }
    setCommerceGuardMessage(null);
  }, [ownsSendHandoff, sendHandoff]);
  const recordSendInternalSimulation = useCallback((event: InternalTransferSimulation) => {
    if (!ownsSendHandoff() || acceptedSendInternal.current?.handoff !== sendHandoff ||
      acceptedSendInternal.current.quote !== JSON.stringify(event.quote)) return null;
    return recordInternalTransferSimulation(event);
  }, [ownsSendHandoff, sendHandoff, recordInternalTransferSimulation]);
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
  if (accountsAdapterChanged && accountsWorkspace) {
    accountsWorkspaceRef.current = null;
    setAccountsWorkspace(null); setAssetWorkspace(null); setSheet(null); updateBatteryActivity(null);
  }
  const setBatteryActivity = useCallback((activity: ProductBatteryActivity) => {
    updateBatteryActivity(current => current?.poolId === activity?.poolId && current?.phase === activity?.phase
      ? current : activity);
  }, []);
  const closeSheet = useCallback(() => {
    if (!requestContextChange()) return;
    setSheet(null); updateBatteryActivity(null);
  }, [requestContextChange]);
  const closeAsset = useCallback(() => {
    if (!requestContextChange()) return;
    setAssetWorkspace(null); closeSheet();
  }, [closeSheet, requestContextChange]);
  const balanceHidden = privacy.hidden ?? localHidden;
  const projection = useMemo(() => selectProductScope(snapshot, effectiveContext), [snapshot, effectiveContext]);
  const overview = useMemo(() => effectiveContext.kind === "all" ? projection : selectProductScope(snapshot, ALL_WALLET_CONTEXT),
    [snapshot, effectiveContext, projection]);
  const { holdings, balanceMinor, batteryPools } = projection;
  const workspaceHoldings = useMemo(() => !assetWorkspace?.scope ? holdings : assetWorkspace.scope.kind === "all"
    ? overview.holdings : selectProductScope(snapshot, assetWorkspace.scope).holdings,
  [assetWorkspace?.scope, snapshot, holdings, overview.holdings]);
  const workspaceGroup = assetWorkspace ? workspaceHoldings.find(group => group.assetId === assetWorkspace.assetId) : null;
  // Discard stale source state before rendering a flow against a changed snapshot.
  if (assetWorkspace && (!workspaceGroup || (assetWorkspace.holdingId &&
    !workspaceGroup.placements.some(holding => holding.id === assetWorkspace.holdingId)))) {
    setAssetWorkspace(workspaceGroup ? { ...assetWorkspace, holdingId: null } : null);
    closeSheet();
  }
  const batteryChargePercent = useMemo(() => Object.fromEntries((snapshot.batteryPools ?? []).map(pool => {
    const percent = adapter.batteryChargePercent?.[pool.id];
    return [pool.id, typeof percent === "number" && Number.isFinite(percent) && percent >= 0 && percent <= 100
      ? percent : null];
  })), [snapshot, adapter.batteryChargePercent]);
  const coverage = sheet?.kind === "intent" && sheet.route
    ? resolveBatteryCoverage(snapshot.batteryPools, sheet.route) : null;

  function ownsAccountsSession() {
    return mounted.current && accountsSource.current.adapter === adapter && accountsSource.current.snapshot === snapshot;
  }
  function exactAccount(accountId: string) {
    const matches = snapshot.accounts.filter(candidate => candidate.id === accountId);
    return matches.length === 1 ? matches[0]! : null;
  }
  function exactWorkspaceAccount(accountId: string) {
    const current = exactAccount(accountId);
    const groupKind = accountsWorkspaceRef.current?.groupKind;
    return current && (!groupKind || current.kind === groupKind) ? current : null;
  }
  function updateAccountsWorkspace(next: ProductAccountsWorkspaceState) {
    accountsWorkspaceRef.current = next;
    setAccountsWorkspace(next);
  }
  function closeAccountsWorkspace() {
    if (!ownsAccountsSession() || !requestContextChange() || !accountsWorkspaceRef.current) return false;
    updateAccountsWorkspace(null); setAssetWorkspace(null); setSheet(null); updateBatteryActivity(null);
    return true;
  }

  return {
    view: { snapshot, activities, activityStatus: adapter.activityStatus ?? "ready", expandedActivityId, sendDrafts, receiveRequestAmounts, internalTransferDrafts,
      buyDrafts, swapDrafts, flowPorts, commerceBusy, commerceGuardMessage, sendInternalBusy,
      usesDefaultDemoChart: adapter === MONO_PRODUCT_DEMO_ADAPTER,
      context: effectiveContext, account, holdings, balanceMinor, batteryPools,
      balanceHidden, fundsExpanded, expandedAssetIds, assetWorkspace, accountsWorkspace, sheet, intent, coverage, batteryActivity, batteryChargePercent,
      overview, accountGroups: homePins.groups, homePinnedKinds: homePins.pinnedKinds, homeTotalOnly: homePins.totalOnly },
    commands: {
      setBalanceHidden(hidden) {
        if (privacy.onHiddenChange) privacy.onHiddenChange(hidden);
        else setLocalHidden(hidden);
      },
      openAccounts() { if (requestContextChange() && snapshot.accounts.length > 1) { updateBatteryActivity(null); setSheet({ kind: "accounts" }); } },
      openAccountsWorkspace(groupKind) {
        if (!ownsAccountsSession() || !requestContextChange() || sheet) return false;
        if (groupKind && !homePins.groups.some(group => group.kind === groupKind)) return false;
        setAssetWorkspace(null); setExpandedActivityId(null); updateBatteryActivity(null);
        updateAccountsWorkspace({ accountId: null, ...(groupKind ? { groupKind } : {}) });
        return true;
      },
      toggleHomePin(kind) {
        return ownsAccountsSession() && !homePinSheetRef.current && requestContextChange() && homePins.togglePin(kind);
      },
      setHomeTotalOnly(totalOnly) {
        return ownsAccountsSession() && !homePinSheetRef.current && requestContextChange() && homePins.setTotalOnly(totalOnly);
      },
      inspectAccount(accountId) {
        if (!ownsAccountsSession() || !requestContextChange() || !accountsWorkspaceRef.current || sheet || assetWorkspace ||
          !exactWorkspaceAccount(accountId)) return false;
        const workspace = accountsWorkspaceRef.current;
        updateAccountsWorkspace({ ...workspace, accountId });
        return true;
      },
      backAccountsWorkspace() {
        if (!ownsAccountsSession() || !requestContextChange() || !accountsWorkspaceRef.current || sheet || assetWorkspace) return false;
        if (accountsWorkspaceRef.current.accountId !== null) updateAccountsWorkspace({ ...accountsWorkspaceRef.current, accountId: null });
        else return closeAccountsWorkspace();
        return true;
      },
      closeAccountsWorkspace,
      useAccount(accountId) {
        if (!ownsAccountsSession() || !requestContextChange() || accountsWorkspaceRef.current?.accountId !== accountId ||
          !exactWorkspaceAccount(accountId)) return false;
        setContext({ kind: "account", accountId }); setExpandedActivityId(null);
        updateAccountsWorkspace(null); setAssetWorkspace(null); setSheet(null); updateBatteryActivity(null);
        return true;
      },
      openAccountRoute(route) {
        if (!ownsAccountsSession() || !requestContextChange() || !route ||
          accountsWorkspaceRef.current?.accountId !== route.accountId || !exactWorkspaceAccount(route.accountId) ||
          !["send", "receive", "buy", "swap"].includes(route.action)) return false;
        const nextContext: AccountContext = { kind: "account", accountId: route.accountId };
        const matches = resolveActionRoutes(snapshot, nextContext, route.action).routes
          .filter(candidate => productRouteKey(candidate) === productRouteKey(route));
        if (matches.length !== 1) return false;
        const canonical = matches[0]!;
        setContext(nextContext); setAssetWorkspace(null); setExpandedActivityId(null); updateBatteryActivity(null);
        setSheet({ kind: "intent", action: canonical.action, route: canonical, returnToAccountId: canonical.accountId });
        return true;
      },
      openAccountHolding(accountId, holdingId) {
        if (!ownsAccountsSession() || !requestContextChange() || accountsWorkspaceRef.current?.accountId !== accountId ||
          !exactWorkspaceAccount(accountId)) return false;
        const matches = snapshot.holdings.filter(holding => holding.id === holdingId);
        if (matches.length !== 1 || matches[0]!.accountId !== accountId) return false;
        const holding = matches[0]!;
        setContext({ kind: "account", accountId }); setExpandedActivityId(null); setSheet(null); updateBatteryActivity(null);
        setAssetWorkspace({ assetId: holding.assetId, holdingId });
        return true;
      },
      selectContext(next) {
        if (!requestContextChange()) return;
        updateAccountsWorkspace(null); setContext(next); setExpandedActivityId(null); closeAsset();
      },
      openBattery(scope) { if (!requestContextChange()) return; updateBatteryActivity(null); setSheet(current => current?.kind === "battery" ? null : { kind: "battery", ...(scope ? { scope } : {}) }); },
      openIntent(action, scope) {
        if (!requestContextChange()) return;
        const routes = resolveActionRoutes(snapshot, scope ?? effectiveContext, action).routes;
        const compact = action === "send" || action === "receive";
        updateBatteryActivity(null);
        setSheet(current => compact && current?.kind === "intent" && current.action === action &&
          current.route === null && !current.placementId ? null :
          { kind: "intent", action, route: !compact && routes.length === 1 ? routes[0]! : null, ...(scope ? { scope } : {}) });
      },
      openPlacementAction(holdingId, action) {
        if (!requestContextChange()) return;
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
      openAsset(assetId, scope) {
        if (!requestContextChange()) return;
        const scopedHoldings = !scope ? holdings : scope.kind === "all" ? overview.holdings : selectProductScope(snapshot, scope).holdings;
        const group = scopedHoldings.find(candidate => candidate.assetId === assetId);
        if (!group) return;
        closeSheet(); setExpandedActivityId(null);
        setAssetWorkspace({ assetId, holdingId: group.placements.length === 1 ? group.placements[0]!.id : null,
          ...(scope ? { scope } : {}) });
      },
      selectAssetHolding(holdingId) {
        if (!requestContextChange()) return;
        if (!assetWorkspace || !workspaceGroup?.placements.some(holding => holding.id === holdingId)) return;
        closeSheet(); setExpandedActivityId(null);
        setAssetWorkspace({ ...assetWorkspace, holdingId });
      },
      closeAsset,
      setSendMode(mode) {
        if (!mounted.current || currentFlowPorts.current !== flowPorts || !requestContextChange()) return;
        setSheet(current => {
          if (current?.kind !== "intent" || current.action !== "send" || (current.sendMode ?? "external") === mode) return current;
          const destination = mode === "internal" && current.route ? sendInternalDestination(snapshot, current.route) : null;
          return { ...current, sendMode: mode, focusSendMode: false, internalSend: destination && current.route?.action === "send"
            ? { source: { ...current.route, action: "send" }, destination, ports: flowPorts } : undefined };
        });
      },
      backToSendSources() {
        if (!mounted.current || currentFlowPorts.current !== flowPorts || !requestContextChange()) return;
        setSheet(current => {
          if (current?.kind !== "intent" || current.action !== "send" || !current.route) return current;
          return current.placementId || current.returnToAccountId !== undefined
            ? { ...current, sendMode: "external", internalSend: undefined, focusSendMode: true }
            : { ...current, route: null, internalSend: undefined, sendMode: "internal", focusRouteKey: productRouteKey(current.route) };
        });
      },
      selectRoute(route) { if (!requestContextChange()) return; updateBatteryActivity(null); setSheet(current => {
        const valid = resolveIntent(snapshot, effectiveContext, current)?.routes
          .find(candidate => productRouteKey(candidate) === productRouteKey(route));
        if (current?.kind !== "intent" || !valid) return current;
        const destination = current.action === "send" && current.sendMode === "internal" ? sendInternalDestination(snapshot, valid) : null;
        return { ...current, route: valid, internalSend: destination && valid.action === "send"
          ? { source: { ...valid, action: "send" }, destination, ports: flowPorts } : undefined };
      }); },
      backToRoutes(route) { if (!requestContextChange()) return; updateBatteryActivity(null); setSheet(current => {
        if (current?.kind !== "intent" || current.action !== route.action) return current;
        if (current.returnToAccountId !== undefined) {
          if (!ownsAccountsSession() || accountsWorkspaceRef.current?.accountId !== current.returnToAccountId ||
            !current.route || productRouteKey(current.route) !== productRouteKey(route)) return current;
          return null;
        }
        if ((current.placementId || (current.action !== "receive" && current.action !== "send")) &&
          (resolveIntent(snapshot, effectiveContext, current)?.routes.length ?? 0) <= 1) return null;
        return { ...current, route: null, focusRouteKey: productRouteKey(route) };
      }); },
      setBatteryActivity,
      expandActivity(id) { if (requestContextChange()) setExpandedActivityId(id); },
      retryActivities: adapter.retryActivities,
      saveSendDraft,
      saveReceiveRequestAmount,
      recordSendSimulation,
      saveInternalTransferDraft,
      recordInternalTransferSimulation,
      saveSendInternalDraft,
      setSendInternalSubmitState,
      recordSendInternalSimulation,
      saveBuyDraft,
      saveSwapDraft,
      setCommerceSubmitState,
      recordCommerceSimulation,
      requestContextChange,
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
