/*
Adapted for Wallet_4i7 from React Bits at commit
3a1c7f2f9f94ed833934ab5c2635760b9e644583.
Copyright (c) 2026 David Haz. MIT + Commons Clause License Condition v1.0.
Upstream: src/ts-default/Components/SpotlightCard/SpotlightCard.tsx
*/

"use client";

import { type PointerEvent, type PropsWithChildren, type ReactElement, useRef } from "react";

import "./spotlight-surface.css";

type SpotlightSurfaceProps = PropsWithChildren<{
  as?: "section" | "article" | "div";
  "aria-label"?: string;
  className?: string;
  finePointer: boolean;
  spotlightColor?: string;
}>;

export function SpotlightSurface(props: SpotlightSurfaceProps): ReactElement {
  const {
    as: Tag = "div",
    "aria-label": ariaLabel,
    children,
    className,
    finePointer,
    spotlightColor = "color-mix(in srgb, var(--color-accent, #5b8cff) 28%, transparent)",
  } = props;
  const rootRef = useRef<HTMLElement | null>(null);

  function onPointerMove(event: PointerEvent<HTMLElement>) {
    if (!finePointer || !rootRef.current) {
      return;
    }

    const rect = rootRef.current.getBoundingClientRect();
    rootRef.current.style.setProperty("--spotlight-x", `${event.clientX - rect.left}px`);
    rootRef.current.style.setProperty("--spotlight-y", `${event.clientY - rect.top}px`);
    rootRef.current.style.setProperty("--spotlight-color", spotlightColor);
  }

  return (
    <Tag
      ref={(node) => {
        rootRef.current = node;
      }}
      className={["wallet-spotlight", className].filter(Boolean).join(" ")}
      aria-label={ariaLabel}
      data-spotlight={finePointer ? "enabled" : "disabled"}
      onPointerMove={finePointer ? onPointerMove : undefined}
    >
      {children}
    </Tag>
  );
}
