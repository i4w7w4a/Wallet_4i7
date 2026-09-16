"use client";

import { useCallback, useState } from "react";

import {
  WebThreads,
  type WebThreadsProps,
} from "../react-bits/web-threads/web-threads";
import { useTheme } from "../theme/theme-provider";
import { useVisualEffects } from "./visual-effects-provider";
import "./wallet-visual-layer.css";

export type VisualRuntimeCapabilities = {
  hostActive: boolean;
  documentVisible: boolean;
  reducedMotion: boolean;
  reducedTransparency: boolean;
  saveData: boolean;
  coarsePointer: boolean;
};

export function WalletVisualLayer({
  runtime,
  engineFactory,
}: {
  runtime: VisualRuntimeCapabilities;
  engineFactory?: WebThreadsProps["engineFactory"];
}) {
  const { theme } = useTheme();
  const { effects } = useVisualEffects();
  const [unavailable, setUnavailable] = useState(false);
  const animated =
    runtime.hostActive &&
    runtime.documentVisible &&
    !runtime.reducedMotion &&
    !runtime.saveData;
  const mountWebGl = !runtime.reducedMotion && !runtime.saveData && !unavailable;
  const showFallback = !animated || unavailable;
  const dashboardEffects = {
    ...effects,
    spread: effects.spread * 0.4,
    taper: effects.taper * 0.45,
    position: 0.65 + effects.position * 0.15,
    glow: Math.max(0.0045, effects.glow * 0.06),
    falloff: 0.65 + effects.falloff * 0.1,
    thickness: Math.max(0.02, effects.thickness * 0.05),
    brightness: Math.min(3, effects.brightness * 2.4),
    opacity: Math.min(0.96, effects.opacity * 1.04),
  };
  const onUnavailable = useCallback(() => setUnavailable(true), []);

  return (
    <div
      className="wallet-visual-layer"
      data-testid="wallet-visual-layer"
      data-wallet-visual-layer
      data-active={animated ? "true" : "false"}
      data-reduced-transparency={runtime.reducedTransparency ? "true" : "false"}
      aria-hidden="true"
    >
      {mountWebGl ? (
        <WebThreads
          effects={dashboardEffects}
          colors={{
            color1: theme.accent,
            color2: "#67E8FF",
            color3: "#8AF4FF",
            backgroundColor: theme.background,
          }}
          active={animated}
          coarsePointer={runtime.coarsePointer}
          onUnavailable={onUnavailable}
          engineFactory={engineFactory}
        />
      ) : null}
      {showFallback ? (
        // UI package is framework-neutral; the poster is a static decorative asset.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="wallet-visual-layer__fallback"
          src="/media/liquid-hero-poster.avif"
          alt=""
          data-testid="visual-fallback"
          data-visual-fallback
        />
      ) : null}
      <span className="wallet-visual-layer__mask" data-visual-mask />
      <span className="wallet-visual-layer__scrim" data-visual-scrim />
      <span className="wallet-visual-layer__noise" data-visual-noise />
    </div>
  );
}
