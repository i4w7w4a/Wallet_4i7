"use client";

import { useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import "./mono-lab-controls.css";

export type MonoLabIconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> & { label: string };

/** The visual icon stays small; the semantic button remains 44 × 44. */
export function MonoLabIconButton({ label, children, className = "", ...props }: MonoLabIconButtonProps) {
  const id = useId();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const open = (hovered || focused) && !dismissed;
  return <span className="mono-lab-control-tooltip-anchor"
    onPointerEnter={event => { if (event.pointerType !== "touch") { setHovered(true); setDismissed(false); } }}
    onPointerLeave={() => setHovered(false)}
    onFocus={() => { setFocused(true); setDismissed(false); }}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}
    onKeyDown={event => { if (event.key === "Escape" && open) { setDismissed(true); event.stopPropagation(); } }}>
    <button {...props} type={props.type ?? "button"} aria-label={label}
      aria-describedby={[props["aria-describedby"], open ? id : null].filter(Boolean).join(" ") || undefined}
      className={`mono-lab-control-icon-button ${className}`}>
      <span aria-hidden="true" className="mono-lab-control-icon">{children}</span>
    </button>
    {open && <span id={id} role="tooltip" className="mono-lab-control-tooltip"><span>{label}</span></span>}
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
