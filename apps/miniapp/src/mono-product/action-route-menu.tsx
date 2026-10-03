"use client";

import type { ProductActionRoute } from "@wallet/core";
import { useId, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { productRouteKey } from "./product-controller";
import { ProductGlassSurface } from "./product-glass-surface";
import { CurrencyLogo } from "./currency-logo";
import styles from "./receive-menu.module.css";

export type ActionRouteMenuProps = {
  action: "send" | "receive";
  open: boolean;
  routes: readonly ProductActionRoute[];
  focusRouteKey?: string;
  emptyMessage?: string;
  onSelectRoute(route: ProductActionRoute): void;
  onClose(): void;
};

type Placement = {
  left: number; top: number; width: number; height: number; gridHeight: number;
  columns: number; accountColumns: number; side: "above" | "below" | "fallback"; origin: number; anchorVisible: boolean;
};
const tileHeight = 88;

export function ActionRouteMenu({ open, routes, action, ...props }: ActionRouteMenuProps) {
  if (!open) return null;
  const actionRoutes = routes.filter(route => route.action === action);
  const focusRoute = actionRoutes.find(route => productRouteKey(route) === props.focusRouteKey);
  // No closing presence: selection hands the scene and focus to the form immediately.
  return <OpenActionRouteMenu key={`${action}:${focusRoute ? props.focusRouteKey : "default"}`} {...props}
    action={action} routes={actionRoutes} initialAccountId={focusRoute?.accountId} />;
}

function OpenActionRouteMenu({ action, routes, focusRouteKey, emptyMessage, onSelectRoute, onClose, initialAccountId }:
  Omit<ActionRouteMenuProps, "open"> & { initialAccountId?: string }) {
  const receive = action === "receive";
  const triggerSelector = `[data-mono-product-${action}-trigger]`;
  const titleId = useId();
  const layer = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const requestedButton = useRef<HTMLButtonElement>(null);
  const actions = useRef({ onClose });
  const closeRequested = useRef(false);
  const [selectedAccountId, setSelectedAccountId] = useState(initialAccountId ?? routes[0]?.accountId);
  const [animatedIndicatorLayout, setAnimatedIndicatorLayout] = useState<string | null>(null);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const positioned = placement !== null;
  const accounts = new Map<string, { label: string; routes: ProductActionRoute[] }>();
  for (const route of routes) {
    const account = accounts.get(route.accountId);
    if (account) account.routes.push(route);
    else accounts.set(route.accountId, { label: route.accountLabel, routes: [route] });
  }
  const activeId = selectedAccountId && accounts.has(selectedAccountId) ? selectedAccountId : routes[0]?.accountId;
  const activeAccount = activeId ? accounts.get(activeId) : undefined;
  const largestGroup = Math.max(0, ...[...accounts.values()].map(account => account.routes.length));
  const accountCount = accounts.size;
  const accountColumns = placement?.accountColumns ?? Math.min(accountCount, 3);
  const indicatorLayout = `${placement?.width ?? 260}:${accountColumns}:${accountCount}`;
  const activeAccountIndex = [...accounts.keys()].indexOf(activeId ?? "");
  const accountWidth = ((placement?.width ?? 260) - 20 - (accountColumns - 1) * 4) / Math.max(1, accountColumns);
  const indicatorStyle: CSSProperties = {
    width: Math.max(0, accountWidth - 8),
    transform: `translate(${(Math.max(0, activeAccountIndex) % Math.max(1, accountColumns)) * (accountWidth + 4) + 4}px, ${Math.floor(Math.max(0, activeAccountIndex) / Math.max(1, accountColumns)) * 48 + 6}px)`,
  };

  useLayoutEffect(() => { actions.current = { onClose }; }, [onClose]);

  useLayoutEffect(() => {
    const scene = layer.current?.closest<HTMLElement>("[data-mono-preview]") ?? null;
    const place = () => {
      const anchor = scene?.querySelector<HTMLElement>(triggerSelector) ?? null;
      const next = measurePlacement(scene, anchor, largestGroup, accountCount);
      trigger.current = next.anchorVisible ? anchor : null;
      setPlacement(current => current && Object.keys(next).every(key =>
        current[key as keyof Placement] === next[key as keyof Placement]) ? current : next);
    };
    place();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(place);
    const anchor = scene?.querySelector<HTMLElement>(triggerSelector);
    if (scene) observer?.observe(scene);
    if (anchor) observer?.observe(anchor);
    const frame = scene?.closest(".mono-preview-frame"), navigation = scene?.querySelector(".mono-nav");
    if (frame) observer?.observe(frame);
    if (navigation) observer?.observe(navigation);
    window.addEventListener("resize", place);
    document.addEventListener("scroll", place, true);
    const viewport = window.visualViewport;
    viewport?.addEventListener("resize", place);
    viewport?.addEventListener("scroll", place);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", place);
      document.removeEventListener("scroll", place, true);
      viewport?.removeEventListener("resize", place);
      viewport?.removeEventListener("scroll", place);
    };
  }, [largestGroup, accountCount, triggerSelector]);

  function dismiss(restoreFocus: boolean) {
    if (closeRequested.current) return;
    closeRequested.current = true;
    // Before the host's close commit; never restore in cleanup during a route transition.
    if (restoreFocus && trigger.current?.isConnected) trigger.current.focus({ preventScroll: true });
    actions.current.onClose();
  }

  useLayoutEffect(() => {
    const element = panel.current;
    if (!positioned || !element) return;
    const target = requestedButton.current ?? element.querySelector<HTMLButtonElement>("[data-product-route-key]")
      ?? element.querySelector<HTMLButtonElement>("button");
    target?.focus({ preventScroll: true });
    // Only the menu may scroll to a restored route; never scroll the document to its anchor.
    if (target) {
      const top = target.offsetTop, bottom = top + target.offsetHeight;
      if (top < element.scrollTop) element.scrollTop = top;
      else if (bottom > element.scrollTop + element.clientHeight) element.scrollTop = bottom - element.clientHeight;
    }
  }, [positioned, focusRouteKey]);

  useLayoutEffect(() => {
    const element = panel.current;
    if (!positioned || !element) return;
    const outside = (event: PointerEvent) => {
      const anchor = layer.current?.closest("[data-mono-preview]")?.querySelector(triggerSelector);
      if (event.target instanceof Node && !element.contains(event.target) && !anchor?.contains(event.target)) dismiss(false);
    };
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault(); event.stopPropagation(); dismiss(true);
      } else if (event.key === "Tab" && event.target instanceof Node && element.contains(event.target)) {
        const buttons = element.querySelectorAll<HTMLButtonElement>("button:not([disabled])");
        if (event.shiftKey ? event.target === buttons[0] : event.target === buttons[buttons.length - 1]) {
          event.preventDefault(); dismiss(true);
        }
      }
    };
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("keydown", keyboard, true);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("keydown", keyboard, true);
    };
  }, [positioned, triggerSelector]);

  const style: CSSProperties = placement ? {
    left: placement.left, top: placement.top, width: placement.width, height: placement.height,
    transformOrigin: `${placement.origin}px ${placement.side === "above" ? "bottom" : "top"}`,
  } : { visibility: "hidden" };

  return <div className={styles.layer} ref={layer}>
    <ProductGlassSurface className={styles.panel} ref={panel} style={style} role="dialog" aria-labelledby={titleId}
      data-action-route-menu={action} data-receive-menu={receive || undefined} data-send-menu={!receive || undefined}
      data-side={placement?.side ?? "fallback"} data-positioned={positioned}>
      <header className={styles.header}>
        <h2 id={titleId}>{receive ? "Получить" : "Отправить"}</h2>
        <button className={styles.close} type="button" aria-label={receive ? "Закрыть получение" : "Закрыть отправку"} onClick={() => dismiss(true)}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
            <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </header>
      {accountCount > 1 ? <div className={styles.accounts} role="group" aria-label={receive ? "Счёт получения" : "Счёт отправки"}
        style={{ gridTemplateColumns: `repeat(${accountColumns}, minmax(0, 1fr))` }}>
        <span className={styles.accountLens} aria-hidden="true" data-action-account-indicator
          data-receive-account-indicator={receive || undefined} data-account-id={activeId}
          data-animate={animatedIndicatorLayout === indicatorLayout} style={indicatorStyle} />
        {[...accounts].map(([id, account]) => <button key={id} className={styles.account} type="button"
          aria-pressed={id === activeId} onClick={() => {
            setAnimatedIndicatorLayout(indicatorLayout);
            setSelectedAccountId(id);
          }}>{account.label}</button>)}
      </div> : activeAccount && <p className={styles.singleAccount}>{activeAccount.label}</p>}
      {activeAccount ? <ul className={styles.grid} key={activeId} data-action-route-grid data-receive-menu-grid={receive || undefined}
        style={{ height: placement?.gridHeight ?? tileHeight, gridTemplateColumns: `repeat(${placement?.columns ?? 4}, minmax(0, 1fr))` }}>
        {activeAccount.routes.map(route => {
          const key = productRouteKey(route);
          const internal = route.action === "receive" && route.receiveMode === "internal-transfer";
          return <li key={key}>
            <button className={styles.route} type="button" data-product-route-key={key}
              ref={key === focusRouteKey ? requestedButton : undefined}
              aria-label={`${route.symbol} · ${route.name} · ${route.networkLabel} · ${route.accountLabel} · ${receive ? internal ? "Между счетами" : "Внешнее получение" : "Отправить"}`}
              onClick={() => onSelectRoute(route)}>
              <CurrencyLogo assetId={route.assetId} className={styles.coin} />
              <strong>{route.symbol}</strong>
              <span className={styles.network}>{route.networkLabel}</span>
              {internal && <small className={styles.method}>Между счетами</small>}
            </button>
          </li>;
        })}
      </ul> : <p className={styles.empty}>{emptyMessage ?? (receive ? "Нет доступных способов получения." : "Нет доступных способов отправки.")}</p>}
    </ProductGlassSurface>
  </div>;
}

