"use client";

import { useId, useState, useSyncExternalStore } from "react";
import { GOLD_LIQUID_CONTROLS, GOLD_LIQUID_DEFAULTS, isGoldLiquidTunerLocation,
  normalizeGoldLiquidSettings, serializeGoldLiquidSettings, type GoldLiquidControl, type GoldLiquidSettings } from "./mono-gold-liquid-settings";

const serverTunerSnapshot = () => false;
const localTunerSnapshot = () => isGoldLiquidTunerLocation(window.location);
const subscribeLocation = (notify: () => void) => {
  window.addEventListener("popstate", notify);
  return () => window.removeEventListener("popstate", notify);
};

/** An explicit loopback tool. Apply produces a candidate, never an appearance/storage write. */
export function MonoGoldLiquidTuner({ settings, onChange }: {
  settings: Readonly<GoldLiquidSettings>; onChange(settings: GoldLiquidSettings): void;
}) {
  const local = useSyncExternalStore(subscribeLocation, localTunerSnapshot, serverTunerSnapshot);
  const id = useId();
  const [status, setStatus] = useState("Provisional Gold · локальная примерка");
  if (!local) return null;
  const normalized = normalizeGoldLiquidSettings(settings);
  const json = serializeGoldLiquidSettings(normalized);
  const zeroIorReason = normalized.ior === 0 ? "IOR = 0: чистый источник. Верните ненулевой IOR для оптики." : undefined;
  const zeroFieldReason = normalized.fieldEnabled && normalized.fieldStrength === 0
    ? "Field strength = 0: чистый источник. Увеличьте strength или выключите Field." : undefined;
  const fieldOffReason = !normalized.fieldEnabled ? "Field выключен: параметр сохранён для возврата в field режим." : undefined;
  const fadeReason = zeroIorReason ?? fieldOffReason ?? zeroFieldReason;
  const inactiveReason = (control: GoldLiquidControl): string | undefined => {
    if (control.key === "ior" || control.key === "pixelRatio") return undefined;
    if (zeroIorReason) return zeroIorReason;
    if (control.group === "Field") {
      if (fieldOffReason) return fieldOffReason;
      if (control.key === "fieldStrength") return undefined;
    }
    if (zeroFieldReason) return zeroFieldReason;
    if (control.key === "cornerRadius" && normalized.fieldEnabled)
      return "Corner radius работает в edge режиме: выключите Field.";
    if ((control.key === "flowSpeed" || control.key === "flowScale") && normalized.flowStrength === 0)
      return "Flow strength = 0: течение выключено. Значение сохранено.";
    return undefined;
  };
  const change = (patch: Partial<GoldLiquidSettings>) => {
    onChange(normalizeGoldLiquidSettings({ ...normalized, ...patch }));
    setStatus("Draft · изменения только в памяти");
  };
  const copy = async (apply: boolean) => {
    try {
      await navigator.clipboard.writeText(json);
      setStatus(apply ? "Candidate применён локально · JSON скопирован" : "JSON скопирован");
    } catch { setStatus(apply ? "Candidate применён локально · выделите JSON вручную" : "Выделите JSON вручную"); }
  };
  return <aside className="mono-gold-liquid-tuner" aria-label="Gold liquid local tuner">
    <details open><summary>Gold liquid · provisional</summary>
    <p>Техническая примерка. Apply выдаёт candidate JSON; утверждённые presets не меняются.</p>
    {(["Optics", "Field", "Flow"] as const).map(group => <details key={group} open={group === "Optics"}>
      <summary>{group}</summary>
      {group === "Field" && <>
        <label className="mono-gold-liquid-tuner__toggle"><input type="checkbox" checked={normalized.fieldEnabled}
          disabled={Boolean(zeroIorReason)} aria-describedby={zeroIorReason ? `${id}-field-toggle-hint` : undefined}
          onChange={event => { if (!zeroIorReason) change({ fieldEnabled: event.currentTarget.checked }); }} /> Field</label>
        {zeroIorReason && <small id={`${id}-field-toggle-hint`} className="mono-gold-liquid-tuner__inactive">{zeroIorReason}</small>}
        <div className="mono-gold-liquid-tuner__buttons" aria-label="Field fade">
          <button type="button" aria-pressed={normalized.fieldFadeMode === 0} disabled={Boolean(fadeReason)}
            aria-describedby={fadeReason ? `${id}-fade-hint` : undefined}
            onClick={() => { if (!fadeReason) change({ fieldFadeMode: 0 }); }}>Mask</button>
          <button type="button" aria-pressed={normalized.fieldFadeMode === 1} disabled={Boolean(fadeReason)}
            aria-describedby={fadeReason ? `${id}-fade-hint` : undefined}
            onClick={() => { if (!fadeReason) change({ fieldFadeMode: 1 }); }}>Dissolve</button>
        </div>
        {fadeReason && <small id={`${id}-fade-hint`} className="mono-gold-liquid-tuner__inactive">{fadeReason}</small>}
      </>}
      {GOLD_LIQUID_CONTROLS.filter(control => control.group === group).map(control => {
        const reason = inactiveReason(control);
        return <label key={control.key} className="mono-gold-liquid-tuner__control" data-inactive={Boolean(reason)}
          htmlFor={`${id}-${control.key}`}>
          <span>{control.label} <output htmlFor={`${id}-${control.key}`} aria-hidden="true">{normalized[control.key].toFixed(3)}</output></span>
          <input id={`${id}-${control.key}`} type="range" aria-label={control.label} min={control.min} max={control.max}
            step={control.step} value={normalized[control.key]} disabled={Boolean(reason)}
            aria-describedby={reason ? `${id}-${control.key}-hint` : undefined}
            onChange={event => { if (!reason) change({ [control.key]: Number(event.currentTarget.value) }); }} />
          {reason && <small id={`${id}-${control.key}-hint`} className="mono-gold-liquid-tuner__inactive">{reason}</small>}
        </label>;
      })}
    </details>)}
    <div className="mono-gold-liquid-tuner__buttons">
      <button type="button" onClick={() => { onChange({ ...GOLD_LIQUID_DEFAULTS }); setStatus("Provisional Gold · Default"); }}>Default</button>
      <button type="button" onClick={() => { onChange(normalized); void copy(true); }}>Apply</button>
      <button type="button" onClick={() => void copy(false)}>Copy JSON</button>
    </div>
    <textarea aria-label="Gold liquid JSON" readOnly value={json} spellCheck={false} />
    <p role="status">{status}</p>
    </details>
  </aside>;
}
