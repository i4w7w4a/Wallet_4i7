"use client";

import { useCallback, useState } from "react";

import { deriveThemeTokens } from "@wallet/core";

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
  const tokens = deriveThemeTokens(theme);
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
          effects={effects}
          colors={{
            color1: theme.accent,
            color2: theme.glassTint,
            color3: tokens.textPrimary,
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
