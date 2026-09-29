"use client";

import type { CSSProperties } from "react";
import type { WalletSnapshot } from "@wallet/core";
import type { MonoAppearanceEnvelope } from "./mono-preset-envelope";
import { MonoProductScene } from "./mono-product-scene";
import { useMonoSceneActivity } from "./mono-scene-activity";
import "./mono-viewer.css";

/** The same product scene as portable viewing, fed by a server-held stable revision. */
export function MonoPublishedViewer({ wallet, published }: {
  wallet: WalletSnapshot;
  published: MonoAppearanceEnvelope;
}) {
  const active = useMonoSceneActivity();
  return <div className="mono-viewer" data-mono-published-viewer>
    <div className="mono-preview-frame"
      data-material-scrollport={Boolean(published.material.background || published.material.buttons?.bindings.length) || undefined}
      style={{ "--mono-preview-width": "480px" } as CSSProperties}>
      <MonoProductScene snapshot={wallet} appearance={published.appearance}
        material={published.material} active={active} />
    </div>
  </div>;
}
