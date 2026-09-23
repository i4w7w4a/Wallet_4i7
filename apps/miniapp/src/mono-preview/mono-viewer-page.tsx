"use client";
import type { WalletSnapshot } from "@wallet/core";
import { MonoScene } from "./mono-scene";
import { useMonoSceneActivity } from "./mono-scene-activity";
import { MonoViewer } from "./mono-viewer";

export function MonoViewerPage({ snapshot }: { snapshot: WalletSnapshot }) {
  const hostActive = useMonoSceneActivity();
  return <MonoViewer renderScene={appearance => <MonoScene snapshot={snapshot} appearance={appearance} active={hostActive} />} />;
}
