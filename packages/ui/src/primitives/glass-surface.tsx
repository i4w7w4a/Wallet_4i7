"use client";

import { createContext, useContext, useSyncExternalStore, type HTMLAttributes } from "react";

import "./primitives.css";

export const GlassNestingContext = createContext(false);

export function GlassSurface(
  props: HTMLAttributes<HTMLDivElement> & {
    variant?: "regular" | "clear";
    interactive?: boolean;
  },
) {
  const { variant = "regular", interactive = false, className, children, ...rest } = props;
  const nested = useContext(GlassNestingContext);
  const backdropSupported = useSyncExternalStore(noopSubscribe, supportsBackdropBlur, () => false);
  const classNames = ["glass-surface", className].filter(Boolean).join(" ");

  if (nested) {
    return (
      <div data-glass-nested="true" className={classNames} {...rest}>
        {children}
      </div>
    );
  }

  return (
    <GlassNestingContext.Provider value={true}>
      <div
        className={classNames}
        data-glass-variant={variant}
        data-interactive={interactive ? "true" : "false"}
        data-backdrop={backdropSupported ? "supported" : "unsupported"}
        {...rest}
      >
        {children}
      </div>
    </GlassNestingContext.Provider>
  );
}

function noopSubscribe() {
  return () => undefined;
}

function supportsBackdropBlur(): boolean {
  if (typeof CSS === "undefined" || typeof CSS.supports !== "function") {
    return false;
  }

  return CSS.supports("backdrop-filter", "blur(1px)") || CSS.supports("-webkit-backdrop-filter", "blur(1px)");
}
