/*
Adapted for Wallet_4i7 from React Bits at commit
3a1c7f2f9f94ed833934ab5c2635760b9e644583.
Copyright (c) 2026 David Haz. MIT + Commons Clause License Condition v1.0.
Upstream: src/ts-default/Components/GlassIcons/GlassIcons.tsx
*/

"use client";

import { type KeyboardEvent, type ReactNode } from "react";

import "./glass-action.css";

type GlassActionProps = {
  label: string;
  icon: ReactNode;
  onAction(): void;
  className?: string;
};

export function GlassAction(props: GlassActionProps) {
  const { label, icon, onAction, className } = props;

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onAction();
    }
  }

  return (
    <button
      type="button"
      className={["glass-action", className].filter(Boolean).join(" ")}
      aria-label={label}
      onClick={onAction}
      onKeyDown={onKeyDown}
    >
      <span
        className="glass-action__back"
        aria-hidden="true"
        style={{ ["--glass-action-transition" as string]: "transform" }}
      />
      <span className="glass-action__front" aria-hidden="true">
        <span className="glass-action__core" />
        <span className="glass-action__lens" />
        <span className="glass-action__rim" />
      </span>
      <span
        className="glass-action__icon"
        aria-hidden="true"
        style={{ ["--glyph-filter" as string]: "none", ["--glyph-color" as string]: "#e8f4ff" }}
      >
        {icon}
      </span>
      <span className="glass-action__label">{label}</span>
    </button>
  );
}
