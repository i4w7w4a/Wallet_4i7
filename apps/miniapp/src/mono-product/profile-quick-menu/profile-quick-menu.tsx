"use client";

import { useId, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { ProductGlassSurface } from "../product-glass-surface";
import styles from "./profile-quick-menu.module.css";

export type ProfileQuickMenuDismissReason = "close" | "escape" | "outside" | "focus-out";
export type ProfileQuickMenuProps = {
  id: string;
  open: boolean;
  anchorRef: RefObject<HTMLButtonElement | null>;
  theme: "dark" | "light";
  onThemeChange?(theme: "dark" | "light"): void;
  balanceHidden: boolean;
  onBalanceHiddenChange(hidden: boolean): void;
  onOpenHelp(): void;
  onDismiss(reason: ProfileQuickMenuDismissReason): void;
  motionEnabled?: boolean;
};
type Placement = { left: number; top: number; width: number; maxHeight: number; origin: number; side: "below" | "above" };

export function ProfileQuickMenu({ open, ...props }: ProfileQuickMenuProps) {
  // No closing presence: the next view receives focus immediately and the optical lease is released.
  return open ? <OpenProfileQuickMenu {...props} /> : null;
}

function OpenProfileQuickMenu({ id, anchorRef, balanceHidden, onBalanceHiddenChange,
  onOpenHelp, onDismiss, motionEnabled = true }: Omit<ProfileQuickMenuProps, "open">) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const firstControl = useRef<HTMLButtonElement>(null);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const positioned = placement !== null;

  useLayoutEffect(() => {
    const anchor = anchorRef.current, panel = panelRef.current;
    const scene = anchor?.closest<HTMLElement>("[data-mono-preview]");
    if (!anchor || !scene || !panel) return;
    const place = () => {
      const next = measurePlacement(scene, anchor, panel);
      if (!next) { onDismiss("outside"); return; }
      setPlacement(current => current && Object.keys(next).every(key =>
        current[key as keyof Placement] === next[key as keyof Placement]) ? current : next);
    };
    place();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(place);
    observer?.observe(scene); observer?.observe(anchor); observer?.observe(panel);
    const frame = scene.closest<HTMLElement>(".mono-preview-frame");
    if (frame) observer?.observe(frame);
    const viewport = window.visualViewport;
    window.addEventListener("resize", place);
    document.addEventListener("scroll", place, true);
    viewport?.addEventListener("resize", place);
    viewport?.addEventListener("scroll", place);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", place);
      document.removeEventListener("scroll", place, true);
      viewport?.removeEventListener("resize", place);
      viewport?.removeEventListener("scroll", place);
    };
  }, [anchorRef, onDismiss]);

  useLayoutEffect(() => {
    if (positioned) firstControl.current?.focus({ preventScroll: true });
  }, [positioned]);

  useLayoutEffect(() => {
    if (!positioned) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !panelRef.current?.contains(event.target) &&
        !anchorRef.current?.contains(event.target)) onDismiss("outside");
    };
    const focus = (event: FocusEvent) => {
      if (event.target instanceof Node && !panelRef.current?.contains(event.target) &&
        !anchorRef.current?.contains(event.target)) onDismiss("focus-out");
    };
    const keyboard = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault(); event.stopPropagation(); onDismiss("escape");
    };
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("focusin", focus, true);
    document.addEventListener("keydown", keyboard, true);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("focusin", focus, true);
      document.removeEventListener("keydown", keyboard, true);
    };
  }, [anchorRef, onDismiss, positioned]);

  const style: CSSProperties = placement ? {
    left: placement.left, top: placement.top, width: placement.width, maxHeight: placement.maxHeight,
    transformOrigin: `${placement.origin}px ${placement.side === "above" ? "bottom" : "top"}`,
  } : { visibility: "hidden" };
  return <div className={styles.layer} data-profile-quick-menu-layer>
    <ProductGlassSurface ref={panelRef} id={id} role="dialog" aria-labelledby={titleId}
      className={styles.panel} style={style} data-profile-quick-menu data-positioned={positioned}
      data-motion={motionEnabled} data-side={placement?.side ?? "below"}
      inert={!positioned} aria-hidden={!positioned || undefined}
      onBlurCapture={event => {
        if (!(event.relatedTarget instanceof Node) || (!event.currentTarget.contains(event.relatedTarget) &&
          !anchorRef.current?.contains(event.relatedTarget))) onDismiss("focus-out");
      }}>
      <div className={styles.heading}>
        <h2 id={titleId}>Быстрые настройки</h2>
        <button type="button" className={styles.close} aria-label="Закрыть быстрые настройки" onClick={() => onDismiss("close")}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
            <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <button ref={firstControl} type="button" className={styles.row}
        aria-label="Скрывать суммы" aria-pressed={balanceHidden} onClick={() => onBalanceHiddenChange(!balanceHidden)}>
        <span>Скрывать суммы</span>
        <span className={styles.toggle} data-checked={balanceHidden} aria-hidden="true" />
      </button>
      <button type="button" className={`${styles.row} ${styles.help}`} onClick={onOpenHelp}>
        <span>Помощь</span>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
          <path d="m6 4 4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </ProductGlassSurface>
  </div>;
}

