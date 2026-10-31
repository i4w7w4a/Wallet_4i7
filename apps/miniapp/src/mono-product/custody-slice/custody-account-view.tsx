"use client";

import { useId, useState, type JSX, type ReactNode } from "react";
import type { ProductAccount, ProductActionRoute, ProductHolding } from "@wallet/core";
import { NovexActionRow, type NovexAction } from "../novex-layout-preview";
import { selectAccountPlacementActions, type AccountsActionOrigin } from "../accounts-workspace/account-placement-actions";
import { accountKindLabels, accountStatusLabels, accountOperationsUnavailable, holdingQuantityLabel } from "../accounts-workspace/accounts-workspace-data";
import { CurrencyLogo } from "../currency-logo";
import { AccountKindIcon } from "../accounts-workspace/account-kind-icon";
import { productRouteKey } from "../product-controller";
import { formatFiatMinor } from "../product-format";
import styles from "./custody-account-view.module.css";

export type CustodyAccountViewProps = {
  account: ProductAccount;
  holdings: readonly ProductHolding[];
  estimateMinor: number;
  current: boolean;
  contextLabel: string;
  balanceHidden: boolean;
  permittedRoutes: readonly ProductActionRoute[];
  useAccountUnavailableReason?: string;
  expandedHoldingId: string | null;
  onExpandedHoldingChange(id: string | null): void;
  onUseAccount(accountId: string): void;
  onOpenAction(route: ProductActionRoute, origin?: AccountsActionOrigin): boolean | void;
  onOpenHolding(holdingId: string): void;
  pendingActivity?: ReactNode;
};

const actions: readonly NovexAction[] = ["receive", "send", "buy", "swap"];
const labels: Record<NovexAction, string> = { receive: "Получить", send: "Отправить", buy: "Купить", swap: "Обменять" };
const prepareLabels: Record<NovexAction, string> = {
  receive: "Подготовить получение", send: "Подготовить отправку", buy: "Подготовить покупку", swap: "Подготовить обмен",
};

function routeDescription(route: ProductActionRoute): string {
  if (route.action === "withdraw") return "";
  const mode = route.action === "receive"
    ? route.receiveMode === "internal-transfer" ? " · Перевод между счетами" : " · Внешнее получение" : "";
  return `${prepareLabels[route.action]} ${route.symbol} · ${route.accountLabel} · ${route.networkLabel || "Сеть неизвестна"}${mode}`;
}

export function CustodyAccountView({ account, holdings, estimateMinor, current, contextLabel, balanceHidden,
  permittedRoutes, useAccountUnavailableReason, expandedHoldingId, onExpandedHoldingChange, onUseAccount,
  onOpenAction, onOpenHolding, pendingActivity }: CustodyAccountViewProps): JSX.Element {
  const titleId = useId();
  const [choice, setChoice] = useState<NovexAction | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const placements = selectAccountPlacementActions(holdings, permittedRoutes);
  const reason = useAccountUnavailableReason?.trim();
  const actionRoutes = (action: NovexAction) => permittedRoutes.filter(route => route.action === action);
  const openRoute = (route: ProductActionRoute) => {
    if (route.action === "withdraw") return;
    const origin: AccountsActionOrigin = { kind: "account-quick-action", action: route.action, routeKey: productRouteKey(route) };
    setUnavailable(onOpenAction(route, origin) === false);
  };
  const chooseAction = (action: NovexAction) => {
    const routes = actionRoutes(action);
    setUnavailable(false);
    if (routes.length === 1) { setChoice(null); openRoute(routes[0]!); }
    else if (routes.length > 1) setChoice(previous => previous === action ? null : action);
  };

  return <div className={styles.view}>
    <header className={styles.header}>
      <div className={styles.accountMark}><AccountKindIcon kind={account.kind} className={styles.accountIcon} /></div>
      <div className={styles.headingCopy}>
        <p className={styles.eyebrow}>Счёт</p>
        <h1 id={titleId} tabIndex={-1} data-mono-product-accounts-title>{account.label}</h1>
        <p className={styles.meta}>{accountKindLabels[account.kind]} · {accountStatusLabels[account.status]}</p>
      </div>
    </header>
    <section className={styles.summary} aria-label="Оценка активов счёта">
      <p className={styles.balanceLabel}>Оценка активов в USD</p>
      <p className={styles.balance}><bdi>{balanceHidden ? "••••" : `≈ ${formatFiatMinor(estimateMinor)}`}</bdi></p>
      {current ? <p className={styles.current}>✓ Выбран в кошельке</p> : <div className={styles.context}>
        <p>В кошельке сейчас: {contextLabel}.</p>
        <button type="button" className={styles.useAccount} onClick={() => onUseAccount(account.id)}
          disabled={Boolean(reason)} aria-describedby={reason ? `${titleId}-reason` : undefined}>Выбрать счёт в кошельке <span aria-hidden="true">→</span></button>
        {reason && <p id={`${titleId}-reason`}>{reason}</p>}
      </div>}
    </section>

    <div className={styles.actionArea}>
      <NovexActionRow items={actions.map(action => ({ action, label: labels[action], disabled: actionRoutes(action).length === 0,
        accountActionFocus: true, onClick: () => chooseAction(action) }))} />
      {choice && actionRoutes(choice).length > 1 && <div className={styles.choices} role="group" aria-label={`Выберите способ: ${labels[choice]}`}>
        <p>Выберите актив и сеть</p>
        {actionRoutes(choice).map(route => <RouteChoice key={productRouteKey(route)} route={route} onOpen={openRoute} />)}
      </div>}
      {unavailable && <p className={styles.notice} role="status">Эта операция сейчас недоступна.</p>}
      {permittedRoutes.length === 0 && <p className={styles.notice}>{accountOperationsUnavailable(account)}</p>}
    </div>

    {pendingActivity}
    <section className={styles.assets} aria-labelledby={`${titleId}-assets`}>
      <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>На этом счёте</p><h2 id={`${titleId}-assets`}>Активы</h2></div><span>{holdings.length}</span></div>
      {holdings.length === 0 ? <p className={styles.notice}>Размещений пока нет.</p> : <ul className={styles.holdings}>
        {holdings.map(holding => <Holding key={holding.id} holding={holding} hidden={balanceHidden}
          routes={placements.byHoldingId.get(holding.id) ?? []} expanded={expandedHoldingId === holding.id}
          onToggle={() => onExpandedHoldingChange(expandedHoldingId === holding.id ? null : holding.id)}
          onOpenAction={onOpenAction} onOpenHolding={onOpenHolding} />)}
      </ul>}
    </section>
  </div>;
}

