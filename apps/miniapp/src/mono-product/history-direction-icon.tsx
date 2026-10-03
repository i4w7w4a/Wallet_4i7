import styles from "./history-direction-icon.module.css";

type HistoryDirection = "incoming" | "outgoing";
type HistoryStatus = "pending" | "completed" | "failed";

export type HistoryDirectionIconProps = {
  direction: HistoryDirection;
  status: HistoryStatus;
};

export function HistoryDirectionIcon({ direction, status }: HistoryDirectionIconProps) {
  return <span className={styles.icon} data-history-direction-icon={direction} data-status={status} aria-hidden="true">
    <svg className={styles.artwork} width="38" height="38" viewBox="0 0 40 40" fill="none"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {direction === "incoming" ? <>
        <path className={styles.surface}
          d="M6.8 23.1h6.6l3 3.5h7.2l3-3.5h6.6v7.1a3.6 3.6 0 0 1-3.6 3.6H10.4a3.6 3.6 0 0 1-3.6-3.6z" />
        <path className={styles.depth} transform="translate(0 1)"
          d="M6.8 23.1v7.1a3.6 3.6 0 0 0 3.6 3.6h19.2a3.6 3.6 0 0 0 3.6-3.6v-7.1" />
        <path className={styles.contour}
          d="M6.8 23.1v7.1a3.6 3.6 0 0 0 3.6 3.6h19.2a3.6 3.6 0 0 0 3.6-3.6v-7.1" />
        <path className={styles.rim}
          d="m6.8 23.1 2.4-4.7h3.2m15.2 0h3.2l2.4 4.7M6.8 23.1h6.6l3 3.5h7.2l3-3.5h6.6" />
        <path className={styles.inset} d="M10.7 30.7h18.6" />
        <g className={styles.travel}>
          <path className={styles.depth} transform="translate(0 1)" d="M20 6.2v16.2m-5.3-5.3 5.3 5.3 5.3-5.3" />
          <path className={styles.direction} d="M20 6.2v16.2m-5.3-5.3 5.3 5.3 5.3-5.3" />
          <path className={styles.highlight} d="M19.7 6.6v7.1" />
        </g>
      </> : <>
        <path className={styles.surface} d="M17.8 9.9A12.1 12.1 0 1 0 29.9 22" />
        <path className={styles.depth} transform="translate(0 1)" d="M17.8 9.9A12.1 12.1 0 1 0 29.9 22" />
        <path className={styles.contour} d="M17.8 9.9A12.1 12.1 0 1 0 29.9 22" />
        <path className={styles.inset} d="M11.1 28.7a9.5 9.5 0 0 0 11.7 1.6" />
        <g className={styles.travel}>
          <path className={styles.depth} transform="translate(0 1)" d="m17.2 23 16.8-16.8m-8.5 0H34v8.5" />
          <path className={styles.direction} d="m17.2 23 16.8-16.8m-8.5 0H34v8.5" />
          <path className={styles.highlight} d="M27 5.9h6.5" />
        </g>
      </>}
    </svg>
  </span>;
}

export function HistoryStatusIcon({ status }: { status: HistoryStatus }) {
  return <svg className={styles.statusIcon} data-history-status-icon={status} width="12" height="12"
    viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {status === "completed" ? <path d="m3.2 8.1 3 3.1 6.6-6.5" /> :
      status === "pending" ? <>
        <circle cx="8" cy="8" r="5.7" />
        <path d="M8 4.5V8l2.4 1.5" />
      </> : <>
        <circle cx="8" cy="8" r="5.7" />
        <path d="M8 4.5v3.8" />
        <circle cx="8" cy="10.9" r="0.8" fill="currentColor" stroke="none" />
      </>}
  </svg>;
}