function measurePlacement(scene: HTMLElement, anchor: HTMLButtonElement, panel: HTMLDivElement): Placement | null {
  const bounds = scene.getBoundingClientRect(), rect = anchor.getBoundingClientRect();
  const viewport = window.visualViewport;
  const viewLeft = viewport?.offsetLeft ?? 0, viewTop = viewport?.offsetTop ?? 0;
  const viewRight = viewLeft + (viewport?.width ?? window.innerWidth);
  const viewBottom = viewTop + (viewport?.height ?? window.innerHeight);
  const frame = scene.closest<HTMLElement>(".mono-preview-frame"), clip = frame?.getBoundingClientRect();
  const leftEdge = Math.max(bounds.left, viewLeft, clip?.width ? clip.left + (frame?.clientLeft ?? 0) : viewLeft) + 12;
  const rightEdge = Math.min(bounds.right, viewRight, clip?.width ? clip.right - (frame?.clientLeft ?? 0) : viewRight) - 12;
  const topEdge = Math.max(bounds.top, viewTop, clip?.height ? clip.top + (frame?.clientTop ?? 0) : viewTop) + 12;
  const nav = scene.querySelector<HTMLElement>(".mono-nav")?.getBoundingClientRect();
  const navTop = nav && nav.width > 0 && nav.height > 0 && nav.top > topEdge && nav.top < viewBottom ? nav.top - 8 : viewBottom;
  const bottomEdge = Math.min(bounds.bottom, viewBottom, navTop, clip?.height ? clip.bottom : viewBottom) - 12;
  if (rect.width <= 0 || rect.height <= 0 || rect.bottom <= topEdge || rect.top >= bottomEdge ||
    rect.right <= leftEdge || rect.left >= rightEdge || rightEdge <= leftEdge || bottomEdge <= topEdge) return null;
  const width = Math.min(280, rightEdge - leftEdge);
  const naturalHeight = Math.min(320, panel.scrollHeight || 176);
  const below = Math.max(0, bottomEdge - rect.bottom - 8), above = Math.max(0, rect.top - topEdge - 8);
  const side = below >= naturalHeight || below >= above ? "below" : "above";
  const maxHeight = Math.min(320, side === "below" ? below : above);
  const height = Math.min(naturalHeight, maxHeight);
  const left = clamp(rect.right - width, leftEdge, rightEdge - width);
  const top = clamp(side === "below" ? rect.bottom + 8 : rect.top - 8 - height, topEdge, bottomEdge - height);
  return { left: left - bounds.left + scene.scrollLeft, top: top - bounds.top + scene.scrollTop,
    width, maxHeight, side, origin: clamp(rect.left + rect.width / 2 - left, 16, width - 16) };
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(value, Math.max(minimum, maximum)));
}
