"use client";

import { useState, type CSSProperties } from "react";
import type { ChartPeriod, WalletSnapshot } from "@wallet/core";
import type { MonoAppearanceEnvelope } from "./mono-preset-envelope";
import type { MonoSection } from "./mono-scene";
import { MonoProductScene } from "./mono-product-scene";
import { useMonoSceneActivity } from "./mono-scene-activity";
import "./mono-viewer.css";

/** Read-only composition pilot. Saved Promo/chart/pin settings remain untouched. */
export function MonoCompactPilotViewer({ wallet, published }: {
  wallet: WalletSnapshot;
  published: MonoAppearanceEnvelope;
}) {
  const active = useMonoSceneActivity();
  // Own the live session in memory; standalone visitor preferences must not restore or persist here.
  const [balanceHidden, setBalanceHidden] = useState(wallet.balance.hidden);
  const [period, setPeriod] = useState<ChartPeriod>("1D");
  const [section, setSection] = useState<MonoSection>("overview");
  return <div className="mono-viewer" data-mono-compact-pilot>
    <div className="mono-preview-frame" data-material-scrollport
      style={{ "--mono-preview-width": "480px" } as CSSProperties}>
      <MonoProductScene snapshot={wallet} appearance={published.appearance}
        material={published.material} active={active} themePreference="fixed"
        session={{ balanceHidden, onBalanceHiddenChange: setBalanceHidden,
          period, onPeriodChange: setPeriod, section, onSectionChange: setSection }}
        homeComposition="compact" historyPresentation="compact" />
    </div>
  </div>;
}
