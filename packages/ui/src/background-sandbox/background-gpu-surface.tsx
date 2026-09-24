"use client";

import { useEffect, useRef, useState } from "react";
import type { BackgroundRecipe } from "./contracts";
import type { BackgroundRuntimeStatus } from "./host-contract";
import type { MaterialBinding } from "./material-binding";
import { createGpuBackend } from "./gpu-backend";
import { mountSurface, type SurfaceInput } from "./surface-lifecycle";

export function BackgroundGpuSurface({ material, recipe, paused, restartKey, hostActive = true,
  effectsDisabled = false, onStatus }: {
  material: MaterialBinding; recipe: BackgroundRecipe; paused: boolean; restartKey: number;
  hostActive?: boolean; effectsDisabled?: boolean;
  onStatus?: (status: BackgroundRuntimeStatus) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const host = useRef<ReturnType<typeof mountSurface> | null>(null);
  const notify = useRef(onStatus);
  const [initial] = useState<SurfaceInput>(() => ({ material, recipe, paused, restartKey, hostActive, effectsDisabled }));
  const [status, setStatus] = useState<BackgroundRuntimeStatus>({ phase: "initializing", message: "Подготовка материала…" });
  useEffect(() => { notify.current = onStatus; }, [onStatus]);
  useEffect(() => {
    if (!root.current) return;
    const mounted = mountSurface(root.current, initial, createGpuBackend, next => { setStatus(next); notify.current?.(next); });
    host.current = mounted;
    return () => { mounted.dispose(); if (host.current === mounted) host.current = null; };
  }, [initial]);
  useEffect(() => {
    host.current?.update({ material, recipe, paused, restartKey, hostActive, effectsDisabled });
  }, [material, recipe, paused, restartKey, hostActive, effectsDisabled]);
  const unavailable = status.phase === "fallback" || status.phase === "lost";
  return <div ref={root} data-background-surface data-effect-id={recipe.effectId} data-gpu-phase={status.phase}
    style={{ position: "relative", width: "100%", height: "100%", minHeight: 1, overflow: "hidden", backgroundColor: material.fallback.color }}>
    {unavailable && <div role="status" data-background-fallback style={{ position: "absolute", inset: 0, display: "grid",
      placeContent: "center", padding: 24, color: "#e1e6e9", background: material.fallback.color, textAlign: "center", fontSize: 14 }}>
      <strong>{material.fallback.label}</strong><p>{status.message}</p>
    </div>}
  </div>;
}
