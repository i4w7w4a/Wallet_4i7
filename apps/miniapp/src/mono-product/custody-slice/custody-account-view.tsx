"use client";

import { Component, createRef, useId, useLayoutEffect, useRef, useState, type JSX, type ReactNode } from "react";
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
  const rootRef = useRef<HTMLDivElement>(null);
  const [choice, setChoice] = useState<NovexAction | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const placements = selectAccountPlacementActions(holdings, permittedRoutes);
  const reason = useAccountUnavailableReason?.trim();
  const actionRoutes = (action: NovexAction) => permittedRoutes.filter(route => route.action === action);
  useLayoutEffect(() => {
    if (choice && permittedRoutes.filter(route => route.action === choice).length <= 1) setChoice(null);
  }, [choice, permittedRoutes]);
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

  return <div ref={rootRef} className={styles.view}>
    <header className={styles.header}>
      <div className={styles.accountMark}><AccountKindIcon kind={account.kind} className={styles.accountIcon} /></div>
      <div className={styles.headingCopy}>
        <p className={styles.eyebrow}>Счёт</p>
        <h1 id={titleId} tabIndex={-1} data-mono-product-accounts-title>{account.label} · Демо</h1>
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
      <NovexActionRow items={actions.map(action => {
        const multiple = actionRoutes(action).length > 1;
        return { action, label: labels[action], disabled: actionRoutes(action).length === 0,
          accountActionFocus: true, expanded: multiple ? choice === action : undefined,
          controls: multiple ? `${titleId}-${action}-choices` : undefined, onClick: () => chooseAction(action) };
      })} />
      {actions.map(action => {
        const options = actionRoutes(action);
        return <FocusRegion key={action} id={`${titleId}-${action}-choices`} className={styles.choices}
          label={`Выберите способ: ${labels[action]}`} open={options.length > 1 && choice === action}
          revision={JSON.stringify(options.map(productRouteKey))} fallbackId={titleId} canFocusLauncher={options.length > 0}
          launcher={() => [...(rootRef.current?.querySelectorAll<HTMLElement>("[data-product-account-quick-action]") ?? [])]
            .find(element => element.dataset.productAccountQuickAction === action) ?? null}>
          <p>Выберите актив и сеть</p>
          {options.map(route => <RouteChoice key={productRouteKey(route)} route={route} onOpen={openRoute} />)}
        </FocusRegion>;
      })}
      {unavailable && <p className={styles.notice} role="status">Эта операция сейчас недоступна.</p>}
      {permittedRoutes.length === 0 && <p className={styles.notice}>{accountOperationsUnavailable(account)}</p>}
    </div>

    {pendingActivity}
    <section className={styles.assets} aria-labelledby={`${titleId}-assets`}>
      <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>На этом счёте</p><h2 id={`${titleId}-assets`}>Активы</h2></div><span>{holdings.length}</span></div>
      {holdings.length === 0 ? <p className={styles.notice}>Размещений пока нет.</p> : <ul className={styles.holdings}>
        {holdings.map(holding => <Holding key={holding.id} account={account} titleId={titleId} holding={holding} hidden={balanceHidden}
          routes={placements.byHoldingId.get(holding.id) ?? []} expanded={expandedHoldingId === holding.id}
          onToggle={() => onExpandedHoldingChange(expandedHoldingId === holding.id ? null : holding.id)}
          onOpenAction={onOpenAction} onOpenHolding={onOpenHolding} />)}
      </ul>}
    </section>
  </div>;
}