function measurePlacement(scene: HTMLElement | null, anchor: HTMLElement | null, maxRoutes: number, accountCount: number): Placement {
  const viewport = window.visualViewport;
  const viewportLeft = viewport?.offsetLeft ?? 0, viewportTop = viewport?.offsetTop ?? 0;
  const viewportRight = viewportLeft + (viewport?.width ?? window.innerWidth);
  const viewportBottom = viewportTop + (viewport?.height ?? window.innerHeight);
  const measured = scene?.getBoundingClientRect();
  const bounds = measured && measured.width > 0 && measured.height > 0 ? measured
    : { left: viewportLeft, top: viewportTop, right: viewportRight, bottom: viewportBottom };
  const frame = scene?.closest<HTMLElement>(".mono-preview-frame");
  const clip = frame?.getBoundingClientRect();
  const workbench = scene?.closest<HTMLElement>("[data-mono-workbench]");
  const chromeBottom = viewportTop + (workbench ? Number.parseFloat(getComputedStyle(workbench).paddingTop) || 0 : 0);
  const navigation = scene?.querySelector<HTMLElement>(".mono-nav");
  const nav = navigation?.getBoundingClientRect();
  const visibleNav = nav && nav.width > 0 && nav.height > 0 && nav.bottom > viewportTop && nav.top < viewportBottom &&
    navigation && getComputedStyle(navigation).visibility !== "hidden" && !navigation.closest("[hidden], [aria-hidden='true']");
  const leftEdge = Math.max(bounds.left, viewportLeft, clip?.width ? clip.left + (frame?.clientLeft ?? 0) : viewportLeft) + 12;
  const rightEdge = Math.min(bounds.right, viewportRight, clip?.width ? clip.left + (frame?.clientLeft ?? 0) + (frame?.clientWidth || clip.width) : viewportRight) - 12;
  const topEdge = Math.max(bounds.top, viewportTop, chromeBottom, clip?.height ? clip.top + (frame?.clientTop ?? 0) : viewportTop) + 12;
  const bottomEdge = Math.max(topEdge, Math.min(bounds.bottom, viewportBottom,
    clip?.height ? clip.top + (frame?.clientTop ?? 0) + (frame?.clientHeight || clip.height) : viewportBottom) - 12);
  const contentBottom = visibleNav && nav ? Math.max(topEdge, Math.min(bottomEdge, nav.top - 8)) : bottomEdge;
  const width = Math.min(260, Math.max(0, rightEdge - leftEdge));
  const availableColumns = Math.max(1, Math.floor((width - 20 + 4) / 48));
  const columns = Math.min(4, Math.max(1, maxRoutes), availableColumns);
  const accountColumns = Math.min(3, Math.max(1, accountCount), availableColumns);
  const rowCount = Math.max(1, Math.ceil(maxRoutes / columns));
  const gridHeight = maxRoutes ? rowCount * tileHeight + (rowCount - 1) * 4 : 64;
  const accountRows = Math.ceil(accountCount / accountColumns);
  const accountHeight = accountCount > 1 ? accountRows * 44 + (accountRows - 1) * 4 : accountCount === 1 ? 24 : 0;
  const preferredHeight = Math.min(320, 20 + 44 + (accountHeight ? accountHeight + 4 : 0) + 4 + gridHeight);
  const rect = anchor?.getBoundingClientRect();
  const anchorStyle = anchor ? getComputedStyle(anchor) : null;
  const anchorVisible = Boolean(rect && rect.width > 0 && rect.height > 0 &&
    rect.right > leftEdge && rect.left < rightEdge && rect.bottom > topEdge && rect.top < contentBottom &&
    anchorStyle?.visibility !== "hidden" && anchorStyle?.display !== "none" &&
    !anchor?.closest("[hidden], [inert], [aria-hidden='true']"));
  let side: Placement["side"] = "fallback";
  let maxHeight = Math.max(0, contentBottom - topEdge);
  if (anchorVisible && rect) {
    const below = Math.max(0, contentBottom - rect.bottom - 8), above = Math.max(0, rect.top - topEdge - 8);
    if (Math.max(above, below) >= Math.min(preferredHeight, 144)) {
      side = below >= preferredHeight || below >= above ? "below" : "above";
      maxHeight = side === "below" ? below : above;
    }
  }
  const height = Math.min(preferredHeight, maxHeight);
  const center = anchorVisible && rect ? rect.left + rect.width / 2 : (leftEdge + rightEdge) / 2;
  const left = clamp(center - width / 2, leftEdge, rightEdge - width);
  const requestedTop = side === "above" && rect ? rect.top - 8 - height : side === "below" && rect ? rect.bottom + 8 : topEdge;
  const top = clamp(requestedTop, topEdge, contentBottom - height);
  return { left: left - bounds.left + (scene?.scrollLeft ?? 0), top: top - bounds.top + (scene?.scrollTop ?? 0),
    width, height, gridHeight, columns, accountColumns, side, origin: clamp(center - left, 16, width - 16), anchorVisible };
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(value, Math.max(minimum, maximum)));
}
