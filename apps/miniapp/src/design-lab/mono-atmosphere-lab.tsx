"use client";

import { useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { MonoBackgroundRecipes } from "../mono-preview/mono-background-recipes-view";
import { MONO_BACKGROUND_DEFAULTS, parseMonoBackgroundRecipe,
  type MonoBackgroundRecipeConfig, type MonoBackgroundRecipeId } from "../mono-preview/mono-background-recipes";
import { MonoLogo } from "../mono-preview/mono-logo";
import { MonoLabIconButton, MonoLabSection } from "../mono-preview/mono-lab-controls";
import { MonoBackgroundRecipeControls } from "../mono-preview/mono-background-recipes-controls";
import "../mono-preview/mono-fonts.css";
import "../mono-preview/mono-preview.css";
import "../mono-preview/mono-theme.css";
import styles from "./mono-atmosphere-lab.module.css";

export const MONO_ATMOSPHERE_LAB_STORAGE_KEY = "wallet4i7.mono.atmosphere-lab.v1";
const SAVED_EVENT = "mono-atmosphere-lab-saved";
const RECIPES = [
  { id: "baseline", label: "База · Ирис", index: "00", subtitle: "Знакомая тишина", description: "Исходный световой фон MONO. Контрольная точка для сравнения." },
  { id: "obsidian", label: "Обсидиан", index: "01", subtitle: "Глубина материала", description: "Широкая складка и тонкий контур движутся на разной глубине." },
  { id: "aperture", label: "Световой разрез", index: "02", subtitle: "Свет задаёт форму", description: "Направленный свет и строгая теневая плоскость отвечают на положение мыши." },
] as const;
const WIDTHS = [320, 390, 430, 480] as const;
type History = { past: MonoBackgroundRecipeConfig[]; future: MonoBackgroundRecipeConfig[] };
type ConfigMap = Partial<Record<MonoBackgroundRecipeId, MonoBackgroundRecipeConfig>>;

function readSaved() { try { return localStorage.getItem(MONO_ATMOSPHERE_LAB_STORAGE_KEY); } catch { return null; } }
function subscribeSaved(listener: () => void) {
  window.addEventListener("storage", listener); window.addEventListener(SAVED_EVENT, listener);
  return () => { window.removeEventListener("storage", listener); window.removeEventListener(SAVED_EVENT, listener); };
}
function serverSaved() { return null; }

export type MonoAtmosphereSceneInput = { config: MonoBackgroundRecipeConfig; theme: "dark" | "light"; width: number };

/** The optional shared-scene render slot is owned by the central MONO integration. */
export function MonoAtmosphereLab({ renderScene }: { renderScene?: (input: MonoAtmosphereSceneInput) => ReactNode } = {}) {
  const storedRaw = useSyncExternalStore(subscribeSaved, readSaved, serverSaved);
  const saved = useMemo(() => { try { return storedRaw ? parseMonoBackgroundRecipe(storedRaw) : null; } catch { return null; } }, [storedRaw]);
  const [selected, setSelected] = useState<MonoBackgroundRecipeId | null>(null);
  const [drafts, setDrafts] = useState<ConfigMap>({});
  const [history, setHistory] = useState<Partial<Record<MonoBackgroundRecipeId, History>>>({});
  const gesture = useRef<MonoBackgroundRecipeConfig | null>(null);
  const recipe = selected ?? saved?.recipe ?? "obsidian";
  const config = drafts[recipe] ?? (saved?.recipe === recipe ? saved : MONO_BACKGROUND_DEFAULTS[recipe]);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [width, setWidth] = useState<number>(390);
  const [context, setContext] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [status, setStatus] = useState("");
  const [exported, setExported] = useState("");
  const [imported, setImported] = useState("");
  const [pendingImport, setPendingImport] = useState<MonoBackgroundRecipeConfig | null>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const currentHistory = history[recipe] ?? { past: [], future: [] };
  const shown = comparing ? { ...MONO_BACKGROUND_DEFAULTS.baseline, calm: config.calm } : config;
  const entry = RECIPES.find(item => item.id === shown.recipe)!;
  const dirty = JSON.stringify(config) !== JSON.stringify(saved?.recipe === recipe ? saved : MONO_BACKGROUND_DEFAULTS[recipe]);
  const remember = (before: MonoBackgroundRecipeConfig) => setHistory(current => ({ ...current,
    [recipe]: { past: [...(current[recipe]?.past ?? []), before].slice(-30), future: [] } }));
  const update = (next: MonoBackgroundRecipeConfig) => {
    if (!gesture.current && JSON.stringify(next) !== JSON.stringify(config)) remember(config);
    setDrafts(current => ({ ...current, [next.recipe]: next }));
    setStatus("Проба изменена.");
  };
  const beginGesture = () => { gesture.current ??= config; };
  const endGesture = (next: MonoBackgroundRecipeConfig) => {
    const before = gesture.current; gesture.current = null;
    if (before && JSON.stringify(before) !== JSON.stringify(next)) remember(before);
  };
  const undo = (redo = false) => {
    const stack = redo ? currentHistory.future : currentHistory.past;
    const next = stack.at(-1); if (!next) return;
    setHistory(current => ({ ...current, [recipe]: redo
      ? { past: [...currentHistory.past, config], future: stack.slice(0, -1) }
      : { past: stack.slice(0, -1), future: [...currentHistory.future, config] } }));
    setDrafts(current => ({ ...current, [recipe]: next }));
  };

  return <div className={styles.lab} data-atmosphere-lab>
    <header className={styles.header}>
      <a href="/design-lab">← Motion Lab</a><span>MONO / ATMOSPHERE 01</span><a href="/mono">Открыть MONO ↗</a>
    </header>
    <div className={styles.workspace}>
      <section className={styles.intro} aria-labelledby="atmosphere-heading">
        <span className={styles.eyebrow}>ТРИ СПОСОБА ПОЧУВСТВОВАТЬ ПРОСТРАНСТВО</span>
        <h1 id="atmosphere-heading">Атмосфера.</h1>
        <p>Двигайте мышь внутри сцены.<br />Материал откликается и замирает.</p>
        <div className={styles.recipes} role="group" aria-label="Варианты атмосферы">
          {RECIPES.map(item => <button key={item.id} type="button" aria-label={item.label} aria-pressed={recipe === item.id}
            onClick={() => { setSelected(item.id); setComparing(false); }}>
            <span className={styles.recipeIndex}>{item.index}</span><span>{item.label}</span><span aria-hidden="true">↗</span>
          </button>)}
        </div>
        <p className={styles.description}>{entry.description}</p>
        <div className={styles.contextSwitch}>
          {renderScene && <button type="button" aria-pressed={context} onClick={() => setContext(value => !value)}>{context ? "Показать отдельно" : "Показать в MONO"}</button>}
          <button type="button" aria-pressed={comparing} disabled={recipe === "baseline"}
            onClick={() => setComparing(value => !value)}>{comparing ? "Вернуться к пробе" : "Сравнить с базой"}</button>
        </div>
      </section>

      <section className={styles.previewColumn} aria-label="Живая примерка">
        <div className={styles.previewMeta}><span>{comparing ? "A / БАЗА" : `B / ${entry.label.toUpperCase()}`}</span><span>{width} PX</span></div>
        <div className={styles.frame} style={{ "--atmosphere-width": `${width}px` } as CSSProperties}>
          {context && renderScene ? renderScene({ config: shown, theme, width }) :
            <div ref={surfaceRef} className={`mono-page ${styles.surface}`} data-mono-preset="ledger" data-mono-theme={theme}
              data-mono-background="iris" data-atmosphere-surface>
              <MonoBackgroundRecipes surfaceRef={surfaceRef} config={shown} theme={theme} />
              <div className={styles.sample}>
                <div className="mono-app-header__mark"><MonoLogo /></div>
                <div className={styles.sampleHeading}><span>МАТЕРИАЛ / {entry.index}</span><h2>{entry.subtitle}</h2><p>Свет движется.<br />Содержание остаётся на месте.</p></div>
                <div className={styles.sampleFoot}><span>{theme === "dark" ? "ГРАФИТ" : "КЕРАМИКА"} / {config.calm ? "ПОКОЙ" : "ОТКЛИК"}</span><span aria-hidden="true">＋</span></div>
              </div>
            </div>}
        </div>
        <p className={styles.previewHint}>Локальная проба · оформление MONO не изменено</p>
      </section>

      <aside className={styles.tuner} aria-label="Настройка атмосферы">
        <div className={styles.tunerHeading}><strong>Характер</strong><span>{dirty ? "ПРОБА" : "ИСХОДНЫЙ"}</span></div>
        <div className={styles.segment} role="group" aria-label="Тема">
          <button type="button" aria-pressed={theme === "dark"} onClick={() => setTheme("dark")}>Тёмная</button>
          <button type="button" aria-pressed={theme === "light"} onClick={() => setTheme("light")}>Светлая</button>
        </div>
        <div className={styles.widths} role="group" aria-label="Ширина примерки">{WIDTHS.map(value => <button key={value} type="button" aria-pressed={width === value} onClick={() => setWidth(value)}>{value}</button>)}</div>
        <div className={styles.controls}><MonoBackgroundRecipeControls value={config} disabled={comparing}
          showRecipeSelector={false} onGestureStart={beginGesture} onGestureCommit={endGesture}
          onChange={next => { if (next) update(next); }} /></div>
        <div className={styles.history}>
          <MonoLabIconButton label="Отменить" disabled={!currentHistory.past.length} onClick={() => undo()}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 5 3 10l5 5M3 10h10a7 7 0 0 1 0 14" /></svg></MonoLabIconButton>
          <MonoLabIconButton label="Повторить" disabled={!currentHistory.future.length} onClick={() => undo(true)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m16 5 5 5-5 5m5-5H11a7 7 0 0 0 0 14" /></svg></MonoLabIconButton>
          <MonoLabIconButton label="По умолчанию" onClick={() => update({ ...MONO_BACKGROUND_DEFAULTS[recipe] })}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 4v6h6M4 10a8 8 0 1 1 .5 7" /></svg></MonoLabIconButton>
        </div>
        <div className={styles.commands}>
          <button type="button" className={styles.primary} onClick={() => {
            try { localStorage.setItem(MONO_ATMOSPHERE_LAB_STORAGE_KEY, JSON.stringify(config)); window.dispatchEvent(new Event(SAVED_EVENT)); setStatus("Проба сохранена в этом браузере."); }
            catch { setStatus("Сохранение недоступно. Используйте JSON пробы."); }
          }}>Сохранить пробу</button>
        </div>
        <p className={styles.status} role="status">{status || (storedRaw ? saved ? "Сохранённая проба восстановлена." : "Проба повреждена; открыт исходный вариант." : "Проба ещё не сохранена.")}</p>
        <div className={styles.details}><MonoLabSection title="JSON пробы">
          <button type="button" onClick={() => setExported(JSON.stringify(config, null, 2))}>Экспорт JSON</button>
          {exported && <textarea aria-label="Экспорт пробы" readOnly value={exported} rows={8} />}
          <textarea aria-label="Импорт пробы" value={imported} maxLength={4097} rows={4} placeholder="Вставьте JSON атмосферы" onChange={event => { setImported(event.target.value); setPendingImport(null); }} />
          <button type="button" onClick={() => { try { setPendingImport(parseMonoBackgroundRecipe(imported)); setStatus("JSON проверен. Откройте его в примерке."); } catch (error) { setPendingImport(null); setStatus((error as Error).message); } }}>Проверить JSON</button>
          {pendingImport && <div role="region" aria-label="Предпросмотр импорта"><p>{RECIPES.find(item => item.id === pendingImport.recipe)?.label} · {Math.round(pendingImport.intensity * 100)}% · {pendingImport.calm ? "покой" : "отклик"}</p><button type="button" onClick={() => {
            const target = pendingImport.recipe;
            const before = drafts[target] ?? (saved?.recipe === target ? saved : MONO_BACKGROUND_DEFAULTS[target]);
            setHistory(current => ({ ...current, [target]: { past: [...(current[target]?.past ?? []), before].slice(-30), future: [] } }));
            setSelected(target); setDrafts(current => ({ ...current, [target]: pendingImport }));
            setComparing(false); setPendingImport(null); setStatus("Импорт открыт как несохранённая проба.");
          }}>Открыть импорт в примерке</button></div>}
          <p className={styles.note}>«Отклик» меняет время успокоения. На сенсорном экране и при ограничении движения материал статичен. Сохранение пробы не применяет её к MONO.</p>
          <p className={styles.note}>Собственная SVG/CSS-композиция. Без физической рефракции фона. Референсы: <a href="https://github.com/DavidHDev/react-bits/blob/3a1c7f2f9f94ed833934ab5c2635760b9e644583/src/ts-default/Backgrounds/Silk/Silk.tsx">Silk</a> и <a href="https://github.com/magicuidesign/magicui/blob/d7207e5692d14c00dceafa8488d6d01f197fa0e4/apps/www/registry/magicui/light-rays.tsx">Light Rays</a>.</p>
        </MonoLabSection></div>
      </aside>
    </div>
  </div>;
}
