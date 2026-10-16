"use client";

import { useEffect, useRef } from "react";
import { createGoldLiquidRenderer, GOLD_LIQUID_INTERACTION_LIMITS,
  type GoldLiquidInteraction, type GoldLiquidRenderer } from "./mono-gold-liquid-renderer";
import { GOLD_LIQUID_DEFAULTS, normalizeGoldLiquidSettings, type GoldLiquidSettings } from "./mono-gold-liquid-settings";

/** Owns only a decorative viewport layer. It never queries DOM text or wallet state. */
export function MonoGoldLiquidBackground({ active = true, effectsDisabled = false,
  settings = GOLD_LIQUID_DEFAULTS }: {
  active?: boolean; effectsDisabled?: boolean; settings?: Readonly<GoldLiquidSettings>;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputs = useRef({ active, effectsDisabled, settings: normalizeGoldLiquidSettings(settings) });
  const runtime = useRef<{ refresh(): void } | null>(null);
  useEffect(() => {
    inputs.current = { active, effectsDisabled, settings: normalizeGoldLiquidSettings(settings) };
    runtime.current?.refresh();
  }, [active, effectsDisabled, settings]);

  useEffect(() => {
    const root = rootRef.current, canvas = canvasRef.current;
    if (!root || !canvas) return;
    const doc = root.ownerDocument, view = doc.defaultView;
    if (!view) return;
    const scrollport = root.closest<HTMLElement>("[data-material-scrollport]") ?? root.parentElement ?? root;
    const reducedMotion = view.matchMedia("(prefers-reduced-motion: reduce)");
    const reducedTransparency = view.matchMedia("(prefers-reduced-transparency: reduce)");
    const forcedColors = view.matchMedia("(forced-colors: active)");
    const connection = (view.navigator as Navigator & {
      connection?: EventTarget & { readonly saveData?: boolean };
    }).connection;
    let renderer: GoldLiquidRenderer | null = null;
    let raf: number | null = null, lastStamp: number | null = null, lastDraw: number | null = null;
    let activeSeconds = 0, responseSeconds = 0, disposed = false, failed = false, generation = 0;
    let intersecting = typeof view.IntersectionObserver !== "function";
    let tapAt: number | null = null, tapUv: readonly [number, number] = [0.5, 0.5];
    let scrollAt: number | null = null, scrollImpulse = 0, lastScrollTop = scrollport.scrollTop;
    let needsResponseClear = false;
    const resetInteraction = () => {
      tapAt = null; scrollAt = null; scrollImpulse = 0; needsResponseClear = false;
      lastScrollTop = scrollport.scrollTop;
    };
    const hasResponse = () => (tapAt !== null && responseSeconds - tapAt < GOLD_LIQUID_INTERACTION_LIMITS.tapLifetime) ||
      (scrollAt !== null && responseSeconds - scrollAt < GOLD_LIQUID_INTERACTION_LIMITS.scrollLifetime);
    const response = (): GoldLiquidInteraction | undefined => {
      if (tapAt !== null && responseSeconds - tapAt >= GOLD_LIQUID_INTERACTION_LIMITS.tapLifetime) tapAt = null;
      if (scrollAt !== null && responseSeconds - scrollAt >= GOLD_LIQUID_INTERACTION_LIMITS.scrollLifetime) scrollAt = null;
      if (tapAt === null && scrollAt === null) return undefined;
      const scrollAge = scrollAt === null ? 1 : Math.min(1,
        Math.max(0, (responseSeconds - scrollAt) / GOLD_LIQUID_INTERACTION_LIMITS.scrollLifetime));
      const scrollFade = 1 - scrollAge * scrollAge * (3 - 2 * scrollAge);
      return { tapUv, tapAge: tapAt === null ? GOLD_LIQUID_INTERACTION_LIMITS.tapLifetime : responseSeconds - tapAt,
        tapStrength: tapAt === null ? 0 : 1, scrollShiftCss: scrollImpulse * scrollFade };
    };
    // This DOM state belongs to the imperative canvas host, not product/controller state.
    const mark = (phase: "idle" | "ready" | "disabled" | "fallback") => {
      if (disposed) return;
      if (root.dataset.goldLiquidState !== phase) root.dataset.goldLiquidState = phase;
      if (canvas.hidden !== (phase !== "ready")) canvas.hidden = phase !== "ready";
    };
    const stop = (resetClock = true) => {
      generation++;
      if (raf !== null) view.cancelAnimationFrame(raf);
      raf = null;
      if (resetClock) { lastStamp = null; lastDraw = null; resetInteraction(); }
    };
    const release = () => { renderer?.dispose(); renderer = null; };
    const fallback = () => { stop(); failed = true; release(); mark("fallback"); };
    const draw = () => {
      try {
        const drawn = renderer?.render(activeSeconds, response()) ?? false;
        if (drawn && !hasResponse()) needsResponseClear = false;
        return drawn;
      }
      catch { return false; }
    };
    const motionAllowed = () => !disposed && !failed && inputs.current.active &&
      !inputs.current.effectsDisabled && doc.visibilityState !== "hidden" && intersecting &&
      !reducedMotion.matches && !reducedTransparency.matches && !forcedColors.matches && !connection?.saveData;
    const opticalEnabled = () => inputs.current.settings.ior !== 0 &&
      (!inputs.current.settings.fieldEnabled || inputs.current.settings.fieldStrength > 0);
    const ambientMoving = () => motionAllowed() && opticalEnabled() &&
      inputs.current.settings.flowSpeed > 0 && inputs.current.settings.flowStrength > 0;
    const schedule = () => {
      const scheduledGeneration = generation;
      raf = view.requestAnimationFrame(timestamp => frame(timestamp, scheduledGeneration));
    };
    const frame = (timestamp: number, scheduledGeneration: number) => {
      if (disposed || failed || !renderer || scheduledGeneration !== generation) return;
      raf = null;
      if (lastStamp === null) { lastStamp = timestamp; lastDraw = timestamp; }
      else {
        const elapsed = Math.max(0, (timestamp - lastStamp) / 1000);
        activeSeconds += Math.min(0.05, elapsed);
        // Ambient drift avoids a jump; an old tap must still expire after a stalled visible frame.
        responseSeconds += elapsed;
        lastStamp = timestamp;
        if (lastDraw === null || timestamp - lastDraw >= 1000 / 30) {
          if (!draw()) { fallback(); return; }
          mark("ready");
          lastDraw = timestamp;
        }
      }
      if (ambientMoving() || hasResponse() || needsResponseClear) schedule();
      else stop();
    };
    const refresh = () => {
      if (disposed) return;
      stop(false);
      if (inputs.current.effectsDisabled || reducedTransparency.matches || forcedColors.matches) {
        stop(); release(); mark("disabled"); return;
      }
      if (!inputs.current.active || doc.visibilityState === "hidden" || !intersecting) { stop(); return; }
      if (failed) { mark("fallback"); return; }
      // The fixed layer retains its viewport box when the failed/initial canvas is hidden.
      const rect = root.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) { stop(); mark("idle"); return; }
      const initial = renderer === null;
      if (!renderer) renderer = createGoldLiquidRenderer(canvas, inputs.current.settings);
      if (!renderer) { fallback(); return; }
      const settings = inputs.current.settings;
      try {
        renderer.update(settings);
        if (!renderer.resize(rect.width, rect.height, view.devicePixelRatio)) { fallback(); return; }
      } catch { fallback(); return; }
      if (!motionAllowed() || !opticalEnabled()) resetInteraction();
      const moving = ambientMoving() || hasResponse() || needsResponseClear;
      if (initial || !moving) {
        if (!draw()) { fallback(); return; }
        mark("ready");
      }
      if (moving) schedule();
      else stop();
    };
    const wakeResponse = () => {
      if (raf !== null) return;
      lastStamp = null; lastDraw = null;
      schedule();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!renderer || !motionAllowed() || !opticalEnabled() || event.button !== 0 || event.isPrimary === false) return;
      const target = event.target as Element | null;
      if (target?.closest?.("[inert], :disabled, [aria-disabled='true']")) return;
      const rect = root.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0 || !Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return;
      tapUv = [Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
        Math.min(1, Math.max(0, 1 - (event.clientY - rect.top) / rect.height))];
      tapAt = responseSeconds; needsResponseClear = true;
      wakeResponse();
    };
    const onPointerCancel = () => {
      if (tapAt === null) return;
      tapAt = null; needsResponseClear = true;
      if (renderer && motionAllowed() && opticalEnabled()) wakeResponse();
    };
    const onScroll = () => {
      const nextTop = scrollport.scrollTop, delta = nextTop - lastScrollTop;
      lastScrollTop = nextTop;
      if (!renderer || !motionAllowed() || !opticalEnabled() || delta === 0 || !Number.isFinite(delta)) return;
      scrollImpulse = Math.min(GOLD_LIQUID_INTERACTION_LIMITS.scrollShiftCss,
        Math.max(-GOLD_LIQUID_INTERACTION_LIMITS.scrollShiftCss, delta * 0.12 + scrollImpulse * 0.25));
      scrollAt = responseSeconds; needsResponseClear = true;
      wakeResponse();
    };
    const onLost = (event: Event) => { event.preventDefault(); if (!disposed) fallback(); };
    const onRestored = () => { if (!disposed) { release(); failed = false; refresh(); } };
    const resize = typeof view.ResizeObserver === "function" ? new view.ResizeObserver(refresh) : null;
    const intersection = typeof view.IntersectionObserver === "function" ? new view.IntersectionObserver(entries => {
      if (disposed) return;
      intersecting = entries.some(entry => entry.isIntersecting && entry.intersectionRatio > 0);
      refresh();
    }, { threshold: 0 }) : null;
    resize?.observe(root);
    intersection?.observe(root.closest("[data-material-scrollport]") ?? root);
    doc.addEventListener("visibilitychange", refresh);
    view.addEventListener("resize", refresh);
    for (const media of [reducedMotion, reducedTransparency, forcedColors]) media.addEventListener("change", refresh);
    connection?.addEventListener("change", refresh);
    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);
    scrollport.addEventListener("pointerdown", onPointerDown, { passive: true });
    scrollport.addEventListener("pointercancel", onPointerCancel, { passive: true });
    scrollport.addEventListener("scroll", onScroll, { passive: true });
    const handle = { refresh };
    runtime.current = handle;
    refresh();
    return () => {
      disposed = true; stop(); release(); resize?.disconnect(); intersection?.disconnect();
      doc.removeEventListener("visibilitychange", refresh); view.removeEventListener("resize", refresh);
      for (const media of [reducedMotion, reducedTransparency, forcedColors]) media.removeEventListener("change", refresh);
      connection?.removeEventListener("change", refresh);
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      scrollport.removeEventListener("pointerdown", onPointerDown);
      scrollport.removeEventListener("pointercancel", onPointerCancel);
      scrollport.removeEventListener("scroll", onScroll);
      if (runtime.current === handle) runtime.current = null;
    };
  }, []);
  return <div ref={rootRef} className="mono-gold-liquid" data-gold-liquid-state="idle" aria-hidden="true">
    <canvas ref={canvasRef} aria-hidden="true" hidden />
  </div>;
}
