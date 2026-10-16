"use client";

import { useId, useState } from "react";
import { productActivityCryptoLegs, type ProductActivity } from "./demo-activity";
import { CurrencyLogo } from "./currency-logo";
import { getHistoryPresentation } from "./history-presentation";
import { selectPendingActivityIds, type PendingActivityOpenResult } from "./pending-activity";
import { scopeProductActivities } from "./product-activity-scope";
import styles from "./product-pending-activity.module.css";

function getPendingMetadata(activity: ProductActivity) {
  const { directionLabel, assetLabel, networkLabel } = getHistoryPresentation(activity, true);
  const legs = productActivityCryptoLegs(activity);
  const internal = activity.internalTransfer;
  const accountLabels = internal
    ? [internal.sourceAccountLabel, internal.destinationAccountLabel]
    : legs.length
      ? legs.filter((leg, index) => legs.findIndex(candidate => candidate.accountId === leg.accountId) === index)
        .map(leg => leg.accountLabel)
      : [activity.accountLabel];
  return {
    directionLabel, assetLabel, networkLabel,
    accountLabel: accountLabels.map(label => label.trim() || "Счёт не указан").join(" → "),
    logoIds: [...new Set(legs.length ? legs.map(leg => leg.assetId) : [activity.assetId ?? ""])],
    internal: Boolean(internal),
  };
}

export function ProductPendingActivity({ activities, accountId, status, disabled = false, onOpen, onRetry }: {
  activities: readonly ProductActivity[];
  accountId?: string;
  status: "ready" | "loading" | "error";
  disabled?: boolean;
  onOpen(activityId: string | null): PendingActivityOpenResult;
  onRetry?(): void;
}) {
  const noteId = useId();
  const [unavailableSource, setUnavailableSource] = useState<readonly ProductActivity[] | null>(null);
  const scopedActivities = accountId === undefined ? activities : scopeProductActivities(activities, [accountId]);
  const ids = status === "ready" ? selectPendingActivityIds(scopedActivities) : null;
  if (status === "loading") return <p className={styles.state} role="status">Проверяем операции…</p>;
  if (status === "error" || ids === null || unavailableSource === activities) return <div className={styles.unavailable}>
    <p className={styles.state} role="status">Операции сейчас недоступны</p>
    {onRetry && <button type="button" className={styles.retry} disabled={disabled}
      onClick={() => { setUnavailableSource(null); onRetry(); }}>Повторить</button>}
  </div>;
  if (ids.length === 0) return null;
  // A repeated ID can contribute to the count, but cannot identify a particular record.
  const metadata = ids.map(id => {
    const matches = scopedActivities.filter(activity => activity.id === id);
    return matches.length === 1 && activities.filter(activity => activity.id === id).length === 1
      ? getPendingMetadata(matches[0]!) : null;
  });
  const single = ids.length === 1 ? metadata[0] : null;
  const recognized = metadata.filter(item => item !== null);
  const assetLabels = [...new Set(recognized.map(item => item.assetLabel))];
  const shownLabels = assetLabels.slice(0, 2);
  const shown = recognized.filter(item => shownLabels.includes(item.assetLabel));
  const networks = [...new Set(shown.map(item => item.networkLabel))];
  const recognizer = ids.length === 1
    ? single ? `${single.directionLabel}${single.internal ? " · " : " "}${single.assetLabel}` : "Сведения операции недоступны"
    : [...shownLabels, ...(assetLabels.length > 2 || recognized.length < ids.length ? ["…"] : [])].join(" · ");
  const context = ids.length === 1
    ? single ? `${single.networkLabel} · ${single.accountLabel}` : null
    : [...networks.slice(0, 2), ...(networks.length > 2 ? ["…"] : [])].join(" · ") || null;
  const logoIds = ids.length === 1 ? single?.logoIds ?? [""]
    : [...new Set(shown.flatMap(item => item.logoIds))].slice(0, 2);
  const recognizerId = `${noteId}-recognizer`, contextId = `${noteId}-context`;
  return <button type="button" className={styles.entry} data-product-pending-trigger disabled={disabled}
    aria-label={`В процессе · ${ids.length}`} aria-describedby={[recognizerId, ...(context ? [contextId] : []), noteId].join(" ")}
    onClick={() => { if (onOpen(ids.length === 1 ? ids[0]! : null) === "unavailable") setUnavailableSource(activities); }}>
    <span className={styles.logos}>
      {(logoIds.length ? logoIds : [""]).map(assetId => <CurrencyLogo key={assetId} assetId={assetId} className={styles.logo} />)}
    </span>
    <span className={styles.copy}>
      <span className={styles.headline}><strong>В процессе · {ids.length}</strong><span className={styles.demo} aria-hidden="true">Демо</span></span>
      <span className={styles.recognizer} id={recognizerId}>{recognizer}</span>
      {context && <span className={styles.context} id={contextId}>{context}</span>}
      <span id={noteId} hidden>Примеры и симуляции</span>
    </span>
    <svg className={styles.chevron} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="m6 4 4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </button>;
}
