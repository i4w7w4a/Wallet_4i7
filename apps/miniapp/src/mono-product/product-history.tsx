"use client";

import { useId, useState } from "react";
import { getProductActivityLabels, type ProductActivity } from "./demo-activity";
import { formatQuantity } from "./product-format";
import { OperationReceiptView } from "./operation-receipt-view";
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

export function ProductHistory({
  activities, balanceHidden, accountId, accountLabel,
  expandedActivityId, onExpandedActivityChange, status = "ready", onRetry,
}: ProductHistoryProps) {
  const titleId = useId();
  const detailIdPrefix = useId();
  const [openId, setOpenId] = useState<string | null>(null);
  const activeId = expandedActivityId === undefined ? openId : expandedActivityId;
  const visibleActivities = accountId === undefined
    ? activities
    : activities.filter((activity) => activity.accountId === accountId);

  function changeExpandedActivity(id: string | null) {
    if (expandedActivityId === undefined) setOpenId(id);
    onExpandedActivityChange?.(id);
  }

  return <section className={styles.section} aria-labelledby={titleId}>
    <div className={styles.heading}>
      <h1 id={titleId}>История операций</h1>
      <span className={styles.demoBadge}>Демо</span>
    </div>
    <p className={styles.intro}>
      {accountId === undefined ? "Все счета" : accountLabel ?? "Выбранный счёт"} · примеры и симуляции
    </p>
    {status === "loading" ? <p className={styles.empty} role="status">Загружаем операции…</p> :
      status === "error" ? <div className={styles.historyState}>
        <p role="alert">Не удалось загрузить операции.</p>
        {onRetry && <button type="button" className={styles.retryButton} onClick={onRetry}>Повторить</button>}
      </div> :
      visibleActivities.length === 0 ? <p className={styles.empty}>Для этого счёта операций пока нет.</p> :
      <ol className={styles.rows}>
        {visibleActivities.map((activity, index) => {
          const expanded = activeId === activity.id;
          const detailsId = `${detailIdPrefix}-operation-${index}`;
          const { directionLabel, statusLabel } = getProductActivityLabels(activity);
          const quantity = balanceHidden ? "••••" : formatQuantity(activity.quantity);
          const occurredAt = new Date(activity.occurredAt);
          const validTime = !Number.isNaN(occurredAt.getTime());
          const networkLabel = activity.networkLabel?.trim() || "Сеть не указана";
          const accessibleQuantity = balanceHidden ? "Сумма скрыта" : `${quantity} ${activity.assetSymbol}`;
          return <li className={styles.row} key={activity.id} data-status={activity.status} data-mode={activity.mode ?? "example"}>
            <button type="button" className={styles.rowButton} aria-expanded={expanded}
              aria-label={`${directionLabel} · ${activity.assetSymbol} · ${networkLabel}, ${statusLabel}, ${accessibleQuantity}`}
              aria-controls={detailsId} onClick={() => changeExpandedActivity(expanded ? null : activity.id)}>
              <span className={styles.directionMark} aria-hidden="true">{activity.direction === "incoming" ? "↓" : "↑"}</span>
              <span className={styles.rowIdentity}>
                <strong>{directionLabel}</strong>
                <span className={styles.rowMeta}>
                  <small className={styles.status} data-status={activity.status}>
                    <span className={styles.statusMark} aria-hidden="true">{activity.status === "completed" ? "✓" : activity.status === "failed" ? "×" : "·"}</span>
                    <span>{statusLabel}</span>
                  </small>
                  <time className={styles.rowDate} dateTime={validTime ? activity.occurredAt : undefined}>
                    {validTime ? rowDateFormat.format(occurredAt) : "Время не указано"}
                  </time>
                </span>
              </span>
              <span className={styles.rowAmount}>
                <strong>{quantity}</strong>
                <small className={styles.rowAssetMeta}><span>{activity.assetSymbol}</span><span aria-hidden="true">·</span><span>{networkLabel}</span></small>
              </span>
              <svg className={styles.rowChevron} viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="m6 4 4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <div className={styles.receiptDetails} id={detailsId} hidden={!expanded}>
              {expanded && <OperationReceiptView activity={activity} balanceHidden={balanceHidden} />}
            </div>
          </li>;
        })}
      </ol>}
  </section>;
}
