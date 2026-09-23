"use client";

import { useState } from "react";
import { MONO_GLASS_BOUNDS, type MonoGlassSettings, type MonoOpticalPreset } from "@wallet/ui";

import "./mono-glass-tuner.css";

type ContinuousKey = keyof typeof MONO_GLASS_BOUNDS;
type Control = { key: ContinuousKey; label: string; hint: string };

const GROUPS: ReadonlyArray<{ id: string; label: string; controls: readonly Control[] }> = [
  {
    id: "optics", label: "Линза", controls: [
      { key: "ior", label: "Преломление", hint: "Знак меняет направление линзы; ноль оставляет чистый источник." },
      { key: "edgeThickness", label: "Толщина края", hint: "Глубина материала на кромке." },
      { key: "edgeDarkening", label: "Затемнение края", hint: "Контраст без цветной дисперсии." },
      { key: "pointerStrength", label: "Отклик на касание", hint: "Сдвиг блика вслед за курсором или пальцем." },
    ],
  },
  {
    id: "light", label: "Свет", controls: [
      { key: "highlightStrength", label: "Световая кромка", hint: "Нейтральный блик вдоль края." },
      { key: "reflectionStrength", label: "Отражение", hint: "Серебряный верхний слой." },
      { key: "causticStrength", label: "Каустика", hint: "Сгущение света внутри стекла." },
    ],
  },
  {
    id: "field", label: "Поле", controls: [
      { key: "fieldStart", label: "Начало поля", hint: "Где появляется оптический сдвиг." },
      { key: "fieldSoftness", label: "Мягкость поля", hint: "Ширина перехода от центра к краю." },
      { key: "fieldCurve", label: "Кривая поля", hint: "Насколько резко растёт эффект." },
      { key: "fieldStrength", label: "Сила поля", hint: "Общая амплитуда преломления." },
    ],
  },
  {
    id: "flow", label: "Течение", controls: [
      { key: "flowSpeed", label: "Скорость течения", hint: "Медленный ритм, не мельтешение." },
      { key: "flowStrength", label: "Сила течения", hint: "Насколько волна меняет нормаль линзы." },
      { key: "flowScale", label: "Масштаб волны", hint: "Ширина рисунка потока." },
    ],
  },
];

const NAMES: Record<MonoOpticalPreset, string> = { ledger: "Ledger", frost: "Frost", mercury: "Mercury" };

export function MonoGlassTuner({
  preset, settings, onChange, onDefault, onCancel, onApply,
}: {
  preset: MonoOpticalPreset;
  settings: MonoGlassSettings;
  onChange: (next: Partial<MonoGlassSettings>) => void;
  onDefault: () => void;
  onCancel: () => void;
  onApply: () => void;
}) {
  const [group, setGroup] = useState("optics");
  const currentGroup = GROUPS.find((item) => item.id === group) ?? GROUPS[0]!;
  const materialDisabled = !settings.fieldEnabled;
  return (
    <div className="mono-tuner" role="group" aria-labelledby="mono-tuner-title" data-mono-control>
      <div className="mono-tuner__head">
        <div>
          <span className="mono-tuner__overline">MATERIAL LAB / {NAMES[preset].toUpperCase()}</span>
          <h2 id="mono-tuner-title">Настройка стекла</h2>
        </div>
      </div>
      <p className="mono-tuner__intro">Двигай бегунки. Материал меняется сразу; V1 остаётся нетронутой.</p>
      <div className="mono-tuner__groups" role="tablist" aria-label="Свойства материала">
        {GROUPS.map((item) => (
          <button key={item.id} id={`mono-tuner-tab-${item.id}`} type="button" role="tab"
            aria-selected={group === item.id} aria-controls="mono-tuner-panel"
            onClick={() => setGroup(item.id)}>{item.label}</button>
        ))}
      </div>
      <div className="mono-tuner__scroll" id="mono-tuner-panel" role="tabpanel" aria-labelledby={`mono-tuner-tab-${currentGroup.id}`}>
        {currentGroup.id === "field" && (
          <>
            <label className="mono-tuner__toggle">
              <span>Оптическое поле</span>
              <input type="checkbox" checked={settings.fieldEnabled} onChange={(event) => onChange({ fieldEnabled: event.currentTarget.checked })} />
            </label>
            <label className="mono-tuner__select">
              <span>Затухание поля</span>
              <select value={settings.fieldFadeMode} disabled={materialDisabled}
                onChange={(event) => onChange({ fieldFadeMode: Number(event.currentTarget.value) as 0 | 1 })}>
                <option value={0}>От края</option><option value={1}>Плавная линза</option>
              </select>
            </label>
          </>
        )}
        {currentGroup.id === "flow" && (
          <>
            <label className="mono-tuner__toggle">
              <span>Течение</span>
              <input type="checkbox" checked={settings.flowEnabled} disabled={materialDisabled}
                onChange={(event) => onChange({
                  flowEnabled: event.currentTarget.checked,
                  ...(event.currentTarget.checked && settings.flowMode === 0 ? { flowMode: 9 as const } : {}),
                })} />
            </label>
            <label className="mono-tuner__select">
              <span>Рисунок потока</span>
              <select value={settings.flowMode} disabled={materialDisabled || !settings.flowEnabled}
                onChange={(event) => onChange({ flowMode: Number(event.currentTarget.value) as 0 | 5 | 9 })}>
                <option value={0} disabled>Выключено</option><option value={5}>Спираль</option><option value={9}>Волна</option>
              </select>
            </label>
          </>
        )}
        {currentGroup.controls.map(({ key, label, hint }) => {
          const bounds = MONO_GLASS_BOUNDS[key];
          const value = settings[key] as number;
          const disabled = materialDisabled || (currentGroup.id === "flow" && !settings.flowEnabled);
          return (
            <label className="mono-tuner__control" key={key}>
              <span className="mono-tuner__control-top"><span>{label}</span><output>{value.toFixed(2)}</output></span>
              <input type="range" min={bounds.min} max={bounds.max} step={bounds.step} value={value}
                disabled={disabled} aria-label={label}
                onChange={(event) => onChange({ [key]: Number(event.currentTarget.value) })} />
              <small>{hint}</small>
            </label>
          );
        })}
      </div>
      <div className="mono-tuner__footer">
        <div className="mono-tuner__footnote">Проба материала · примени её к рабочему пресету</div>
        <div className="mono-tuner__buttons">
          <button type="button" className="mono-tuner__reset" onClick={onDefault}>По умолчанию</button>
          <button type="button" className="mono-tuner__cancel" aria-label="Отменить пробу оптики"
            onClick={onCancel}>Отмена</button>
          <button type="button" className="mono-tuner__apply" onClick={onApply}>Применить</button>
        </div>
      </div>
    </div>
  );
}
