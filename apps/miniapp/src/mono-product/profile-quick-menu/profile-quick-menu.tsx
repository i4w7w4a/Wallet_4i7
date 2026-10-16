"use client";

import { useCallback, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from "react";
import { ProductGlassSurface } from "../product-glass-surface";
import { AccountContextIcon } from "../product-account-chooser";
import { ProfileSectionIcon } from "../profile-section-icons";
import { createDemoProfileResource, type ProductProfileResource } from "../profile";
import { ProductProfileDocumentsContent, ProductProfileHelpContent, ProductProfileSettingsContent,
  type ProductBalanceDynamicsControl } from "../product-profile-content";
import { HomePinSettings, type HomePinSettingsProps } from "../accounts-workspace/home-pin-settings";
import { ProductSupportContent } from "../product-support";
import type { ProductHelpActions } from "../product-help";
import { MenuIcon } from "./menu-icons";
import styles from "./profile-quick-menu.module.css";

export type ProfileQuickMenuDismissReason = "close" | "escape" | "outside" | "focus-out" | "back";
export type ProfileQuickMenuDetail = "language" | "currency" | "documents" | "help" | "support" | "home";
export type ProfileQuickMenuProps = {
  id: string;
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  theme: "dark" | "light";
  onThemeChange?(theme: "dark" | "light"): void;
  balanceHidden: boolean;
  onBalanceHiddenChange(hidden: boolean): void;
  onOpenAccounts?(): void;
  onOpenHelp?(): void;
  resource?: ProductProfileResource;
  helpActions?: ProductHelpActions;
  initialDetail?: ProfileQuickMenuDetail;
  initialBackLabel?: string;
  /** Legacy Profile requests reuse this exact shell, in normal document flow. */
  inline?: boolean;
  homePins?: HomePinSettingsProps;
  /** Only the ordinary viewer Menu opts into navigation between independent routes. */
  viewerPresentation?: "mono" | "gold";
  balanceDynamics?: ProductBalanceDynamicsControl;
  onRequestDetail?(target: ProfileQuickMenuDetail): boolean;
  onBackRequest?(): boolean;
  onDismiss(reason: ProfileQuickMenuDismissReason): void;
  motionEnabled?: boolean;
};
type Placement = { left: number; top: number; width: number; maxHeight: number; origin: number; side: "below" | "above" };

export function ProfileQuickMenu({ open, ...props }: ProfileQuickMenuProps) {
  // No closing presence: the next view receives focus immediately and the optical lease is released.
  return open ? <OpenProfileQuickMenu {...props} /> : null;
}

function OpenProfileQuickMenu({ id, anchorRef, resource, helpActions, initialDetail, initialBackLabel, inline = false, homePins, onRequestDetail, onBackRequest,
  onOpenAccounts, onOpenHelp, onDismiss, viewerPresentation, balanceDynamics, motionEnabled = true }: Omit<ProfileQuickMenuProps, "open">) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const detailBack = useRef<HTMLButtonElement>(null);
  const rowRefs = useRef<Partial<Record<ProfileQuickMenuDetail, HTMLButtonElement | null>>>({});
  const returnRow = useRef<ProfileQuickMenuDetail | null>(null);
  const [detail, setDetail] = useState<ProfileQuickMenuDetail | null>(initialDetail ?? null);
  const fallbackResource = useMemo(createDemoProfileResource, []);
  const current = resource ?? fallbackResource;
  const details = current.status === "ready" ? current.data : null;
  const unavailable = current.status === "loading" ? "Загрузка…" : "Недоступно";
  const detailTitle = detail === "support" ? "Поддержка" : detail === "home" ? "На главной"
    : detail === "help" ? "Помощь" : detail === "documents" ? "Документы сервиса" : "Настройки";
  const pinCount = homePins?.pinnedKinds.length ?? 0;
  const homeSummary = homePins?.totalOnly ? "Только общий баланс"
    : `${pinCount} ${pinCount === 1 ? "кошелёк" : pinCount === 2 ? "кошелька" : "кошельков"}`;
  const [placement, setPlacement] = useState<Placement | null>(null);
  const positioned = inline || placement !== null;

  useLayoutEffect(() => {
    if (inline) return;
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
  }, [anchorRef, onDismiss, detail, inline]);

  useLayoutEffect(() => {
    if (!positioned) return;
    const panel = panelRef.current;
    if (panel) panel.scrollTop = 0;
    if (detail) detailBack.current?.focus({ preventScroll: true });
    else {
      const target = rowRefs.current[returnRow.current ?? "language"] ?? rowRefs.current.language;
      target?.focus({ preventScroll: true });
      if (panel && target && target.offsetTop + target.offsetHeight > panel.clientHeight) {
        panel.scrollTop = target.offsetTop + target.offsetHeight - panel.clientHeight;
      }
      returnRow.current = null;
    }
  }, [positioned, detail]);

  const back = useCallback(() => {
    if (onBackRequest && !onBackRequest()) return;
    if (initialDetail) { onDismiss("back"); return; }
    returnRow.current = detail; setDetail(null);
  }, [detail, initialDetail, onBackRequest, onDismiss]);

  function openDetail(target: ProfileQuickMenuDetail) {
    if (onRequestDetail && !onRequestDetail(target)) return;
    if (target === "help") onOpenHelp?.();
    setDetail(target);
  }

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
      const nestedPanel = event.target instanceof Element ? event.target.closest("[data-profile-panel]") : null;
      if (nestedPanel && panelRef.current?.contains(nestedPanel)) return;
      event.preventDefault(); event.stopPropagation();
      if (detail) back(); else onDismiss("escape");
    };
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("focusin", focus, true);
    document.addEventListener("keydown", keyboard, true);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("focusin", focus, true);
      document.removeEventListener("keydown", keyboard, true);
    };
  }, [anchorRef, onDismiss, positioned, detail, back]);

  const style: CSSProperties = inline ? {} : placement ? {
    left: placement.left, top: placement.top, width: placement.width, maxHeight: placement.maxHeight,
    transformOrigin: `${placement.origin}px ${placement.side === "above" ? "bottom" : "top"}`,
  } : { visibility: "hidden" };
  return <div className={inline ? styles.inlineLayer : styles.layer} data-profile-quick-menu-layer>
    <ProductGlassSurface ref={panelRef} id={id} role="dialog" aria-labelledby={titleId}
      className={[styles.panel, inline ? styles.inlinePanel : null].filter(Boolean).join(" ")} style={style} data-profile-quick-menu data-positioned={positioned}
      data-motion={motionEnabled} data-side={placement?.side ?? "below"}
      inert={!positioned} aria-hidden={!positioned || undefined}
      onBlurCapture={event => {
        if (!(event.relatedTarget instanceof Node) || (!event.currentTarget.contains(event.relatedTarget) &&
          !anchorRef.current?.contains(event.relatedTarget))) onDismiss("focus-out");
      }}>
      <div className={styles.heading}>
        {detail && <button ref={detailBack} type="button" className={styles.back}
          aria-label={initialDetail ? initialBackLabel ?? "Назад в обзор" : "Назад в меню"} onClick={back}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
            <path d="m14 6-6 6 6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>}
        <h2 id={titleId}>{detail ? detailTitle : "Меню"}</h2>
        <button type="button" className={styles.close} aria-label={detail ? "Закрыть панель" : "Закрыть меню"} onClick={() => onDismiss("close")}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
            <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      {detail ? <div className={styles.detailBody}>
        {detail === "support" ? <ProductSupportContent resource={current} />
          : detail === "home" ? homePins ? <HomePinSettings {...homePins} /> : <p>Настройка главной пока недоступна.</p>
          : detail === "help" ? <ProductProfileHelpContent resource={current} helpActions={helpActions} />
          : detail === "documents" ? <ProductProfileDocumentsContent resource={current} hideHeading />
            : <ProductProfileSettingsContent resource={current} balanceDynamics={balanceDynamics} />}
      </div> : <>
      <button type="button" className={styles.row} disabled aria-label="Тема" aria-describedby={`${id}-theme-unavailable`}>
        <span className={styles.leadingIcon}><MenuIcon name="theme" /></span>
        <span className={styles.label}>Тема</span><span className={styles.value} id={`${id}-theme-unavailable`}>Пока недоступно</span>
      </button>

      {([
        { target: "language", label: "Язык", value: details?.languageLabel ?? unavailable },
        { target: "currency", label: "Валюта оценки", value: details?.valuationCurrencyLabel ?? unavailable },
        { target: "documents", label: "Документы сервиса", value: null },
      ] as const).map(row => <button key={row.target} ref={element => { rowRefs.current[row.target] = element; }}
        type="button" className={styles.row} onClick={() => openDetail(row.target)}
        aria-label={row.label} aria-describedby={row.value ? `${id}-${row.target}-value` : undefined}>
        <span className={styles.leadingIcon}><MenuIcon name={row.target} /></span>
        <span className={styles.label}>{row.label}</span>
        <span className={styles.value} id={`${id}-${row.target}-value`}>{row.value}</span>
        <MenuChevron />
      </button>)}
      {homePins && <button ref={element => { rowRefs.current.home = element; }} type="button" className={styles.row}
        aria-label="На главной" aria-describedby={`${id}-home-value`} onClick={() => openDetail("home")}>
        <span className={styles.leadingIcon}><MenuIcon name="home" /></span>
        <span className={styles.label}>На главной</span><span className={styles.value} id={`${id}-home-value`}>{homeSummary}</span>
        <MenuChevron />
      </button>}
      {onOpenAccounts && <button type="button" className={styles.row} onClick={onOpenAccounts}>
        <span className={styles.leadingIcon}><AccountContextIcon stacked /></span>
        <span className={styles.label}>Мои счета</span>
        <span /><MenuChevron />
      </button>}
      <button ref={element => { rowRefs.current.help = element; }} type="button" className={`${styles.row} ${styles.help}`}
        onClick={() => openDetail("help")}>
        <span className={styles.leadingIcon}><ProfileSectionIcon section="help" /></span>
        <span className={styles.label}>Помощь</span>
        <span /><MenuChevron />
      </button>
      {viewerPresentation && !inline && <a className={`${styles.row} ${styles.viewerLink}`}
        href={viewerPresentation === "gold" ? "/p/2" : "/gold"}>
        <span className={styles.leadingIcon}><MenuIcon name="theme" /></span>
        <span className={styles.label}>{viewerPresentation === "gold"
          ? "MONO · варианты оформления" : "Gold · золотое оформление"}</span>
        <MenuChevron />
      </a>}
      </>}
    </ProductGlassSurface>
  </div>;
}