function Holding({ account, titleId, holding, hidden, routes, expanded, onToggle, onOpenAction, onOpenHolding }: {
  account: ProductAccount; titleId: string; holding: ProductHolding; hidden: boolean; routes: readonly ProductActionRoute[]; expanded: boolean; onToggle(): void;
  onOpenAction: CustodyAccountViewProps["onOpenAction"]; onOpenHolding: CustodyAccountViewProps["onOpenHolding"];
}) {
  const id = useId();
  const [choice, setChoice] = useState<NovexAction | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const network = holding.networkLabel || "Сеть неизвестна";
  const restrictions = holdingRestrictions(account, holding, routes, hidden);
  useLayoutEffect(() => {
    if (choice && routes.filter(route => route.action === choice).length <= 1) setChoice(null);
  }, [choice, routes]);
  const openRoute = (route: ProductActionRoute) => {
    if (route.action === "withdraw") return;
    const origin: AccountsActionOrigin = { kind: "holding-action", holdingId: holding.id, action: route.action, routeKey: productRouteKey(route) };
    setUnavailable(onOpenAction(route, origin) === false);
  };
  return <li className={styles.holding}>
    <button type="button" id={`${id}-trigger`} className={styles.holdingButton} data-product-holding-id={holding.id}
      aria-label={`${routes.length > 0 ? "Действия" : "Сведения"}: ${holding.name} · ${holding.symbol} · ${network}`} aria-expanded={expanded} aria-controls={`${id}-content`}
      aria-describedby={`${id}-values${restrictions.length ? ` ${id}-restrictions` : ""}`} onClick={() => { setChoice(null); setUnavailable(false); onToggle(); }}>
      <CurrencyLogo assetId={holding.assetId} className={styles.currencyIcon} />
      <span className={styles.holdingName}><strong>{holding.name}</strong><span>{holding.symbol} · {network}</span></span>
      <span id={`${id}-values`} className={styles.values}>
        <span role="group" aria-label={`Количество ${holding.symbol} · ${network}`}><bdi>{holdingQuantityLabel(holding.quantity, holding.symbol, hidden)}</bdi></span>
        <span className={styles.fiat}><bdi>{hidden ? "••••" : `≈ ${formatFiatMinor(holding.fiatMinor)}`}</bdi></span>
      </span>
      <span className={styles.chevron} aria-hidden="true">{expanded ? "⌃" : "⌄"}</span>
    </button>
    {restrictions.length > 0 && <p id={`${id}-restrictions`} className={styles.notice}>{restrictions.join(" ")}</p>}
    <FocusRegion id={`${id}-content`} className={styles.holdingContent} open={expanded} revision={JSON.stringify(routes.map(productRouteKey))}
      fallbackId={titleId} canFocusLauncher launcher={() => document.getElementById(`${id}-trigger`)}>
      <div className={styles.available}><span>Доступно</span><span role="group" aria-label={`Доступное количество ${holding.symbol} · ${network}`}><bdi>{holdingQuantityLabel(holding.availableQuantity, holding.symbol, hidden)}</bdi></span></div>
      {routes.length > 0 && <div className={styles.holdingActions} role="group" aria-label={`Операции: ${holding.symbol} · ${network}`}>
        {actions.map(action => {
          const options = routes.filter(route => route.action === action);
          if (!options.length) return null;
          return <button key={action} id={`${id}-${action}-trigger`} type="button" data-product-holding-action-id={holding.id} data-product-holding-action={action}
            data-product-account-route-key={options.length === 1 ? productRouteKey(options[0]!) : undefined}
            aria-expanded={options.length > 1 ? choice === action : undefined}
            aria-controls={options.length > 1 ? `${id}-${action}-choices` : undefined}
            onClick={() => { setUnavailable(false); if (options.length === 1) { setChoice(null); openRoute(options[0]!); }
              else setChoice(previous => previous === action ? null : action); }}>{labels[action]}</button>;
        })}
      </div>}
      {actions.map(action => {
        const options = routes.filter(route => route.action === action);
        return <FocusRegion key={action} id={`${id}-${action}-choices`} className={styles.choices} label="Выбор способа операции"
          open={expanded && options.length > 1 && choice === action} revision={JSON.stringify(options.map(productRouteKey))}
          fallbackId={titleId} canFocusLauncher
          launcher={() => document.getElementById(expanded && options.length > 0 ? `${id}-${action}-trigger` : `${id}-trigger`)}>
          {options.map(route => <RouteChoice key={productRouteKey(route)} route={route} onOpen={openRoute} />)}
        </FocusRegion>;
      })}
      {unavailable && <p className={styles.notice} role="status">Эта операция сейчас недоступна.</p>}
      <button type="button" className={styles.details} data-product-holding-detail-id={holding.id}
        aria-label={`Подробнее: ${holding.name} · ${holding.symbol} · ${network}`} onClick={() => onOpenHolding(holding.id)}>Подробнее <span aria-hidden="true">→</span></button>
    </FocusRegion>
  </li>;
}

