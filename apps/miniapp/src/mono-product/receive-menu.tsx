"use client";

import type { ProductActionRoute } from "@wallet/core";
import { useId, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { productRouteKey } from "./product-controller";
import { ProductGlassSurface } from "./product-glass-surface";
import styles from "./receive-menu.module.css";

export type ReceiveMenuProps = {
  open: boolean;
  routes: readonly ProductActionRoute[];
  focusRouteKey?: string;
  emptyMessage?: string;
  onSelectRoute(route: ProductActionRoute): void;
  onClose(): void;
};

type ReceiveRoute = Extract<ProductActionRoute, { action: "receive" }>;
type Placement = {
  left: number; top: number; width: number; height: number; gridHeight: number;
  columns: number; accountColumns: number; side: "above" | "below" | "fallback"; origin: number; anchorVisible: boolean;
};
const triggerSelector = "[data-mono-product-receive-trigger]";
const tileHeight = 88;

export function ReceiveMenu({ open, routes, ...props }: ReceiveMenuProps) {
  if (!open) return null;
  const receiveRoutes = routes.filter((route): route is ReceiveRoute => route.action === "receive");
  const focusRoute = receiveRoutes.find(route => productRouteKey(route) === props.focusRouteKey);
  // No closing presence: selection hands the scene and focus to Receive immediately.
  return <OpenReceiveMenu key={focusRoute ? props.focusRouteKey : "default"} {...props}
    routes={receiveRoutes} initialAccountId={focusRoute?.accountId} />;
}

function OpenReceiveMenu({ routes, focusRouteKey, emptyMessage, onSelectRoute, onClose, initialAccountId }:
  Omit<ReceiveMenuProps, "open" | "routes"> & { routes: readonly ReceiveRoute[]; initialAccountId?: string }) {
  const titleId = useId();
  const layer = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const requestedButton = useRef<HTMLButtonElement>(null);
  const actions = useRef({ onClose });
  const closeRequested = useRef(false);
  const [selectedAccountId, setSelectedAccountId] = useState(initialAccountId ?? routes[0]?.accountId);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const positioned = placement !== null;
  const accounts = new Map<string, { label: string; routes: ReceiveRoute[] }>();
  for (const route of routes) {
    const account = accounts.get(route.accountId);
    if (account) account.routes.push(route);
    else accounts.set(route.accountId, { label: route.accountLabel, routes: [route] });
  }
  const activeId = selectedAccountId && accounts.has(selectedAccountId) ? selectedAccountId : routes[0]?.accountId;
  const activeAccount = activeId ? accounts.get(activeId) : undefined;
  const largestGroup = Math.max(0, ...[...accounts.values()].map(account => account.routes.length));
  const accountCount = accounts.size;

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
  }, [largestGroup, accountCount]);

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
  }, [positioned]);

  const style: CSSProperties = placement ? {
    left: placement.left, top: placement.top, width: placement.width, height: placement.height,
    transformOrigin: `${placement.origin}px ${placement.side === "above" ? "bottom" : "top"}`,
  } : { visibility: "hidden" };

  return <div className={styles.layer} ref={layer}>
    <ProductGlassSurface className={styles.panel} ref={panel} style={style} role="dialog" aria-labelledby={titleId}
      data-receive-menu data-side={placement?.side ?? "fallback"} data-positioned={positioned}>
      <header className={styles.header}>
        <h2 id={titleId}>Получить</h2>
        <button className={styles.close} type="button" aria-label="Закрыть получение" onClick={() => dismiss(true)}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
            <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </header>
      {accountCount > 1 ? <div className={styles.accounts} role="group" aria-label="Счёт получения"
        style={{ gridTemplateColumns: `repeat(${placement?.accountColumns ?? Math.min(accountCount, 3)}, minmax(0, 1fr))` }}>
        {[...accounts].map(([id, account]) => <button key={id} className={styles.account} type="button"
          aria-pressed={id === activeId} onClick={() => setSelectedAccountId(id)}>{account.label}</button>)}
      </div> : activeAccount && <p className={styles.singleAccount}>{activeAccount.label}</p>}
      {activeAccount ? <ul className={styles.grid} data-receive-menu-grid
        style={{ height: placement?.gridHeight ?? tileHeight, gridTemplateColumns: `repeat(${placement?.columns ?? 4}, minmax(0, 1fr))` }}>
        {activeAccount.routes.map(route => {
          const key = productRouteKey(route);
          const internal = route.receiveMode === "internal-transfer";
          return <li key={key}>
            <button className={styles.route} type="button" data-product-route-key={key}
              ref={key === focusRouteKey ? requestedButton : undefined}
              aria-label={`${route.symbol} · ${route.name} · ${route.networkLabel} · ${route.accountLabel} · ${internal ? "Между счетами" : "Внешнее получение"}`}
              onClick={() => onSelectRoute(route)}>
              <svg className={styles.coin} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
                <circle cx="16" cy="16" r="14" />
                <text x="16" y="21" textAnchor="middle">{route.symbol.slice(0, 1)}</text>
              </svg>
              <strong>{route.symbol}</strong>
              <span className={styles.network}>{route.networkLabel}</span>
              <small className={styles.method}>{internal ? "Между счетами" : "Извне"}</small>
            </button>
          </li>;
        })}
      </ul> : <p className={styles.empty}>{emptyMessage ?? "Нет доступных способов получения."}</p>}
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
  const leftEdge = Math.max(bounds.left, viewportLeft) + 12;
  const rightEdge = Math.min(bounds.right, viewportRight) - 12;
  const topEdge = Math.max(bounds.top, viewportTop) + 12;
  const bottomEdge = Math.min(bounds.bottom, viewportBottom) - 12;
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
    rect.right > leftEdge && rect.left < rightEdge && rect.bottom > topEdge && rect.top < bottomEdge &&
    anchorStyle?.visibility !== "hidden" && anchorStyle?.display !== "none" &&
    !anchor?.closest("[hidden], [inert], [aria-hidden='true']"));
  let side: Placement["side"] = "fallback";
  let maxHeight = Math.max(0, bottomEdge - topEdge);
  if (anchorVisible && rect) {
    const below = Math.max(0, bottomEdge - rect.bottom - 8), above = Math.max(0, rect.top - topEdge - 8);
    if (Math.max(above, below) >= Math.min(preferredHeight, 144)) {
      side = below >= preferredHeight || below >= above ? "below" : "above";
      maxHeight = side === "below" ? below : above;
    }
  }
  const height = Math.min(preferredHeight, maxHeight);
  const center = anchorVisible && rect ? rect.left + rect.width / 2 : (leftEdge + rightEdge) / 2;
  const left = clamp(center - width / 2, leftEdge, rightEdge - width);
  const requestedTop = side === "above" && rect ? rect.top - 8 - height : side === "below" && rect ? rect.bottom + 8 : topEdge;
  const top = clamp(requestedTop, topEdge, bottomEdge - height);
  return { left: left - bounds.left + (scene?.scrollLeft ?? 0), top: top - bounds.top + (scene?.scrollTop ?? 0),
    width, height, gridHeight, columns, accountColumns, side, origin: clamp(center - left, 16, width - 16), anchorVisible };
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(value, Math.max(minimum, maximum)));
}
