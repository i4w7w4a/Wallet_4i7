"use client";

import { useEffect, useRef, useState, type CSSProperties, type FocusEvent, type KeyboardEvent, type PointerEvent } from "react";

import { magneticOffset, type ControlFeedbackPreset } from "../design-lab/control-feedback-model";
import type { ButtonTargetId } from "@wallet/ui";
import { MonoActionArtwork } from "./action-artwork/mono-action-artwork";
import type { MonoActionArtworkV1 } from "./action-artwork/model";

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
  materialTargetId?: ButtonTargetId;
  materialRadiusCss?: number;
  actionId?: ButtonTargetId;
  artwork?: MonoActionArtworkV1;
  active?: boolean;
  manualPreviewTrigger?: number;
};

export function MonoQuickActionFeedback({ label, path, preset, onActivate, materialTargetId, materialRadiusCss,
  actionId, artwork, active = true, manualPreviewTrigger = 0 }: Props) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [keyboardPressed, setKeyboardPressed] = useState(false);
  const [energyTrigger, setEnergyTrigger] = useState(0);
  const lastManualPreview = useRef(manualPreviewTrigger);
  const effectId = preset.effectId;
  const config = preset.config;

  useEffect(() => {
    if (lastManualPreview.current === manualPreviewTrigger) return;
    const freshRequest = manualPreviewTrigger > lastManualPreview.current;
    lastManualPreview.current = manualPreviewTrigger;
    if (freshRequest && active && artwork && artwork.packId !== "original" &&
        artwork.energy.enabled && artwork.energy.intensity > 0) setEnergyTrigger(value => value + 1);
  }, [active, artwork, manualPreviewTrigger]);

  const pulse = () => {
    if (active && artwork && artwork.packId !== "original" && artwork.energy.enabled &&
        artwork.energy.intensity > 0) setEnergyTrigger(value => value + 1);
  };
  const fineEnter = (event: PointerEvent<HTMLButtonElement>) => {
    if ((event.pointerType === "mouse" || event.pointerType === "pen") &&
        window.matchMedia("(hover: hover) and (pointer: fine)").matches) pulse();
  };
  const keyboardFocus = (event: FocusEvent<HTMLButtonElement>) => {
    if (event.currentTarget.matches(":focus-visible")) pulse();
  };

  useEffect(() => {
    const resetWhenHidden = () => {
      if (document.visibilityState === "hidden") {
        setOffset({ x: 0, y: 0 });
        setKeyboardPressed(false);
      }
    };
    document.addEventListener("visibilitychange", resetWhenHidden);
    if (effectId !== "magnetic") return () => document.removeEventListener("visibilitychange", resetWhenHidden);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const resetWhenReduced = () => {
      if (reduced.matches) setOffset({ x: 0, y: 0 });
    };
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
    ...(materialRadiusCss === undefined ? {} : { "--mono-button-radius": `${materialRadiusCss}px` }),
  } as CSSProperties;
  const labelStyle: CSSProperties | undefined = effectId === "magnetic"
    ? {
      transform: `translate3d(${offset.x}px, ${offset.y}px, 0)`,
      transition: `transform ${config.settleMs}ms cubic-bezier(0.2, 0, 0, 1)`,
    }
    : undefined;

  return (
    <button className="mono-actions__item" type="button" data-control-effect={effectId}
      data-material-target={materialTargetId}
      data-key-pressed={keyboardPressed}
      data-artwork-pack={artwork?.packId}
      style={style} aria-label={`${label} — демо, операция недоступна`} onClick={() => { pulse(); onActivate(); }}
      onPointerEnter={fineEnter} onFocus={keyboardFocus}
      onPointerMove={move} onPointerLeave={reset} onPointerCancel={reset}
      onKeyDown={keyDown} onKeyUp={() => setKeyboardPressed(false)}
      onBlur={() => { reset(); setKeyboardPressed(false); }}>
      <span className="mono-actions__icon" aria-hidden="true">
        {artwork && artwork.packId !== "original" && actionId
          ? <MonoActionArtwork key={artwork.packId} actionId={actionId} config={artwork} active={active} trigger={energyTrigger} />
          : <svg viewBox="0 0 24 24"><path d={path} /></svg>}
      </span>
      <span className="mono-actions__label" style={labelStyle}>{label}</span>
    </button>
  );
}
