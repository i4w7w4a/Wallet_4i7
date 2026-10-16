"use client";

import { useCallback, useLayoutEffect, useRef, type RefObject } from "react";

const SECTION_ORDER = ["overview", "assets", "history", "profile"] as const;
export type ProductViewIdentity = { section: typeof SECTION_ORDER[number]; assetId: string | null };
type Entry = { duration: number; offset: number };
type Batch = Map<Animation, HTMLElement>;
const EASE = "cubic-bezier(.2,0,0,1)";

function entryFor(previous: ProductViewIdentity | null, next: ProductViewIdentity): Entry | null {
  if (!previous) return null;
  if (previous.section !== next.section) return {
    duration: 280,
    offset: SECTION_ORDER.indexOf(next.section) > SECTION_ORDER.indexOf(previous.section) ? 6 : -6,
  };
  if (previous.assetId === next.assetId) return null;
  return { duration: 300, offset: next.assetId ? 12 : -12 };
}

function motionAllowed(surface: HTMLElement): boolean {
  const doc = surface.ownerDocument;
  return surface.dataset.monoMotion === "ready" && doc.visibilityState !== "hidden" &&
    !doc.defaultView?.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/** One current content tree, using existing siblings so the scene's layout order stays intact. */
export function useProductViewMotion({ surfaceRef, contentRef, view: { section, assetId }, enabled }: {
  surfaceRef: RefObject<HTMLElement | null>;
  contentRef: RefObject<HTMLElement | null>;
  view: ProductViewIdentity;
  enabled: boolean;
}) {
  const previousView = useRef<ProductViewIdentity | null>(null);
  const current = useRef<Batch | null>(null);
  const cancel = useCallback(() => {
    const batch = current.current;
    current.current = null;
    batch?.forEach((element, animation) => {
      animation.onfinish = null;
      animation.oncancel = null;
      animation.cancel();
      element.removeAttribute("data-product-view-motion-target");
    });
  }, []);

  useLayoutEffect(() => {
    const entry = entryFor(previousView.current, { section, assetId });
    previousView.current = { section, assetId };
    if (!enabled) { cancel(); return; }
    if (!entry) return;
    cancel();
    const surface = surfaceRef.current, content = contentRef.current;
    if (!surface || !content || !motionAllowed(surface)) return;
    const batch: Batch = new Map();
    current.current = batch;
    const easing = surface.ownerDocument.defaultView?.getComputedStyle(surface)
      .getPropertyValue("--mono-product-motion-ease").trim() || EASE;
    for (const element of Array.from(content.children)) {
      if (!(element instanceof HTMLElement) || element.matches(".mono-app-header, .mono-product-context") ||
          typeof element.animate !== "function") continue;
      element.setAttribute("data-product-view-motion-target", "");
      try {
        const animation = element.animate([
          { opacity: .88, transform: `translate3d(${entry.offset}px, 0, 0)` },
          { opacity: 1, transform: "none" },
        ], { duration: entry.duration, easing, fill: "both" });
        batch.set(animation, element);
        const settle = () => {
          if (current.current !== batch || !batch.delete(animation)) return;
          animation.onfinish = null;
          animation.oncancel = null;
          animation.cancel();
          element.removeAttribute("data-product-view-motion-target");
          if (!batch.size) current.current = null;
        };
        animation.onfinish = settle;
        animation.oncancel = settle;
      } catch {
        // Unsupported WAAPI keeps the already committed view in its visible resting state.
        element.removeAttribute("data-product-view-motion-target");
        cancel();
        return;
      }
    }
    if (!batch.size) current.current = null;
  }, [section, assetId, enabled, surfaceRef, contentRef, cancel]);

  useLayoutEffect(() => {
    const surface = surfaceRef.current;
    if (!surface || !enabled) return;
    const doc = surface.ownerDocument;
    const reduced = doc.defaultView?.matchMedia?.("(prefers-reduced-motion: reduce)");
    const settleIfDisabled = () => { if (!motionAllowed(surface)) cancel(); };
    const observer = new MutationObserver(settleIfDisabled);
    observer.observe(surface, { attributes: true, attributeFilter: ["data-mono-motion"] });
    reduced?.addEventListener("change", settleIfDisabled);
    doc.addEventListener("visibilitychange", settleIfDisabled);
    return () => {
      observer.disconnect();
      reduced?.removeEventListener("change", settleIfDisabled);
      doc.removeEventListener("visibilitychange", settleIfDisabled);
      cancel();
    };
  }, [surfaceRef, enabled, cancel]);
}
