"use client";

import { useRef, useState, type CSSProperties } from "react";
import type { WalletSnapshot } from "@wallet/core";
import { MONO_FONT_REGISTRY } from "./mono-font-registry";
import { MonoLabIconButton, MonoLabSection } from "./mono-lab-controls";
import { MonoLogo } from "./mono-logo";
import { createMonoTypographyDefaults, monoTypographyStyle, type MonoTypographyConfigV1 } from "./mono-typography";
import { useMonoTypographyPreview } from "./mono-typography-preview";
import { MonoTypographyTuner } from "./mono-typography-tuner";
import "./mono-fonts.css";
import "./mono-font-candidates.css";
import "./mono-font-lab.css";

const same = (left: MonoTypographyConfigV1, right: MonoTypographyConfigV1) => JSON.stringify(left) === JSON.stringify(right);
const widths = [320, 390, 430, 480] as const;
const actions = [{ label: "Отправить", icon: "↗" }, { label: "Получить", icon: "↙" }, { label: "Обменять", icon: "⇄" }, { label: "Купить", icon: "+" }];
const money = (value: number, currency: string) => new Intl.NumberFormat("ru-RU", { style: "currency", currency, minimumFractionDigits: 2 }).format(value);

export function MonoFontLab({ snapshot }: { snapshot: WalletSnapshot }) {
  const [baseline] = useState(createMonoTypographyDefaults);
  const [draft, setDraft] = useState(baseline);
  const draftRef = useRef(draft);
  const gesture = useRef<MonoTypographyConfigV1 | null>(null);
  const [past, setPast] = useState<MonoTypographyConfigV1[]>([]);
  const [future, setFuture] = useState<MonoTypographyConfigV1[]>([]);
  const [compare, setCompare] = useState(false);
  const [width, setWidth] = useState<(typeof widths)[number]>(390);
  const [light, setLight] = useState(false);
  const [longAmount, setLongAmount] = useState(false);
  const [demoAction, setDemoAction] = useState("");
  const [copied, setCopied] = useState(false);
  const preview = useMonoTypographyPreview(compare ? baseline : draft);
  const active = preview.active ?? baseline, status = preview.status;
  const amount = money(longAmount ? 1234567.89 : snapshot.balance.amount, snapshot.balance.currency);
  const primary = MONO_FONT_REGISTRY[active.primaryFontId], secondary = MONO_FONT_REGISTRY[active.secondaryFontId];

  function setCurrent(config: MonoTypographyConfigV1) { draftRef.current = config; setDraft(config); setCopied(false); }
  function change(config: MonoTypographyConfigV1) {
    const previous = draftRef.current;
    if (same(config, previous)) return;
    if (!gesture.current) { setPast(values => [...values.slice(-49), previous]); setFuture([]); }
    setCompare(false);
    setCurrent(config);
  }
  function commitGesture() {
    const start = gesture.current;
    gesture.current = null;
    if (start && !same(start, draftRef.current)) { setPast(values => [...values.slice(-49), start]); setFuture([]); }
  }
  function undo() {
    const previous = past.at(-1);
    if (!previous) return;
    const current = draftRef.current;
    setFuture(values => [current, ...values]); setPast(values => values.slice(0, -1)); setCompare(false); setCurrent(previous);
  }
  function redo() {
    const next = future[0];
    if (!next) return;
    const current = draftRef.current;
    setPast(values => [...values, current]); setFuture(values => values.slice(1)); setCompare(false); setCurrent(next);
  }
  async function copy() {
    try { await navigator.clipboard.writeText(JSON.stringify(draft, null, 2)); setCopied(true); }
    catch { setCopied(false); }
  }

  return <main className="mono-font-lab">
    <header className="mono-font-lab-header">
      <div><a className="mono-font-back" href="/mono">↖ Novex / Design Lab</a><h1>Тон задаёт шрифт.</h1><p>Одна композиция. Согласованные роли.</p></div>
      <span className="mono-font-edition">TYPE STUDY <span>01 / MONO</span></span>
    </header>
    <div className="mono-font-lab-layout">
      <aside className="mono-font-lab-panel" aria-label="Настройка типографики">
        <div className="mono-font-panel-title"><h2>Font Lab</h2><div className="mono-font-tool-row">
          <MonoLabIconButton label="Отменить изменение" disabled={!past.length} onClick={undo}>↶</MonoLabIconButton>
          <MonoLabIconButton label="Повторить изменение" disabled={!future.length} onClick={redo}>↷</MonoLabIconButton>
          <MonoLabIconButton label="Исходный набор" onClick={() => change(baseline)}>↺</MonoLabIconButton>
        </div></div>
        <MonoTypographyTuner value={draft} onChange={change} onStart={() => { gesture.current = draftRef.current; }} onCommit={commitGesture} />
        <MonoLabSection title="Передать настройки">
          <p className="mono-font-small">Проба живёт в этой вкладке. JSON содержит только типографику.</p>
          <button className="mono-font-text-button" onClick={copy}>{copied ? "Скопировано" : "Копировать JSON"}</button>
          <textarea readOnly aria-label="JSON типографики" value={JSON.stringify(draft, null, 2)} rows={7} />
        </MonoLabSection>
      </aside>
      <div className="mono-font-stage">
        <div className="mono-font-stage-toolbar">
          <div className="mono-font-widths" role="group" aria-label="Ширина образца">
            {widths.map(item => <button key={item} aria-pressed={width === item} onClick={() => setWidth(item)}>{item}</button>)}
          </div>
          <div className="mono-font-tool-row">
            <MonoLabIconButton label="Сравнить с исходным" aria-pressed={compare} onClick={() => setCompare(value => !value)}>A/B</MonoLabIconButton>
            <MonoLabIconButton label="Проверить длинную сумму" aria-pressed={longAmount} onClick={() => setLongAmount(value => !value)}>↔</MonoLabIconButton>
            <MonoLabIconButton label="Светлая поверхность" aria-pressed={light} onClick={() => setLight(value => !value)}>☼</MonoLabIconButton>
          </div>
        </div>
        <div className="mono-font-status" role="status" aria-live="polite">
          <span className={`mono-font-status-dot mono-font-status-dot--${status}`} />
          {status === "ready" ? (compare ? "Исходный набор · A" : "Набор готов") : status === "error" ? "Шрифт не загрузился. Оставлен предыдущий набор." : "Загружаю выбранный набор…"}
        </div>
        <div className="mono-font-canvas" style={{ "--mono-font-preview-width": `${width}px` } as CSSProperties}>
          <section className="mono-font-scene" data-theme={light ? "light" : "dark"} aria-label="Живой образец кошелька"
            style={{ ...monoTypographyStyle(active), "--mono-font-amount-units": String(amount.length * .62) } as CSSProperties}>
            <header className="mono-font-wallet-header"><MonoLogo /><span className="mono-font-wallet-demo">ДЕМО</span></header>
            <div className="mono-font-greeting"><span>Добрый день</span><span lang="be">Добры дзень</span></div>
            <div className="mono-font-balance-block"><p className="mono-font-role-label">Общий баланс</p>
              <p className="mono-font-balance" data-testid="mono-font-balance">{amount}</p>
              <p className="mono-font-change">↑ +{snapshot.balance.change24h.toLocaleString("ru-RU")}% <span>за сегодня</span></p>
            </div>
            <div className="mono-font-actions" aria-label="Демонстрационные действия">
              {actions.map(action => <button key={action.label} onClick={() => setDemoAction(`${action.label} · демо-действие`)}>
                <span aria-hidden="true">{action.icon}</span><span>{action.label}</span>
              </button>)}
            </div>
            <p className="mono-font-demo-feedback" role="status">{demoAction || "Проверьте ощущение кнопок"}</p>
            <div className="mono-font-assets"><h2>Активы <span>03</span></h2>
              {snapshot.assets.map(asset => <div className="mono-font-asset-row" key={asset.symbol}>
                <div><strong>{asset.name}</strong><span>{asset.amount.toLocaleString("ru-RU")} {asset.symbol}</span></div>
                <div className="mono-font-asset-value"><strong>{money(asset.value, snapshot.balance.currency)}</strong><span>{asset.change24h > 0 ? "↑ +" : ""}{asset.change24h.toLocaleString("ru-RU")}%</span></div>
              </div>)}
            </div>
            <div className="mono-font-address"><span className="mono-font-role-label">Ваш адрес</span><span>{snapshot.profile.shortAddress}</span></div>
            <nav className="mono-font-navigation" aria-label="Меню образца">
              {["Кошелёк", "Портфель", "Обзор"].map((label, index) => <button key={label} aria-current={index === 0 ? "page" : undefined} onClick={() => setDemoAction(`${label} · образец меню`)}>{label}</button>)}
            </nav>
          </section>
        </div>
        <section className="mono-font-proof" aria-label="Проверка букв и чисел" style={monoTypographyStyle(active)}>
          <div className="mono-font-proof-heading"><span>Буквы, знаки, ритм</span><span>{primary.label} / {secondary.label}</span></div>
          <div className="mono-font-proof-grid">
            <div><p className="mono-font-proof-letters" lang="be">Ўў Іі Ёё</p><p lang="be">Мае грошы. Усё пад кантролем.</p><p lang="en">Clarity in every detail.</p></div>
            <div className="mono-font-proof-numbers"><p>0123456789</p><p>111 111,11</p><p>888 888,88</p><span>₽ $ € £ ¥ ₸ ₿ · −7,08%</span></div>
          </div>
          <p className="mono-font-proof-distinction">0 O · 1 I l · , . · + −</p>
        </section>
      </div>
    </div>
  </main>;
}