type FocusRegionProps = {
  id: string; className: string; label?: string; open: boolean; revision: string; fallbackId: string;
  canFocusLauncher: boolean; launcher(): HTMLElement | null; children: ReactNode;
};

/** Track focus before a disclosure changes and restore it after React's DOM update. */
class FocusRegion extends Component<FocusRegionProps> {
  private readonly region = createRef<HTMLDivElement>();

  private restoreFocus(useLauncher: boolean) {
    const region = this.region.current;
    if (!region) return;
    const candidate = useLauncher && this.props.canFocusLauncher ? this.props.launcher() : null;
    const usable = candidate?.isConnected && !candidate.matches(":disabled") &&
      !candidate.closest("[hidden], [inert], [aria-hidden='true']");
    (usable ? candidate : region.ownerDocument.getElementById(this.props.fallbackId))?.focus({ preventScroll: true });
  }

  getSnapshotBeforeUpdate(previous: FocusRegionProps) {
    const region = this.region.current;
    const active = region?.ownerDocument.activeElement as HTMLElement | null;
    if (!previous.open || !active || !region?.contains(active)) return null;
    if (!this.props.open) return active;
    if (previous.revision !== this.props.revision) {
      const keys = JSON.parse(this.props.revision) as string[];
      const routeKey = active.dataset.productAccountRouteKey;
      const action = active.dataset.productHoldingAction;
      if ((routeKey && !keys.includes(routeKey)) || (action && !keys.some(key => key.startsWith(`${action}:`)))) {
        return active;
      }
    }
    return null;
  }

  componentDidUpdate(_previous: FocusRegionProps, _state: unknown, displaced: HTMLElement | null) {
    if (!displaced) return;
    const doc = displaced.ownerDocument;
    // Do not override another component that deliberately moved focus during the update.
    if (doc.activeElement === displaced || doc.activeElement === doc.body || doc.activeElement === doc.documentElement) {
      this.restoreFocus(true);
    }
  }

  componentWillUnmount() {
    // The launcher may be removed together with this region.
    const region = this.region.current;
    if (region?.contains(region.ownerDocument.activeElement)) this.restoreFocus(false);
  }

  render() {
    const { id, className, label, open, children } = this.props;
    return <div ref={this.region} id={id} className={className} role={label ? "group" : undefined}
      aria-label={label} hidden={!open}>{children}</div>;
  }
}

function holdingRestrictions(account: ProductAccount, holding: ProductHolding, routes: readonly ProductActionRoute[], hidden: boolean): string[] {
  if (account.status !== "active") return [accountOperationsUnavailable(account)];
  const reasons: string[] = [];
  if (routes.length === 0) reasons.push("Операции сейчас недоступны.");
  else {
    if (!routes.some(route => route.action === "send")) reasons.push("Отправка недоступна.");
    const receive = routes.filter(route => route.action === "receive");
    if (receive.length === 0) reasons.push("Получение недоступно.");
    else if (receive.every(route => route.action === "receive" && route.receiveMode === "internal-transfer")) reasons.push("Получение между счетами.");
  }
  if (!hidden && holding.availableQuantity !== undefined && /^0+(?:\.0+)?$/.test(holding.availableQuantity)) {
    reasons.push("Доступных средств пока нет.");
  }
  return reasons;
}
function RouteChoice({ route, onOpen }: { route: ProductActionRoute; onOpen(route: ProductActionRoute): void }) {
  if (route.action === "withdraw") return null;
  const mode = route.action === "receive" ? route.receiveMode === "internal-transfer" ? "Перевод между счетами" : "Внешнее получение" : null;
  return <button type="button" className={styles.route} data-product-account-route-key={productRouteKey(route)}
    aria-label={routeDescription(route)} onClick={() => onOpen(route)}>
    <span><strong>{route.symbol}</strong><small>{route.networkLabel || "Сеть неизвестна"}{mode ? ` · ${mode}` : ""}</small></span><span aria-hidden="true">→</span>
  </button>;
}
