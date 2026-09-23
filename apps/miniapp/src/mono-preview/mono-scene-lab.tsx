"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { ChartPeriod, WalletSnapshot } from "@wallet/core";
import { MONO_GLASS_DEFAULTS, MonoOpticalGlass } from "@wallet/ui";
import { MonoBalance } from "./mono-balance";
import { MonoChart } from "./mono-chart";
import { MonoAssetList } from "./mono-asset-list";
import { MonoLogo } from "./mono-logo";
import { MonoAssetListControls, MonoBalanceControls, MonoChartControls } from "./mono-scene-lab-controls";
import { MONO_SCENE_DEFAULT, normalizeMonoSceneAppearance, type MonoSceneAppearance } from "./mono-scene-lab-contract";
import "./mono-fonts.css";
import "./mono-scene-lab.css";

type Panel = "balance" | "chart" | "assets";
const PANEL_TITLES: Record<Panel, string> = { balance: "Баланс", chart: "График", assets: "Активы" };
const ACTIONS = [
  { label: "Отправить", path: "M5 18 19 4M8 4h11v11" }, { label: "Получить", path: "M19 6 5 20M16 20H5V9" },
  { label: "Обмен", path: "M4 8h16m0 0-4-4m4 4-4 4M20 16H4m0 0 4-4m-4 4 4 4" }, { label: "Купить", path: "M12 4v16M4 12h16" },
] as const;

