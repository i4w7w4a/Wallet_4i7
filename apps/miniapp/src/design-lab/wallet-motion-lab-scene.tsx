"use client";

import { useMemo, useState, type CSSProperties } from "react";
import type { ChartPeriod, WalletSnapshot } from "@wallet/core";
import { MonoProductScene } from "../mono-preview/mono-product-scene";
import type { MonoSection } from "../mono-preview/mono-scene";
import { createMonoAppearanceEnvelope } from "../mono-preview/mono-preset-envelope";
import { cardMotionVariables } from "../mono-product/motion/card-motion-preset";
import type { ControlFeedbackPreset } from "./control-feedback-model";
import styles from "./design-lab.module.css";

export function WalletMotionLabScene({ snapshot, preset }: { snapshot: WalletSnapshot; preset: ControlFeedbackPreset }) {
  const envelope = useMemo(() => createMonoAppearanceEnvelope("ledger"), []);
  const [balanceHidden, setBalanceHidden] = useState(snapshot.balance.hidden);
  const [period, setPeriod] = useState<ChartPeriod>("1D");
  const [section, setSection] = useState<MonoSection>("assets");
  const stageStyle = cardMotionVariables(preset) as CSSProperties;
  return <section aria-label="Примерка кошелька" className={styles.walletStage} style={stageStyle}>
    <div className={styles.walletStageViewport} style={{ "--mono-preview-width": `${preset.previewWidth}px` } as CSSProperties}>
      <div className={`mono-preview-frame ${styles.walletStageFrame}`} data-material-scrollport>
        <MonoProductScene snapshot={snapshot} appearance={envelope.appearance} material={envelope.material}
          viewport={preset.previewWidth} homeComposition="compact" historyPresentation="compact" assetsPresentation="wallet-selection"
          themePreference="fixed" quickActionPreset={preset}
          session={{ balanceHidden, onBalanceHiddenChange: setBalanceHidden, period, onPeriodChange: setPeriod,
            section, onSectionChange: setSection }} />
      </div>
    </div>
  </section>;
}
