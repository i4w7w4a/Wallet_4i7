"use client";
import { useEffect, useState } from "react";
import { loadMonoTypography } from "./mono-font-loader";
import type { MonoTypographyConfigV1 } from "./mono-typography";

type PreviewState = {
  key: string;
  active: MonoTypographyConfigV1 | null;
  status: "legacy" | "loading" | "ready" | "error";
};

/** Latest request wins; null is a displayed legacy state, not a hidden font cache. */
export function useMonoTypographyPreview(candidate: MonoTypographyConfigV1 | null) {
  const key = JSON.stringify(candidate);
  const [state, setState] = useState<PreviewState>(() => ({
    key, active: null, status: candidate === null ? "legacy" : "loading",
  }));
  let shown = state;
  if (state.key !== key) {
    // Adjust on the input transition, before children render. An effect-only reset
    // could expose A for a frame during A → legacy → B, or revive it after failure.
    shown = { key, active: candidate === null ? null : state.active, status: candidate === null ? "legacy" : "loading" };
    setState(shown);
  }
  useEffect(() => {
    const requested: unknown = JSON.parse(key);
    if (requested === null) return;
    let current = true;
    loadMonoTypography(requested).then(active => {
      if (current) setState(previous => previous.key === key ? { key, active, status: "ready" } : previous);
    }).catch(() => {
      if (current) setState(previous => previous.key === key ? { ...previous, status: "error" } : previous);
    });
    return () => { current = false; };
  }, [key]);
  return { active: shown.active, status: shown.status } as const;
}
