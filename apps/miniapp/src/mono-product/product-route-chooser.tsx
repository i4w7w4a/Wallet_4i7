"use client";

import type { ProductActionKind, ProductActionRoute, ProductHolding } from "@wallet/core";
import { useLayoutEffect, useRef, useState } from "react";
import { productRouteKey } from "./product-controller";
import { formatQuantity } from "./product-format";
import styles from "./product-chooser.module.css";

export type ProductRouteChooserProps = {
  routes: readonly ProductActionRoute[];
  holdings: readonly ProductHolding[];
  action: ProductActionKind;
  balanceHidden: boolean;
  focusRouteKey?: string;
  onSelectRoute(route: ProductActionRoute): void;
};

export function ProductRouteChooser(props: ProductRouteChooserProps) {
  if (props.routes.length === 0) return null;
  const focusRoute = props.routes.find(route => productRouteKey(route) === props.focusRouteKey);
  // A new Back target starts in its own group; ordinary rerenders preserve manual account selection.
  return <RouteGroups key={focusRoute ? props.focusRouteKey : ""} {...props} initialAccountId={focusRoute?.accountId} />;
}

function RouteGroups({ routes, holdings, action, balanceHidden, focusRouteKey, onSelectRoute, initialAccountId }:
  ProductRouteChooserProps & { initialAccountId?: string }) {
  const [selectedAccountId, setSelectedAccountId] = useState(initialAccountId ?? routes[0]!.accountId);
  const selectedButton = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => { selectedButton.current?.focus({ preventScroll: true }); }, [focusRouteKey]);

  const accounts = new Map<string, string>();
  for (const route of routes) if (!accounts.has(route.accountId)) accounts.set(route.accountId, route.accountLabel);
  const activeAccountId = accounts.has(selectedAccountId) ? selectedAccountId : routes[0]!.accountId;
  const accountRoutes = routes.filter(route => route.accountId === activeAccountId);
  const assets = new Map<string, ProductActionRoute[]>();
  for (const route of accountRoutes) {
    const group = assets.get(route.assetId);
    if (group) group.push(route);
    else assets.set(route.assetId, [route]);
  }
  const accountPrompt = action === "receive" ? "Счёт получения" : "Счёт операции";

  return <div className={styles.chooser} data-product-route-chooser>
    <p className={styles.intro}>Демо: выберите актив и сеть. Средства не перемещаются.</p>
    {accounts.size > 1 ? <div className={styles.accountSwitch} role="group" aria-label={accountPrompt}>
      {[...accounts].map(([id, label]) => <button type="button" className={styles.accountTab} key={id}
        data-route-account-id={id} aria-pressed={activeAccountId === id} onClick={() => setSelectedAccountId(id)}>{label}</button>)}
    </div> : <p className={styles.singleAccount}><small>{accountPrompt}</small><strong>{accounts.get(activeAccountId)}</strong></p>}

    <div className={styles.routePanel} role="group" aria-label={`Маршруты · ${accounts.get(activeAccountId)}`}>
      <ul className={styles.assetGroups}>
        {[...assets].map(([assetId, assetRoutes]) => <li className={styles.assetGroup} key={assetId}>
          <div className={styles.assetHeading}><strong>{assetRoutes[0]!.symbol}</strong><span>{assetRoutes[0]!.name}</span></div>
          <ul className={styles.routeList}>
            {assetRoutes.map(route => {
              const key = productRouteKey(route);
              const method = route.action === "receive"
                ? route.receiveMode === "internal-transfer" ? "Между счетами" : "Внешнее получение" : null;
              const available = method || balanceHidden ? null : exactAvailable(route, holdings);
              const financialLabel = balanceHidden ? "Сумма скрыта" : available === null
                ? "Доступный остаток не указан" : `Доступно: ${available} ${route.symbol}`;
              return <li key={key}>
                <button type="button" className={styles.routeRow} data-product-route-key={key}
                  data-receive-mode={route.action === "receive" ? route.receiveMode : undefined}
                  aria-label={`${route.symbol} · ${route.name} · ${route.networkLabel} · ${route.accountLabel} · ${method ?? financialLabel}`}
                  ref={key === focusRouteKey ? selectedButton : undefined} onClick={() => onSelectRoute(route)}>
                  <span className={styles.routeCopy}>
                    <strong>{route.networkLabel}</strong>
                    {method && <small className={styles.routeMethod}>{method}</small>}
                  </span>
                  {!method && <span className={styles.routeValue}>
                    <strong>{balanceHidden ? "••••" : available === null ? "Нет данных" : `${available} ${route.symbol}`}</strong>
                    <small>{balanceHidden ? "Сумма скрыта" : "Доступно"}</small>
                  </span>}
                  <svg className={styles.routeChevron} width="16" height="16" viewBox="0 0 16 16" fill="none"
                    aria-hidden="true" focusable="false">
                    <path d="m6 4 4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </li>;
            })}
          </ul>
        </li>)}
      </ul>
    </div>
  </div>;
}

function exactAvailable(route: ProductActionRoute, holdings: readonly ProductHolding[]): string | null {
  const exact = holdings.filter(holding => holding.accountId === route.accountId &&
    holding.assetId === route.assetId && holding.networkId === route.networkId);
  const available = exact.length === 1 ? exact[0]!.availableQuantity : undefined;
  return typeof available === "string" && /^\d+(?:\.\d+)?$/.test(available) ? formatQuantity(available) : null;
}
