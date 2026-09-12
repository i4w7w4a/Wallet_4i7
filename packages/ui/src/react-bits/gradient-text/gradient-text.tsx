/*
Adapted for Wallet_4i7 from React Bits at commit
3a1c7f2f9f94ed833934ab5c2635760b9e644583.
Copyright (c) 2026 David Haz. MIT + Commons Clause License Condition v1.0.
Upstream: src/ts-default/TextAnimations/GradientText/GradientText.tsx
*/

"use client";

import { type CSSProperties, type ReactNode, useCallback, useSyncExternalStore } from "react";

import "./gradient-text.css";

type GradientTextProps = {
  children: ReactNode;
  className?: string;
  colors?: string[];
  reducedMotion: boolean;
  saveData?: boolean;
  active?: boolean;
  animationSpeed?: number;
};

export function GradientText(props: GradientTextProps) {
  const {
    children,
    className,
    colors = ["var(--color-accent, #5b8cff)", "var(--color-glass-tint, #7c6cff)", "#d7f3ff"],
    reducedMotion,
    saveData = false,
    active = true,
    animationSpeed = 8,
  } = props;
  const hidden = useDocumentHidden();
  const staticText = reducedMotion || saveData || !active;
  const gradientColors = [...colors, colors[0]].join(", ");
  const style = {
    "--gradient-image": `linear-gradient(to right, ${gradientColors})`,
    "--gradient-speed": `${animationSpeed}s`,
  } as CSSProperties;

  if (staticText) {
    return (
      <span className={["wallet-gradient-text", "wallet-gradient-text--static", className].filter(Boolean).join(" ")}>
        {children}
      </span>
    );
  }

  return (
    <span
      className={["wallet-gradient-text", "wallet-gradient-text--animated", className].filter(Boolean).join(" ")}
      data-paused={hidden ? "true" : "false"}
      style={style}
    >
      {children}
    </span>
  );
}

function useDocumentHidden(): boolean {
  const subscribe = useCallback((notify: () => void) => {
    document.addEventListener("visibilitychange", notify);
    return () => document.removeEventListener("visibilitychange", notify);
  }, []);

  return useSyncExternalStore(subscribe, () => document.hidden, () => false);
}
