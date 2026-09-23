"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { createPortal } from "react-dom";
import "./mono-lab-controls.css";

export type MonoLabIconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> & { label: string; tooltipPlacement?: "top" | "bottom" };

/** The visual icon stays small; the semantic button remains 44 × 44. */
export function MonoLabIconButton({ label, children, className = "", tooltipPlacement = "bottom", ...props }: MonoLabIconButtonProps) {
  const id = useId();
  const anchor = useRef<HTMLSpanElement>(null);
  const tooltip = useRef<HTMLSpanElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const open = (hovered || focused) && !dismissed;
  const enter = () => { clearTimeout(hideTimer.current); setHovered(true); setDismissed(false); };
  const leave = () => { hideTimer.current = setTimeout(() => setHovered(false), 100); };
  useEffect(() => () => clearTimeout(hideTimer.current), []);
  useLayoutEffect(() => {
    if (!open) return;
    function position() {
      if (!anchor.current || !tooltip.current) return;
      const trigger = anchor.current.getBoundingClientRect();
      const box = tooltip.current.getBoundingClientRect();
      const viewportWidth = document.documentElement.clientWidth;
      const viewportHeight = document.documentElement.clientHeight;
      const above = tooltipPlacement === "top" ? trigger.top >= box.height + 8 : trigger.bottom + box.height > viewportHeight - 8;
      tooltip.current.style.left = `${Math.max(8, Math.min(viewportWidth - box.width - 8, trigger.left + (trigger.width - box.width) / 2))}px`;
      tooltip.current.style.top = `${Math.max(8, Math.min(viewportHeight - box.height - 8, above ? trigger.top - box.height : trigger.bottom))}px`;
      tooltip.current.dataset.placement = above ? "top" : "bottom";
      tooltip.current.style.visibility = "visible";
    }
    function dismiss(event: KeyboardEvent) {
      if (event.key === "Escape") { setDismissed(true); event.stopPropagation(); }
    }
    position();
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    document.addEventListener("keydown", dismiss, true);
    return () => {
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
      document.removeEventListener("keydown", dismiss, true);
    };
  }, [open, label, tooltipPlacement]);
  return <span ref={anchor} className="mono-lab-control-tooltip-anchor"
    onPointerEnter={event => { if (event.pointerType !== "touch") enter(); }}
    onPointerLeave={leave}
    onFocus={() => { setFocused(true); setDismissed(false); }}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}
    onKeyDown={event => { if (event.key === "Escape" && open) { setDismissed(true); event.stopPropagation(); } }}>
    <button {...props} type={props.type ?? "button"} aria-label={label}
      aria-describedby={[props["aria-describedby"], open ? id : null].filter(Boolean).join(" ") || undefined}
      className={`mono-lab-control-icon-button ${className}`}>
      <span aria-hidden="true" className="mono-lab-control-icon">{children}</span>
    </button>
    {open && createPortal(<span ref={tooltip} id={id} role="tooltip" className="mono-lab-control-tooltip"
      onPointerEnter={enter} onPointerLeave={leave}><span>{label}</span></span>, document.body)}
  </span>;
}

export type MonoLabSliderRowProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  disabled?: boolean;
  onChange(value: number): void;
  onStart?(): void;
  onCommit?(value: number): void;
};

const RANGE_KEYS = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"]);

export function MonoLabSliderRow({ label, value, min, max, step, unit, disabled, onChange, onStart, onCommit }: MonoLabSliderRowProps) {
  const id = useId();
  const active = useRef(false);
  const numberEditing = useRef(false);
  const pending = useRef(value);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(String(value));
  const clamp = (next: number) => Number(Math.min(max, Math.max(min, min + Math.round((next - min) / step) * step)).toFixed(6));
  function start() {
    if (!active.current) { active.current = true; pending.current = value; onStart?.(); }
  }
  function finish() {
    if (active.current) { active.current = false; onCommit?.(pending.current); }
  }
  function commitNumber() {
    if (!numberEditing.current) return;
    numberEditing.current = false;
    setEditing(false);
    const parsed = Number(text);
    if (text.trim() !== "" && Number.isFinite(parsed)) {
      const next = clamp(parsed);
      if (next !== value) { start(); pending.current = next; onChange(next); finish(); }
    }
  }
  return <div className="mono-lab-control-slider-row" data-disabled={disabled || undefined}>
    <label htmlFor={id}>{label}</label>
    <div className="mono-lab-control-slider-inputs">
      <input id={id} type="range" min={min} max={max} step={step} value={value} disabled={disabled}
        aria-valuetext={`${value}${unit ? ` ${unit}` : ""}`}
        onPointerDown={event => { start(); event.currentTarget.setPointerCapture?.(event.pointerId); }}
        onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish} onBlur={finish}
        onKeyDown={event => { if (RANGE_KEYS.has(event.key)) start(); }}
        onKeyUp={event => { if (RANGE_KEYS.has(event.key)) finish(); }}
        onChange={event => { start(); pending.current = clamp(Number(event.target.value)); onChange(pending.current); }} />
      <span className="mono-lab-control-number-wrap">
        <input type="number" inputMode="decimal" aria-label={`${label} — значение`}
          min={min} max={max} step={step} value={editing ? text : value} disabled={disabled}
          onFocus={() => { numberEditing.current = true; setText(String(value)); setEditing(true); }}
          onChange={event => setText(event.target.value)} onBlur={commitNumber}
          onKeyDown={event => {
            if (event.key === "Enter") { commitNumber(); event.currentTarget.blur(); }
            if (event.key === "Escape") { numberEditing.current = false; setEditing(false); event.currentTarget.blur(); event.stopPropagation(); }
          }} />
        {unit && <span aria-hidden="true">{unit}</span>}
      </span>
    </div>
  </div>;
}

export function MonoLabSection({ title, children, defaultOpen = false }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  return <details className="mono-lab-control-section" open={defaultOpen}>
    <summary><span>{title}</span><span className="mono-lab-control-chevron" aria-hidden="true">⌄</span></summary>
    <div className="mono-lab-control-section-content">{children}</div>
  </details>;
}
