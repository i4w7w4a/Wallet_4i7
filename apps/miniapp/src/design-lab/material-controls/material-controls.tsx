"use client";

import { useId, useRef, useState } from "react";
import type { MaterialAction, MaterialCapability, MaterialDescriptorV2, MaterialRecipeV2, ParameterControl, ParameterGroup, ParameterValue } from "@wallet/ui";
import { MonoLabSliderRow } from "../../mono-preview/mono-lab-controls";
import styles from "./material-controls.module.css";

export type MaterialControlsProps = {
  descriptor: MaterialDescriptorV2;
  recipe: MaterialRecipeV2;
  capability?: MaterialCapability;
  disabled?: boolean;
  /** Only full, descriptor-validated recipes reach the editor. */
  onChange(recipe: MaterialRecipeV2): void;
  onGestureStart?(): void;
  onGestureCommit?(): void;
  onError?(message: string): void;
  /** Runtime-only command: never written into params or Save history. */
  onAction?(action: MaterialAction): void;
};

const GROUPS: readonly Readonly<{ id: ParameterGroup; label: string; icon: string }>[] = [
  { id: "color", label: "Цвет", icon: "◉" },
  { id: "motion", label: "Движение", icon: "↝" },
  { id: "surface", label: "Форма / поверхность", icon: "▰" },
  { id: "light", label: "Свет", icon: "✦" },
  { id: "physics", label: "Физика", icon: "∿" },
  { id: "precise", label: "Точно", icon: "⋯" },
];

function ColorInput({ label, value, disabled, onStart, onFinish, onValue }: {
  label: string; value: string; disabled: boolean; onStart?(): void; onFinish?(): void; onValue(value: string): void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const draftRef = useRef(value);
  const cancelled = useRef(false);
  const pickable = /^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(value);
  const swatch = pickable ? value.slice(0, 7) : "#000000";
  const alpha = pickable && value.length === 9 ? value.slice(7) : "";
  return <div className={styles.colorInput}>
    <input type="color" aria-label={`${label} — палитра`} value={swatch} disabled={disabled}
      onFocus={onStart} onBlur={onFinish} onChange={event => onValue(`${event.target.value}${alpha}`)} />
    <input type="text" aria-label={`${label} — HEX`} inputMode="text" spellCheck={false} autoComplete="off"
      value={editing ? draft : value} disabled={disabled}
      onFocus={() => { cancelled.current = false; draftRef.current = value; setDraft(value); setEditing(true); onStart?.(); }}
      onChange={event => { draftRef.current = event.target.value; setDraft(event.target.value); }}
      onBlur={() => { if (!cancelled.current && draftRef.current !== value) onValue(draftRef.current); setEditing(false); onFinish?.(); }}
      onKeyDown={event => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") { cancelled.current = true; event.currentTarget.blur(); event.stopPropagation(); }
      }} />
  </div>;
}

