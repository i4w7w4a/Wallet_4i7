import { useEffect, useId, useRef, type ReactNode } from "react";
import { MonoLabIconButton } from "../../mono-preview/mono-lab-controls";
import styles from "../mono-atmosphere-lab.module.css";

export function SandboxDialog({ title, children, close, busy = false }: { title: string; children: ReactNode; close(): void; busy?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    (ref.current?.querySelector<HTMLElement>("[data-initial-focus]") ??
      ref.current?.querySelector<HTMLElement>('input, textarea, button:not([aria-label="Закрыть диалог"])') ?? ref.current)?.focus();
  }, []);
  return <div className={styles.scrim} onClick={event => { if (event.target === event.currentTarget && !busy) close(); }}>
    <div ref={ref} className={styles.modal} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
      onKeyDown={event => {
        if (event.key === "Escape" && !busy) { event.preventDefault(); event.stopPropagation(); close(); }
        if (event.key === "Tab") {
          const targets = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')];
          const first = targets[0], last = targets.at(-1);
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
      }}>
      <div className={styles.modalHeading}><h2 id={titleId}>{title}</h2><MonoLabIconButton label="Закрыть диалог" disabled={busy} onClick={close}>×</MonoLabIconButton></div>
      {children}
    </div>
  </div>;
}
