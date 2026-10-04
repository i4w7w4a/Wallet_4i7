"use client";

import { useId } from "react";
import { resolveActionRoutes, type ProductAccount, type ProductHolding, type ProductSnapshot } from "@wallet/core";
import type { MonoProductView, ProductPlacementAction } from "../product-controller";
import { formatFiatMinor, formatQuantity } from "../product-format";
import { ProductHistory } from "../product-history";
import { selectAssetActivities, sumDecimalQuantities } from "./asset-workspace-data";
import styles from "./product-asset-workspace.module.css";

export type ProductAssetWorkspaceProps = {
  view: MonoProductView;
  assetId: string;
  selectedHoldingId: string | null;
  onSelectHolding(holdingId: string): void;
  onBack(): void;
  onPlacementAction(holdingId: string, action: ProductPlacementAction): void;
  onExpandActivity(id: string | null): void;
  onRetryActivities?(): void;
};

export function ProductAssetWorkspace({ view, assetId, selectedHoldingId, onSelectHolding, onBack,
  onPlacementAction, onExpandActivity, onRetryActivities }: ProductAssetWorkspaceProps) {
  const titleId = useId();
  const placementsId = useId();
  const historyId = useId();
  const asset = view.holdings.find(group => group.assetId === assetId);
  const placements = asset?.placements ?? [];
  // Selection is controlled by the host. Never turn a stale or absent ID into the first route.
  const selected = placements.find(holding => holding.id === selectedHoldingId) ?? null;
  const accounts = new Map(view.snapshot.accounts.map(account => [account.id, account]));
  const scopedAccountIds = view.snapshot.accounts.filter(account =>
    view.context.kind === "all" || account.id === view.context.accountId).map(account => account.id);
  const activities = selectAssetActivities(view.activities, assetId, scopedAccountIds, selected);
  const total = sumDecimalQuantities(placements.map(holding => holding.quantity));
  const historyAccountId = selected?.accountId ?? (view.context.kind === "account" ? view.context.accountId : undefined);

  return <section className={styles.workspace} aria-labelledby={titleId} data-mono-product-asset-workspace={assetId}>
    <button type="button" className={styles.back} onClick={onBack} aria-label="Назад к активам">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6" /></svg>Назад
    </button>
    {!asset ? <div className={styles.missing}>
      <h1 id={titleId}>Актив недоступен</h1>
      <p>В выбранных счетах нет этого актива.</p>
    </div> : <>
      <header className={styles.identity}>
        <span className={styles.symbol} aria-hidden="true">{asset.symbol.slice(0, 1)}</span>
        <div><h1 id={titleId} tabIndex={-1} data-mono-product-asset-title>{asset.name}</h1><span className={styles.ticker}>{asset.symbol}</span></div>
      </header>
      <div className={styles.balance}>
        <p className={styles.balanceLabel}>Общее количество</p>
        <div className={styles.quantity} role="group" aria-label={`Общее количество ${asset.symbol}`} data-unknown={!view.balanceHidden && total === null}>
          <bdi>{view.balanceHidden ? "••••" : total === null ? "Количество неизвестно" : formatQuantity(total)}</bdi>
          {(view.balanceHidden || total !== null) && <span>{asset.symbol}</span>}
        </div>
        <p className={styles.estimate}>{view.balanceHidden ? "Оценка скрыта" : `≈ ${formatFiatMinor(asset.fiatMinor)}`}</p>
      </div>

      <section className={styles.placements} aria-labelledby={placementsId}>
        <div className={styles.sectionHeading}><h2 id={placementsId}>Размещения</h2><span>{placements.length}</span></div>
        {!selected && <p className={styles.hint}>Выберите счёт и сеть для операции.</p>}
        {placements.length > 0 ? <div role="radiogroup" aria-labelledby={placementsId} className={styles.placementList}>
          {placements.map(holding => {
            const account = accounts.get(holding.accountId);
            const accountLabel = account?.label ?? "Счёт недоступен";
            const checked = holding.id === selected?.id;
            return <label key={holding.id} className={styles.placement} data-selected={checked}>
              <input type="radio" name={placementsId} value={holding.id} checked={checked}
                aria-label={`Выбрать размещение: ${accountLabel} · ${holding.networkLabel}`}
                onChange={() => onSelectHolding(holding.id)} />
              <span className={styles.selectionMark} aria-hidden="true"><svg viewBox="0 0 16 16"><path d="m4 8 3 3 5-6" /></svg></span>
              <span className={styles.placementContext}><strong>{accountLabel}</strong><span>{holding.networkLabel || "Сеть неизвестна"}</span></span>
              <span className={styles.placementValue}><bdi>{quantityLabel(holding.quantity, asset.symbol, view.balanceHidden)}</bdi></span>
            </label>;
          })}
        </div> : <p className={styles.hint}>В выбранной области размещений нет.</p>}
        {selected && <SelectedPlacement holding={selected} account={accounts.get(selected.accountId)} snapshot={view.snapshot}
          hidden={view.balanceHidden} onAction={onPlacementAction} />}
      </section>

      <div className={styles.history}>
        {view.activityStatus === "ready" && activities.length === 0 ? <section aria-labelledby={historyId}>
          <h2 id={historyId}>История операций</h2><p className={styles.empty}>По этому активу операций пока нет</p>
        </section> : <ProductHistory activities={activities} balanceHidden={view.balanceHidden}
          accountId={historyAccountId} accountLabel={historyAccountId ? accounts.get(historyAccountId)?.label : undefined}
          status={view.activityStatus} expandedActivityId={view.expandedActivityId}
          onExpandedActivityChange={onExpandActivity} onRetry={onRetryActivities} />}
      </div>
    </>}
  </section>;
}

