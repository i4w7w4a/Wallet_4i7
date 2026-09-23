"use client";

import type { MonoAssetListAppearance, MonoBalanceAppearance, MonoChartAppearance, MonoLayoutAppearance } from "./mono-scene-lab-contract";

export function MonoBalanceControls({ value, onChange }: {
  value: Readonly<MonoBalanceAppearance>; onChange: (value: MonoBalanceAppearance) => void;
}) {
  return <div className="mono-scene-lab__fields">
    <label>Композиция баланса<select value={value.composition} onChange={(event) => onChange({ ...value, composition: event.target.value as MonoBalanceAppearance["composition"] })}>
      <option value="ledger">Реестр · слева</option><option value="centered">Фокус · по центру</option><option value="compact">Компактная плоскость</option>
    </select></label>
    <label>Размер дробной части<select value={value.fractionSize} onChange={(event) => onChange({ ...value, fractionSize: event.target.value as MonoBalanceAppearance["fractionSize"] })}>
      <option value="small">Малый · 42%</option><option value="medium">Спокойный · 56%</option><option value="large">Единый размер · 100%</option>
    </select></label>
    <label>Тон дробной части<select value={value.fractionTone} onChange={(event) => onChange({ ...value, fractionTone: event.target.value as MonoBalanceAppearance["fractionTone"] })}>
      <option value="secondary">Вторичный</option><option value="primary">Основной</option>
    </select></label>
    <p>Центы остаются точными. Меняются размер и тон.</p>
  </div>;
}

export function MonoChartControls({ value, layout, onChange, onLayoutChange }: {
  value: Readonly<MonoChartAppearance>; layout: Readonly<MonoLayoutAppearance>;
  onChange: (value: MonoChartAppearance) => void; onLayoutChange: (value: MonoLayoutAppearance) => void;
}) {
  return <div className="mono-scene-lab__fields">
    <label className="mono-scene-lab__check"><input type="checkbox" checked={value.visible} onChange={(event) => onChange({ ...value, visible: event.target.checked })} />Показывать график</label>
    <label>Положение графика<select value={layout.chartPosition} disabled={!value.visible} onChange={(event) => onLayoutChange({ chartPosition: event.target.value as MonoLayoutAppearance["chartPosition"] })}>
      <option value="top">Сверху · под балансом</option><option value="bottom">Снизу · после активов</option>
    </select></label>
    <label>Вид графика<select value={value.variant} disabled={!value.visible} onChange={(event) => onChange({ ...value, variant: event.target.value as MonoChartAppearance["variant"] })}>
      <option value="line">Линия</option><option value="area">Мягкое заполнение</option><option value="step">Ступени</option>
    </select></label>
    <p>{value.visible ? "Три способа увидеть одни данные." : "Баланс и активы остаются в сцене. Настройки графика сохранены."}</p>
  </div>;
}

export function MonoAssetListControls({ value, onChange }: {
  value: Readonly<MonoAssetListAppearance>; onChange: (value: MonoAssetListAppearance) => void;
}) {
  return <div className="mono-scene-lab__fields">
    <label>Оформление активов<select value={value.variant} onChange={(event) => onChange({ ...value, variant: event.target.value as MonoAssetListAppearance["variant"] })}>
      <option value="ledger">Единый реестр</option><option value="tiles">Матовые строки</option>
    </select></label>
    <label>Плотность списка<select value={value.density} onChange={(event) => onChange({ ...value, density: event.target.value as MonoAssetListAppearance["density"] })}>
      <option value="comfortable">Свободная</option><option value="compact">Компактная</option>
    </select></label>
    <label>Разделители<select value={value.separators} onChange={(event) => onChange({ ...value, separators: event.target.value as MonoAssetListAppearance["separators"] })}>
      <option value="subtle">Тонкие</option><option value="none">Без линий</option>
    </select></label>
    <p>Отклик всей поверхности, без боковой полосы.</p>
  </div>;
}
