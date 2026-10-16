"use client";

import { createContext, forwardRef, useCallback, useContext, useLayoutEffect, useMemo, useRef,
  useState, useSyncExternalStore, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { normalizeMonoGlassSettings, type MonoGlassSettings, type MonoOpticalLease,
  type MonoOpticalPreset, type MonoSharedOpticalHost } from "@wallet/ui";
import "./product-glass-surface.css";

export type ProductGlassProviderProps = {
  sharedHost?: MonoSharedOpticalHost;
  preset: MonoOpticalPreset;
  settings?: Partial<MonoGlassSettings>;
  active?: boolean;
  /** Use the host's existing accessibility preference; this module owns no storage. */
  opaque?: boolean;
  children: ReactNode;
};
type GlassContext = {
  sharedHost?: MonoSharedOpticalHost; settings: MonoGlassSettings; active: boolean; opaque: boolean;
};
const GlassContext = createContext<GlassContext | null>(null);

export function ProductGlassProvider({ sharedHost, preset, settings, active = true, opaque = false,
  children }: ProductGlassProviderProps) {
  const value = useMemo(() => ({ sharedHost, settings: normalizeMonoGlassSettings(preset, settings), active, opaque }),
    [sharedHost, preset, settings, active, opaque]);
  return <GlassContext.Provider value={value}>{children}</GlassContext.Provider>;
}

type Connection = { saveData?: boolean; addEventListener?(type: string, listener: () => void): void;
  removeEventListener?(type: string, listener: () => void): void };
const connection = () => (navigator as Navigator & { connection?: Connection }).connection;
const motionQuery = "(prefers-reduced-motion: reduce)";
const transparencyQuery = "(prefers-reduced-transparency: reduce)";
const contrastQuery = "(forced-colors: active)";
function capabilitySnapshot(): "live" | "fallback" | "opaque" {
  if (window.matchMedia?.(transparencyQuery).matches || window.matchMedia?.(contrastQuery).matches) return "opaque";
  return window.matchMedia?.(motionQuery).matches || connection()?.saveData || document.visibilityState === "hidden"
    ? "fallback" : "live";
}
const serverCapability = () => "fallback" as const;
function subscribeCapabilities(listener: () => void) {
  const queries = [motionQuery, transparencyQuery, contrastQuery].map(query => window.matchMedia?.(query));
  const network = connection();
  queries.forEach(query => query?.addEventListener?.("change", listener));
  network?.addEventListener?.("change", listener);
  document.addEventListener("visibilitychange", listener);
  return () => {
    queries.forEach(query => query?.removeEventListener?.("change", listener));
    network?.removeEventListener?.("change", listener);
    document.removeEventListener("visibilitychange", listener);
  };
}

/** A single live DOM panel. Dialog/focus/scroll/motion remain the shell's responsibility. */
export const ProductGlassSurface = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<"div">>(
  function ProductGlassSurface({ className, children, ...props }, forwardedRef) {
    const context = useContext(GlassContext);
    const root = useRef<HTMLDivElement | null>(null);
    const lease = useRef<MonoOpticalLease | null>(null);
    const [presented, setPresented] = useState(false);
    const capability = useSyncExternalStore(subscribeCapabilities, capabilitySnapshot, serverCapability);
    const host = context?.sharedHost;
    const opaque = Boolean(context?.opaque || capability === "opaque");
    const enabled = Boolean(host && context?.active && !opaque && capability === "live");
    const settings = context?.settings;
    const currentSettings = useRef(settings);
    useLayoutEffect(() => {
      currentSettings.current = settings;
      if (settings) lease.current?.update(settings);
    }, [settings]);
    const attachRef = useCallback((element: HTMLDivElement | null) => {
      root.current = element;
      if (typeof forwardedRef === "function") forwardedRef(element);
      else if (forwardedRef) forwardedRef.current = element;
    }, [forwardedRef]);

    useLayoutEffect(() => {
      const element = root.current;
      setPresented(false);
      if (!enabled || !host || !element || !currentSettings.current) return;
      let live = true;
      const owned = host.register(element, currentSettings.current, {
        source: "background", onPresented: next => { if (live) setPresented(next); },
      });
      lease.current = owned;
      const invalidate = () => owned.invalidate?.();
      const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(invalidate);
      observer?.observe(element);
      window.addEventListener("resize", invalidate);
      document.addEventListener("scroll", invalidate, true);
      element.addEventListener("animationstart", invalidate);
      element.addEventListener("animationend", invalidate);
      element.addEventListener("transitionend", invalidate);
      return () => {
        live = false;
        observer?.disconnect();
        window.removeEventListener("resize", invalidate);
        document.removeEventListener("scroll", invalidate, true);
        element.removeEventListener("animationstart", invalidate);
        element.removeEventListener("animationend", invalidate);
        element.removeEventListener("transitionend", invalidate);
        owned.dispose();
        if (lease.current === owned) lease.current = null;
      };
    }, [enabled, host]);

    return <div {...props} ref={attachRef} className={["mono-product-glass", className].filter(Boolean).join(" ")}
      data-product-glass={opaque ? "opaque" : enabled && presented ? "shared-webgl" : "fallback"}>
      {children}
    </div>;
  },
);
