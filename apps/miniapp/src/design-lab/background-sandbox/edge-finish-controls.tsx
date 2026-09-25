"use client";

import { useState } from "react";
import { BACKGROUND_EDGE_FINISH_BOUNDS, normalizeBackgroundEdgeFinish, type BackgroundEdgeFinishV1 } from "@wallet/ui";
import { MonoLabSliderRow } from "../../mono-preview/mono-lab-controls";
import styles from "./edge-finish-controls.module.css";

export function EdgeFinishControls({ value, disabled, onChange, onStart, onCommit }: {
  value: BackgroundEdgeFinishV1;
  disabled?: boolean;
  onChange(value: BackgroundEdgeFinishV1): void;
  onStart?(): void;
  onCommit?(): void;
}) {
  const [opened, setOpened] = useState(false);
  const detailDisabled = disabled || value.sideDarkening <= 0;
  function set(key: "sideDarkening" | "inset" | "softness", next: number) {
    onChange(normalizeBackgroundEdgeFinish({ ...value, [key]: next }));
  }
  return <section className={styles.root} aria-label="Отделка краёв">
    <button className={styles.disclosure} type="button" aria-expanded={opened}
      aria-controls="background-edge-finish-controls" onClick={() => setOpened(current => !current)}>
      <span aria-hidden="true" className={styles.icon}>◧</span><span>Края</span><span aria-hidden="true">{opened ? "−" : "+"}</span>
    </button>
    {opened && <div className={styles.controls} id="background-edge-finish-controls">
      <p>Отделка действует только на пиксели фона. Текст и кнопки не меняются.</p>
      {value.sideDarkening <= 0 && <p>Задайте затемнение, чтобы настроить ширину и мягкость перехода.</p>}
      <MonoLabSliderRow label="Затемнение боков" value={value.sideDarkening}
        min={BACKGROUND_EDGE_FINISH_BOUNDS.sideDarkening[0]} max={BACKGROUND_EDGE_FINISH_BOUNDS.sideDarkening[1]} step={0.01}
        disabled={disabled} onChange={next => set("sideDarkening", next)} onStart={onStart} onCommit={onCommit} />
      <MonoLabSliderRow label="Ширина тёмной зоны" value={value.inset}
        min={BACKGROUND_EDGE_FINISH_BOUNDS.inset[0]} max={BACKGROUND_EDGE_FINISH_BOUNDS.inset[1]} step={0.01}
        disabled={detailDisabled} onChange={next => set("inset", next)} onStart={onStart} onCommit={onCommit} />
      <MonoLabSliderRow label="Мягкость перехода" value={value.softness}
        min={BACKGROUND_EDGE_FINISH_BOUNDS.softness[0]} max={BACKGROUND_EDGE_FINISH_BOUNDS.softness[1]} step={0.01}
        disabled={detailDisabled} onChange={next => set("softness", next)} onStart={onStart} onCommit={onCommit} />
    </div>}
  </section>;
}
