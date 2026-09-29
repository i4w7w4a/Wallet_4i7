"use client";

import { useId, useState } from "react";
import { FLUID_VIEWPORT_RESPONSE_BOUNDS, parseFluidViewportResponse,
  type FluidViewportResponseV1 } from "@wallet/ui";
import { MonoLabSliderRow } from "../../mono-preview/mono-lab-controls";
import styles from "./viewport-response-controls.module.css";

export function ViewportResponseControls({ value, disabled, onChange, onStart, onCommit }: {
  value: FluidViewportResponseV1;
  disabled?: boolean;
  onChange(value: FluidViewportResponseV1): void;
  onStart?(): void;
  onCommit?(): void;
}) {
  const [opened, setOpened] = useState(false);
  const id = useId();
  function set(next: FluidViewportResponseV1) {
    const parsed = parseFluidViewportResponse(next);
    if (parsed) onChange(parsed);
  }
  function changePercent(key: "strength" | "inertia" | "edgeResponse", percent: number) {
    set({ ...value, [key]: Math.round(percent) / 100 });
  }
  return <section className={styles.root} aria-label="Внутри экрана">
    <button className={styles.disclosure} type="button" aria-expanded={opened} aria-controls={id}
      onClick={() => setOpened(current => !current)}>
      <span>Внутри экрана</span><span aria-hidden="true">{opened ? "−" : "+"}</span>
    </button>
    {opened && <div id={id} className={styles.controls}>
      <p>Жидкость остаётся в видимом экране кошелька. Прокрутка и касания работают как обычно.</p>
      <label className={styles.toggle}>
        <input type="checkbox" checked={value.enabled} disabled={disabled}
          onChange={event => set({ ...value, enabled: event.currentTarget.checked })} />
        Реагировать на прокрутку
      </label>
      {(["strength", "inertia", "edgeResponse"] as const).map(key => <MonoLabSliderRow key={key}
        label={{ strength: "Сила прокрутки", inertia: "Инерция", edgeResponse: "Отклик краёв" }[key]}
        value={Math.round(value[key] * 100)} min={FLUID_VIEWPORT_RESPONSE_BOUNDS[key].min * 100}
        max={FLUID_VIEWPORT_RESPONSE_BOUNDS[key].max * 100}
        step={FLUID_VIEWPORT_RESPONSE_BOUNDS[key].step * 100} unit="%"
        disabled={disabled || !value.enabled || (key !== "strength" && value.strength === 0)}
        onChange={next => changePercent(key, next)} onStart={onStart} onCommit={onCommit} />)}
    </div>}
  </section>;
}
