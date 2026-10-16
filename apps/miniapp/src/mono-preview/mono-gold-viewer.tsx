"use client";

import { useState, type CSSProperties } from "react";
import type { WalletSnapshot } from "@wallet/core";
import { MonoProductScene } from "./mono-product-scene";
import { useMonoSceneActivity } from "./mono-scene-activity";
import { MONO_GOLD_ENVELOPE, MONO_GOLD_PAINT } from "./mono-gold-appearance";
import { MonoGoldLiquidBackground } from "./mono-gold-liquid-background";
import { MonoGoldLiquidTuner } from "./mono-gold-liquid-tuner";
import { normalizeGoldLiquidSettings } from "./mono-gold-liquid-settings";
import "./mono-viewer.css";
import "./mono-gold.css";
import "./mono-gold-smoked-glass.css";

export function MonoGoldViewer({ snapshot, effectsDisabled = false }: {
  snapshot: WalletSnapshot;
  effectsDisabled?: boolean;
}) {
  const active = useMonoSceneActivity();
  const [balanceDynamicsEnabled, setBalanceDynamicsEnabled] = useState(false);
  const [liquidSettings, setLiquidSettings] = useState(() => normalizeGoldLiquidSettings({}));
  return <div className="mono-viewer mono-gold-viewer" data-mono-gold-viewer data-gold-effects={effectsDisabled ? "off" : "on"} style={MONO_GOLD_PAINT}>
    <div className="mono-preview-frame" data-material-scrollport
      style={{ "--mono-preview-width": "480px" } as CSSProperties}>
      <MonoProductScene snapshot={snapshot} appearance={MONO_GOLD_ENVELOPE.appearance}
        material={MONO_GOLD_ENVELOPE.material} active={active} effectsDisabled={effectsDisabled}
        themePreference="fixed" presentation="gold"
        atmosphere={<MonoGoldLiquidBackground active={active} effectsDisabled={effectsDisabled} settings={liquidSettings} />}
        balanceDynamics={{ enabled: balanceDynamicsEnabled, disabled: !active,
          onChange: enabled => { if (active) setBalanceDynamicsEnabled(enabled); } }} />
    </div>
    <MonoGoldLiquidTuner settings={liquidSettings} onChange={setLiquidSettings} />
  </div>;
}
