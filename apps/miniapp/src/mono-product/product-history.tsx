"use client";

import { useId, useState } from "react";
import type { ProductActivity } from "./demo-activity";
import { scopeProductActivities } from "./product-activity-scope";
import { formatQuantity } from "./product-format";
import { OperationReceiptView } from "./operation-receipt-view";
import { HistoryDirectionIcon, HistoryStatusIcon } from "./history-direction-icon";
import { getHistoryPresentation } from "./history-presentation";
import styles from "./product-account-sections.module.css";

export type ProductHistoryProps = {
  activities: readonly ProductActivity[];
  balanceHidden: boolean;
  accountId?: string;
  accountLabel?: string;
  expandedActivityId?: string | null;
  onExpandedActivityChange?(id: string | null): void;
  status?: "ready" | "loading" | "error";
  onRetry?(): void;
};

const rowDateFormat = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric", month: "short", timeZone: "UTC",
});
const directionFilters = [
  { id: "all", label: "Все" }, { id: "incoming", label: "Получения" }, { id: "outgoing", label: "Отправки" },
] as const;
type DirectionFilter = typeof directionFilters[number]["id"];

export function ProductHistory({
  activities, balanceHidden, accountId, accountLabel,
  expandedActivityId, onExpandedActivityChange, status = "ready", onRetry,
}: ProductHistoryProps) {
  const titleId = useId();
  const detailIdPrefix = useId();
  const [openId, setOpenId] = useState<string | null>(null);
  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>("all");
  const activeId = expandedActivityId === undefined ? openId : expandedActivityId;
  const scopedActivities = scopeProductActivities(activities, accountId === undefined ? undefined : [accountId]);
  const activeActivity = scopedActivities.find(activity => activity.id === activeId);
  // An externally selected activity must be visible on the first render, even after another filter.
  const effectiveFilter = activeActivity && directionFilter !== "all" && activeActivity.direction !== directionFilter
    ? "all" : directionFilter;
  const visibleActivities = effectiveFilter === "all" ? scopedActivities
    : scopedActivities.filter(activity => activity.direction === effectiveFilter);

  function changeExpandedActivity(id: string | null) {
    if (expandedActivityId === undefined) setOpenId(id);
    onExpandedActivityChange?.(id);
  }
  function selectDirection(next: DirectionFilter) {
    setDirectionFilter(next);
    if (activeActivity && next !== "all" && activeActivity.direction !== next) changeExpandedActivity(null);
  }

  return <section className={`${styles.section} ${styles.historyPresentation}`} aria-labelledby={titleId}>
    <div className={styles.heading}>
      <h1 id={titleId}>История операций</h1>
    </div>
    <p className={styles.intro}>
      {accountId === undefined ? "Все счета" : accountLabel ?? "Выбранный счёт"} · примеры и симуляции
    </p>
    {status === "ready" && scopedActivities.length > 0 && <div className={styles.directionFilters} role="group" aria-label="Направление операций">
      {directionFilters.map(filter => <button key={filter.id} type="button" data-direction-filter={filter.id}
        aria-pressed={effectiveFilter === filter.id} onClick={() => selectDirection(filter.id)}>{filter.label}</button>)}
    </div>}
    {status === "loading" ? <p className={styles.empty} role="status">Загружаем операции…</p> :
      status === "error" ? <div className={styles.historyState}>
        <p role="alert">Не удалось загрузить операции.</p>
        {onRetry && <button type="button" className={styles.retryButton} onClick={onRetry}>Повторить</button>}
      </div> :
      scopedActivities.length === 0 ? <p className={styles.empty}>Для этого счёта операций пока нет.</p> :
      visibleActivities.length === 0 ? <div className={styles.filterEmpty}>
        <p>{effectiveFilter === "incoming" ? "Получений пока нет" : "Отправок пока нет"}</p>
        <button type="button" onClick={() => selectDirection("all")}>Показать все</button>
      </div> :
      <ol className={`${styles.rows} ${styles.historyRows}`}>
        {visibleActivities.map(activity => {
          const expanded = activeId === activity.id;
          const detailsId = `${detailIdPrefix}-operation-${encodeURIComponent(activity.id)}`;
          const { directionLabel, statusLabel, accessibleStatusLabel } = getHistoryPresentation(activity);
          const quantity = balanceHidden ? "••••" : formatQuantity(activity.quantity);
          const occurredAt = new Date(activity.occurredAt);
          const validTime = !Number.isNaN(occurredAt.getTime());
          const networkLabel = activity.networkLabel?.trim() || "Сеть не указана";
          const accessibleQuantity = balanceHidden ? "Сумма скрыта" : `${quantity} ${activity.assetSymbol}`;
          return <li className={styles.row} key={activity.id} data-direction={activity.direction}
            data-status={activity.status} data-mode={activity.mode ?? "example"} data-expanded={expanded}>
            <button type="button" className={`${styles.rowButton} ${styles.historyRowButton}`} aria-expanded={expanded}
              data-history-interactive data-product-activity-id={activity.id} data-direction={activity.direction} data-status={activity.status}
              aria-label={`${directionLabel} · ${activity.assetSymbol} · ${networkLabel}, ${accessibleStatusLabel}, ${accessibleQuantity}`}
              aria-controls={detailsId} onClick={() => changeExpandedActivity(expanded ? null : activity.id)}>
              <HistoryDirectionIcon direction={activity.direction} status={activity.status} />
              <span className={styles.rowIdentity}>
                <strong>{directionLabel}</strong>
                <small className={styles.historyNetwork}>{networkLabel}</small>
              </span>
              <span className={`${styles.rowMeta} ${styles.historyRowMeta}`}>
                <small className={styles.status} data-status={activity.status}>
                  <HistoryStatusIcon status={activity.status} />
                  <span>{statusLabel}</span>
                </small>
                <time className={styles.rowDate} dateTime={validTime ? activity.occurredAt : undefined}>
                  {validTime ? rowDateFormat.format(occurredAt) : "Время не указано"}
                </time>
              </span>
              <span className={styles.rowAmount}>
                <strong>{quantity}</strong>
                <small>{activity.assetSymbol}</small>
              </span>
              <svg className={styles.rowChevron} viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="m6 4 4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <div className={styles.receiptDetails} id={detailsId} hidden={!expanded}>
              {expanded && <OperationReceiptView activity={activity} balanceHidden={balanceHidden} showStatusHeading={false} />}
            </div>
          </li>;
        })}
      </ol>}
  </section>;
}
