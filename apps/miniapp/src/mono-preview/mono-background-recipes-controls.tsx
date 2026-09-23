"use client";

import { MONO_BACKGROUND_CONTROLS, MONO_BACKGROUND_DEFAULTS, type MonoBackgroundRecipeConfig } from "./mono-background-recipes";
import { MonoLabSliderRow } from "./mono-lab-controls";
import styles from "./mono-background-recipes-controls.module.css";

export type MonoBackgroundRecipeControlsProps = {
  value: MonoBackgroundRecipeConfig | null;
  onChange(value: MonoBackgroundRecipeConfig | null): void;
  onGestureStart?(): void;
  onGestureCommit?(value: MonoBackgroundRecipeConfig): void;
  disabled?: boolean;
  showRecipeSelector?: boolean;
};

/** Controlled inspector. Null preserves the host's iris/tide/strata choice.
 * It owns no storage, save/apply/cancel commands, runtime gates, or render surface.
 */
export function MonoBackgroundRecipeControls({ value, onChange, onGestureStart, onGestureCommit,
  disabled = false, showRecipeSelector = true }: MonoBackgroundRecipeControlsProps) {
  const config = value ?? MONO_BACKGROUND_DEFAULTS.baseline;
  const baseline = value === null || config.recipe === "baseline";
  return <div className={styles.controls}>
    {showRecipeSelector && <div className={styles.recipes} role="group" aria-label="Материал фона">
      <button type="button" disabled={disabled} aria-pressed={baseline} onClick={() => onChange(null)}>Исходный фон</button>
      <button type="button" disabled={disabled} aria-pressed={config.recipe === "obsidian"}
        onClick={() => onChange({ ...MONO_BACKGROUND_DEFAULTS.obsidian })}>Обсидиан</button>
      <button type="button" disabled={disabled} aria-pressed={config.recipe === "aperture"}
        onClick={() => onChange({ ...MONO_BACKGROUND_DEFAULTS.aperture })}>Световой разрез</button>
    </div>}
    <fieldset className={styles.fields} disabled={disabled || baseline} aria-label="Параметры материала">
      {MONO_BACKGROUND_CONTROLS.map(control => <MonoLabSliderRow key={control.key} label={control.label}
        min={control.min * 100} max={control.max * 100} step={control.step * 100} unit="%"
        value={Math.round(config[control.key] * 100)} disabled={disabled || baseline}
        onStart={onGestureStart} onCommit={next => onGestureCommit?.({ ...config, [control.key]: next / 100 })}
        onChange={next => onChange({ ...config, [control.key]: next / 100 })} />)}
      <div className={styles.character} role="group" aria-label="Характер отклика">
        <button type="button" aria-pressed={config.character === "fluid"} onClick={() => onChange({ ...config, character: "fluid" })}>Текучий</button>
        <button type="button" aria-pressed={config.character === "precise"} onClick={() => onChange({ ...config, character: "precise" })}>Собранный</button>
      </div>
    </fieldset>
    <label className={styles.calm}><input type="checkbox" checked={config.calm} disabled={disabled || value === null}
      onChange={event => onChange({ ...config, calm: event.currentTarget.checked })} /><span>Спокойный режим</span><span aria-hidden="true">Ⅱ</span></label>
  </div>;
}
