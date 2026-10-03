"use client";

import { useId } from "react";
import { getProductActivityLabels, type ProductActivity } from "./demo-activity";
import { formatQuantity } from "./product-format";
import styles from "./product-account-sections.module.css";

export type ProductRecentActivityProps = {
  activities: readonly ProductActivity[];
  balanceHidden: boolean;
  accountId?: string;
  onOpenActivity(id: string): void;
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

  const { directionLabel, statusLabel } = getProductActivityLabels(latest);
  const quantity = balanceHidden ? "••••" : formatQuantity(latest.quantity);
  const accessibleQuantity = balanceHidden ? "Сумма скрыта" : `${quantity} ${latest.assetSymbol}`;

  return <section className={`${styles.section} ${styles.recentActivity}`} aria-labelledby={titleId}>
    <div className={styles.recentHeading}>
      <h2 id={titleId}>Последняя операция</h2>
      <span className={styles.demoBadge}>Демо</span>
    </div>
    <button type="button" className={`${styles.rowButton} ${styles.recentButton}`}
      aria-label={`Открыть операцию: ${directionLabel} · ${latest.assetSymbol}, ${statusLabel}, ${accessibleQuantity}`}
      onClick={() => onOpenActivity(latest.id)}>
      <span className={styles.directionMark} aria-hidden="true">{latest.direction === "incoming" ? "↓" : "↑"}</span>
      <span className={styles.rowIdentity}>
        <strong>{directionLabel}</strong>
        <small className={styles.status} data-status={latest.status}>
          <span className={styles.statusMark} aria-hidden="true">{latest.status === "completed" ? "✓" : latest.status === "failed" ? "×" : "·"}</span>
          <span>{statusLabel}</span>
        </small>
      </span>
      <span className={styles.rowAmount}>
        <strong>{quantity}</strong>
        <small>{latest.assetSymbol}</small>
      </span>
      <svg className={styles.recentChevron} viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="m6 4 4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  </section>;
}
