"use client";
import { useState } from "react";
import { MONO_FONT_AUDIT, MONO_FONT_REGISTRY, MONO_UI_FONT_IDS, monoFontPairCoversCurrencies, type MonoFontId, type MonoUiFontId } from "./mono-font-registry";
import { MonoLabSection, MonoLabSliderRow } from "./mono-lab-controls";
import { createMonoTypographyDefaults, createMonoTypographySet, MONO_TYPOGRAPHY_BOUNDS, MONO_TYPOGRAPHY_ROLES, monoTypographyRoleFont, normalizeMonoTypography, type MonoTypographyConfigV1, type MonoTypographyRole } from "./mono-typography";
import "./mono-typography-tuner.css";

const ROLE_LABELS: Record<MonoTypographyRole, string> = {
  body: "Основной текст", balance: "Баланс и суммы", button: "Кнопки", menu: "Меню", label: "Подписи", mono: "Адреса и ID",
};
const SET_LABELS: Record<MonoUiFontId, string> = {
  "ibm-plex-sans": "Plex · точный", "golos-text": "Golos + Plex · кириллица", onest: "Onest · мягкий",
  manrope: "Manrope · геометрия", "source-sans-3": "Source + Manrope · контраст",
};

export type MonoTypographyTunerProps = {
  value: MonoTypographyConfigV1 | null;
  onChange(value: MonoTypographyConfigV1): void;
  onStart?(): void;
  onCommit?(): void;
};

