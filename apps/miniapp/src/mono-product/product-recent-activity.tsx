"use client";

import { useId } from "react";
import type { ProductActivity } from "./demo-activity";
import { formatQuantity } from "./product-format";
import { HistoryDirectionIcon, HistoryStatusIcon } from "./history-direction-icon";
import { getHistoryPresentation } from "./history-presentation";
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

  const { directionLabel, statusLabel, accessibleStatusLabel } = getHistoryPresentation(latest);
  const quantity = balanceHidden ? "••••" : formatQuantity(latest.quantity);
  const accessibleQuantity = balanceHidden ? "Сумма скрыта" : `${quantity} ${latest.assetSymbol}`;
  const networkLabel = latest.networkLabel?.trim() || "Сеть не указана";

  return <section className={`${styles.section} ${styles.recentActivity}`} aria-labelledby={titleId}>
    <div className={styles.recentHeading}>
      <h2 id={titleId}>Последняя операция</h2>
    </div>
    <button type="button" className={`${styles.rowButton} ${styles.historyRowButton} ${styles.recentButton}`}
      data-history-interactive data-product-activity-id={latest.id} data-direction={latest.direction} data-status={latest.status}
      aria-label={`Открыть операцию: ${directionLabel} · ${latest.assetSymbol} · ${networkLabel}, ${accessibleStatusLabel}, ${accessibleQuantity}`}
      onClick={() => onOpenActivity(latest.id)}>
      <HistoryDirectionIcon direction={latest.direction} status={latest.status} />
      <span className={styles.rowIdentity}>
        <strong>{directionLabel}</strong>
        <small className={styles.historyNetwork}>{networkLabel}</small>
      </span>
      <span className={`${styles.rowMeta} ${styles.historyRowMeta}`}>
        <small className={styles.status} data-status={latest.status}>
          <HistoryStatusIcon status={latest.status} />
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
