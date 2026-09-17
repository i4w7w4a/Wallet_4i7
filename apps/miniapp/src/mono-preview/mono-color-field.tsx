"use client";

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import "./mono-color-field.css";

export type MonoColorFieldValue = { hue: number; chroma: number };
export type MonoColorFieldProps = MonoColorFieldValue & {
  maxChroma: number;
  onChange: (value: MonoColorFieldValue) => void;
  onGestureStart: () => void;
  onGestureEnd: () => void;
};

const clamp = (value: number, min: number, max: number): number =>
  Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min;
const wrapHue = (value: number): number => Number.isFinite(value) ? ((value % 360) + 360) % 360 : 0;
const quietZero = (value: number): number => Math.abs(value) < 1e-12 ? 0 : value;

/** Coordinates are relative to the field box; 0° is north, clockwise. */
export function monoColorFieldPoint(
  x: number, y: number, width: number, height: number, maxChroma: number, fallbackHue = 0,
): MonoColorFieldValue {
  const radius = Math.min(width, height) / 2;
  if (!Number.isFinite(radius) || radius <= 0) return { hue: wrapHue(fallbackHue), chroma: 0 };
  const dx = x - width / 2, dy = y - height / 2;
  const distance = Math.hypot(dx, dy);
  const hue = distance < 1e-9 ? wrapHue(fallbackHue) : wrapHue(Math.atan2(dx, -dy) * 180 / Math.PI);
  const fraction = clamp(distance / radius, 0, 1);
  const safeMax = Number.isFinite(maxChroma) ? Math.max(0, maxChroma) : 0;
  return { hue, chroma: Number((fraction * fraction * safeMax).toFixed(6)) };
}

/** Signed radius units; multiply by the current field radius for the puck. */
export function monoColorFieldPosition(hue: number, chroma: number, maxChroma: number): { x: number; y: number } {
  const fraction = maxChroma > 0 && Number.isFinite(maxChroma) ? Math.sqrt(clamp(chroma / maxChroma, 0, 1)) : 0;
  const angle = wrapHue(hue) * Math.PI / 180;
  return { x: quietZero(Math.sin(angle) * fraction), y: quietZero(-Math.cos(angle) * fraction) };
}

export function MonoColorField({ hue, chroma, maxChroma, onChange, onGestureStart, onGestureEnd }: MonoColorFieldProps) {
  const fieldRef = useRef<HTMLDivElement>(null);
  const activePointer = useRef<number | null>(null);
  const activeRangePointer = useRef<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [radius, setRadius] = useState(110);
  const safeMax = Number.isFinite(maxChroma) && maxChroma > 0 ? maxChroma : 0;
  const position = monoColorFieldPosition(hue, chroma, safeMax);
  const style = {
    "--mono-puck-x": `${position.x * radius}px`,
    "--mono-puck-y": `${position.y * radius}px`,
    "--mono-puck-color": `oklch(70% ${clamp(chroma, 0, safeMax).toFixed(3)} ${wrapHue(hue).toFixed(1)})`,
  } as CSSProperties;

  useEffect(() => {
    const element = fieldRef.current;
    if (!element) return;
    const measure = () => {
      const bounds = element.getBoundingClientRect();
      const next = Math.min(bounds.width, bounds.height) / 2;
      if (next > 0) setRadius(next);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const updateFromPointer = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return;
    const nextRadius = Math.min(bounds.width, bounds.height) / 2;
    if (nextRadius !== radius) setRadius(nextRadius);
    onChange(monoColorFieldPoint(event.clientX - bounds.left, event.clientY - bounds.top,
      bounds.width, bounds.height, safeMax, hue));
  };

  const finishFieldGesture = (event: PointerEvent<HTMLDivElement>, includePosition: boolean) => {
    if (activePointer.current !== event.pointerId) return;
    if (includePosition) updateFromPointer(event);
    activePointer.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    onGestureEnd();
  };

  const beginRangeGesture = (event: PointerEvent<HTMLInputElement>) => {
    if (activeRangePointer.current !== null) return;
    activeRangePointer.current = event.pointerId;
    onGestureStart();
  };
  const endRangeGesture = (event: PointerEvent<HTMLInputElement>) => {
    if (activeRangePointer.current !== event.pointerId) return;
    activeRangePointer.current = null;
    onGestureEnd();
  };

  return <div className="mono-color-field-control">
    <div ref={fieldRef} role="group" aria-label="Цветовое поле"
      className={`mono-color-field${dragging ? " is-dragging" : ""}`} style={style}
      onPointerDown={event => {
        if (activePointer.current !== null) return;
        activePointer.current = event.pointerId;
        event.currentTarget.setPointerCapture?.(event.pointerId);
        setDragging(true);
        onGestureStart();
        updateFromPointer(event);
      }}
      onPointerMove={event => { if (activePointer.current === event.pointerId) updateFromPointer(event); }}
      onPointerUp={event => finishFieldGesture(event, true)}
      onPointerCancel={event => finishFieldGesture(event, false)}
      onLostPointerCapture={event => finishFieldGesture(event, false)}>
      <span className="mono-color-field-center" aria-hidden="true" />
      <span className="mono-color-field-puck" aria-hidden="true" />
    </div>
    <div className="mono-color-field-ranges">
      <label className="mono-color-field-range">
        <span>Тон <output>{Math.round(wrapHue(hue))}°</output></span>
        <input type="range" aria-label="Тон" min="0" max="359" step="1" value={Math.round(wrapHue(hue))}
          onChange={event => onChange({ hue: Number(event.currentTarget.value), chroma })}
          onPointerDown={beginRangeGesture} onPointerUp={endRangeGesture} onPointerCancel={endRangeGesture} />
      </label>
      <label className="mono-color-field-range">
        <span>Интенсивность <output>{Math.round(safeMax > 0 ? chroma / safeMax * 100 : 0)}%</output></span>
        <input type="range" aria-label="Интенсивность" min="0" max="100" step="1" value={Math.round(safeMax > 0 ? clamp(chroma / safeMax * 100, 0, 100) : 0)}
          onChange={event => onChange({ hue, chroma: Number((Number(event.currentTarget.value) / 100 * safeMax).toFixed(6)) })}
          onPointerDown={beginRangeGesture} onPointerUp={endRangeGesture} onPointerCancel={endRangeGesture} />
      </label>
    </div>
  </div>;
}
