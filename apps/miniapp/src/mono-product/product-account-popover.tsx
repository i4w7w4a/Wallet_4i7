"use client";

import { useId, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import type { AccountContext } from "@wallet/core";
import type { MonoProductView } from "./product-controller";
import { ProductAccountChooser } from "./product-account-chooser";
import { ProductGlassSurface } from "./product-glass-surface";
import styles from "./product-account-popover.module.css";

type Placement = { left: number; top: number; width: number; maxHeight: number; origin: number; side: "above" | "below" | "fallback" };
type Props = {
  view: MonoProductView; open: boolean; active?: boolean; id?: string;
  allowClosing: boolean; restoreOnClose: boolean;
  onClose(): void; onSelectContext(context: AccountContext): void;
};

export function ProductAccountPopover({ view, open, active = true, id, allowClosing, restoreOnClose, onClose, onSelectContext }: Props) {
  const generatedId = useId(), titleId = useId();
  const layer = useRef<HTMLDivElement>(null), panel = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onClose, onSelectContext });
  const closeRequested = useRef(false), returnFocus = useRef(false), wasOpen = useRef(false), generation = useRef(0);
  const [present, setPresent] = useState(open && active);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const positioned = placement !== null;
  useLayoutEffect(() => { callbacks.current = { onClose, onSelectContext }; }, [onClose, onSelectContext]);

  useLayoutEffect(() => {
    const revision = ++generation.current;
    if (open && active) { closeRequested.current = false; setPresent(true); return; }
    const element = panel.current, scene = layer.current?.closest<HTMLElement>("[data-mono-preview]");
    const ready = (scene?.dataset.monoDisclosureMotion ?? scene?.dataset.monoMotion) === "ready";
    if (!present || !element || !active || !allowClosing || !ready || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPresent(false); return;
    }
    void window.getComputedStyle(element).animationName;
    const transitions = element.getAnimations?.() ?? [];
    if (!transitions.length) { setPresent(false); return; }
    void Promise.allSettled(transitions.map(transition => transition.finished)).then(() => {
      if (generation.current === revision) setPresent(false);
    });
    return () => { ++generation.current; };
  }, [open, active, present, allowClosing]);

  useLayoutEffect(() => {
    if (!open || !active || !present) return;
    const scene = layer.current?.closest<HTMLElement>("[data-mono-preview]");
    const anchor = scene?.querySelector<HTMLElement>("[data-mono-product-context-trigger]"), element = panel.current;
    if (!scene || !anchor || !element || view.snapshot.accounts.length <= 1) { callbacks.current.onClose(); return; }
    const place = () => {
      const next = measurePlacement(scene, anchor, element);
      setPlacement(current => current && Object.keys(next).every(key =>
        current[key as keyof Placement] === next[key as keyof Placement]) ? current : next);
    };
    place();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(place);
    observer?.observe(scene); observer?.observe(anchor); observer?.observe(element);
    const frame = scene.closest<HTMLElement>(".mono-preview-frame");
    if (frame) observer?.observe(frame);
    const viewport = window.visualViewport;
    window.addEventListener("resize", place); document.addEventListener("scroll", place, true);
    viewport?.addEventListener("resize", place); viewport?.addEventListener("scroll", place);
    return () => {
      observer?.disconnect(); window.removeEventListener("resize", place); document.removeEventListener("scroll", place, true);
      viewport?.removeEventListener("resize", place); viewport?.removeEventListener("scroll", place);
    };
  }, [open, active, present, view.snapshot.accounts.length]);

  useLayoutEffect(() => {
    if (!active && open) { returnFocus.current = false; callbacks.current.onClose(); }
    if (!open && wasOpen.current) {
      if (returnFocus.current && restoreOnClose && active) {
        const scene = layer.current?.closest<HTMLElement>("[data-mono-preview]");
        const trigger = scene?.querySelector<HTMLElement>("[data-mono-product-context-trigger]")
          ?? scene?.querySelector<HTMLElement>(".mono-app-header__mark");
        trigger?.focus({ preventScroll: true });
      }
      returnFocus.current = false;
    }
    wasOpen.current = open;
    if (!open || !active || !present || !positioned) return;
    const element = panel.current, scene = layer.current?.closest<HTMLElement>("[data-mono-preview]");
    const anchor = scene?.querySelector<HTMLElement>("[data-mono-product-context-trigger]");
    if (!element) return;
    returnFocus.current = true;
    const selected = element.querySelector<HTMLElement>('[data-account-context][aria-current="true"]')
      ?? element.querySelector<HTMLElement>("[data-account-context]");
    (selected ?? element).focus({ preventScroll: true });
    if (selected && selected.offsetTop + selected.offsetHeight > element.scrollTop + element.clientHeight) {
      element.scrollTop = Math.max(0, selected.offsetTop + selected.offsetHeight - element.clientHeight);
    }
    const dismiss = (restore: boolean) => {
      if (closeRequested.current) return;
      closeRequested.current = true; returnFocus.current = restore; callbacks.current.onClose();
    };
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !element.contains(event.target) && !anchor?.contains(event.target)) dismiss(false);
    };
    const focus = (event: FocusEvent) => {
      if (event.target instanceof Node && !element.contains(event.target) && !anchor?.contains(event.target)) dismiss(false);
    };
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); dismiss(true); }
      else if (event.key === "Tab" && event.target instanceof Node && element.contains(event.target)) {
        const buttons = element.querySelectorAll<HTMLButtonElement>("button:not([disabled])");
        if (event.shiftKey ? event.target === buttons[0] : event.target === buttons[buttons.length - 1]) {
          event.preventDefault(); dismiss(true);
        }
      }
    };
    document.addEventListener("pointerdown", outside, true); document.addEventListener("focusin", focus, true);
    document.addEventListener("keydown", keyboard, true);
    return () => {
      document.removeEventListener("pointerdown", outside, true); document.removeEventListener("focusin", focus, true);
      document.removeEventListener("keydown", keyboard, true);
    };
  }, [open, active, present, positioned, restoreOnClose]);

  if (!present) return null;
  const style: CSSProperties = placement ? { left: placement.left, top: placement.top, width: placement.width,
    maxHeight: placement.maxHeight, transformOrigin: `${placement.origin}px ${placement.side === "above" ? "bottom" : "top"}` }
    : { visibility: "hidden" };
  return <div className={styles.layer} ref={layer}>
    <ProductGlassSurface ref={panel} id={id ?? generatedId} className={styles.panel} style={style} role="dialog"
      aria-labelledby={titleId} aria-hidden={!open || !positioned || undefined} inert={!open || !positioned}
      tabIndex={-1} data-product-account-popover data-positioned={positioned} data-state={open ? "open" : "closing"} data-side={placement?.side}>
      <header className={styles.heading}>
        <h2 id={titleId}>Выбор счёта</h2>
        <button type="button" aria-label="Закрыть выбор счёта" onClick={() => callbacks.current.onClose()}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
            <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </button>
      </header>
      <ProductAccountChooser snapshot={view.snapshot} context={view.context} balanceHidden={view.balanceHidden}
        onSelectContext={next => callbacks.current.onSelectContext(next)} />
    </ProductGlassSurface>
  </div>;
}