function SelectedPlacement({ holding, account, snapshot, hidden, onAction }: {
  holding: ProductHolding;
  account: ProductAccount | undefined;
  snapshot: Readonly<ProductSnapshot>;
  hidden: boolean;
  onAction: ProductAssetWorkspaceProps["onPlacementAction"];
}) {
  const context = { kind: "account", accountId: holding.accountId } as const;
  const allows = (action: ProductPlacementAction) => resolveActionRoutes(snapshot, context, action).routes.some(route =>
    route.accountId === holding.accountId && route.assetId === holding.assetId && route.networkId === holding.networkId);
  const canSend = allows("send");
  const canReceive = allows("receive");
  const actions = (["receive", "send", "buy", "swap"] as const).filter(allows);
  const labels = { send: "Отправить", receive: "Получить", buy: "Купить", swap: "Обмен" } as const;
  const icons = { send: "M6 18 18 6M7 6h11v11", receive: "M18 6 6 18M6 7v11h11",
    buy: "M12 4v16M4 12h16", swap: "M4 8h16m-4-4 4 4-4 4M20 16H4m4-4-4 4 4 4" } as const;
  const explanation = !account || account.status === "unavailable" ? "Счёт недоступен. Операции пока недоступны."
    : account.status === "inactive" ? "Счёт не активирован. Операции недоступны."
      : !canSend && !canReceive ? "Для этого размещения отправка и получение недоступны."
        : !canSend ? "Для этого размещения отправка недоступна."
          : !canReceive ? "Для этого размещения получение недоступно." : null;

  return <div className={styles.selected}>
    <dl className={styles.available}>
      <div><dt>Доступно</dt><dd><span role="group" aria-label={`Доступное количество ${holding.symbol}`}>
        {quantityLabel(holding.availableQuantity, holding.symbol, hidden)}
      </span></dd></div>
    </dl>
    {actions.length > 0 && <div className={styles.actions} role="group" aria-label={`Операции: ${account?.label} · ${holding.networkLabel}`}>
      {actions.map(action =>
        <button key={action} type="button" className={styles.action}
          aria-label={`${labels[action]} ${holding.symbol} · ${account?.label} · ${holding.networkLabel}`}
          data-mono-product-placement-id={holding.id} data-mono-product-placement-action={action}
          onClick={() => onAction(holding.id, action)}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d={icons[action]} /></svg>
          {labels[action]}
        </button>)}
    </div>}
    {explanation && <p className={styles.hint}>{explanation}</p>}
  </div>;
}

function quantityLabel(value: string | undefined, symbol: string, hidden: boolean): string {
  if (hidden) return "••••";
  const quantity = value === undefined ? null : sumDecimalQuantities([value]);
  return quantity === null ? "Нет данных" : `${formatQuantity(quantity)} ${symbol}`;
}