function MenuChevron() {
  return <svg className={styles.chevron} width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
    <path d="m6 4 4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}

function measurePlacement(scene: HTMLElement, anchor: HTMLElement, panel: HTMLDivElement): Placement | null {
  const bounds = scene.getBoundingClientRect(), rect = anchor.getBoundingClientRect();
  const viewport = window.visualViewport;
  const viewLeft = viewport?.offsetLeft ?? 0, viewTop = viewport?.offsetTop ?? 0;
  const viewRight = viewLeft + (viewport?.width ?? window.innerWidth);
  const viewBottom = viewTop + (viewport?.height ?? window.innerHeight);
  const frame = scene.closest<HTMLElement>(".mono-preview-frame"), clip = frame?.getBoundingClientRect();
  const leftEdge = Math.max(bounds.left, viewLeft, clip?.width ? clip.left + (frame?.clientLeft ?? 0) : viewLeft) + 12;
  const rightEdge = Math.min(bounds.right, viewRight, clip?.width ? clip.right - (frame?.clientLeft ?? 0) : viewRight) - 12;
  const topEdge = Math.max(bounds.top, viewTop, clip?.height ? clip.top + (frame?.clientTop ?? 0) : viewTop) + 12;
  const navElement = scene.querySelector<HTMLElement>(".mono-nav");
  const nav = navElement?.getBoundingClientRect();
  const navTop = nav && nav.width > 0 && nav.height > 0 && nav.top > topEdge && nav.top < viewBottom ? nav.top - 8 : viewBottom;
  const visibleBottom = Math.min(bounds.bottom, viewBottom, clip?.height ? clip.bottom : viewBottom);
  const bottomEdge = Math.min(visibleBottom - 12, navTop);
  // The launcher may sit in nav; only the panel must stay above it.
  if (rect.width <= 0 || rect.height <= 0 || rect.bottom <= topEdge || rect.top >= visibleBottom ||
    rect.right <= leftEdge || rect.left >= rightEdge || rightEdge <= leftEdge || bottomEdge <= topEdge) return null;
  const width = Math.min(280, rightEdge - leftEdge);
  const naturalHeight = panel.scrollHeight || 404;
  const aboveEdge = Math.min(rect.top - 8, bottomEdge);
  const below = Math.max(0, bottomEdge - rect.bottom - 8), above = Math.max(0, aboveEdge - topEdge);
  const side = navElement?.contains(anchor) ? "above" : below >= naturalHeight || below >= above ? "below" : "above";
  const maxHeight = side === "below" ? below : above;
  if (maxHeight <= 0) return null;
  const height = Math.min(naturalHeight, maxHeight);
  const left = clamp(rect.right - width, leftEdge, rightEdge - width);
  const top = clamp(side === "below" ? rect.bottom + 8 : aboveEdge - height, topEdge, bottomEdge - height);
  return { left: left - bounds.left + scene.scrollLeft, top: top - bounds.top + scene.scrollTop,
    width, maxHeight, side, origin: clamp(rect.left + rect.width / 2 - left, 16, width - 16) };
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(value, Math.max(minimum, maximum)));
}
