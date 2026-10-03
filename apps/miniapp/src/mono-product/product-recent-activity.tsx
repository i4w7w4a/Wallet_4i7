"use client";

import { useId } from "react";
import type { ProductActivity } from "./demo-activity";
import styles from "./product-account-sections.module.css";

export type ProductRecentActivityProps = {
  activities: readonly ProductActivity[];
  balanceHidden: boolean;
  accountId?: string;
  onOpenActivity(id: string): void;
};

const STATUS_LABEL: Record<ProductActivity["status"], string> = {
  pending: "В обработке",
  completed: "Выполнено",
  failed: "Не выполнено",
};

function occurredAtTime(activity: ProductActivity): number {
  const time = Date.parse(activity.occurredAt);
  return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time;
}

export function ProductRecentActivity({ activities, balanceHidden, accountId, onOpenActivity }: ProductRecentActivityProps) {
  const titleId = useId();
  const latest = activities
    .filter((activity) => accountId === undefined || activity.accountId === accountId)
    .sort((left, right) => {
      const leftTime = occurredAtTime(left);
      const rightTime = occurredAtTime(right);
      return leftTime === rightTime ? 0 : rightTime - leftTime;
    })[0];

  if (!latest) return null;

  const directionLabel = latest.direction === "incoming" ? "Получение" : "Отправка";
  const quantity = balanceHidden ? "••••" : latest.quantity;
  const accessibleQuantity = balanceHidden ? "Сумма скрыта" : `${latest.quantity} ${latest.assetSymbol}`;

  return <section className={`${styles.section} ${styles.recentActivity}`} aria-labelledby={titleId}>
    <div className={styles.recentHeading}>
      <h2 id={titleId}>Последняя операция</h2>
      <span className={styles.demoBadge}>Демо</span>
    </div>
    <button type="button" className={`${styles.rowButton} ${styles.recentButton}`}
      aria-label={`Открыть операцию: ${directionLabel} · ${latest.assetSymbol}, ${STATUS_LABEL[latest.status]}, ${accessibleQuantity}`}
      onClick={() => onOpenActivity(latest.id)}>
      <span className={styles.directionMark} aria-hidden="true">{latest.direction === "incoming" ? "↓" : "↑"}</span>
      <span className={styles.rowIdentity}>
        <strong>{directionLabel} · {latest.assetSymbol}</strong>
        <small className={styles.status} data-status={latest.status}>{STATUS_LABEL[latest.status]}</small>
      </span>
      <span className={styles.rowAmount}>
        <strong>{quantity} <span>{latest.assetSymbol}</span></strong>
      </span>
      <svg className={styles.recentChevron} viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="m6 4 4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  </section>;
}
