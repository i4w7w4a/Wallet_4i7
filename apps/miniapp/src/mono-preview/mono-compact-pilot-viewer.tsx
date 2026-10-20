"use client";

import type { CSSProperties } from "react";
import type { WalletSnapshot } from "@wallet/core";
import type { MonoAppearanceEnvelope } from "./mono-preset-envelope";
import { MonoProductScene } from "./mono-product-scene";
import { useMonoSceneActivity } from "./mono-scene-activity";
import "./mono-viewer.css";

/** Read-only composition pilot. Saved Promo/chart/pin settings remain untouched. */
export function MonoCompactPilotViewer({ wallet, published }: {
  wallet: WalletSnapshot;
  published: MonoAppearanceEnvelope;
}) {
  const active = useMonoSceneActivity();
  return <div className="mono-viewer" data-mono-compact-pilot>
    <div className="mono-preview-frame" data-material-scrollport
      style={{ "--mono-preview-width": "480px" } as CSSProperties}>
      <MonoProductScene snapshot={wallet} appearance={published.appearance}
        material={published.material} active={active} themePreference="fixed"
        homeComposition="compact" historyPresentation="compact" />
    </div>
  </div>;
}
