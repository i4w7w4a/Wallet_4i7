"use client";

import { useId } from "react";
import type { MonoAssetListAppearance, MonoBalanceAppearance, MonoChartAppearance, MonoLayoutAppearance } from "./mono-scene-lab-contract";
import "./mono-scene-lab-controls.css";

export function MonoBalanceControls({ value, onChange }: {
  value: Readonly<MonoBalanceAppearance>; onChange: (value: MonoBalanceAppearance) => void;
}) {
  const id = useId();
  return <div className="mono-scene-controls">
    <div className="mono-scene-controls__field"><label htmlFor={`${id}-composition`}>Композиция баланса</label><select id={`${id}-composition`} value={value.composition} onChange={(event) => onChange({ ...value, composition: event.target.value as MonoBalanceAppearance["composition"] })}>
      <option value="ledger">Реестр · слева</option><option value="centered">Фокус · по центру</option><option value="compact">Компактная плоскость</option>
    </select></div>
    <div className="mono-scene-controls__field"><label htmlFor={`${id}-fraction`}>Размер дробной части</label><select id={`${id}-fraction`} value={value.fractionSize} onChange={(event) => onChange({ ...value, fractionSize: event.target.value as MonoBalanceAppearance["fractionSize"] })}>
      <option value="small">Малый · 42%</option><option value="medium">Спокойный · 56%</option><option value="large">Единый размер · 100%</option>
    </select></div>
    <div className="mono-scene-controls__field"><label htmlFor={`${id}-tone`}>Тон дробной части</label><select id={`${id}-tone`} value={value.fractionTone} onChange={(event) => onChange({ ...value, fractionTone: event.target.value as MonoBalanceAppearance["fractionTone"] })}>
      <option value="secondary">Вторичный</option><option value="primary">Основной</option>
    </select></div>
    <p>Центы остаются точными. Меняются размер и тон.</p>
  </div>;
}

export function MonoChartControls({ value, layout, onChange, onLayoutChange }: {
  value: Readonly<MonoChartAppearance>; layout: Readonly<MonoLayoutAppearance>;
  onChange: (value: MonoChartAppearance) => void; onLayoutChange: (value: MonoLayoutAppearance) => void;
}) {
  const id = useId();
  return <div className="mono-scene-controls">
    <label className="mono-scene-controls__check" htmlFor={`${id}-visible`}><input id={`${id}-visible`} type="checkbox" checked={value.visible} onChange={(event) => onChange({ ...value, visible: event.target.checked })} />Показывать график</label>
    <div className="mono-scene-controls__field"><label htmlFor={`${id}-position`}>Положение графика</label><select id={`${id}-position`} value={layout.chartPosition} disabled={!value.visible} onChange={(event) => onLayoutChange({ chartPosition: event.target.value as MonoLayoutAppearance["chartPosition"] })}>
      <option value="top">Сверху · под балансом</option><option value="bottom">Снизу · после активов</option>
    </select></div>
    <div className="mono-scene-controls__field"><label htmlFor={`${id}-variant`}>Вид графика</label><select id={`${id}-variant`} value={value.variant} disabled={!value.visible} onChange={(event) => onChange({ ...value, variant: event.target.value as MonoChartAppearance["variant"] })}>
      <option value="line">Линия</option><option value="area">Мягкое заполнение</option><option value="step">Ступени</option>
    </select></div>
    <p>{value.visible ? "Три способа увидеть одни данные." : "Баланс и активы остаются в сцене. Настройки графика сохранены."}</p>
  </div>;
}

export function MonoAssetListControls({ value, onChange }: {
  value: Readonly<MonoAssetListAppearance>; onChange: (value: MonoAssetListAppearance) => void;
}) {
  const id = useId();
  return <div className="mono-scene-controls">
    <div className="mono-scene-controls__field"><label htmlFor={`${id}-variant`}>Оформление активов</label><select id={`${id}-variant`} value={value.variant} onChange={(event) => onChange({ ...value, variant: event.target.value as MonoAssetListAppearance["variant"] })}>
      <option value="ledger">Единый реестр</option><option value="tiles">Матовые строки</option>
    </select></div>
    <div className="mono-scene-controls__field"><label htmlFor={`${id}-density`}>Плотность списка</label><select id={`${id}-density`} value={value.density} onChange={(event) => onChange({ ...value, density: event.target.value as MonoAssetListAppearance["density"] })}>
      <option value="comfortable">Свободная</option><option value="compact">Компактная</option>
    </select></div>
    <div className="mono-scene-controls__field"><label htmlFor={`${id}-separators`}>Разделители</label><select id={`${id}-separators`} value={value.separators} onChange={(event) => onChange({ ...value, separators: event.target.value as MonoAssetListAppearance["separators"] })}>
      <option value="subtle">Тонкие</option><option value="none">Без линий</option>
    </select></div>
    <p>Отклик всей поверхности, без боковой полосы.</p>
  </div>;
}
