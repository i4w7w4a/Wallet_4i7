"use client";

import { useId, useLayoutEffect, useRef, type ReactNode } from "react";
import styles from "../product-profile.module.css";

/** Inline navigation boundary. Escape stays local; it must not close the containing Menu. */
export function ProfilePanel({ title, children, onBack, onClose = onBack, backLabel = "Назад в профиль", focusBack = true }: {
  title: string; children: ReactNode; onBack(): void; onClose?(): void; backLabel?: string; focusBack?: boolean;
}) {
  const titleId = useId();
  const backRef = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => { if (focusBack) backRef.current?.focus({ preventScroll: true }); }, [focusBack]);
  return <section className={styles.panel} aria-labelledby={titleId} data-profile-panel onKeyDown={event => {
    if (event.key !== "Escape") return;
    event.preventDefault(); event.stopPropagation(); onClose();
  }}>
    <div className={styles.panelNavigation}>
      <button type="button" ref={backRef} className={styles.textAction} onClick={onBack} aria-label={backLabel}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
          <path d="m14 6-6 6 6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg><span>{backLabel}</span>
      </button>
      <button type="button" className={styles.iconAction} aria-label="Закрыть" onClick={onClose}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
          <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </button>
    </div>
    <h2 className={styles.panelTitle} id={titleId}>{title}</h2>
    {children}
  </section>;
}
