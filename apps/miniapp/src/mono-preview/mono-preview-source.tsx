"use client";

import { useEffect, useState } from "react";
import styles from "./mono-preview-source.module.css";

type PreviewInfo = { sourceId: string; sourceState: "working-tree" | "committed"; mode: "development" | "production" };

/** Workbench-only diagnostic. Visitors and published appearances never include this control. */
export function MonoPreviewSource() {
  const [info, setInfo] = useState<PreviewInfo | null>(null);
  const [revision, refresh] = useState(0);
  useEffect(() => {
    if (!["127.0.0.1", "localhost"].includes(window.location.hostname) || window.location.port !== "3184") return;
    const controller = new AbortController();
    void fetch("/api/preview-info", { cache: "no-store", signal: controller.signal }).then(async response => {
      if (!response.ok) return;
      const value = await response.json();
      if (!controller.signal.aborted && value.kind === "novex-local-preview" && /^[a-f0-9]{40}$/.test(value.sourceId) &&
        ["working-tree", "committed"].includes(value.sourceState) && ["development", "production"].includes(value.mode)) {
        setInfo({ sourceId: value.sourceId, sourceState: value.sourceState, mode: value.mode });
      }
    }).catch(() => {});
    return () => controller.abort();
  }, [revision]);
  if (!info) return null;
  return <button type="button" className={styles.source} onClick={() => refresh(value => value + 1)}
    aria-label="Обновить сведения о локальной версии"
    title={`Git ${info.sourceId}${info.sourceState === "working-tree" ? " · есть рабочие изменения" : ""}`}>
    <span>{info.mode === "development" ? "DEV" : "PREVIEW"} · {info.sourceId.slice(0, 7)}{info.sourceState === "working-tree" ? " *" : ""}</span>
    <span aria-hidden="true">3184 ↻</span>
  </button>;
}
