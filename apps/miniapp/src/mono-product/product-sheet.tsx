"use client";

import { useId, useLayoutEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import { selectFiatBalanceMinor, selectHoldings, type ProductActionKind, type ProductActionRoute,
  type RouteUnavailableReason } from "@wallet/core";
import type { MonoProductCommands, MonoProductView } from "./product-controller";
import { accountStatus, remainingLabel } from "./product-home";
import { formatFiatMinor } from "./product-format";
import "./product-home.css";

type ProductProps = { view: MonoProductView; commands: MonoProductCommands };

export function ProductOverlay({ view, commands }: ProductProps) {
  const sheet = view.sheet;
  if (!sheet) return null;
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

  if (sheet.kind === "battery") return <ProductSheet title="Батарейка" onClose={commands.closeSheet}>
    <p className="mono-product-sheet__intro">Демо-данные. Батарейка действует для указанной сети, действия и подходящих счетов. Остаток общего пула не складывается по счетам.</p>
    {view.batteryPools.length ? <ul className="mono-product-sheet__pools">
      {view.batteryPools.map(pool => <li key={pool.id}>
        <div className="mono-product-sheet__pool-top"><h3>{pool.networkLabel}</h3><strong>{remainingLabel(pool.remainingTransfers)}</strong></div>
        <p>Общий пул · {actionLabel(pool.action)} · {pool.eligibleAccountIds.map(id =>
          view.snapshot.accounts.find(account => account.id === id)?.label ?? "Недоступный счёт").join(", ")}</p>
      </li>)}
    </ul> : <p className="mono-product-sheet__empty">Для выбранного контекста правила батарейки неизвестны.</p>}
    <p className="mono-product-sheet__caution">Покрытие и комиссия конкретной операции пока неизвестны. Остаток не обещает бесплатный перевод.</p>
  </ProductSheet>;

  const action = sheet.action;
  const title = actionLabel(action);
  return <ProductSheet title={title} onClose={commands.closeSheet}>
    {sheet.route ? <RouteDetail route={sheet.route} view={view} /> : <>
      <p className="mono-product-sheet__intro">Выберите счёт, актив и сеть. Это просмотр демо-маршрутов; перевод здесь не выполняется.</p>
      {view.intent?.routes.length ? <div className="mono-product-sheet__options">
        {view.intent.routes.map((route, index) => <button type="button" key={`${route.accountId}-${route.assetId}-${route.networkId}-${index}`}
          className="mono-product-sheet__option" onClick={() => commands.selectRoute(route)}>
          <span><strong>{route.symbol} · {route.networkLabel}</strong><small>{route.accountLabel}</small></span>
          <span>{route.action === "receive" ? receiveLabel(route.receiveMode) : "Выбрать"}</span>
        </button>)}
      </div> : <p className="mono-product-sheet__empty">{unavailableReason(view.intent?.reason ?? null, action, view.context.kind === "all")}</p>}
    </>}
    <p className="mono-product-sheet__caution">Демо · операции и адреса не подключены. Ни одно действие здесь не отправляет средства.</p>
  </ProductSheet>;
}

function RouteDetail({ route, view }: { route: ProductActionRoute; view: MonoProductView }) {
  const coverage = view.coverage;
  return <div className="mono-product-sheet__route">
    <span className="mono-product-sheet__overline">ВЫБРАННЫЙ МАРШРУТ</span>
    <h3>{route.symbol} · {route.networkLabel}</h3>
    <p>Счёт: {route.accountLabel}</p>
    {route.action === "receive" && <p>{receiveLabel(route.receiveMode)}. Реквизиты и адрес не предоставлены демо-адаптером.</p>}
    {route.action === "send" && <p>Сумма, доступность и комиссия появятся после подключения расчёта операции.</p>}
    {route.action === "send" && <p>{coverage?.status === "covered"
      ? `Батарейка подходит к этому маршруту · ${remainingLabel(coverage.pool!.remainingTransfers)} в общем пуле. Комиссия ещё не рассчитана.`
      : coverage?.status === "exhausted" ? "Подходящий пул исчерпан. Комиссия ещё не рассчитана."
        : coverage?.status === "not-applicable" ? "Батарейка на этот маршрут не распространяется. Комиссия ещё не рассчитана."
          : "Правила батарейки для маршрута неизвестны. Комиссия ещё не рассчитана."}</p>}
    <p className="mono-product-sheet__empty">Продолжение пока недоступно в демо.</p>
  </div>;
}

function ProductSheet({ title, onClose, children }: { title: string; onClose(): void; children: ReactNode }) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.focus();
    return () => {
      const previous = returnFocus.current;
      if (previous?.isConnected) previous.focus();
      else document.querySelector<HTMLElement>("[data-mono-product-context-trigger], [data-mono-product-battery-trigger], .mono-actions__item")?.focus();
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
    const focusable = [...(dialogRef.current?.querySelectorAll<HTMLElement>("button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])") ?? [])];
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
    <div ref={dialogRef} className="mono-product-sheet__panel" role="dialog" aria-modal="true"
      aria-labelledby={titleId} tabIndex={-1} onKeyDown={onKeyDown}>
      <div className="mono-product-sheet__handle" aria-hidden="true" />
      <header className="mono-product-sheet__header">
        <h2 id={titleId}>{title}</h2>
        <button type="button" onClick={onClose}>Закрыть</button>
      </header>
      <div className="mono-product-sheet__body">{children}</div>
    </div>
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
