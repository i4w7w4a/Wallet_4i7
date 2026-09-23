"use client";
import type { WalletSnapshot } from "@wallet/core";
import { MonoScene } from "./mono-scene";
import { MonoViewer } from "./mono-viewer";

export function MonoViewerPage({ snapshot }: { snapshot: WalletSnapshot }) {
  return <MonoViewer renderScene={appearance => <MonoScene snapshot={snapshot} appearance={appearance} />} />;
}
