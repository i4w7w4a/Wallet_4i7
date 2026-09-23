"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import type { ChartPeriod, WalletSnapshot } from "@wallet/core";
import { MONO_GLASS_DEFAULTS, MonoOpticalGlass } from "@wallet/ui";
import { MonoBalance } from "./mono-balance";
import { MonoChart } from "./mono-chart";
import { MonoAssetList } from "./mono-asset-list";
import { MonoLogo } from "./mono-logo";
import { MonoLabIconButton } from "./mono-lab-controls";
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
export function MonoSceneLab({ snapshot, formatProbe = false }: { snapshot: WalletSnapshot; formatProbe?: boolean }) {
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
  const closePanel = useCallback(() => {
    dialogRef.current?.close();
    setPanel(null);
    launchRef.current?.focus();
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!panel || !dialog) return;
    const compact = window.matchMedia("(max-width: 1199px)");
    const show = () => {
      const modal = String(compact.matches);
      if (dialog.open && dialog.dataset.modal === modal) return;
      const focused = dialog.contains(document.activeElement) ? document.activeElement as HTMLElement : null;
      if (dialog.open) dialog.close();
      dialog.dataset.modal = modal;
      if (compact.matches) dialog.showModal(); else dialog.show();
      (focused ?? dialog.querySelector<HTMLElement>("input, select"))?.focus();
    };
    const escape = (event: KeyboardEvent) => {
      if (!compact.matches && event.key === "Escape" && !event.defaultPrevented) {
        event.preventDefault(); closePanel();
      }
    };
    show();
    compact.addEventListener("change", show);
    window.addEventListener("keydown", escape);
    return () => { compact.removeEventListener("change", show); window.removeEventListener("keydown", escape); };
  }, [panel, closePanel]);

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
        <div className="mono-scene-lab__environment-field"><label htmlFor="scene-lab-theme">Тема</label><select id="scene-lab-theme" value={theme} onChange={(event) => setTheme(event.target.value as "dark" | "light")}><option value="dark">Графит</option><option value="light">Фарфор</option></select></div>
        <div className="mono-scene-lab__environment-field"><label htmlFor="scene-lab-locale">Формат чисел</label><select id="scene-lab-locale" value={locale} onChange={(event) => setLocale(event.target.value)}><option value="ru-RU">Русский</option><option value="en-US">English</option><option value="de-DE">Deutsch</option></select></div>
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

    {formatProbe && <section className="mono-scene-lab__format-probe" aria-label="Типографические образцы">
      <h2>Типографические образцы</h2><p>Искусственные числа для проверки ширины. Баланс кошелька не меняется.</p>
      <div><MonoBalance label="Длинная сумма · образец" value={1234567.89} format={{ locale: "ru-RU", currency: "RUB" }} appearance={appearance.balance} hidden={false} /></div>
      <div><MonoBalance label="Высокая точность · образец" value={-0.00001234} format={{ locale: "en-US", currency: "USD", minimumFractionDigits: 8, maximumFractionDigits: 8 }} appearance={appearance.balance} hidden={false} /></div>
    </section>}

    <dialog ref={dialogRef} className="mono-scene-lab__dialog" aria-labelledby="scene-panel-title"
      onKeyDown={(event) => {
        if (event.key === "Escape") { event.preventDefault(); closePanel(); return; }
        if (event.key !== "Tab" || event.currentTarget.dataset.modal !== "true") return;
        const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled), select:not(:disabled), input:not(:disabled), [tabindex='0']"));
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }}
      onCancel={(event) => { event.preventDefault(); closePanel(); }} onClick={(event) => { if (event.target === event.currentTarget) closePanel(); }}>
      <div className="mono-scene-lab__dialog-body">
        <header><div><span>НАСТРОЙКА СЦЕНЫ</span><h2 id="scene-panel-title">{panel ? PANEL_TITLES[panel] : "Настройки"}</h2></div><MonoLabIconButton label="Закрыть настройки" onClick={closePanel}>×</MonoLabIconButton></header>
        {panel === "balance" && <MonoBalanceControls value={appearance.balance} onChange={(balance) => setAppearance({ ...appearance, balance })} />}
        {panel === "chart" && <MonoChartControls value={appearance.chart} layout={appearance.layout} onChange={(chart) => setAppearance({ ...appearance, chart })} onLayoutChange={(layout) => setAppearance({ ...appearance, layout })} />}
        {panel === "assets" && <MonoAssetListControls value={appearance.assets} onChange={(assets) => setAppearance({ ...appearance, assets })} />}
        <button type="button" className="mono-scene-lab__done" onClick={closePanel}>Готово</button>
      </div>
    </dialog>
  </div>;
}
