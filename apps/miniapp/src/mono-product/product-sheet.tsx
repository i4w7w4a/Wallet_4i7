"use client";

import { useCallback, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import type { ProductActionKind, ProductActionRoute, RouteUnavailableReason } from "@wallet/core";
import { productRouteKey, receiveRequestAmountKey, sendDraftKey, type MonoProductCommands, type MonoProductView } from "./product-controller";
import { createMonoDemoFlowPorts } from "./demo-adapter";
import { ProductAccountChooser } from "./product-account-chooser";
import { ProductRouteChooser } from "./product-route-chooser";
import { ReceiveMenu } from "./receive-menu";
import type { InternalTransferDraft, InternalTransferSimulation } from "./internal-transfer";
import { ReceiveFlow } from "./receive";
import { SendFlow, type SendDraft, type SendOperationStatus, type SendSimulationResult } from "./send";
import { ProductAssetDetail } from "./asset-detail/product-asset-detail";
import { BatteryPopover } from "./battery-popover";
import { ProductGlassSurface } from "./product-glass-surface";
import "./product-home.css";

type ProductProps = { view: MonoProductView; commands: MonoProductCommands; onOpenActivity?(id: string): void };

export function ProductOverlay({ view, commands, onOpenActivity }: ProductProps) {
  const ports = useMemo(() => createMonoDemoFlowPorts(view.snapshot), [view.snapshot]);
  const currentSheet = useRef(view.sheet);
  currentSheet.current = view.sheet;
  const canRestoreReceiveFocus = useCallback(() => currentSheet.current === null, []);
  const receiveChooser = view.sheet?.kind === "intent" && view.sheet.action === "receive" && !view.sheet.route;
  return <>
    <BatteryPopover view={view} open={view.sheet?.kind === "battery"} onClose={commands.closeSheet} />
    <ReceiveMenu open={receiveChooser} routes={receiveChooser ? view.intent?.routes ?? [] : []}
      focusRouteKey={receiveChooser ? view.sheet?.kind === "intent" ? view.sheet.focusRouteKey : undefined : undefined}
      emptyMessage={unavailableReason(view.intent?.reason ?? null, "receive", view.context.kind === "all")}
      onSelectRoute={commands.selectRoute} onClose={commands.closeSheet} />
    <ProductModalOverlay view={view} commands={commands} ports={ports} onOpenActivity={onOpenActivity}
      canRestoreReceiveFocus={canRestoreReceiveFocus} />
  </>;
}

function ProductModalOverlay({ view, commands, ports, onOpenActivity, canRestoreReceiveFocus }: ProductProps & {
  ports: ReturnType<typeof createMonoDemoFlowPorts>; canRestoreReceiveFocus(): boolean;
}) {
  const sheet = view.sheet;
  if (!sheet || sheet.kind === "battery") return null;
  if (sheet.kind === "intent" && sheet.action === "receive" && !sheet.route) return null;
  if (sheet.kind === "accounts") return <ProductSheet title="Выбор счёта" onClose={commands.closeSheet}>
    <ProductAccountChooser snapshot={view.snapshot} context={view.context} balanceHidden={view.balanceHidden}
      onSelectContext={commands.selectContext} />
  </ProductSheet>;

  const action = sheet.action;
  const title = actionLabel(action);
  return <ProductSheet key={action} title={title} onClose={commands.closeSheet} receiveScreen={action === "receive"}
    canRestoreFocus={action === "receive" ? canRestoreReceiveFocus : undefined}
    returnPlacement={sheet.placementId ? { id: sheet.placementId, action } : undefined}>
    {sheet.route ? <RouteDetail key={productRouteKey(sheet.route)} route={sheet.route} view={view} commands={commands} ports={ports}
      onOpenActivity={onOpenActivity} /> :
      <RouteChooser view={view} commands={commands} action={action} focusRouteKey={sheet.focusRouteKey} />}
  </ProductSheet>;
}

function RouteChooser({ view, commands, action, focusRouteKey }: ProductProps & {
  action: ProductActionKind; focusRouteKey?: string;
}) {
  return <>
      {view.intent?.routes.length ? <ProductRouteChooser routes={view.intent.routes} holdings={view.snapshot.holdings}
        action={action} balanceHidden={view.balanceHidden} focusRouteKey={focusRouteKey} onSelectRoute={commands.selectRoute} />
        : <p className="mono-product-sheet__empty">{unavailableReason(view.intent?.reason ?? null, action, view.context.kind === "all")}</p>}
  </>;
}

function RouteDetail({ route, view, commands, ports, onOpenActivity }: ProductProps & {
  route: ProductActionRoute; ports: ReturnType<typeof createMonoDemoFlowPorts>;
}) {
  const container = useRef<HTMLDivElement>(null);
  const returnToAsset = useRef<HTMLElement | null>(null);
  const [assetDetails, setAssetDetails] = useState(false);
  const [operation, setOperation] = useState<SendOperationStatus | null>(null);
  const [resultActivityId, setResultActivityId] = useState<string | null>(null);
  const saveDraft = commands.saveSendDraft;
  const saveReceiveAmount = commands.saveReceiveRequestAmount;
  const recordSimulation = commands.recordSendSimulation;
  const saveInternalDraft = commands.saveInternalTransferDraft;
  const recordInternalSimulation = commands.recordInternalTransferSimulation;
  const onDraftChange = useCallback((draft: SendDraft | null) => saveDraft(route, draft), [route, saveDraft]);
  const onRequestAmountChange = useCallback((amount: string) => saveReceiveAmount(route, amount), [route, saveReceiveAmount]);
  const onSimulationResult = useCallback((event: SendSimulationResult) => {
    setResultActivityId(recordSimulation(event));
  }, [recordSimulation]);
  const onInternalDraftChange = useCallback((draft: InternalTransferDraft | null) => {
    saveInternalDraft(route, draft);
    if (draft) setResultActivityId(null);
  }, [route, saveInternalDraft]);
  const onInternalSimulationResult = useCallback((event: InternalTransferSimulation) => {
    setResultActivityId(recordInternalSimulation(event));
  }, [recordInternalSimulation]);
  const onOperationChange = useCallback((next: SendOperationStatus | null) => {
    setOperation(next);
    if (next?.status !== "completed" && next?.status !== "failed") setResultActivityId(null);
  }, []);
  const previousDetails = useRef(false);
  const showAssetDetails = useCallback(() => {
    if (!returnToAsset.current?.isConnected) {
      returnToAsset.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }
    setAssetDetails(true);
  }, []);
  const hideAssetDetails = useCallback(() => setAssetDetails(false), []);
  useLayoutEffect(() => {
    if (assetDetails) container.current?.querySelector<HTMLElement>("[data-product-asset-content] button")?.focus({ preventScroll: true });
    else if (previousDetails.current) returnToAsset.current?.focus({ preventScroll: true });
    previousDetails.current = assetDetails;
  }, [assetDetails]);
  useLayoutEffect(() => { container.current?.querySelector<HTMLElement>("button")?.focus({ preventScroll: true }); }, [route]);
  const pool = view.batteryPools.find(candidate => candidate.networkId === route.networkId &&
    candidate.eligibleAccountIds.includes(route.accountId));
  return <div ref={container} onClickCapture={event => {
    if (!assetDetails && event.target instanceof Element) returnToAsset.current = event.target.closest<HTMLButtonElement>("button");
  }} onKeyDownCapture={event => {
    if (assetDetails && event.key === "Escape") {
      event.preventDefault(); event.stopPropagation(); hideAssetDetails();
    }
  }}>
    <div hidden={assetDetails} inert={assetDetails} data-product-flow-content>
    {route.action === "receive" ? <ReceiveFlow route={route} dataPort={ports.receive} privacy={view.balanceHidden}
      initialRequestAmount={route.receiveMode === "external-address" ? view.receiveRequestAmounts[receiveRequestAmountKey(route)] ?? "" : undefined}
      onRequestAmountChange={route.receiveMode === "external-address" ? onRequestAmountChange : undefined}
      internalTransferPort={route.receiveMode === "internal-transfer" ? ports.internalTransfer : undefined}
      initialInternalDraft={route.receiveMode === "internal-transfer" ? view.internalTransferDrafts[receiveRequestAmountKey(route)] : undefined}
      onInternalDraftChange={route.receiveMode === "internal-transfer" ? onInternalDraftChange : undefined}
      onInternalSimulationResult={route.receiveMode === "internal-transfer" ? onInternalSimulationResult : undefined}
      onViewInternalHistory={resultActivityId && onOpenActivity ? () => onOpenActivity(resultActivityId) : undefined}
      onBack={commands.backToRoutes} onClose={commands.closeSheet} showCloseButton={false} onAssetDetails={showAssetDetails} /> :
      route.action === "send" ? <SendFlow route={route} port={ports.send} privacy={view.balanceHidden}
        initialDraft={view.sendDrafts[sendDraftKey(route)] ?? null} onDraftChange={onDraftChange}
        onSimulationResult={onSimulationResult}
        onViewHistory={resultActivityId && onOpenActivity ? () => onOpenActivity(resultActivityId) : undefined}
        onBack={() => commands.backToRoutes(route)} onClose={commands.closeSheet}
        onAssetDetails={showAssetDetails} onOperationChange={onOperationChange}
        onBatteryActivityChange={commands.setBatteryActivity} /> : <div className="mono-product-sheet__route">
    <button type="button" className="mono-product-sheet__back" onClick={() => commands.backToRoutes(route)}>← Назад к выбору маршрута</button>
    <span className="mono-product-sheet__overline">ВЫБРАННЫЙ МАРШРУТ</span>
    <h3>{route.symbol} · {route.networkLabel}</h3>
    <p>Счёт: {route.accountLabel}</p>
    <p className="mono-product-sheet__empty">Продолжение пока недоступно в демо.</p>
    </div>}
    </div>
    {assetDetails && <div data-product-asset-content><ProductAssetDetail route={route} battery={pool ? { networkLabel: pool.networkLabel,
      chargePercent: view.batteryChargePercent[pool.id] ?? null, remainingTransfers: pool.remainingTransfers } : null}
      operation={operation} onBack={hideAssetDetails} /></div>}
  </div>;
}

function ProductSheet({ title, onClose, children, returnPlacement, receiveScreen = false, canRestoreFocus }: {
  title: string; onClose(): void; children: ReactNode; returnPlacement?: { id: string; action: ProductActionKind };
  receiveScreen?: boolean; canRestoreFocus?(): boolean;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const placementRef = useRef(returnPlacement);
  placementRef.current = returnPlacement;
  const [receiveBounds, setReceiveBounds] = useState<CSSProperties>();

  useLayoutEffect(() => {
    if (!receiveScreen) return;
    const page = dialogRef.current?.closest<HTMLElement>("[data-mono-preview]");
    if (!page) return;
    const viewport = window.visualViewport;
    const place = () => {
      const bounds = page.getBoundingClientRect();
      const viewportLeft = viewport?.offsetLeft ?? 0, viewportTop = viewport?.offsetTop ?? 0;
      const viewportWidth = viewport?.width ?? window.innerWidth, viewportHeight = viewport?.height ?? window.innerHeight;
      const width = Math.min(bounds.width || 480, viewportWidth);
      const left = Math.max(viewportLeft, Math.min(bounds.width ? bounds.left : (viewportWidth - width) / 2,
        viewportLeft + viewportWidth - width));
      const top = Math.max(viewportTop, bounds.height ? bounds.top : viewportTop);
      const bottom = Math.min(viewportTop + viewportHeight, bounds.height ? bounds.bottom : viewportTop + viewportHeight);
      const next = { left, top, width, height: Math.max(0, bottom - top), bottom: "auto", transform: "none" };
      setReceiveBounds(current => current && current.left === next.left && current.top === next.top &&
        current.width === next.width && current.height === next.height ? current : next);
    };
    place();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(place);
    observer?.observe(page);
    window.addEventListener("resize", place); document.addEventListener("scroll", place, true);
    viewport?.addEventListener("resize", place); viewport?.addEventListener("scroll", place);
    return () => {
      observer?.disconnect(); window.removeEventListener("resize", place); document.removeEventListener("scroll", place, true);
      viewport?.removeEventListener("resize", place); viewport?.removeEventListener("scroll", place);
    };
  }, [receiveScreen]);

  useLayoutEffect(() => {
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const page = dialogRef.current?.closest<HTMLElement>("[data-mono-preview]");
    dialogRef.current?.focus({ preventScroll: true });
    return () => {
      const previous = returnFocus.current;
      const placement = placementRef.current;
      queueMicrotask(() => {
        // Back mounts the anchored chooser, which owns its exact-route focus.
        if (canRestoreFocus && !canRestoreFocus()) return;
        const origin = placement && [...(page?.querySelectorAll<HTMLElement>("[data-mono-product-placement-id]") ?? [])]
          .find(element => element.dataset.monoProductPlacementId === placement.id &&
            element.dataset.monoProductPlacementAction === placement.action);
        if (origin?.isConnected) origin.focus({ preventScroll: true });
        else if (receiveScreen && page?.querySelector<HTMLElement>("[data-mono-product-receive-trigger]")?.isConnected) {
          page.querySelector<HTMLElement>("[data-mono-product-receive-trigger]")?.focus({ preventScroll: true });
        }
        else if (previous?.isConnected) previous.focus({ preventScroll: true });
        else document.querySelector<HTMLElement>("[data-mono-product-context-trigger], [data-mono-product-battery-trigger], .mono-actions__item")?.focus({ preventScroll: true });
      });
    };
  }, []);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = [...(dialogRef.current?.querySelectorAll<HTMLElement>("button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary") ?? [])]
      .filter(element => !element.closest("[hidden], [inert]"));
    if (!focusable.length) { event.preventDefault(); dialogRef.current?.focus(); return; }
    const first = focusable[0]!, last = focusable[focusable.length - 1]!;
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first.focus();
    }
  }

  return <div className="mono-product-sheet" data-product-sheet data-product-receive-screen={receiveScreen || undefined}
    style={receiveScreen ? receiveBounds : undefined}>
    <div className="mono-product-sheet__scrim" aria-hidden="true" onClick={receiveScreen ? undefined : onClose} />
    <ProductGlassSurface ref={dialogRef} className="mono-product-sheet__panel" role="dialog" aria-modal="true"
      aria-labelledby={titleId} tabIndex={-1} onKeyDown={onKeyDown}>
      {!receiveScreen && <div className="mono-product-sheet__handle" aria-hidden="true" />}
      <header className="mono-product-sheet__header">
        <h2 id={titleId}>{title}</h2>
        <button type="button" onClick={onClose}>Закрыть</button>
      </header>
      <div className="mono-product-sheet__body">{children}</div>
    </ProductGlassSurface>
  </div>;
}

function actionLabel(action: ProductActionKind): string {
  return { send: "Отправить", receive: "Получить", swap: "Обмен", buy: "Купить", withdraw: "Вывести" }[action];
}

function unavailableReason(reason: RouteUnavailableReason | null, action: ProductActionKind, all: boolean): string {
  if (reason === "account-inactive") return "Счёт не активирован. Маршруты пока недоступны.";
  if (reason === "account-unavailable") return "Счёт недоступен. Маршруты не показаны.";
  if (reason === "account-not-found") return "Счёт не найден. Выберите другой счёт.";
  if (all) return `Доступных маршрутов для действия «${actionLabel(action)}» нет.`;
  if (action === "send") return "Для этого счёта отправка недоступна.";
  if (action === "receive") return "Для этого счёта получение недоступно.";
  return `Для этого счёта действие «${actionLabel(action)}» недоступно.`;
}