function measurePlacement(scene: HTMLElement, anchor: HTMLElement, panel: HTMLElement): Placement {
  const bounds = scene.getBoundingClientRect(), rect = anchor.getBoundingClientRect(), viewport = window.visualViewport;
  const viewLeft = viewport?.offsetLeft ?? 0, viewTop = viewport?.offsetTop ?? 0;
  const viewRight = viewLeft + (viewport?.width ?? window.innerWidth), viewBottom = viewTop + (viewport?.height ?? window.innerHeight);
  const sceneWidth = scene.clientWidth || bounds.width || Math.min(480, viewRight - viewLeft);
  const frame = scene.closest<HTMLElement>(".mono-preview-frame"), clip = frame?.getBoundingClientRect();
  const leftEdge = Math.max(bounds.left, viewLeft, clip?.width ? clip.left + (frame?.clientLeft ?? 0) : viewLeft) + 12;
  const rightEdge = Math.min(bounds.width ? bounds.right : bounds.left + sceneWidth, viewRight, clip?.width ? clip.right : viewRight) - 12;
  const topEdge = Math.max(bounds.top, viewTop, clip?.height ? clip.top : viewTop) + 12;
  const nav = scene.querySelector<HTMLElement>(".mono-nav")?.getBoundingClientRect();
  const navEdge = nav && nav.width > 0 && nav.top > topEdge ? nav.top - 8 : viewBottom;
  const bottomEdge = Math.min(bounds.height ? bounds.bottom : viewBottom, viewBottom, navEdge, clip?.height ? clip.bottom : viewBottom) - 12;
  const width = Math.min(336, Math.max(0, rightEdge - leftEdge));
  const anchored = rect.width > 0 && rect.height > 0 && rect.bottom > topEdge && rect.top < bottomEdge && rect.right > leftEdge && rect.left < rightEdge;
  const below = Math.max(0, bottomEdge - rect.bottom - 8), above = Math.max(0, rect.top - topEdge - 8);
  const natural = Math.min(panel.scrollHeight || 416, 416);
  const side = !anchored ? "fallback" : below >= natural || below >= above ? "below" : "above";
  const maxHeight = Math.min(416, Math.max(0, side === "fallback" ? bottomEdge - topEdge : side === "below" ? below : above));
  const height = Math.min(natural, maxHeight), left = clamp(anchored ? rect.left : leftEdge, leftEdge, rightEdge - width);
  const top = clamp(side === "fallback" ? topEdge : side === "below" ? rect.bottom + 8 : rect.top - height - 8, topEdge, bottomEdge - height);
  return { left: left - bounds.left + scene.scrollLeft, top: top - bounds.top + scene.scrollTop, width, maxHeight, side,
    origin: clamp(anchored ? rect.left + rect.width / 2 - left : width / 2, 16, width - 16) };
}
function clamp(value: number, minimum: number, maximum: number) { return Math.max(minimum, Math.min(value, Math.max(minimum, maximum))); }
