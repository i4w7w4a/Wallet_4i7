"use client";

import { useEffect, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";

import { magneticOffset, type ControlFeedbackPreset } from "../design-lab/control-feedback-model";

type QuickActionFeedback = Pick<ControlFeedbackPreset, "effectId" | "config">;

export const MONO_QUICK_ACTION_DEFAULT: QuickActionFeedback = {
  effectId: "material",
  config: { pressDepth: 2.7, magneticTravel: 5, settleMs: 270 },
};

type Props = {
  label: string;
  path: string;
  preset: QuickActionFeedback;
  onActivate: () => void;
};

export function MonoQuickActionFeedback({ label, path, preset, onActivate }: Props) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [keyboardPressed, setKeyboardPressed] = useState(false);
  const effectId = preset.effectId;
  const config = preset.config;

  useEffect(() => {
    if (effectId !== "magnetic") return;
    const resetWhenHidden = () => {
      if (document.visibilityState === "hidden") setOffset({ x: 0, y: 0 });
    };
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const resetWhenReduced = () => {
      if (reduced.matches) setOffset({ x: 0, y: 0 });
    };
    document.addEventListener("visibilitychange", resetWhenHidden);
    reduced.addEventListener("change", resetWhenReduced);
    return () => {
      document.removeEventListener("visibilitychange", resetWhenHidden);
      reduced.removeEventListener("change", resetWhenReduced);
    };
  }, [effectId]);

  const reset = () => setOffset({ x: 0, y: 0 });
  const keyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (effectId === "material" && (event.key === "Enter" || event.key === " " || event.key === "Spacebar")) {
      setKeyboardPressed(true);
    }
  };
  const move = (event: PointerEvent<HTMLButtonElement>) => {
    if (effectId !== "magnetic" || event.pointerType !== "mouse" ||
        document.visibilityState === "hidden" ||
        !window.matchMedia("(hover: hover) and (pointer: fine)").matches ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setOffset(magneticOffset({ x: event.clientX, y: event.clientY }, rect, config.magneticTravel));
  };
  const style = {
    "--press-depth": `${config.pressDepth}px`,
    "--settle-ms": `${config.settleMs}ms`,
  } as CSSProperties;
  const labelStyle: CSSProperties | undefined = effectId === "magnetic"
    ? {
      transform: `translate3d(${offset.x}px, ${offset.y}px, 0)`,
      transition: `transform ${config.settleMs}ms cubic-bezier(0.2, 0, 0, 1)`,
    }
    : undefined;

  return (
    <button className="mono-actions__item" type="button" data-control-effect={effectId}
      data-key-pressed={keyboardPressed}
      style={style} aria-label={`${label} — демо, операция недоступна`} onClick={onActivate}
      onPointerMove={move} onPointerLeave={reset} onPointerCancel={reset}
      onKeyDown={keyDown} onKeyUp={() => setKeyboardPressed(false)}
      onBlur={() => { reset(); setKeyboardPressed(false); }}>
      <span className="mono-actions__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d={path} /></svg>
      </span>
      <span className="mono-actions__label" style={labelStyle}>{label}</span>
    </button>
  );
}
