"use client";

import { useCallback, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import type { HistoryFilters } from "./history-filters";
import { HistoryStatusIcon } from "./history-direction-icon";
import { ProductGlassSurface } from "./product-glass-surface";
import styles from "./history-status-filter.module.css";

type Status = HistoryFilters["status"];
type Props = { value: Status; scopeKey: string; onChange(value: Status): void };
type Placement = { left: number; top: number; width: number; maxHeight: number; origin: number; side: "above" | "below" };
const statuses = [
  { id: "all", label: "Все статусы" }, { id: "pending", label: "Ожидают" },
  { id: "completed", label: "Завершены" }, { id: "failed", label: "Ошибки" },
] as const;

export function HistoryStatusFilter({ value, scopeKey, onChange }: Props) {
  const panelId = useId(), titleId = useId();
  const rootRef = useRef<HTMLDivElement>(null), triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null), selectedRef = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  const [openScope, setOpenScope] = useState<string | null>(null);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const [motionEnabled, setMotionEnabled] = useState(false);
  const open = openScope !== null && openScope === scopeKey;
  const positioned = placement !== null;
  const label = statuses.find(status => status.id === value)!.label;
  const dismiss = useCallback((restore: boolean) => { restoreFocus.current = restore; setOpenScope(null); }, []);

  useLayoutEffect(() => {
    if (openScope !== null && openScope !== scopeKey) dismiss(false);
  }, [openScope, scopeKey, dismiss]);

  useLayoutEffect(() => {
    const anchor = triggerRef.current;
    if (!anchor) return;
    const doc = anchor.ownerDocument, view = doc.defaultView;
    const reduced = view?.matchMedia?.("(prefers-reduced-motion: reduce)");
    const sync = () => {
      const gate = anchor.closest<HTMLElement>("[data-mono-disclosure-motion], [data-mono-motion]");
      const available = triggerAvailable(anchor);
      setMotionEnabled(available && reduced?.matches === false &&
        (gate?.dataset.monoDisclosureMotion ?? gate?.dataset.monoMotion) === "ready");
      if (!available) dismiss(false);
    };
    sync();
    const observer = view ? new view.MutationObserver(sync) : null;
    for (let element: HTMLElement | null = anchor; element; element = element.parentElement) {
      observer?.observe(element, { attributes: true, attributeFilter: ["hidden", "inert", "aria-hidden", "style", "class",
        "data-mono-disclosure-motion", "data-mono-motion", "data-mono-section"] });
    }
    reduced?.addEventListener("change", sync);
    doc.addEventListener("visibilitychange", sync);
    return () => {
      observer?.disconnect(); reduced?.removeEventListener("change", sync);
      doc.removeEventListener("visibilitychange", sync);
    };
  }, [dismiss]);

  useLayoutEffect(() => {
    if (!open) return;
    const root = rootRef.current, anchor = triggerRef.current, panel = panelRef.current;
    if (!root || !anchor || !panel) return;
    const doc = anchor.ownerDocument, view = doc.defaultView;
    if (!view) return;
    const scene = anchor.closest<HTMLElement>("[data-mono-preview]");
    const place = () => {
      const next = triggerAvailable(anchor) ? measurePlacement(root, anchor, panel, scene) : null;
      if (!next) { dismiss(false); return; }
      setPlacement(current => current && Object.keys(next).every(key =>
        current[key as keyof Placement] === next[key as keyof Placement]) ? current : next);
    };
    const outside = (event: Event) => {
      if (event.target instanceof Node && !panel.contains(event.target) && !anchor.contains(event.target)) dismiss(false);
    };
    place();
    const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(place);
    resize?.observe(root); resize?.observe(anchor); resize?.observe(panel);
    if (scene) resize?.observe(scene);
    for (let element = root.parentElement; element; element = element.parentElement) {
      if (element.matches(".mono-preview-frame, [data-material-scrollport]")) resize?.observe(element);
    }
    const nav = scene?.querySelector<HTMLElement>(".mono-nav");
    if (nav) resize?.observe(nav);
    // A sibling financial sheet may appear before inert/focus is applied to the content.
    const mutation = new view.MutationObserver(place);
    mutation.observe(scene ?? root.parentElement ?? root, { childList: true, subtree: true, attributes: true,
      attributeFilter: ["hidden", "inert", "aria-hidden", "aria-modal", "style", "class"] });
    const viewport = view.visualViewport;
    view.addEventListener("resize", place); doc.addEventListener("scroll", place, true);
    viewport?.addEventListener("resize", place); viewport?.addEventListener("scroll", place);
    doc.addEventListener("pointerdown", outside, true); doc.addEventListener("focusin", outside, true);
    return () => {
      resize?.disconnect(); mutation.disconnect();
      view.removeEventListener("resize", place); doc.removeEventListener("scroll", place, true);
      viewport?.removeEventListener("resize", place); viewport?.removeEventListener("scroll", place);
      doc.removeEventListener("pointerdown", outside, true); doc.removeEventListener("focusin", outside, true);
    };
  }, [open, dismiss]);

  useLayoutEffect(() => {
    if (open && positioned) selectedRef.current?.focus({ preventScroll: true });
  }, [open, positioned]);

  useLayoutEffect(() => {
    if (!open && restoreFocus.current) {
      restoreFocus.current = false;
      if (triggerRef.current && triggerAvailable(triggerRef.current)) triggerRef.current.focus({ preventScroll: true });
    }
  }, [open, value]);

  function keyboard(event: KeyboardEvent<HTMLDivElement>) {
    if (!open) return;
    if (event.key === "Escape") {
      event.preventDefault(); event.stopPropagation(); dismiss(true); return;
    }
    if (!(event.target instanceof HTMLButtonElement) || !event.target.hasAttribute("data-history-status-option")) return;
    const options = [...panelRef.current!.querySelectorAll<HTMLButtonElement>("[data-history-status-option]")];
    const index = options.indexOf(event.target);
    const next = event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 :
      event.key === "ArrowDown" ? (index + 1) % options.length :
        event.key === "ArrowUp" ? (index + options.length - 1) % options.length : null;
    if (next !== null) { event.preventDefault(); event.stopPropagation(); options[next]?.focus({ preventScroll: true }); }
  }

  const style: CSSProperties = placement ? { left: placement.left, top: placement.top, width: placement.width,
    maxHeight: placement.maxHeight, transformOrigin: `${placement.origin}px ${placement.side === "above" ? "bottom" : "top"}` }
    : { visibility: "hidden" };
  return <div ref={rootRef} className={styles.control} data-history-status-filter data-active={value !== "all"}
    data-open={open} data-motion={motionEnabled} onKeyDown={keyboard}>
    <button ref={triggerRef} type="button" className={styles.trigger} data-history-status-trigger
      aria-label="Фильтр статуса" aria-description={`Текущий статус: ${label}`}
      aria-haspopup="dialog" aria-expanded={open} aria-controls={panelId}
      onClick={() => {
        if (open) dismiss(true);
        else { restoreFocus.current = false; setPlacement(null); setOpenScope(scopeKey); }
      }}>
      <svg className={styles.sliders} width="22" height="22" viewBox="0 0 22 22" fill="none"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true" focusable="false">
        <path d="M3 5h16M3 11h16M3 17h16" />
        <path className={styles.firstSlider} d="M7 2.5v5" />
        <path d="M14 8.5v5" />
        <path className={styles.lastSlider} d="M9 14.5v5" />
      </svg>
    </button>
    {value !== "all" && <>
      <span className={styles.activeLabel}>{label}</span>
      <button type="button" className={styles.reset} aria-label="Сбросить фильтр статуса"
        onClick={() => { restoreFocus.current = true; setOpenScope(null); onChange("all"); }}>
        <CloseIcon />
      </button>
    </>}
    {open && <ProductGlassSurface ref={panelRef} id={panelId} role="dialog" aria-labelledby={titleId}
      className={styles.panel} style={style} data-positioned={positioned} data-side={placement?.side}
      aria-hidden={!positioned || undefined} inert={!positioned}
      onBlurCapture={event => {
        if (!(event.relatedTarget instanceof Node) || (!event.currentTarget.contains(event.relatedTarget) &&
          !triggerRef.current?.contains(event.relatedTarget))) dismiss(false);
      }}>
      <header className={styles.heading}>
        <h2 id={titleId}>Статус операций</h2>
        <button type="button" className={styles.close} aria-label="Закрыть фильтр статуса" onClick={() => dismiss(true)}>
          <CloseIcon />
        </button>
      </header>
      <div role="group" aria-labelledby={titleId} className={styles.options}>
        {statuses.map(status => <button key={status.id} type="button" className={styles.option}
          ref={status.id === value ? selectedRef : undefined} data-history-status-option={status.id} data-status={status.id}
          aria-pressed={status.id === value} onClick={() => { dismiss(true); onChange(status.id); }}>
          <span className={styles.statusIcon} aria-hidden="true">{status.id !== "all" && <HistoryStatusIcon status={status.id} />}</span>
          <span>{status.label}</span>
          {status.id === value && <svg className={styles.check} width="16" height="16" viewBox="0 0 16 16" fill="none"
            aria-hidden="true" focusable="false"><path d="m3.5 8 3 3 6-6" stroke="currentColor" strokeWidth="1.5"
              strokeLinecap="round" strokeLinejoin="round" /></svg>}
        </button>)}
      </div>
    </ProductGlassSurface>}
  </div>;
}

