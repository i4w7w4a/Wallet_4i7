"use client";
import { useEffect, useState } from "react";
import { loadMonoTypography } from "./mono-font-loader";
import type { MonoTypographyConfigV1 } from "./mono-typography";

/** Latest request wins; failed/slow faces never replace the last ready specimen. */
export function useMonoTypographyPreview(candidate: MonoTypographyConfigV1 | null) {
  const [ready, setReady] = useState<{ config: MonoTypographyConfigV1 | null; key: string }>({ config: candidate, key: "" });
  const [failure, setFailure] = useState<string | null>(null);
  const key = JSON.stringify(candidate);
  useEffect(() => {
    if (!candidate) return;
    let current = true;
    loadMonoTypography(candidate).then(config => {
      if (current) { setReady({ config, key }); setFailure(null); }
    }).catch(() => { if (current) setFailure(key); });
    return () => { current = false; };
  }, [candidate, key]);
  return { active: candidate === null ? null : ready.config, status: candidate === null ? "legacy" : failure === key ? "error" : ready.key === key ? "ready" : "loading" } as const;
}