function Holding({ holding, hidden, routes, expanded, onToggle, onOpenAction, onOpenHolding }: {
  holding: ProductHolding; hidden: boolean; routes: readonly ProductActionRoute[]; expanded: boolean; onToggle(): void;
  onOpenAction: CustodyAccountViewProps["onOpenAction"]; onOpenHolding: CustodyAccountViewProps["onOpenHolding"];
}) {
  const id = useId();
  const [choice, setChoice] = useState<NovexAction | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const network = holding.networkLabel || "Сеть неизвестна";
  const openRoute = (route: ProductActionRoute) => {
    if (route.action === "withdraw") return;
    const origin: AccountsActionOrigin = { kind: "holding-action", holdingId: holding.id, action: route.action, routeKey: productRouteKey(route) };
    setUnavailable(onOpenAction(route, origin) === false);
  };
  return <li className={styles.holding}>
    <button type="button" className={styles.holdingButton} data-product-holding-id={holding.id}
      aria-label={`${routes.length > 0 ? "Действия" : "Сведения"}: ${holding.name} · ${holding.symbol} · ${network}`} aria-expanded={expanded} aria-controls={`${id}-content`}
      aria-describedby={`${id}-values`} onClick={() => { setChoice(null); setUnavailable(false); onToggle(); }}>
      <CurrencyLogo assetId={holding.assetId} className={styles.currencyIcon} />
      <span className={styles.holdingName}><strong>{holding.name}</strong><span>{holding.symbol} · {network}</span></span>
      <span id={`${id}-values`} className={styles.values}>
        <span role="group" aria-label={`Количество ${holding.symbol} · ${network}`}><bdi>{holdingQuantityLabel(holding.quantity, holding.symbol, hidden)}</bdi></span>
        <span className={styles.fiat}><bdi>{hidden ? "••••" : `≈ ${formatFiatMinor(holding.fiatMinor)}`}</bdi></span>
      </span>
      <span className={styles.chevron} aria-hidden="true">{expanded ? "⌃" : "⌄"}</span>
    </button>
    <div id={`${id}-content`} hidden={!expanded} className={styles.holdingContent}>
      <div className={styles.available}><span>Доступно</span><span role="group" aria-label={`Доступное количество ${holding.symbol} · ${network}`}><bdi>{holdingQuantityLabel(holding.availableQuantity, holding.symbol, hidden)}</bdi></span></div>
      {routes.length > 0 && <div className={styles.holdingActions} role="group" aria-label={`Операции: ${holding.symbol} · ${network}`}>
        {actions.map(action => {
          const options = routes.filter(route => route.action === action);
          if (!options.length) return null;
          return <button key={action} type="button" data-product-holding-action-id={holding.id} data-product-holding-action={action}
            data-product-account-route-key={options.length === 1 ? productRouteKey(options[0]!) : undefined}
            aria-expanded={options.length > 1 ? choice === action : undefined}
            onClick={() => { setUnavailable(false); if (options.length === 1) { setChoice(null); openRoute(options[0]!); }
              else setChoice(previous => previous === action ? null : action); }}>{labels[action]}</button>;
        })}
      </div>}
      {choice && routes.filter(route => route.action === choice).length > 1 && <div className={styles.choices} role="group" aria-label="Выбор способа операции">
        {routes.filter(route => route.action === choice).map(route => <RouteChoice key={productRouteKey(route)} route={route} onOpen={openRoute} />)}
      </div>}
      {unavailable && <p className={styles.notice} role="status">Эта операция сейчас недоступна.</p>}
      <button type="button" className={styles.details} data-product-holding-detail-id={holding.id}
        aria-label={`Подробнее: ${holding.name} · ${holding.symbol} · ${network}`} onClick={() => onOpenHolding(holding.id)}>Подробнее <span aria-hidden="true">→</span></button>
    </div>
  </li>;
}

function RouteChoice({ route, onOpen }: { route: ProductActionRoute; onOpen(route: ProductActionRoute): void }) {
  if (route.action === "withdraw") return null;
  const mode = route.action === "receive" ? route.receiveMode === "internal-transfer" ? "Перевод между счетами" : "Внешнее получение" : null;
  return <button type="button" className={styles.route} data-product-account-route-key={productRouteKey(route)}
    aria-label={routeDescription(route)} onClick={() => onOpen(route)}>
    <span><strong>{route.symbol}</strong><small>{route.networkLabel || "Сеть неизвестна"}{mode ? ` · ${mode}` : ""}</small></span><span aria-hidden="true">→</span>
  </button>;
}