export function MonoTypographyTuner({ value: candidate, onChange, onStart, onCommit }: MonoTypographyTunerProps) {
  const [role, setRole] = useState<MonoTypographyRole>("body");
  const value = candidate ?? createMonoTypographyDefaults();
  const primary = MONO_FONT_REGISTRY[value.primaryFontId], secondary = MONO_FONT_REGISTRY[value.secondaryFontId];
  const face = MONO_FONT_REGISTRY[monoTypographyRoleFont(value, role)];
  const emit = (next: MonoTypographyConfigV1) => onChange(normalizeMonoTypography(next));
  function updateRole(selected: MonoTypographyRole, patch: Partial<MonoTypographyConfigV1["roles"][MonoTypographyRole]>) {
    emit({ ...value, roles: { ...value.roles, [selected]: { ...value.roles[selected], ...patch } } });
  }
  function chooseSet(id: MonoUiFontId) {
    const next = createMonoTypographySet(id);
    for (const key of MONO_TYPOGRAPHY_ROLES) next.roles[key].size = value.roles[key].size;
    emit(next);
  }
  const gesture = { onStart, onCommit };
  if (!candidate) return <div className="mono-font-tuner">
    <label className="mono-font-field"><span>Шрифтовой набор</span><select value="" onChange={event => chooseSet(event.target.value as MonoUiFontId)}>
      <option value="" disabled>Текущее оформление</option>
      {MONO_UI_FONT_IDS.map(id => <option key={id} value={id}>{SET_LABELS[id]}</option>)}
    </select></label>
    <p className="mono-font-pair-note">Выберите набор для примерки.</p>
  </div>;
  return <div className="mono-font-tuner">
    <label className="mono-font-field"><span>Шрифтовой набор</span>
      <select value={value.primaryFontId} onChange={event => chooseSet(event.target.value as MonoUiFontId)}>
        {MONO_UI_FONT_IDS.map(id => <option key={id} value={id}>{SET_LABELS[id]}</option>)}
      </select>
    </label>
    <p className="mono-font-pair-note">{primary.label}<span> + {secondary.label}</span></p>
    <MonoLabSliderRow label="Макс. размер баланса" value={value.roles.balance.size} {...MONO_TYPOGRAPHY_BOUNDS.balance} unit="px"
      onChange={size => updateRole("balance", { size })} {...gesture} />
    <MonoLabSliderRow label="Размер текста" value={value.roles.body.size} {...MONO_TYPOGRAPHY_BOUNDS.body} unit="px"
      onChange={size => updateRole("body", { size })} {...gesture} />
    <MonoLabSection title="Роли и начертания">
      <label className="mono-font-field"><span>Роль</span>
        <select value={role} onChange={event => setRole(event.target.value as MonoTypographyRole)}>
          {MONO_TYPOGRAPHY_ROLES.map(id => <option key={id} value={id}>{ROLE_LABELS[id]}</option>)}
        </select>
      </label>
      <label className="mono-font-field"><span>Семейство роли</span>
        <select value={value.roles[role].family} onChange={event => updateRole(role, { family: event.target.value as "primary" | "secondary" })}>
          <option value="primary" disabled={role === "balance" && !primary.tabular}>{primary.label}</option>
          <option value="secondary" disabled={role === "balance" && !secondary.tabular}>{secondary.label}</option>
        </select>
      </label>
      {"min" in face.weights
        ? <MonoLabSliderRow label="Вес роли" value={value.roles[role].weight} min={face.weights.min} max={face.weights.max} step={10}
          onChange={weight => updateRole(role, { weight })} {...gesture} />
        : <label className="mono-font-field"><span>Вес роли</span><select value={value.roles[role].weight}
          onChange={event => updateRole(role, { weight: Number(event.target.value) })}>
          {face.weights.map(weight => <option key={weight} value={weight}>{weight}</option>)}
        </select></label>}
      <MonoLabSliderRow label={role === "balance" ? "Макс. размер роли" : "Размер роли"} value={value.roles[role].size} {...MONO_TYPOGRAPHY_BOUNDS[role]} unit="px"
        onChange={size => updateRole(role, { size })} {...gesture} />
    </MonoLabSection>
    <MonoLabSection title="Ритм и второй шрифт">
      <label className="mono-font-field"><span>Второе семейство</span><select value={value.secondaryFontId}
        onChange={event => emit({ ...value, secondaryFontId: event.target.value as MonoFontId })}>
        {Object.values(MONO_FONT_REGISTRY).map(font => <option key={font.id} value={font.id}
          disabled={!monoFontPairCoversCurrencies(primary.id, font.id) || (!primary.tabular && !font.tabular)}>{font.label}</option>)}
      </select></label>
      <MonoLabSliderRow label="Межстрочный интервал" value={value.bodyLineHeight} {...MONO_TYPOGRAPHY_BOUNDS.bodyLineHeight}
        onChange={bodyLineHeight => emit({ ...value, bodyLineHeight })} {...gesture} />
      <MonoLabSliderRow label="Разрядка подписей" value={value.labelTracking} {...MONO_TYPOGRAPHY_BOUNDS.labelTracking} unit="em"
        onChange={labelTracking => emit({ ...value, labelTracking })} {...gesture} />
    </MonoLabSection>
    <MonoLabSection title="Файлы и знаки">
      {[...new Set([primary.id, secondary.id])].map(id => {
        const font = MONO_FONT_REGISTRY[id];
        const first = MONO_FONT_AUDIT[font.files[0]];
        const companion = id === primary.id ? secondary : primary;
        return <div className="mono-font-file-note" key={id}>
          <strong>{font.label}</strong><span>{first.version.split(";")[0]} · {Math.round(font.files.reduce((sum, file) => sum + MONO_FONT_AUDIT[file].bytes, 0) / 1024)} КБ</span>
          <span>Латиница · русский · беларускі · Ўў Іі</span>
          {font.missingCurrencies && <span>{font.missingCurrencies} — из {companion.label}</span>}
          {!font.tabular && <span>Ровные колонки сумм — {secondary.label}</span>}
          <span><a href={font.source} target="_blank" rel="noreferrer">Источник</a> · <a href={font.license} target="_blank" rel="noreferrer">OFL 1.1</a></span>
        </div>;
      })}
    </MonoLabSection>
  </div>;
}