function CloseIcon() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
    <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>;
}

function triggerAvailable(anchor: HTMLButtonElement): boolean {
  const doc = anchor.ownerDocument, view = doc.defaultView;
  if (!anchor.isConnected || anchor.disabled || doc.visibilityState === "hidden" ||
    anchor.closest("[hidden], [inert], [aria-hidden='true']")) return false;
  for (let element: HTMLElement | null = anchor; element; element = element.parentElement) {
    const style = view?.getComputedStyle(element);
    if (style?.display === "none" || style?.visibility === "hidden" || style?.visibility === "collapse") return false;
  }
  const scene = anchor.closest<HTMLElement>("[data-mono-preview]");
  if (scene && [...scene.querySelectorAll<HTMLElement>("[data-product-sheet], [role='dialog'][aria-modal='true']")]
    .some(overlay => !overlay.closest("[hidden], [inert], [aria-hidden='true']") &&
      view?.getComputedStyle(overlay).display !== "none" && view?.getComputedStyle(overlay).visibility !== "hidden")) return false;
  const rect = anchor.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

// Local placement follows the existing profile/account popovers without turning them into a new shared API.
function measurePlacement(root: HTMLElement, anchor: HTMLButtonElement, panel: HTMLElement, scene: HTMLElement | null): Placement | null {
  const view = anchor.ownerDocument.defaultView!;
  const viewport = view.visualViewport, rect = anchor.getBoundingClientRect(), origin = root.getBoundingClientRect();
  let leftEdge = viewport?.offsetLeft ?? 0, topEdge = viewport?.offsetTop ?? 0;
  let rightEdge = leftEdge + (viewport?.width ?? view.innerWidth), bottomEdge = topEdge + (viewport?.height ?? view.innerHeight);
  for (let element = root.parentElement; element; element = element.parentElement) {
    const style = view.getComputedStyle(element), bounds = element.getBoundingClientRect();
    const sceneBoundary = element === scene;
    const clipX = sceneBoundary || element.matches(".mono-preview-frame, [data-material-scrollport]") || /auto|scroll|hidden|clip/.test(style.overflowX);
    const clipY = sceneBoundary || element.matches(".mono-preview-frame, [data-material-scrollport]") || /auto|scroll|hidden|clip/.test(style.overflowY);
    if (clipX && bounds.width > 0) {
      const left = bounds.left + element.clientLeft;
      leftEdge = Math.max(leftEdge, left); rightEdge = Math.min(rightEdge, left + (element.clientWidth || bounds.width));
    }
    if (clipY && bounds.height > 0) {
      const top = bounds.top + element.clientTop;
      topEdge = Math.max(topEdge, top); bottomEdge = Math.min(bottomEdge, top + (element.clientHeight || bounds.height));
    }
  }
  const navigation = scene?.querySelector<HTMLElement>(".mono-nav"), nav = navigation?.getBoundingClientRect();
  if (navigation && nav && nav.width > 0 && nav.height > 0 && nav.top > topEdge && nav.top < bottomEdge &&
    !navigation.closest("[hidden], [aria-hidden='true']") && view.getComputedStyle(navigation).visibility !== "hidden") {
    bottomEdge = Math.min(bottomEdge, nav.top - 8);
  }
  leftEdge += 12; rightEdge -= 12; topEdge += 12; bottomEdge -= 12;
  if (rect.right <= leftEdge || rect.left >= rightEdge || rect.bottom <= topEdge || rect.top >= bottomEdge ||
    rightEdge <= leftEdge || bottomEdge <= topEdge) return null;
  const width = Math.min(224, rightEdge - leftEdge), naturalHeight = panel.scrollHeight || 246;
  const below = Math.max(0, bottomEdge - rect.bottom - 8), above = Math.max(0, rect.top - topEdge - 8);
  const side = below >= naturalHeight || below >= above ? "below" : "above";
  const maxHeight = side === "below" ? below : above;
  if (maxHeight <= 0) return null;
  const height = Math.min(naturalHeight, maxHeight), left = clamp(rect.right - width, leftEdge, rightEdge - width);
  const top = clamp(side === "below" ? rect.bottom + 8 : rect.top - height - 8, topEdge, bottomEdge - height);
  return { left: left - origin.left + root.scrollLeft, top: top - origin.top + root.scrollTop, width, maxHeight, side,
    origin: clamp(rect.left + rect.width / 2 - left, 16, width - 16) };
}
function clamp(value: number, minimum: number, maximum: number) { return Math.max(minimum, Math.min(value, Math.max(minimum, maximum))); }
