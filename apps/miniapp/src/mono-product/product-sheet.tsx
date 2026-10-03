"use client";

import { useCallback, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { selectFiatBalanceMinor, selectHoldings, type ProductActionKind, type ProductActionRoute,
  type RouteUnavailableReason } from "@wallet/core";
import { productRouteKey, receiveRequestAmountKey, sendDraftKey, type MonoProductCommands, type MonoProductView } from "./product-controller";
import { accountStatus } from "./product-home";
import { formatFiatMinor } from "./product-format";
import { createMonoDemoFlowPorts } from "./demo-adapter";
import { ReceiveFlow } from "./receive";
import { SendFlow, type SendDraft, type SendOperationStatus, type SendSimulationResult } from "./send";
import { ProductAssetDetail } from "./asset-detail/product-asset-detail";
import { BatteryPopover } from "./battery-popover";
import { ProductGlassSurface } from "./product-glass-surface";
import "./product-home.css";

type ProductProps = { view: MonoProductView; commands: MonoProductCommands; onOpenActivity?(id: string): void };

export function ProductOverlay({ view, commands, onOpenActivity }: ProductProps) {
  const ports = useMemo(() => createMonoDemoFlowPorts(view.snapshot), [view.snapshot]);
  return <>
    <BatteryPopover view={view} open={view.sheet?.kind === "battery"} onClose={commands.closeSheet} />
    <ProductModalOverlay view={view} commands={commands} ports={ports} onOpenActivity={onOpenActivity} />
  </>;
}

function ProductModalOverlay({ view, commands, ports, onOpenActivity }: ProductProps & { ports: ReturnType<typeof createMonoDemoFlowPorts> }) {
  const sheet = view.sheet;
  if (!sheet || sheet.kind === "battery") return null;
  if (sheet.kind === "accounts") return <ProductSheet title="Выбор счёта" onClose={commands.closeSheet}>
    <p className="mono-product-sheet__intro">Контекст меняет сумму и доступные маршруты. «Все счета» — обзор, не источник перевода.</p>
    <div className="mono-product-sheet__options">
      <button type="button" className="mono-product-sheet__option" aria-current={view.context.kind === "all" ? "true" : undefined}
        onClick={() => commands.selectContext({ kind: "all" })}>
        <span><strong>Все счета</strong><small>Общая стоимость</small></span>
        <span>{view.balanceHidden ? "Значения скрыты" : formatFiatMinor(selectFiatBalanceMinor(view.snapshot.holdings))}</span>
      </button>
      {view.snapshot.accounts.map(account => <button type="button" key={account.id}
        className="mono-product-sheet__option" aria-current={view.context.kind === "account" &&
          view.context.accountId === account.id ? "true" : undefined}
        onClick={() => commands.selectContext({ kind: "account", accountId: account.id })}>
        <span><strong>{account.label}</strong><small>{accountStatus(account)}</small></span>
        <span>{view.balanceHidden ? "Значения скрыты" : formatFiatMinor(selectFiatBalanceMinor(
          selectHoldings(view.snapshot, { kind: "account", accountId: account.id })))}</span>
      </button>)}
    </div>
  </ProductSheet>;

  const action = sheet.action;
  const title = actionLabel(action);
  return <ProductSheet title={title} onClose={commands.closeSheet}
    returnPlacement={sheet.placementId ? { id: sheet.placementId, action } : undefined}>
    {sheet.route ? <RouteDetail key={productRouteKey(sheet.route)} route={sheet.route} view={view} commands={commands} ports={ports}
      onOpenActivity={onOpenActivity} /> :
      <RouteChooser view={view} commands={commands} action={action} focusRouteKey={sheet.focusRouteKey} />}
  </ProductSheet>;
}

function RouteChooser({ view, commands, action, focusRouteKey }: ProductProps & {
  action: ProductActionKind; focusRouteKey?: string;
}) {
  const selectedButton = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => { selectedButton.current?.focus({ preventScroll: true }); }, [focusRouteKey]);
  return <>
      <p className="mono-product-sheet__intro">Демо: выберите счёт, актив и сеть. Средства не отправляются.</p>
      {view.intent?.routes.length ? <div className="mono-product-sheet__options">
        {view.intent.routes.map((route, index) => <button type="button" key={`${route.accountId}-${route.assetId}-${route.networkId}-${index}`}
          className="mono-product-sheet__option" onClick={() => commands.selectRoute(route)}
          ref={productRouteKey(route) === focusRouteKey ? selectedButton : undefined}>
          <span><strong>{route.symbol} · {route.networkLabel}</strong><small>{route.accountLabel}</small></span>
          <span>{route.action === "receive" ? receiveLabel(route.receiveMode) : "Выбрать"}</span>
        </button>)}
      </div> : <p className="mono-product-sheet__empty">{unavailableReason(view.intent?.reason ?? null, action, view.context.kind === "all")}</p>}
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
  const onDraftChange = useCallback((draft: SendDraft | null) => saveDraft(route, draft), [route, saveDraft]);
  const onRequestAmountChange = useCallback((amount: string) => saveReceiveAmount(route, amount), [route, saveReceiveAmount]);
  const onSimulationResult = useCallback((event: SendSimulationResult) => {
    setResultActivityId(recordSimulation(event));
  }, [recordSimulation]);
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

function ProductSheet({ title, onClose, children, returnPlacement }: {
  title: string; onClose(): void; children: ReactNode; returnPlacement?: { id: string; action: ProductActionKind };
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const placementRef = useRef(returnPlacement);
  placementRef.current = returnPlacement;

  useLayoutEffect(() => {
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const page = dialogRef.current?.closest<HTMLElement>("[data-mono-preview]");
    dialogRef.current?.focus({ preventScroll: true });
    return () => {
      const previous = returnFocus.current;
      const placement = placementRef.current;
      queueMicrotask(() => {
        const origin = placement && [...(page?.querySelectorAll<HTMLElement>("[data-mono-product-placement-id]") ?? [])]
          .find(element => element.dataset.monoProductPlacementId === placement.id &&
            element.dataset.monoProductPlacementAction === placement.action);
        if (origin?.isConnected) origin.focus({ preventScroll: true });
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

  return <div className="mono-product-sheet" data-product-sheet>
    <div className="mono-product-sheet__scrim" aria-hidden="true" onClick={onClose} />
    <ProductGlassSurface ref={dialogRef} className="mono-product-sheet__panel" role="dialog" aria-modal="true"
      aria-labelledby={titleId} tabIndex={-1} onKeyDown={onKeyDown}>
      <div className="mono-product-sheet__handle" aria-hidden="true" />
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

function receiveLabel(mode: "external-address" | "internal-transfer"): string {
  return mode === "internal-transfer" ? "Внутреннее пополнение" : "Внешний адрес";
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
