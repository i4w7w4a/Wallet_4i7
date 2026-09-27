"use client";
import type { WalletSnapshot } from "@wallet/core";
import { MonoProductScene } from "./mono-product-scene";
import { useMonoSceneActivity } from "./mono-scene-activity";
import { MonoViewer } from "./mono-viewer";

export function MonoViewerPage({ snapshot }: { snapshot: WalletSnapshot }) {
  const hostActive = useMonoSceneActivity();
  return <MonoViewer renderScene={shared => <MonoProductScene snapshot={snapshot}
    appearance={shared.appearance} material={shared.material} active={hostActive} />} />;
}
