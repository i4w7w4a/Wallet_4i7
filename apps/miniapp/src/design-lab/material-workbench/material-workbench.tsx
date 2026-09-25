"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import styles from "./material-workbench.module.css";

export type MaterialWorkbenchProps = {
  activeLab: "background" | "buttons";
  title: string;
  status: string;
  toolbar: ReactNode;
  left: ReactNode;
  right: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  modalOpen?: boolean;
};

type Drawer = "left" | "right" | null;
const COMPACT_QUERY = "(max-width: 980px)";
const FOCUSABLE = 'a[href], button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), summary, [tabindex]:not([tabindex="-1"])';

function compactSnapshot() { return typeof window !== "undefined" && !!window.matchMedia?.(COMPACT_QUERY).matches; }
function subscribeCompact(change: () => void) {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const query = window.matchMedia(COMPACT_QUERY);
  query.addEventListener("change", change);
  return () => query.removeEventListener("change", change);
}
function focusable(panel: HTMLElement) {
  return [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(node => {
    if (node.closest("[hidden], [inert]")) return false;
    const closed = node.closest("details:not([open])");
    if (closed && !closed.querySelector(":scope > summary")?.contains(node)) return false;
    for (let ancestor: HTMLElement | null = node; ancestor && panel.contains(ancestor); ancestor = ancestor.parentElement) {
      const appearance = window.getComputedStyle(ancestor);
      if (appearance.display === "none" || appearance.visibility === "hidden") return false;
    }
    return true;
  });
}

export function MaterialWorkbench({ activeLab, title, status, toolbar, left, right, children, footer, modalOpen = false }: MaterialWorkbenchProps) {
  const compact = useSyncExternalStore(subscribeCompact, compactSnapshot, () => false);
  const [drawer, setDrawer] = useState<Drawer>(null);
  const open = compact && !modalOpen ? drawer : null;
  const id = useId();
  const leftRef = useRef<HTMLElement>(null);
  const rightRef = useRef<HTMLElement>(null);
  const leftLauncher = useRef<HTMLButtonElement>(null);
  const rightLauncher = useRef<HTMLButtonElement>(null);
  const focusPending = useRef<Drawer>(null);
  const closeDrawer = useCallback((side: "left" | "right") => {
    setDrawer(null);
    (side === "left" ? leftLauncher.current : rightLauncher.current)?.focus();
  }, []);

  useEffect(() => {
    if (compact) return;
    let active = true;
    queueMicrotask(() => { if (active) setDrawer(null); });
    return () => { active = false; };
  }, [compact]);

  useLayoutEffect(() => {
    if (!open || focusPending.current !== open) return;
    focusPending.current = null;
    const panel = open === "left" ? leftRef.current : rightRef.current;
    (panel && focusable(panel)[0] || panel)?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const panel = open === "left" ? leftRef.current : rightRef.current;
    if (!panel) return;
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault(); event.stopPropagation();
        closeDrawer(open);
      } else if (event.key === "Tab") {
        const options = focusable(panel);
        const first = options[0], last = options.at(-1);
        if (!first || !last) { event.preventDefault(); panel.focus(); return; }
        if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) {
          event.preventDefault(); last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) {
          event.preventDefault(); first.focus();
        }
      }
    };
    window.addEventListener("keydown", keydown, true);
    return () => window.removeEventListener("keydown", keydown, true);
  }, [open, closeDrawer]);

  const leftClosed = compact && open !== "left";
  const rightClosed = compact && open !== "right";
  return <div className={styles.root} data-material-workbench data-active-lab={activeLab}>
    <header className={styles.header}>
      <nav className={styles.nav} aria-label="Мастерские материалов">
        <a href="/design-lab">Lab</a>
        <a href="/design-lab/atmosphere" aria-current={activeLab === "background" ? "page" : undefined}>Фоны</a>
        <a href="/design-lab/buttons" aria-current={activeLab === "buttons" ? "page" : undefined}>Кнопки</a>
      </nav>
      <div className={styles.identity}><h1 title={title}>{title}</h1><span role="status" data-save-status={status}>{status}</span></div>
      <div className={styles.toolbar} role="toolbar" aria-label="Действия пробы">{toolbar}</div>
      <div className={styles.launchers}>
        <button ref={leftLauncher} type="button" aria-label="Материалы" aria-controls={`${id}-left`}
          aria-expanded={open === "left"} disabled={modalOpen} onClick={() => {
            if (open === "left") closeDrawer("left");
            else { focusPending.current = "left"; setDrawer("left"); }
          }}>
          <span aria-hidden="true">▤</span></button>
        <button ref={rightLauncher} type="button" aria-label="Настройки" aria-controls={`${id}-right`}
          aria-expanded={open === "right"} disabled={modalOpen} onClick={() => {
            if (open === "right") closeDrawer("right");
            else { focusPending.current = "right"; setDrawer("right"); }
          }}>
          <span aria-hidden="true">☷</span></button>
      </div>
    </header>
    <div className={styles.body}>
      {open && <div className={styles.scrim} data-workbench-scrim aria-hidden="true" onClick={() => closeDrawer(open)} />}
      <aside ref={leftRef} id={`${id}-left`} className={`${styles.rail} ${styles.left}`} data-workbench-rail="left"
        role={open === "left" ? "dialog" : undefined} aria-label="Материалы"
        aria-modal={open === "left" ? true : undefined} aria-hidden={leftClosed || undefined} inert={leftClosed} tabIndex={open === "left" ? -1 : undefined}>
        {left}<button className={styles.close} type="button" aria-label="Закрыть материалы" onClick={() => closeDrawer("left")}>Закрыть</button>
      </aside>
      <main className={styles.center} role="region" aria-label="Сцена" inert={!!open}>
        <div className={styles.scene}>{children}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </main>
      <aside ref={rightRef} id={`${id}-right`} className={`${styles.rail} ${styles.right}`} data-workbench-rail="right"
        role={open === "right" ? "dialog" : undefined} aria-label="Настройки"
        aria-modal={open === "right" ? true : undefined} aria-hidden={rightClosed || undefined} inert={rightClosed} tabIndex={open === "right" ? -1 : undefined}>
        {right}<button className={styles.close} type="button" aria-label="Закрыть настройки" onClick={() => closeDrawer("right")}>Закрыть</button>
      </aside>
    </div>
  </div>;
}
