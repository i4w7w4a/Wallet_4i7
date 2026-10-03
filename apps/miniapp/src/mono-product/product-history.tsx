"use client";

import { useId, useLayoutEffect, useRef, useState } from "react";
import type { ProductActivity } from "./demo-activity";
import { scopeProductActivities } from "./product-activity-scope";
import { formatQuantity } from "./product-format";
import { OperationReceiptView } from "./operation-receipt-view";
import { HistoryDirectionIcon, HistoryStatusIcon } from "./history-direction-icon";
import { getHistoryPresentation } from "./history-presentation";
import { DEFAULT_HISTORY_FILTERS, HISTORY_QUERY_LIMIT, filterHistoryActivities, matchesHistoryFilters,
  type HistoryFilters } from "./history-filters";
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
const statusFilters = [
  { id: "all", label: "Все статусы" }, { id: "pending", label: "Ожидают" },
  { id: "completed", label: "Завершены" }, { id: "failed", label: "Ошибки" },
] as const;

export function ProductHistory({
  activities, balanceHidden, accountId, accountLabel,
  expandedActivityId, onExpandedActivityChange, status = "ready", onRetry,
}: ProductHistoryProps) {
  const titleId = useId();
  const detailIdPrefix = useId();
  const searchId = useId();
  const searchInput = useRef<HTMLInputElement>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [filters, setFilters] = useState<HistoryFilters>(DEFAULT_HISTORY_FILTERS);
  const [searchOpen, setSearchOpen] = useState(false);
  const [observedExternalId, setObservedExternalId] = useState(expandedActivityId);
  const [dismissedId, setDismissedId] = useState<string | null>(null);
  const scopedActivities = scopeProductActivities(activities, accountId === undefined ? undefined : [accountId]);
  const visibleActivities = filterHistoryActivities(scopedActivities, filters);
  const requestedId = expandedActivityId === undefined ? openId : expandedActivityId;
  const activeId = requestedId === dismissedId ? null : requestedId;
  const activeActivity = visibleActivities.find(activity => activity.id === activeId);

  // Consume a new external reveal before committing children; an unchanged controlled ID must not undo manual filters.
  if (expandedActivityId !== observedExternalId) {
    setObservedExternalId(expandedActivityId);
    setDismissedId(null);
    if (expandedActivityId != null && !visibleActivities.some(activity => activity.id === expandedActivityId)) {
      setFilters(DEFAULT_HISTORY_FILTERS);
    }
  }

  useLayoutEffect(() => {
    if (searchOpen) searchInput.current?.focus({ preventScroll: true });
  }, [searchOpen]);

  function changeExpandedActivity(id: string | null) {
    setDismissedId(id === null ? requestedId : null);
    if (expandedActivityId === undefined) setOpenId(id);
    onExpandedActivityChange?.(id);
  }
  function updateFilters(next: HistoryFilters) {
    setFilters(next);
    if (activeActivity && !matchesHistoryFilters(activeActivity, next)) changeExpandedActivity(null);
  }
  function clearSearch() {
    updateFilters({ ...filters, query: "" });
    searchInput.current?.focus({ preventScroll: true });
  }

  return <section className={`${styles.section} ${styles.historyPresentation}`} aria-labelledby={titleId}>
    <div className={styles.heading}>
      <h1 id={titleId}>История операций</h1>
    </div>
    <p className={styles.intro}>
      {accountId === undefined ? "Все счета" : accountLabel ?? "Выбранный счёт"} · примеры и симуляции
    </p>
    {status === "ready" && scopedActivities.length > 0 && <>
      <div className={styles.historyTools}>
        <button type="button" className={styles.historySearchToggle} aria-label="Поиск по операциям"
          aria-expanded={searchOpen} aria-controls={searchOpen ? searchId : undefined}
          aria-description={filters.query.trim() ? "Поисковый фильтр применён" : undefined} data-active={filters.query.trim().length > 0}
          onClick={() => setSearchOpen(value => !value)}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
            <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.4" />
            <path d="m10.5 10.5 3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          <span>Поиск</span>
        </button>
        <select className={styles.historyStatusFilter} aria-label="Статус операций" value={filters.status}
          data-active={filters.status !== "all"}
          onChange={event => updateFilters({ ...filters, status: event.target.value as HistoryFilters["status"] })}>
          {statusFilters.map(filter => <option key={filter.id} value={filter.id}>{filter.label}</option>)}
        </select>
      </div>
      {searchOpen && <div className={styles.historySearchField}>
        <label className={styles.historySearchLabel} htmlFor={searchId}>Валюта, сеть или счёт</label>
        <input id={searchId} ref={searchInput} type="search" value={filters.query} maxLength={HISTORY_QUERY_LIMIT}
          placeholder="Валюта, сеть или счёт" autoComplete="off" spellCheck={false}
          onChange={event => updateFilters({ ...filters, query: event.target.value.slice(0, HISTORY_QUERY_LIMIT) })}
          onKeyDown={event => {
            if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); clearSearch(); }
          }} />
        {filters.query.length > 0 && <button type="button" className={styles.historySearchClear} aria-label="Очистить поиск" onClick={clearSearch}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
            <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </button>}
      </div>}
      <div className={styles.directionFilters} role="group" aria-label="Направление операций">
        {directionFilters.map(filter => <button key={filter.id} type="button" data-direction-filter={filter.id}
          aria-pressed={filters.direction === filter.id}
          onClick={() => updateFilters({ ...filters, direction: filter.id })}>{filter.label}</button>)}
      </div>
    </>}
    {status === "loading" ? <p className={styles.empty} role="status">Загружаем операции…</p> :
      status === "error" ? <div className={styles.historyState}>
        <p role="alert">Не удалось загрузить операции.</p>
        {onRetry && <button type="button" className={styles.retryButton} onClick={onRetry}>Повторить</button>}
      </div> :
      scopedActivities.length === 0 ? <p className={styles.empty}>Для этого счёта операций пока нет.</p> :
      visibleActivities.length === 0 ? <div className={styles.filterEmpty}>
        <p>Нет совпадений</p>
        <button type="button" onClick={() => updateFilters(DEFAULT_HISTORY_FILTERS)}>Сбросить фильтры</button>
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
