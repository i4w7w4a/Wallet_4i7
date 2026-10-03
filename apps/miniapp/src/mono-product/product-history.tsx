"use client";

import { useId, useState } from "react";
import type { ProductActivity } from "./demo-activity";
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

const STATUS_LABEL: Record<ProductActivity["status"], string> = {
  pending: "В обработке",
  completed: "Выполнено",
  failed: "Не выполнено",
};

const dateFormat = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

function formatOccurredAt(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "Время не указано" : dateFormat.format(date);
}

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
      <div>
        <p className={styles.eyebrow}>ОПЕРАЦИИ / DEMO</p>
        <h1 id={titleId}>История операций</h1>
      </div>
      <span className={styles.demoBadge}>Демо</span>
    </div>
    <p className={styles.intro}>
      {accountId === undefined ? "Все счета" : accountLabel ?? "Выбранный счёт"} · примеры состояний, не история переводов
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
          return <li className={styles.row} key={activity.id} data-status={activity.status}>
            <button type="button" className={styles.rowButton} aria-expanded={expanded}
              aria-controls={detailsId} onClick={() => changeExpandedActivity(expanded ? null : activity.id)}>
              <span className={styles.directionMark} aria-hidden="true">{activity.direction === "incoming" ? "↓" : "↑"}</span>
              <span className={styles.rowIdentity}>
                <strong>{activity.direction === "incoming" ? "Получение" : "Отправка"} · {activity.assetSymbol}</strong>
                <small className={styles.status} data-status={activity.status}>{STATUS_LABEL[activity.status]}</small>
              </span>
              <span className={styles.rowAmount}>
                <strong>{balanceHidden ? "••••" : activity.quantity} <span>{activity.assetSymbol}</span></strong>
                <small aria-hidden="true">{expanded ? "−" : "+"}</small>
              </span>
            </button>
            <div className={styles.details} id={detailsId} hidden={!expanded}>
              {expanded && <>
              <div><span>Направление</span><strong>{activity.direction === "incoming" ? "Входящая" : "Исходящая"}</strong></div>
              <div><span>Статус</span><strong>{STATUS_LABEL[activity.status]}</strong></div>
              <div><span>Количество</span><strong>{balanceHidden ? "••••" : activity.quantity} {activity.assetSymbol}</strong></div>
              <div><span>Сеть</span><strong>{activity.networkLabel}</strong></div>
              <div><span>Счёт</span><strong>{activity.accountLabel}</strong></div>
              <div><span>Время</span><strong>{formatOccurredAt(activity.occurredAt)}</strong></div>
              <div><span>Комиссия</span><strong>{activity.feeLabel ? balanceHidden ? "••••" : activity.feeLabel : "Комиссия не указана"}</strong></div>
              </>}
            </div>
          </li>;
        })}
      </ol>}
  </section>;
}
