"use client";
import { useEffect, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import type { MonoAppearance } from "./mono-preset-envelope";
import { readMonoShareFragment } from "./mono-share-codec";
import "./mono-viewer.css";

export type MonoViewerProps = { renderScene: (appearance: MonoAppearance) => ReactNode };

function subscribe(listener: () => void) {
  window.addEventListener("hashchange", listener);
  return () => window.removeEventListener("hashchange", listener);
}
const currentFragment = () => window.location.hash;
const serverFragment = () => null;
type Result = { fragment: string; appearance: MonoAppearance } | { fragment: string; error: string };

export function MonoViewer({ renderScene }: MonoViewerProps) {
  const fragment = useSyncExternalStore(subscribe, currentFragment, serverFragment);
  const [result, setResult] = useState<Result | null>(null);
  useEffect(() => {
    if (!fragment) return;
    let alive = true;
    void readMonoShareFragment(fragment).then(envelope => {
      if (alive) setResult({ fragment, appearance: envelope.appearance });
    }).catch(error => {
      if (alive) setResult({ fragment, error: error instanceof Error ? error.message : "Не удалось открыть оформление." });
    });
    return () => { alive = false; };
  }, [fragment]);

  const shown = result?.fragment === fragment ? result : null;
  const error = fragment === "" ? "В ссылке нет сохранённого оформления." : shown && "error" in shown ? shown.error : null;
  return <div className="mono-viewer" data-mono-viewer>
    {error ? <main className="mono-viewer__message" role="alert">
      <h1>Не удалось открыть оформление</h1><p>{error}</p><a href="/mono">Открыть редактор</a>
    </main> : shown && "appearance" in shown ?
      <div className="mono-preview-frame" style={{ "--mono-preview-width": "480px" } as CSSProperties}>
        {renderScene(shown.appearance)}
      </div> : <p className="mono-viewer__message" role="status">Загрузка оформления…</p>}
  </div>;
}
