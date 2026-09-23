"use client";

import { useState } from "react";

import { MONO_SHAPE_RADIUS_BOUNDS, type MonoShapeGroup } from "./mono-shape-preview";
export type { MonoShapeGroup } from "./mono-shape-preview";

const GROUPS: ReadonlyArray<{ id: MonoShapeGroup; label: string }> = [
  { id: "quick-actions", label: "Быстрые действия" },
  { id: "bottom-navigation", label: "Нижнее меню" },
];

export function MonoShapeTuner({
  values,
  dirty,
  status,
  onChange,
  onDefault,
  onCancel,
  onApply,
  onOpenMotionLab,
  motionLabStatus,
}: {
  values: Record<MonoShapeGroup, number>;
  dirty: boolean;
  status: string;
  onChange: (group: MonoShapeGroup, radius: number) => void;
  onDefault: () => void;
  onCancel: () => void;
  onApply: () => void;
  onOpenMotionLab?: (anchor: HTMLAnchorElement) => void;
  motionLabStatus?: string;
}) {
  const [group, setGroup] = useState<MonoShapeGroup>("quick-actions");
  const radius = values[group];
  const [exactEdit, setExactEdit] = useState<{
    group: MonoShapeGroup;
    baseRadius: number;
    value: string;
  } | null>(null);
  const exactRadius = exactEdit?.group === group && exactEdit.baseRadius === radius
    ? exactEdit.value
    : String(radius);

  function updateExactRadius(value: string) {
    setExactEdit({ group, baseRadius: radius, value });
    if (value.trim() === "") return;
    const next = Number(value);
    if (!Number.isInteger(next) || next < MONO_SHAPE_RADIUS_BOUNDS.min || next > MONO_SHAPE_RADIUS_BOUNDS.max) return;
    onChange(group, next);
  }

  return (
    <div className="mono-shape-tuner" role="group" aria-label="Настройка формы" data-mono-control>
      <p>Выбери группу и настрой её скругление. Центральная сцена меняется сразу.</p>
      <div className="mono-shape-tuner__groups" role="radiogroup" aria-label="Редактируемая группа">
        {GROUPS.map((item) => (
          <label key={item.id}>
            <input type="radio" name="mono-shape-group" value={item.id} checked={group === item.id}
              onChange={() => setGroup(item.id)} />
            <span><span>{item.label}</span><i aria-hidden="true">{group === item.id ? "✓" : ""}</i></span>
          </label>
        ))}
      </div>
      <div className="mono-shape-tuner__radius">
        <span className="mono-shape-tuner__radius-head">
          <label htmlFor="mono-shape-radius">Радиус формы</label>
          <output htmlFor="mono-shape-radius">{radius} px</output>
        </span>
        <input id="mono-shape-radius" type="range"
          min={MONO_SHAPE_RADIUS_BOUNDS.min} max={MONO_SHAPE_RADIUS_BOUNDS.max}
          step={MONO_SHAPE_RADIUS_BOUNDS.step} value={radius}
          onChange={(event) => onChange(group, Number(event.currentTarget.value))} />
        <label className="mono-shape-tuner__exact-field">
          <span>Точное значение</span>
          <input className="mono-shape-tuner__exact" type="number" inputMode="numeric"
            min={MONO_SHAPE_RADIUS_BOUNDS.min} max={MONO_SHAPE_RADIUS_BOUNDS.max}
            step={MONO_SHAPE_RADIUS_BOUNDS.step} value={exactRadius}
            aria-label="Радиус: точное значение"
            onChange={(event) => updateExactRadius(event.currentTarget.value)}
            onBlur={() => setExactEdit(null)} />
        </label>
      </div>
      <div className="mono-shape-tuner__actions">
        <button type="button" onClick={onDefault}>По умолчанию</button>
        <button type="button" aria-disabled={!dirty} onClick={() => { if (dirty) onCancel(); }}>Отменить пробу формы</button>
        <button type="button" aria-disabled={!dirty} onClick={() => { if (dirty) onApply(); }}>Применить форму</button>
      </div>
      {group === "quick-actions" && onOpenMotionLab && (
        <div className="mono-shape-tuner__motion">
          <strong>Отклик быстрых действий</strong>
          <p>Настройте четыре действия в отдельной вкладке. Применение видно здесь, но исчезает после перезагрузки.</p>
          <a href="/design-lab" target="_blank" rel="noopener noreferrer"
            onClick={(event) => onOpenMotionLab(event.currentTarget)}>Открыть Motion Lab <span aria-hidden="true">↗</span></a>
          <p role="status" aria-label="Состояние Motion Lab">{motionLabStatus}</p>
        </div>
      )}
      <p className="mono-shape-tuner__status" role="status" aria-label="Состояние формы"
        aria-live="polite">{status}</p>
    </div>
  );
}
