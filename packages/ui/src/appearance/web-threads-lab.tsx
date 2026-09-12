"use client";

import type { ChangeEvent } from "react";
import type { VisualEffectsConfig } from "@wallet/core";

import { useVisualEffects } from "./visual-effects-provider";
import "./web-threads-lab.css";

const RANGE_FIELDS = [
  ["speed", "Скорость", 0, 3, 0.05],
  ["threadCount", "Количество нитей", 1, 10, 1],
  ["frequency", "Частота", 0.5, 8, 0.1],
  ["spread", "Разброс", 0, 1, 0.01],
  ["taper", "Сужение", 0, 1, 0.01],
  ["position", "Положение", 0, 1, 0.01],
  ["glow", "Свечение", 0.01, 0.25, 0.01],
  ["falloff", "Затухание", 0.5, 4, 0.05],
  ["thickness", "Толщина", 0.1, 2, 0.05],
  ["brightness", "Яркость", 0.1, 3, 0.05],
  ["opacity", "Прозрачность нитей", 0, 1, 0.01],
  ["grainIntensity", "Интенсивность зерна", 0, 0.5, 0.01],
  ["pointerStrength", "Сила указателя", 0, 1, 0.01],
] as const satisfies ReadonlyArray<
  readonly [
    keyof Pick<
      VisualEffectsConfig,
      | "speed"
      | "threadCount"
      | "frequency"
      | "spread"
      | "taper"
      | "position"
      | "glow"
      | "falloff"
      | "thickness"
      | "brightness"
      | "opacity"
      | "grainIntensity"
      | "pointerStrength"
    >,
    string,
    number,
    number,
    number,
  ]
>;

const BOOLEAN_FIELDS = [
  ["mirror", "Зеркальность"],
  ["shimmer", "Мерцание"],
  ["grain", "Зерно"],
  ["pointerInteraction", "Реакция на указатель"],
] as const satisfies ReadonlyArray<
  readonly [
    keyof Pick<VisualEffectsConfig, "mirror" | "shimmer" | "grain" | "pointerInteraction">,
    string,
  ]
>;

export function WebThreadsLab() {
  const { effects, setEffects, resetEffects } = useVisualEffects();

  function setNumber(
    key: (typeof RANGE_FIELDS)[number][0],
    event: ChangeEvent<HTMLInputElement>,
  ) {
    setEffects({ [key]: Number(event.target.value) });
  }

  return (
    <div className="web-threads-lab">
      <div className="web-threads-lab__ranges">
        {RANGE_FIELDS.map(([key, label, min, max, step]) => (
          <label key={key} className="web-threads-lab__range">
            <span>{label}</span>
            <input
              type="range"
              aria-label={label}
              min={min}
              max={max}
              step={step}
              value={effects[key]}
              onChange={(event) => setNumber(key, event)}
            />
            <span className="web-threads-lab__value" aria-hidden="true">
              {effects[key]}
            </span>
          </label>
        ))}
      </div>

      <label className="web-threads-lab__select">
        <span>Режим веера</span>
        <select
          aria-label="Режим веера"
          value={effects.fanMode}
          onChange={(event) =>
            setEffects({ fanMode: event.target.value as VisualEffectsConfig["fanMode"] })
          }
        >
          <option value="center">По центру</option>
          <option value="left">Слева</option>
          <option value="right">Справа</option>
        </select>
      </label>

      <div className="web-threads-lab__toggles">
        {BOOLEAN_FIELDS.map(([key, label]) => (
          <label key={key} className="web-threads-lab__toggle">
            <input
              type="checkbox"
              aria-label={label}
              checked={effects[key]}
              onChange={(event) => setEffects({ [key]: event.target.checked })}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>

      <button type="button" className="web-threads-lab__reset" onClick={resetEffects}>
        Сбросить эффекты
      </button>
    </div>
  );
}
