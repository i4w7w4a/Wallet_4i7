"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { BackgroundRuntimeStatus } from "./host-contract";
import type { BackgroundOverlay } from "./overlay";
import type { BackgroundEdgeFinishV1, MaterialAction, MaterialQualityProfile, MaterialRecipeV2, MaterialTargetBinding } from "./material-contract";
import { materialBindingsV2 } from "./registry-v2";
import { MaterialSceneBackend, type MaterialSceneInput } from "./material-scene-backend";

export function MaterialSceneSurface({ background = null, edgeFinish, bindings = [], quality, paused, restartKey,
  hostActive = true, overlay, transientAction, children, onStatus }: {
  background?: MaterialRecipeV2 | null;
  edgeFinish?: BackgroundEdgeFinishV1;
  bindings?: readonly MaterialTargetBinding[];
  quality: MaterialQualityProfile;
  paused: boolean;
  restartKey: number;
  hostActive?: boolean;
  overlay?: BackgroundOverlay;
  transientAction?: Readonly<{ requestId: number; action: MaterialAction }>;
  children?: ReactNode;
  onStatus?: (status: BackgroundRuntimeStatus) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const backend = useRef<MaterialSceneBackend | null>(null);
  const notify = useRef(onStatus);
  const [restoreGeneration, setRestoreGeneration] = useState(0);
  const [status, setStatus] = useState<BackgroundRuntimeStatus>({ phase: "initializing", message: "Подготовка материалов…" });
  const input = useMemo<MaterialSceneInput>(() => ({ background, edgeFinish, bindings, quality, paused, restartKey,
    hostActive, overlay, transientAction }), [background, edgeFinish, bindings, quality, paused, restartKey,
    hostActive, overlay, transientAction]);
  const latestInput = useRef(input);
  const fallback = materialBindingsV2.find(binding => binding.descriptor.id === background?.effectId)?.fallback.color ?? "#0c1119";
  useEffect(() => { notify.current = onStatus; }, [onStatus]);
  useEffect(() => { latestInput.current = input; }, [input]);
  useEffect(() => {
    if (!root.current) return;
    let live = true;
    let mounted: MaterialSceneBackend | null = null;
    try {
      mounted = new MaterialSceneBackend(root.current, latestInput.current, next => {
        queueMicrotask(() => { if (live) { setStatus(next); notify.current?.(next); } });
      }, () => setRestoreGeneration(generation => generation + 1));
      backend.current = mounted;
    } catch (error) {
      const fallbackStatus: BackgroundRuntimeStatus = { phase: "fallback",
        message: error instanceof Error ? error.message : "Материалы недоступны." };
      queueMicrotask(() => { if (live) { setStatus(fallbackStatus); notify.current?.(fallbackStatus); } });
    }
    return () => { live = false; mounted?.dispose(); if (backend.current === mounted) backend.current = null; };
  }, [restoreGeneration]);
  useEffect(() => { backend.current?.update(input); }, [input]);
  return <div ref={root} data-material-scene data-gpu-phase={status.phase}
    style={{ position: "relative", width: "100%", height: children ? "auto" : "100%",
      minHeight: children ? "100%" : 1, overflow: "hidden", backgroundColor: fallback,
      touchAction: background ? "pan-y" : "auto" }}>
    {children && <div style={{ position: "relative", zIndex: 1 }}>{children}</div>}
    {!children && (status.phase === "fallback" || status.phase === "lost") && <div role="status"
      style={{ position: "absolute", inset: 0, display: "grid", placeContent: "center",
        padding: 24, color: "#e1e6e9", background: fallback, textAlign: "center", fontSize: 14 }}>
      {status.message}
    </div>}
  </div>;
}
