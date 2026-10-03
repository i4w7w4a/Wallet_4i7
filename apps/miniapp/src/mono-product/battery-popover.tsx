"use client";

import { useId, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import type { MonoProductView } from "./product-controller";
import { remainingLabel } from "./product-home";
import "./battery-popover.css";

type Placement = { left: number; top: number; width: number; maxHeight: number; side: "below" | "above"; origin: number };

export function BatteryPopover({ view, open, onClose }: {
  view: MonoProductView; open: boolean; onClose(): void;
}) {
  const titleId = useId();
  const layer = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const focusAnchor = useRef<HTMLElement | null>(null);
  const restoreFocus = useRef(false);
  const [present, setPresent] = useState(open);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const positioned = placement !== null;

  useLayoutEffect(() => {
    if (open) { setPresent(true); return; }
    const scene = layer.current?.closest<HTMLElement>("[data-mono-preview]");
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || scene?.dataset.monoMotion === "static") {
      setPresent(false); return;
    }
    const timer = window.setTimeout(() => { setPresent(false); setPlacement(null); }, 160);
    return () => window.clearTimeout(timer);
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !present) return;
    const scene = layer.current?.closest<HTMLElement>("[data-mono-preview]");
    const anchor = scene?.querySelector<HTMLElement>("[data-mono-product-battery-trigger]");
    const element = panel.current;
    if (!scene || !anchor || !element) return;
    const place = () => {
      const bounds = scene.getBoundingClientRect(), rect = anchor.getBoundingClientRect();
      const sceneWidth = bounds.width || Math.min(window.innerWidth, 480);
      const width = Math.min(300, Math.max(0, sceneWidth - 24));
      const left = Math.max(12, Math.min(rect.right - bounds.left - width, sceneWidth - width - 12));
      const visibleTop = Math.max(bounds.top + 12, 12);
      const visibleBottom = Math.min(bounds.bottom || window.innerHeight, window.innerHeight) - 12;
      const below = Math.max(0, visibleBottom - rect.bottom - 8);
      const above = Math.max(0, rect.top - visibleTop - 8);
      const naturalHeight = Math.min(element.scrollHeight || 230, 350);
      const side = below >= naturalHeight || below >= above ? "below" : "above";
      const maxHeight = Math.max(0, Math.min(350, side === "below" ? below : above));
      const height = Math.min(naturalHeight, maxHeight);
      const top = (side === "below" ? rect.bottom + 8 : rect.top - 8 - height) - bounds.top + scene.scrollTop;
      const next: Placement = { left, top, width, maxHeight, side,
        origin: Math.max(16, Math.min(width - 16, rect.left + rect.width / 2 - bounds.left - left)) };
      setPlacement(current => current && Object.keys(next).every(key => current[key as keyof Placement] === next[key as keyof Placement])
        ? current : next);
    };
    place();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(place);
    observer?.observe(scene); observer?.observe(anchor); observer?.observe(element);
    window.addEventListener("resize", place);
    document.addEventListener("scroll", place, true);
    return () => {
      observer?.disconnect(); window.removeEventListener("resize", place);
      document.removeEventListener("scroll", place, true);
    };
  }, [open, present]);

  useLayoutEffect(() => {
    if (!open) {
      // Restore after React's DOM commit, not in effect cleanup before its selection restoration.
      if (restoreFocus.current && focusAnchor.current?.isConnected) focusAnchor.current.focus({ preventScroll: true });
      restoreFocus.current = false;
      return;
    }
    if (!present || !positioned) return;
    const element = panel.current;
    const anchor = layer.current?.closest("[data-mono-preview]")
      ?.querySelector<HTMLElement>("[data-mono-product-battery-trigger]");
    if (!element) return;
    focusAnchor.current = anchor ?? null;
    restoreFocus.current = true;
    element.focus({ preventScroll: true });
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !element.contains(event.target) && !anchor?.contains(event.target)) onClose();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault(); event.stopPropagation(); onClose();
    };
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("keydown", escape, true);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("keydown", escape, true);
    };
  }, [open, present, positioned, onClose]);

  if (!present) return null;
  const style: CSSProperties = placement ? { left: placement.left, top: placement.top, width: placement.width,
    maxHeight: placement.maxHeight, transformOrigin: `${placement.origin}px ${placement.side === "below" ? "top" : "bottom"}` }
    : { visibility: "hidden" };
  return <div ref={layer} className="mono-battery-popover-layer">
    <div ref={panel} className="mono-battery-popover" data-battery-popover data-state={open ? "open" : "closing"}
      data-side={placement?.side ?? "below"} style={style} role="dialog" aria-labelledby={titleId}
      aria-hidden={!open || undefined} inert={!open} tabIndex={-1}>
      <header className="mono-battery-popover__header">
        <div><h2 id={titleId}>Батарейка</h2><span>DEMO · СЕТЕВОЙ ПУЛ</span></div>
        <button type="button" onClick={onClose} aria-label="Закрыть батарейку">×</button>
      </header>
      {view.batteryPools.length ? <ul className="mono-battery-popover__pools">
        {view.batteryPools.map(pool => <li key={pool.id}>
          <div className="mono-battery-popover__pool"><strong>{pool.networkLabel}</strong>
            <span>{view.batteryChargePercent[pool.id] != null ? `${view.batteryChargePercent[pool.id]}%` : "Нет данных"}</span></div>
          {view.batteryChargePercent[pool.id] != null && <small className="mono-battery-popover__example">Пример заряда</small>}
          <p>Общий пул подходящих счетов</p>
          <details><summary>Где действует</summary>
            <p>{remainingLabel(pool.remainingTransfers)} · демо-остаток</p>
            <p>{pool.action === "send" ? "Отправка" : "Операция"} · {pool.eligibleAccountIds.map(id =>
              view.snapshot.accounts.find(account => account.id === id)?.label ?? "Недоступный счёт").join(", ")}</p>
          </details>
        </li>)}
      </ul> : <p className="mono-battery-popover__empty">Для этого счёта правила батарейки пока неизвестны.</p>}
      <p className="mono-battery-popover__note">Покрытие проверяется для конкретной операции. В демо заряд не списывается.</p>
    </div>
  </div>;
}
