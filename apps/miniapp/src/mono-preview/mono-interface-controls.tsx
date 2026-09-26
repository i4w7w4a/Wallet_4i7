"use client";

import { useId } from "react";
import { MONO_NAVIGATION_BOUNDS, type MonoNavigationAppearance } from "./mono-interface-appearance";
import "./mono-interface-controls.css";

export function MonoNavigationControls({ value, onChange }: {
  value: Readonly<MonoNavigationAppearance>;
  onChange: (value: MonoNavigationAppearance) => void;
}) {
  const id = useId();
  const styled = value.indicator !== "original";
  const choices = [
    { id: "original", label: "Исходный", glyph: "▣" },
    { id: "line", label: "Линия", glyph: "━" },
    { id: "capsule", label: "Капсула", glyph: "▬" },
    { id: "dot", label: "Точка", glyph: "●" },
  ] as const;
  return <div className="mono-interface-controls" data-mono-control>
    <div className="mono-interface-controls__field"><span>Индикатор</span>
      <div className="mono-interface-controls__choices" role="group" aria-label="Вид индикатора">
        {choices.map(choice => <button key={choice.id} type="button" title={choice.label}
          aria-label={choice.label} aria-pressed={value.indicator === choice.id}
          onClick={() => onChange({ ...value, indicator: choice.id })}>
          <span aria-hidden="true">{choice.glyph}</span><small>{choice.label}</small>
        </button>)}
      </div>
    </div>
    {!styled && <p className="mono-interface-controls__hint">В исходном виде действует оформление направления; тонкие настройки доступны после выбора индикатора.</p>}
    {styled && value.glowPercent === 0 && <p className="mono-interface-controls__hint">Мягкость станет доступна после включения свечения.</p>}
    <label className="mono-interface-controls__field" htmlFor={`${id}-glow`}>
      <span>Свечение <output>{value.glowPercent}%</output></span>
      <input id={`${id}-glow`} type="range" disabled={!styled}
        min={MONO_NAVIGATION_BOUNDS.glowPercent.min} max={MONO_NAVIGATION_BOUNDS.glowPercent.max}
        step={MONO_NAVIGATION_BOUNDS.glowPercent.step} value={value.glowPercent}
        onChange={event => onChange({ ...value, glowPercent: Number(event.currentTarget.value) })} />
    </label>
    <label className="mono-interface-controls__field" htmlFor={`${id}-softness`}>
      <span>Мягкость <output>{value.softnessPx} px</output></span>
      <input id={`${id}-softness`} type="range" disabled={!styled || value.glowPercent === 0}
        min={MONO_NAVIGATION_BOUNDS.softnessPx.min} max={MONO_NAVIGATION_BOUNDS.softnessPx.max}
        step={MONO_NAVIGATION_BOUNDS.softnessPx.step} value={value.softnessPx}
        onChange={event => onChange({ ...value, softnessPx: Number(event.currentTarget.value) })} />
    </label>
    <label className="mono-interface-controls__check" htmlFor={`${id}-shimmer`}>
      <input id={`${id}-shimmer`} type="checkbox" disabled={!styled} checked={value.shimmerEnabled}
        onChange={event => onChange({ ...value, shimmerEnabled: event.currentTarget.checked })} />
      <span>Перелив</span>
    </label>
    <label className="mono-interface-controls__field" htmlFor={`${id}-period`}>
      <span>Период <output>{value.periodSeconds} с</output></span>
      <input id={`${id}-period`} type="range" disabled={!styled || !value.shimmerEnabled}
        min={MONO_NAVIGATION_BOUNDS.periodSeconds.min} max={MONO_NAVIGATION_BOUNDS.periodSeconds.max}
        step={MONO_NAVIGATION_BOUNDS.periodSeconds.step} value={value.periodSeconds}
        onChange={event => onChange({ ...value, periodSeconds: Number(event.currentTarget.value) })} />
    </label>
  </div>;
}
