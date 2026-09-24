import type { BackgroundMaterialDescriptor, BackgroundRecipe, ParameterValue } from "@wallet/ui";
import { MonoLabSliderRow } from "../../mono-preview/mono-lab-controls";
import styles from "../mono-atmosphere-lab.module.css";

export function ParameterControls({ descriptor, recipe, disabled, onChange, onStart, onCommit, onError }: {
  descriptor: BackgroundMaterialDescriptor; recipe: BackgroundRecipe; disabled: boolean;
  onChange(recipe: BackgroundRecipe): void; onStart(): void; onCommit(): void; onError(message: string): void;
}) {
  function update(key: string, value: ParameterValue) {
    const result = descriptor.updateParameter(recipe, key, value);
    if (result.ok) onChange(result.value);
    else onError(result.issues.map(issue => issue.message).join(" "));
  }
  return <div className={styles.controls}>{descriptor.readControls(recipe).map(({ control, value, disabled: unavailable }) => {
    const inactive = disabled || !!unavailable;
    if (control.kind === "range" && typeof value === "number") return <MonoLabSliderRow key={control.key}
      label={control.label} value={value} min={control.min} max={control.max} step={control.step} unit={control.unit}
      disabled={inactive} onChange={next => update(control.key, next)} onStart={onStart} onCommit={onCommit} />;
    if (control.kind === "select") return <label className={styles.field} key={control.key}>{control.label}
      <select value={String(value)} disabled={inactive} onChange={event => update(control.key, event.target.value)}>
        {control.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select></label>;
    if (control.kind === "toggle") return <label className={styles.toggle} key={control.key}>
      <input type="checkbox" checked={value === true} disabled={inactive} onChange={event => update(control.key, event.target.checked)} />{control.label}</label>;
    if (control.kind === "color") return <label className={styles.field} key={control.key}>{control.label}
      <input type="color" value={String(value)} disabled={inactive} onFocus={onStart} onBlur={onCommit}
        onChange={event => update(control.key, event.target.value)} /></label>;
    return null;
  })}</div>;
}