/** Both workshops use the same descriptor-fed controls; no storage, target or renderer state. */
export function MaterialControls({ descriptor, recipe, capability, disabled = false, onChange, onGestureStart,
  onGestureCommit, onError, onAction }: MaterialControlsProps) {
  const id = useId();
  const rows = descriptor.readControls(recipe, capability);
  const available = GROUPS.filter(group => rows.some(row => (row.control.group ?? "precise") === group.id) ||
    (group.id === "physics" && !!onAction && !!descriptor.actions?.length));
  const [opened, setOpened] = useState<readonly ParameterGroup[]>(available.length ? [available[0]!.id] : []);
  const [error, setError] = useState<{ key: string; message: string } | null>(null);
  const [actionCount, setActionCount] = useState<MaterialAction["count"]>(1);

  function update(key: string, value: ParameterValue) {
    const result = descriptor.updateParameter(recipe, key, value);
    if (result.ok) { setError(null); onChange(result.value); }
    else {
      const message = result.issues.map(issue => issue.message).join(" ") || "Недопустимое значение параметра.";
      setError({ key, message }); onError?.(message);
    }
  }
  function atomic(key: string, value: ParameterValue) {
    onGestureStart?.(); update(key, value); onGestureCommit?.();
  }
  function field(control: ParameterControl, value: ParameterValue, unavailable?: boolean) {
    const locked = disabled || !!unavailable;
    const hint = control.description ? <small className={styles.hint}>{control.description}</small> : null;
    let input;
    if (control.kind === "range" && typeof value === "number") input = <MonoLabSliderRow
      label={control.label} value={value} min={control.min} max={control.max} step={control.step} unit={control.unit}
      disabled={locked} onChange={next => update(control.key, next)} onStart={onGestureStart} onCommit={onGestureCommit} />;
    else if (control.kind === "select" && typeof value === "string") input = <label className={styles.field}>{control.label}
      <select value={value} disabled={locked} onChange={event => atomic(control.key, event.target.value)}>
        {control.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select></label>;
    else if (control.kind === "toggle" && typeof value === "boolean") input = <label className={styles.toggle}>
      <input type="checkbox" checked={value} disabled={locked} onChange={event => atomic(control.key, event.target.checked)} />{control.label}</label>;
    else if (control.kind === "color" && typeof value === "string") input = <div className={styles.field}>
      <span>{control.label}</span><ColorInput label={control.label} value={value} disabled={locked}
        onStart={onGestureStart} onFinish={onGestureCommit} onValue={next => update(control.key, next)} /></div>;
    else if (control.kind === "color-list" && Array.isArray(value)) {
      const colors = value as readonly string[];
      input = <div className={styles.colorList} aria-label={control.label}>
        <span>{control.label}</span>
        {colors.map((color, index) => <div className={styles.colorItem} key={`${control.key}-${index}`}>
          <ColorInput label={`${control.label} · цвет ${index + 1}`} value={color} disabled={locked}
            onStart={onGestureStart} onFinish={onGestureCommit}
            onValue={next => update(control.key, colors.map((item, position) => position === index ? next : item))} />
          <button type="button" aria-label={`Убрать цвет ${index + 1} из ${control.label}`}
            disabled={locked || colors.length <= control.minItems}
            onClick={() => atomic(control.key, colors.filter((_, position) => position !== index))}>−</button>
        </div>)}
        <button className={styles.add} type="button" aria-label={`Добавить цвет в ${control.label}`}
          disabled={locked || colors.length >= control.maxItems}
          onClick={() => atomic(control.key, [...colors, colors.at(-1) ?? "#ffffff"])}>Добавить цвет</button>
      </div>;
    } else input = <p role="alert">Значение «{control.label}» недоступно.</p>;
    return <div className={styles.row} key={control.key}>{input}{hint}
      {error?.key === control.key && <small className={styles.error} role="alert">{error.message}</small>}
    </div>;
  }
  return <div className={styles.root}>
    <div className={styles.tabs} role="group" aria-label="Группы параметров">
      {available.map(group => <button type="button" key={group.id} title={group.label}
        aria-label={group.label} aria-controls={`${id}-${group.id}`} aria-pressed={opened.includes(group.id)}
        onClick={() => setOpened(current => current.includes(group.id) ? current.filter(item => item !== group.id) : [...current, group.id])}>
        <span aria-hidden="true">{group.icon}</span><span>{group.label}</span>
      </button>)}
    </div>
    {available.map(group => <section className={styles.panel} key={group.id} id={`${id}-${group.id}`}
      role="region" aria-label={`${group.label} · параметры`} hidden={!opened.includes(group.id)}>
      {rows.filter(row => (row.control.group ?? "precise") === group.id).map(({ control, value, disabled: unavailable }) => field(control, value, unavailable))}
      {group.id === "physics" && onAction && descriptor.actions?.map(action => <div className={styles.action} key={action.kind}>
        <label>Число всплесков<select value={actionCount} disabled={disabled}
          onChange={event => setActionCount(Number(event.target.value) as MaterialAction["count"])}>
          {Array.from({ length: action.maxCount - action.minCount + 1 }, (_, index) => action.minCount + index).map(count =>
            <option key={count} value={count}>{count}</option>)}</select></label>
        <button type="button" disabled={disabled} onClick={() => onAction({ kind: action.kind, count: actionCount })}>{action.label}</button>
      </div>)}
    </section>)}
  </div>;
}