// Dev-only composition host. Product state stays above the appearance-only modules.
export function MonoSceneLab({ snapshot }: { snapshot: WalletSnapshot }) {
  const [appearance, setAppearance] = useState<MonoSceneAppearance>(() => normalizeMonoSceneAppearance(MONO_SCENE_DEFAULT));
  const [hidden, setHidden] = useState(snapshot.balance.hidden);
  const [period, setPeriod] = useState<ChartPeriod>("1D");
  const [width, setWidth] = useState<320 | 390 | 430 | 480>(390);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [locale, setLocale] = useState("ru-RU");
  const [panel, setPanel] = useState<Panel | null>(null);
  const [status, setStatus] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const launchRef = useRef<HTMLButtonElement | null>(null);
  const format = { locale, currency: snapshot.balance.currency };

  useEffect(() => {
    if (panel && dialogRef.current && !dialogRef.current.open) dialogRef.current.showModal();
  }, [panel]);

  function closePanel() {
    dialogRef.current?.close();
    setPanel(null);
    launchRef.current?.focus();
  }

  const chart = <MonoChart values={snapshot.chart[period]} period={period} onPeriodChange={setPeriod}
    format={format} hidden={hidden} appearance={appearance.chart} />;

  return <div className="mono-scene-lab" data-mono-preset="ledger" data-lab-theme={theme}
    style={{ "--mono-scene-lab-width": `${width}px` } as CSSProperties}>
    <aside className="mono-scene-lab__rail" aria-label="Настройки сцены">
      <div className="mono-scene-lab__intro"><span>MONO / SCENE LAB</span><h1>Сцена счёта</h1><p>Сумма. Движение. Активы.</p></div>
      <div className="mono-scene-lab__panel-buttons">
        {(["balance", "chart", "assets"] as const).map((name, index) => <button key={name} type="button"
          aria-label={`Настроить ${name === "balance" ? "баланс" : name === "chart" ? "график" : "активы"}`}
          onClick={(event) => { launchRef.current = event.currentTarget; setPanel(name); }}>
          <span>0{index + 1}</span><strong>{PANEL_TITLES[name]}</strong><span aria-hidden="true">↗</span>
        </button>)}
      </div>
      <div className="mono-scene-lab__candidate"><p>Быстрая примерка</p>
        <button type="button" onClick={() => setAppearance({ ...appearance, balance: { composition: "ledger", fractionSize: "medium", fractionTone: "secondary" }, chart: { ...appearance.chart, visible: false } })}>Тихий баланс · без графика</button>
        <button type="button" onClick={() => setAppearance({ ...appearance, balance: { ...appearance.balance, composition: "centered" }, chart: { visible: true, variant: "area" }, layout: { chartPosition: "top" } })}>Фокус · мягкий график</button>
        <button type="button" onClick={() => setAppearance({ ...appearance, balance: { ...appearance.balance, composition: "compact" }, assets: { ...appearance.assets, variant: "tiles", density: "compact" } })}>Компактная композиция</button>
      </div>
      <div className="mono-scene-lab__environment"><span>Размер сцены</span>
        <div className="mono-scene-lab__widths">{([320, 390, 430, 480] as const).map((size) => <button type="button" key={size} aria-label={`Ширина ${size}`} aria-pressed={width === size} onClick={() => setWidth(size)}>{size}</button>)}</div>
        <label>Тема<select value={theme} onChange={(event) => setTheme(event.target.value as "dark" | "light")}><option value="dark">Графит</option><option value="light">Фарфор</option></select></label>
        <label>Формат чисел<select value={locale} onChange={(event) => setLocale(event.target.value)}><option value="ru-RU">Русский · 12 840,75 $</option><option value="en-US">English · $12,840.75</option><option value="de-DE">Deutsch · 12.840,75 $</option></select></label>
      </div>
      <button type="button" className="mono-scene-lab__reset" onClick={() => setAppearance(normalizeMonoSceneAppearance(MONO_SCENE_DEFAULT))}>Вернуть начальную сцену</button>
      <p className="mono-scene-lab__note">Локальная примерка. Настройки этой страницы не сохраняются.</p>
      <details className="mono-scene-lab__references"><summary>Референсы и решения</summary>
        <p><a href="https://www.exodus.com/support/en/articles/8598723-what-is-the-total-value-of-my-exodus-wallet" target="_blank" rel="noreferrer">Exodus · общая сумма и состав</a></p>
        <p><a href="https://www.exodus.com/support/en/articles/8598944-how-do-i-customize-exodus-desktop" target="_blank" rel="noreferrer">Exodus · валюта отображения</a></p>
        <p><a href="https://www.ledger.com/how-to-keep-yourself-private-in-the-blockchain-world" target="_blank" rel="noreferrer">Ledger · скрытие значений</a></p>
        <p>Изучены иерархия суммы, связь с активами и privacy. Материалы и графика Novex; чужие assets не используются.</p>
      </details>
    </aside>

    <div className="mono-scene-lab__frame" data-mono-scene-preview>
      <main className="mono-scene-lab__scene">
        <header className="mono-scene-lab__header"><MonoLogo /><span>{snapshot.profile.name}</span><small>DEMO</small></header>
        <div className="mono-scene-lab__account"><span>ЛИЧНЫЙ СЧЁТ</span><span>01 / 03</span></div>
        <MonoBalance value={snapshot.balance.amount} change24h={snapshot.balance.change24h} format={format}
          hidden={hidden} onHiddenChange={setHidden} appearance={appearance.balance} />
        {appearance.layout.chartPosition === "top" && chart}
        <section className="mono-scene-lab__actions" aria-label="Действия — демонстрация">
          {ACTIONS.map((action) => <button key={action.label} type="button" onClick={() => setStatus(`${action.label} — операция недоступна в демо.`)}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d={action.path} /></svg><span>{action.label}</span>
          </button>)}
        </section>
        <p className="mono-scene-lab__status" role="status">{status}</p>
        <div className="mono-scene-lab__promo">
          <MonoOpticalGlass preset="ledger" settings={MONO_GLASS_DEFAULTS.ledger} active>
            <div className="mono-scene-lab__promo-content"><span>NOVEX WALLET / PRIVATE</span><strong>Контроль<br />без шума.</strong><small>МАТЕРИАЛ / 001 <span aria-hidden="true">↗</span></small></div>
          </MonoOpticalGlass>
        </div>
        <MonoAssetList assets={snapshot.assets} format={format} hidden={hidden} appearance={appearance.assets} />
        {appearance.layout.chartPosition === "bottom" && chart}
        <p className="mono-scene-lab__demo">Демонстрационные данные. Операции здесь недоступны.</p>
      </main>
      <div className="mono-scene-lab__nav" aria-label="Предпросмотр нижней навигации"><span data-active>Обзор</span><span>Активы</span><span>История</span><span>Профиль</span></div>
    </div>

    <dialog ref={dialogRef} className="mono-scene-lab__dialog" aria-labelledby="scene-panel-title"
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled), select:not(:disabled), input:not(:disabled), [tabindex='0']"));
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }}
      onCancel={(event) => { event.preventDefault(); closePanel(); }} onClick={(event) => { if (event.target === event.currentTarget) closePanel(); }}>
      <div className="mono-scene-lab__dialog-body">
        <header><div><span>НАСТРОЙКА СЦЕНЫ</span><h2 id="scene-panel-title">{panel ? PANEL_TITLES[panel] : "Настройки"}</h2></div><button type="button" aria-label="Закрыть настройки" onClick={closePanel}>×</button></header>
        {panel === "balance" && <MonoBalanceControls value={appearance.balance} onChange={(balance) => setAppearance({ ...appearance, balance })} />}
        {panel === "chart" && <MonoChartControls value={appearance.chart} layout={appearance.layout} onChange={(chart) => setAppearance({ ...appearance, chart })} onLayoutChange={(layout) => setAppearance({ ...appearance, layout })} />}
        {panel === "assets" && <MonoAssetListControls value={appearance.assets} onChange={(assets) => setAppearance({ ...appearance, assets })} />}
        <button type="button" className="mono-scene-lab__done" onClick={closePanel}>Готово</button>
      </div>
    </dialog>
  </div>;
}
