"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import type { BackgroundPresentation, BackgroundRuntimeStatus, BackgroundSandboxBindings, MaterialAction, MaterialQualityProfile, MaterialRecipeV2 } from "@wallet/ui";
import { MonoBackgroundRecipes } from "../mono-preview/mono-background-recipes-view";
import { MONO_BACKGROUND_DEFAULTS, type MonoBackgroundRecipeConfig, type MonoBackgroundRecipeId } from "../mono-preview/mono-background-recipes";
import { MonoLabIconButton } from "../mono-preview/mono-lab-controls";
import { MonoBackgroundRecipeControls } from "../mono-preview/mono-background-recipes-controls";
import { SandboxDialog } from "./background-sandbox/dialog";
import { ParameterControls } from "./background-sandbox/parameter-controls";
import { MaterialControls } from "./material-controls";
import { RecipeSummary } from "./background-sandbox/recipe-summary";
import { createSandboxSession } from "./background-sandbox/session";
import { isDirty, type SandboxWorkspace } from "./background-sandbox/model";
import { isGpuRecipe, isV1GpuRecipe, isV2Recipe, recipeKey, recipeParser, type SandboxRecipe } from "./background-sandbox/recipes";
import { LEGACY_KEY, boundedJson, exactObject, parseRecipeImport, readLegacyTrial } from "./background-sandbox/storage";
import { readV1LibraryPreview, V2_LIBRARY_KEY, V2_WORKSPACE_KEY } from "./background-sandbox/storage-v2";
import { readV1WorkspacePreview } from "./background-sandbox/workspace-v2";
import type { TrialLibrary } from "./background-sandbox/storage";
import "../mono-preview/mono-fonts.css";
import "../mono-preview/mono-preview.css";
import "../mono-preview/mono-theme.css";
import styles from "./mono-atmosphere-lab.module.css";

/** Compatibility export only: this key is now read-only. */
export const MONO_ATMOSPHERE_LAB_STORAGE_KEY = LEGACY_KEY;
export type MonoAtmosphereSceneInput = { config: MonoBackgroundRecipeConfig; theme: "dark" | "light"; width: number };
const LEGACY = [
  { id: "obsidian", label: "Обсидиан" }, { id: "aperture", label: "Световой разрез" }, { id: "baseline", label: "Ирис" },
] as const;
const WIDTHS = [320, 390, 430, 480] as const;
type Dialog = "library" | "more" | "name" | "guard" | "import" | "export" | "source" | "copy" | null;
type Transition = { action(): void; label: string };
const TITLES = { library: "Библиотека проб", more: "Дополнительно", name: "Сохранить пробу", guard: "Несохранённая проба", import: "Импорт JSON", export: "Экспорт JSON", source: "Материал и источник", copy: "Копия из мастерской кнопок" };
const BUTTON_COPY_KEY = "wallet4i7.material-copy.buttons-to-background.v1";
const BACKGROUND_COPY_KEY = "wallet4i7.material-copy.background-to-buttons.v1";

function Icon({ kind }: { kind: "open" | "undo" | "redo" | "pause" | "play" | "restart" | "more" }) {
  const paths = { open: "M3 7h7l2 2h9l-2 11H3V7Zm0 0V4h7l2 3", undo: "m9 5-6 5 6 5M3 10h10a7 7 0 0 1 0 14", redo: "m15 5 6 5-6 5m6-5H11a7 7 0 0 0 0 14", pause: "M8 5v14M16 5v14", play: "m8 4 12 8-12 8V4Z", restart: "M4 4v6h6M4 10a8 8 0 1 1 .5 7", more: "M5 11v2M12 11v2M19 11v2" };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={paths[kind]} /></svg>;
}
function LegacyStage({ recipe, theme, paused }: { recipe: MonoBackgroundRecipeConfig; theme: "dark" | "light"; paused: boolean }) {
  const surface = useRef<HTMLDivElement>(null);
  return <div ref={surface} className={`mono-page ${styles.legacySurface}`} data-mono-preset="ledger" data-mono-background="iris" data-mono-theme={theme} data-atmosphere-surface>
    <MonoBackgroundRecipes surfaceRef={surface} config={recipe} theme={theme} active={!paused} />
  </div>;
}

/** ORACLE supplies the allowlisted descriptors and the only GPU/MonoScene renderer. */
export function MonoAtmosphereLab({ bindings, renderScene }: {
  bindings?: BackgroundSandboxBindings;
  renderScene?: (input: MonoAtmosphereSceneInput) => ReactNode;
} = {}) {
  const parse = recipeParser(bindings);
  const [editor] = useState(() => {
    const initial: SandboxRecipe = bindings?.materialCatalogV2?.materials[0]?.presets[0]?.recipe
      ?? bindings?.materials[0]?.presets[0]?.recipe ?? { ...MONO_BACKGROUND_DEFAULTS.obsidian };
    return createSandboxSession(initial, recipeKey(initial), parse, 2);
  });
  const state = useSyncExternalStore(editor.subscribe, editor.getSnapshot, editor.getServerSnapshot);
  const slot = state.workspace.slots[state.workspace.activeSlot]!;
  const config = slot.present.recipe;
  const shown = editor.shownRecipe();
  const descriptorV1 = isV1GpuRecipe(config) ? bindings?.materials.find(item => item.id === config.effectId) : undefined;
  const descriptorV2 = isV2Recipe(config) ? bindings?.materialCatalogV2?.materials.find(item => item.id === config.effectId && item.effectVersion === config.effectVersion) : undefined;
  const shownDescriptor = isV2Recipe(shown)
    ? bindings?.materialCatalogV2?.materials.find(item => item.id === shown.effectId && item.effectVersion === shown.effectVersion)
    : isV1GpuRecipe(shown) ? bindings?.materials.find(item => item.id === shown.effectId) : undefined;
  const [presentation, setPresentation] = useState<BackgroundPresentation>({ mode: "standalone", shape: "wide" });
  const [paused, setPaused] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [dialog, setDialogState] = useState<Dialog>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const [pending, setPending] = useState<Transition | null>(null);
  const [name, setName] = useState("");
  const [asNew, setAsNew] = useState(false);
  const [importText, setImportText] = useState("");
  const [importPreview, setImportPreview] = useState<SandboxRecipe | null>(null);
  const [copyPreview, setCopyPreview] = useState<MaterialRecipeV2 | null>(null);
  const copyConsumed = useRef(false);
  const [legacy, setLegacy] = useState<MonoBackgroundRecipeConfig | null>(null);
  const [v1Library, setV1Library] = useState<TrialLibrary<SandboxRecipe> | null>(null);
  const [v1Workspace, setV1Workspace] = useState<SandboxWorkspace<SandboxRecipe> | null>(null);
  const [legacyNotice, setLegacyNotice] = useState("");
  const [notice, setNotice] = useState("");
  const [runtime, setRuntime] = useState<BackgroundRuntimeStatus | null>(null);
  const [quality, setQuality] = useState<MaterialQualityProfile>("balanced");
  const [transientAction, setTransientAction] = useState<{ requestId: number; restartKey: number; action: MaterialAction }>();
  const actionSerial = useRef(0);
  const onStatus = useCallback((next: BackgroundRuntimeStatus) => setRuntime(next), []);
  const dirty = isDirty(slot) || slot.present.key.includes("import");
  const title = slot.present.source?.name ?? "Новая проба";
  const currentSaved = slot.present.source && !dirty && !state.externalChange && !state.libraryError &&
    state.library.trials.some(trial => trial.id === slot.present.source?.id && trial.revision === slot.present.source.revision && JSON.stringify(trial.recipe) === JSON.stringify(config));
  const saveStatus = state.recoveryUnavailable ? "Проба недоступна" : state.saving ? "Сохранение…" : state.saveError ? "Не удалось сохранить" : currentSaved ? "Сохранено" : dirty ? "Изменено" : "Не сохранено";
  const fittingAvailable = isV2Recipe(shown) ? !!bindings?.fittingAvailable && !!bindings.renderMaterialStageV2
    : isGpuRecipe(shown) ? !!bindings?.fittingAvailable : !!renderScene;
  const effectivePresentation: BackgroundPresentation = presentation.mode === "mono" && !fittingAvailable ? { mode: "standalone", shape: "wide" } : presentation;
  const inactive = state.comparing || state.saving || !state.ready || state.recoveryUnavailable;

  function setDialog(next: Dialog) {
    // Capture in the opening event, before the following commit makes the launcher inert.
    if (next !== null && dialog === null) returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setDialogState(next);
  }
  useLayoutEffect(() => {
    if (dialog !== null) return;
    const target = returnFocus.current; returnFocus.current = null;
    // All DOM mutations (including removing inert) have completed before layout effects.
    if (target?.isConnected) target.focus();
  }, [dialog]);

  useEffect(() => {
    const port = { getItem: (key: string) => window.localStorage.getItem(key), setItem: (key: string, value: string) => window.localStorage.setItem(key, value) };
    editor.connect(port, navigator.locks?.request ? task => navigator.locks.request("wallet4i7.background-sandbox.v2", task) : undefined);
    function changed(event: StorageEvent) { if (event.key === null || event.key === V2_LIBRARY_KEY || event.key === V2_WORKSPACE_KEY) editor.notifyExternalChange(); }
    function leaving(event: BeforeUnloadEvent) {
      if (editor.getSnapshot().workspace.slots.some(item => isDirty(item) || item.present.key.includes("import"))) { event.preventDefault(); event.returnValue = ""; }
    }
    window.addEventListener("storage", changed); window.addEventListener("beforeunload", leaving);
    return () => { window.removeEventListener("storage", changed); window.removeEventListener("beforeunload", leaving); };
  }, [editor]);
  useEffect(() => {
    const catalog = bindings?.materialCatalogV2;
    if (!state.ready || !catalog || copyConsumed.current) return;
    let active = true;
    queueMicrotask(() => {
      if (!active || copyConsumed.current) return;
      copyConsumed.current = true;
      try {
        const raw = window.sessionStorage.getItem(BUTTON_COPY_KEY);
        if (raw === null) return;
        window.sessionStorage.removeItem(BUTTON_COPY_KEY);
        const data = exactObject(boundedJson(raw, 64 * 1024), ["version", "target", "recipe"]);
        if (data.version !== 1 || data.target !== "background") throw new Error("Неверный адрес копии материала.");
        const copied = catalog.copyForTarget(data.recipe, "background");
        if (!copied.ok) throw new Error(copied.issues.map(issue => issue.message).join(" "));
        returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        setCopyPreview(copied.value); setDialogState("copy");
      } catch (error) { setNotice(error instanceof Error ? error.message : "Не удалось прочитать копию материала."); }
    });
    return () => { active = false; };
  }, [state.ready, bindings?.materialCatalogV2]);
  useEffect(() => {
    function keyboard(event: KeyboardEvent) {
      if (dialog || event.isComposing || event.defaultPrevented || document.querySelector('[role="dialog"], dialog[open]') ||
        (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable="true"]'))) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") { event.preventDefault(); editor.undo(event.shiftKey); }
      else if (!event.ctrlKey && !event.metaKey && !event.altKey) {
        if (["1", "2", "3"].includes(event.key)) { event.preventDefault(); editor.selectSlot(Number(event.key) - 1); }
        if (event.key.toLowerCase() === "a") editor.compare(true);
        if (event.key.toLowerCase() === "b") editor.compare(false);
      }
    }
    document.addEventListener("keydown", keyboard);
    return () => document.removeEventListener("keydown", keyboard);
  }, [editor, dialog]);

  function close() { setDialog(null); setPending(null); setCopyPreview(null); setNotice(""); }
  function request(transition: Transition) {
    editor.endGesture(); setNotice("");
    if (dirty) { setPending(transition); setDialog("guard"); }
    else { transition.action(); close(); }
  }
  function nameDialog(newCopy: boolean) {
    setAsNew(newCopy); setName(newCopy ? "" : slot.present.source?.name ?? ""); setDialog("name"); setNotice("");
  }
  async function save(transition?: Transition) {
    if (!slot.present.source) { setPending(transition ?? null); nameDialog(true); return; }
    if (await editor.save()) { transition?.action(); close(); }
  }
  function openLibrary() {
    editor.endGesture(); editor.refreshLibrary();
    const errors: string[] = [];
    try { setLegacy(readLegacyTrial(localStorage)); } catch (error) { setLegacy(null); errors.push(`Atmosphere v1: ${(error as Error).message}`); }
    try { setV1Library(readV1LibraryPreview(localStorage, parse)); } catch (error) { setV1Library(null); errors.push(`Библиотека v1: ${(error as Error).message}`); }
    try { setV1Workspace(readV1WorkspacePreview(localStorage, parse)); } catch (error) { setV1Workspace(null); errors.push(`Черновики v1: ${(error as Error).message}`); }
    setLegacyNotice(errors.join(" ")); setNotice("");
    setDialog("library");
  }
  function chooseMaterial(key: string) {
    if (key === recipeKey(config)) return;
    const materialV2 = bindings?.materialCatalogV2?.materials.find(item => `material:${item.id}:${item.effectVersion}` === key);
    const materialV1 = bindings?.materials.find(item => item.id === key);
    const next = materialV2?.presets[0]?.recipe ?? materialV1?.presets[0]?.recipe
      ?? (key.startsWith("legacy-") ? MONO_BACKGROUND_DEFAULTS[key.slice(7) as MonoBackgroundRecipeId] : undefined);
    if (next) request({ label: "Сменить материал", action: () => editor.openRecipe(next, key, true) });
  }
  const recipeLabel = (value: SandboxRecipe) => isV2Recipe(value)
    ? bindings?.materialCatalogV2?.materials.find(item => item.id === value.effectId && item.effectVersion === value.effectVersion)?.label ?? value.effectId
    : isV1GpuRecipe(value) ? bindings?.materials.find(item => item.id === value.effectId)?.label ?? value.effectId
      : LEGACY.find(item => item.id === value.recipe)?.label;
  function copyToButtons() {
    if (!isV2Recipe(config) || !bindings?.materialCatalogV2 || state.recoveryUnavailable || state.saving) return false;
    const result = bindings.materialCatalogV2.copyForTarget(config, "button-fill");
    if (!result.ok) { setNotice(result.issues.map(issue => issue.message).join(" ")); return false; }
    try {
      const snapshot = JSON.stringify({ version: 1, target: "buttons", recipe: result.value });
      if (new TextEncoder().encode(snapshot).byteLength > 64 * 1024) throw new Error("Проба больше 64 KiB.");
      window.sessionStorage.setItem(BACKGROUND_COPY_KEY, snapshot);
      return true;
    } catch (error) { setNotice(error instanceof Error ? error.message : "Не удалось передать материал."); return false; }
  }

  return <div className={styles.lab} data-atmosphere-lab data-background-sandbox>
    <div inert={dialog !== null} aria-hidden={dialog !== null || undefined}>
      <header className={styles.header}><a href="/design-lab">← Design Lab</a><span>BACKGROUND SANDBOX</span><a href="/mono">MONO ↗</a></header>
      <div className={styles.toolbar}>
        <MonoLabIconButton label="Открыть библиотеку" disabled={state.saving} onClick={openLibrary}><Icon kind="open" /></MonoLabIconButton>
        <div className={styles.documentTitle}><h1>{title}</h1><span data-save-status={saveStatus} role="status">{saveStatus}</span></div>
        <div className={styles.tools}>
          <MonoLabIconButton label="Отменить" disabled={inactive || !slot.past.length} onClick={() => editor.undo()}><Icon kind="undo" /></MonoLabIconButton>
          <MonoLabIconButton label="Повторить" disabled={inactive || !slot.future.length} onClick={() => editor.undo(true)}><Icon kind="redo" /></MonoLabIconButton>
          <span className={styles.divider} />
          <MonoLabIconButton label={paused ? "Продолжить" : "Пауза"} aria-pressed={paused} onClick={() => setPaused(value => !value)}><Icon kind={paused ? "play" : "pause"} /></MonoLabIconButton>
          <MonoLabIconButton label="Перезапустить" onClick={() => editor.restart()}><Icon kind="restart" /></MonoLabIconButton>
          <div className={styles.compare} role="group" aria-label="Сравнение A/B">
            <button className={styles.control} type="button" aria-label="Показать A" aria-pressed={state.comparing} disabled={!state.workspace.pinned || state.saving} onClick={() => editor.compare(true)}>A</button>
            <button className={styles.control} type="button" aria-label="Показать B" aria-pressed={!state.comparing} disabled={state.saving} onClick={() => editor.compare(false)}>B</button>
          </div>
          <button className={`${styles.control} ${styles.primary}`} type="button" disabled={state.saving || !state.ready || state.recoveryUnavailable} onClick={() => { void save(); }}>Сохранить</button>
          <MonoLabIconButton label="Дополнительно" disabled={state.saving} onClick={() => { editor.endGesture(); setDialog("more"); }}><Icon kind="more" /></MonoLabIconButton>
        </div>
      </div>
      <div className={styles.workspace}>
        <div className={styles.previewColumn}>
          <div className={styles.viewport}>
            <span>{state.comparing ? `A · ${state.workspace.pinned?.name}` : `B · ${recipeLabel(config)}`}</span>
            <label>Формат<select aria-label="Формат сцены" value={effectivePresentation.mode === "mono" ? "mono" : effectivePresentation.shape}
              onChange={event => setPresentation(event.target.value === "mono" ? { mode: "mono", width: 390 } : { mode: "standalone", shape: event.target.value as "wide" | "square" | "portrait" })}>
              <option value="wide">Широкая сцена</option><option value="square">Квадрат</option><option value="portrait">Портрет</option>
              <option value="mono" disabled={!fittingAvailable}>Примерка MONO{fittingAvailable ? "" : " · недоступна"}</option>
            </select></label>
            {isV2Recipe(shown) && <label>Качество просмотра<select aria-label="Качество просмотра" value={quality}
              onChange={event => setQuality(event.target.value as MaterialQualityProfile)}>
              <option value="economy">Экономно</option><option value="balanced">Сбалансировано</option><option value="detail">Детально</option>
            </select></label>}
          </div>
          {effectivePresentation.mode === "mono" && <div className={styles.widths} role="group" aria-label="Ширина примерки">{WIDTHS.map(width => <button type="button" className={styles.control} key={width} aria-pressed={effectivePresentation.width === width} onClick={() => setPresentation({ mode: "mono", width })}>{width}</button>)}</div>}
          <section className={styles.stage} aria-label="Сцена материала" data-mode={effectivePresentation.mode} data-shape={effectivePresentation.mode === "standalone" ? effectivePresentation.shape : "portrait"}
            style={effectivePresentation.mode === "mono" ? { "--fitting-width": `${effectivePresentation.width}px` } as CSSProperties : undefined}>
            {!state.ready ? <div className={styles.unavailable}>Подготовка рабочего места…</div>
              : state.recoveryUnavailable ? <div className={styles.unavailable}><p>Сохранённое рабочее место недоступно.</p><p>{state.recoveryError}</p><p>Исходные данные сохранены. Можно открыть именованную пробу из библиотеки или начать новую.</p><button className={styles.control} type="button" onClick={editor.startFresh}>Начать новую пробу</button></div>
              : isV2Recipe(shown) && bindings?.renderMaterialStageV2 ? bindings.renderMaterialStageV2({ recipe: shown, presentation: effectivePresentation,
                quality, paused: paused || state.comparing, restartKey: state.restartKey,
                transientAction: !state.comparing && transientAction?.restartKey === state.restartKey ? transientAction : undefined, onStatus })
              : isV1GpuRecipe(shown) && bindings ? bindings.renderStage({ recipe: shown, presentation: effectivePresentation, paused: paused || state.comparing, restartKey: state.restartKey, onStatus })
              : !isGpuRecipe(shown) && effectivePresentation.mode === "mono" && renderScene ? renderScene({ config: paused || state.comparing ? { ...shown, calm: true } : shown, theme, width: effectivePresentation.width })
              : !isGpuRecipe(shown) ? <LegacyStage recipe={shown} theme={theme} paused={paused || state.comparing} /> : <p>Этот материал недоступен.</p>}
          </section>
          <div className={styles.stageFoot}><span>{effectivePresentation.mode === "mono" ? "Примерка · оформление кошелька не изменено" : "Самостоятельная проба · только в этом браузере"}</span>
            <span>{isGpuRecipe(shown) ? runtime?.message ?? "Подготовка материала…" : "SVG / CSS · свет, без физической симуляции"}</span></div>
          <p className={styles.resetNote}>Открытие, A/B и перезапуск начинают движение заново. Смена размера и восстановление GPU могут сбросить симуляцию. Сохраняются параметры, а не история жестов.</p>
        </div>
        <aside className={styles.tuner} aria-label="Инспектор материала">
          <div className={styles.tunerHeading}><h2>Материал</h2><span>{String(state.workspace.activeSlot + 1).padStart(2, "0")}</span></div>
          <div className={styles.slots} role="group" aria-label="Независимые пробы">{[0, 1, 2].map(index => <button className={styles.control} type="button" key={index} aria-label={`Слот ${index + 1}`} aria-pressed={state.workspace.activeSlot === index} disabled={state.saving} onClick={() => editor.selectSlot(index)}>{index + 1}{isDirty(state.workspace.slots[index]!) ? " ·" : ""}</button>)}</div>
          <label className={styles.field}>Материал<select value={recipeKey(config)} disabled={inactive} onChange={event => chooseMaterial(event.target.value)}>
            {bindings?.materialCatalogV2?.materials.map(item => <option key={`material:${item.id}:${item.effectVersion}`}
              value={`material:${item.id}:${item.effectVersion}`}>{item.label} · v{item.effectVersion}</option>)}
            {!!bindings?.materials.length && <optgroup label="Ранние GPU-пробы v1">{bindings.materials.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</optgroup>}
            <optgroup label="Контрольные SVG / CSS">{LEGACY.map(item => <option key={item.id} value={`legacy-${item.id}`}>{item.label}</option>)}</optgroup>
          </select></label>
          <p className={styles.description}>{descriptorV2?.description ?? descriptorV1?.description ?? "Свет и плоскости отвечают на указатель. Контрольный материал прежней лаборатории."}</p>
          {descriptorV2 && isV2Recipe(config) ? <MaterialControls key={recipeKey(config)} descriptor={descriptorV2} recipe={config} disabled={inactive} onChange={editor.edit}
            onGestureStart={editor.beginGesture} onGestureCommit={editor.endGesture} onError={setNotice}
            onAction={action => setTransientAction({ requestId: ++actionSerial.current, restartKey: state.restartKey, action })} />
            : descriptorV1 && isV1GpuRecipe(config) ? <ParameterControls descriptor={descriptorV1} recipe={config} disabled={inactive} onChange={editor.edit} onStart={editor.beginGesture} onCommit={editor.endGesture} onError={setNotice} />
            : !isGpuRecipe(config) && <MonoBackgroundRecipeControls value={config} disabled={inactive} showRecipeSelector={false} onChange={next => { if (next) editor.edit(next); }} onGestureStart={editor.beginGesture} onGestureCommit={editor.endGesture} />}
          {((descriptorV2?.presets.length ?? descriptorV1?.presets.length ?? 0) > 1) && <label className={styles.field}>Начальная проба<select aria-label="Начальная проба" value="" disabled={inactive} onChange={event => {
            const preset = (descriptorV2?.presets ?? descriptorV1?.presets)?.find(item => item.id === event.target.value); if (preset) editor.edit(preset.recipe);
          }}><option value="" disabled>Выбрать вариант…</option>{(descriptorV2?.presets ?? descriptorV1?.presets)?.map(preset => <option key={preset.id} value={preset.id}>{preset.label}</option>)}</select></label>}
          <div className={styles.inspectorActions}><button className={styles.control} type="button" disabled={inactive} onClick={() => {
            const defaults = descriptorV2?.presets[0]?.recipe ?? descriptorV1?.presets[0]?.recipe ?? (!isGpuRecipe(config) ? MONO_BACKGROUND_DEFAULTS[config.recipe] : null); if (defaults) editor.edit(defaults);
          }}>По умолчанию</button><button className={styles.control} type="button" disabled={state.recoveryUnavailable} onClick={() => setDialog("source")}>Об источнике</button></div>
          {isV2Recipe(config) && descriptorV2?.capabilities.includes("button-fill") && <a className={styles.control}
            aria-disabled={state.recoveryUnavailable || state.saving} href="/design-lab/buttons"
            onClick={event => { if (!copyToButtons()) event.preventDefault(); }}>Копировать в мастерскую кнопок</a>}
          {!isGpuRecipe(config) && <label className={styles.field}>Тема<select value={theme} onChange={event => setTheme(event.target.value as "dark" | "light")}><option value="dark">Тёмная</option><option value="light">Светлая</option></select></label>}
          <p className={styles.note}>{state.workspace.pinned ? `A закреплена: ${state.workspace.pinned.name}, ревизия ${state.workspace.pinned.revision}.` : "Для A выберите сохранённую пробу в библиотеке."}</p>
          {!fittingAvailable && <p className={styles.note}>{bindings?.fittingUnavailableReason ?? "Примерка MONO появится после проверки общего renderer."}</p>}
        </aside>
      </div>
      <footer className={styles.footer}>
        <p>{state.recoveryError ? `Workspace не записан: ${state.recoveryError}` : state.recovered ? "Рабочее место восстановлено. Именованные пробы сохраняются отдельно." : "Workspace восстанавливает черновики; именованная проба записывается только по «Сохранить»."}</p>
        {state.ready && !state.writeAvailable && <p role="alert">Сохранение недоступно: браузер не поддерживает Web Locks. Черновик доступен для экспорта JSON.</p>}
        {(state.saveError || state.libraryError || state.externalChange || notice) && <p role="alert">{state.saveError || state.libraryError || notice || "Хранилище изменено в другой вкладке. Откройте библиотеку заново перед сохранением."}</p>}
      </footer>
    </div>
    {dialog && <SandboxDialog key={dialog} title={TITLES[dialog]} close={close} busy={state.saving}>
      {dialog === "more" && <div className={styles.actionList}>
        <button className={styles.control} type="button" disabled={state.recoveryUnavailable} onClick={() => nameDialog(true)}>Сохранить как…</button>
        <button className={styles.control} type="button" onClick={() => { setImportText(""); setImportPreview(null); setNotice(""); setDialog("import"); }}>Импорт JSON</button>
        <button className={styles.control} type="button" disabled={state.recoveryUnavailable} onClick={() => setDialog("export")}>Экспорт JSON</button>
        <button className={styles.control} type="button" disabled={state.recoveryUnavailable} onClick={() => setDialog("source")}>Материал и источник</button>
      </div>}
      {dialog === "name" && <form onSubmit={event => { event.preventDefault(); void editor.save(name, asNew).then(ok => { if (ok) { pending?.action(); close(); } }); }}>
        <label className={styles.field}>Имя пробы<input data-initial-focus value={name} maxLength={64} required disabled={state.saving} onChange={event => setName(event.target.value)} /></label>
        <p className={styles.note}>Полная конфигурация. Только этот браузер; оформление MONO не изменяется.</p>
        <button className={`${styles.control} ${styles.primary}`} type="submit" disabled={state.saving}>Сохранить пробу</button>
        {state.saveError && <p role="alert">{state.saveError}</p>}
      </form>}
      {dialog === "guard" && <div><p>В «{title}» есть изменения. {pending?.label}?</p><div className={styles.actionList}>
        <button className={`${styles.control} ${styles.primary}`} type="button" onClick={() => { void save(pending ?? undefined); }}>Сохранить и перейти</button>
        <button className={styles.control} type="button" onClick={() => { editor.discard(); pending?.action(); close(); }}>Отбросить и перейти</button>
        <button className={styles.control} type="button" data-initial-focus onClick={close}>Вернуться</button>
      </div>{state.saveError && <p role="alert">{state.saveError}</p>}</div>}
      {dialog === "library" && <div>
        <p className={styles.note}>Именованные пробы · {state.library.trials.length} / 32. Закрепление A сохраняет точный снимок выбранной ревизии.</p>
        {state.libraryError && <p role="alert">{state.libraryError}</p>}
        {!state.library.trials.length && <p>Пока пусто. Сохраните первую пробу.</p>}
        <div className={styles.library}>{state.library.trials.map(trial => <div className={styles.libraryRow} key={trial.id}>
          <div><strong>{trial.name}</strong><small>{recipeLabel(trial.recipe)} · ревизия {trial.revision}</small></div>
          <button className={styles.control} type="button" aria-label={`Открыть «${trial.name}»`} onClick={() => request({ label: `Открыть «${trial.name}»`, action: () => editor.openTrial(trial) })}>Открыть</button>
          <button className={styles.control} type="button" aria-label={`Закрепить «${trial.name}» как A`} onClick={() => editor.pin(trial)}>A</button>
        </div>)}</div>
        {(v1Library || v1Workspace || legacy || legacyNotice) && <section className={styles.legacyImport} aria-label="Данные v1 · только чтение">
          <h3>Данные v1 · только чтение</h3>
          {v1Library?.trials.map(trial => <div className={styles.libraryRow} key={`v1-${trial.id}`}>
            <div><strong>{trial.name}</strong><small>{recipeLabel(trial.recipe)} · v1 · ревизия {trial.revision}</small></div>
            <button className={styles.control} type="button" aria-label={`Копировать v1 «${trial.name}»`}
              onClick={() => request({ label: `Копировать v1 «${trial.name}»`, action: () => editor.openRecipe(trial.recipe, "v1-import") })}>Копировать в v2</button>
          </div>)}
          {v1Workspace?.slots.map((oldSlot, index) => <div className={styles.libraryRow} key={`v1-slot-${index}`}>
            <div><strong>Черновик v1 · слот {index + 1}</strong><small>{recipeLabel(oldSlot.present.recipe)}</small></div>
            <button className={styles.control} type="button" onClick={() => request({ label: `Копировать черновик v1 · слот ${index + 1}`,
              action: () => editor.openRecipe(oldSlot.present.recipe, "v1-import") })}>Копировать в v2</button>
          </div>)}
          {legacy && <button className={styles.control} type="button" onClick={() => request({ label: "Восстановить старую SVG / CSS-пробу", action: () => editor.openRecipe(legacy, "legacy-import") })}>Копировать atmosphere-v1</button>}
          {legacyNotice && <p role="alert">{legacyNotice}</p>}
        </section>}
        <p className={styles.note}>Старые записи читаются явно и копируются как новая несохранённая проба. Ключи v1 и оформление MONO не меняются.</p>
        {notice && <p role="alert">{notice}</p>}
      </div>}
      {dialog === "export" && <div><p>Конфигурация B · {title}. Без истории симуляции.</p><textarea aria-label="Экспорт пробы" rows={14} readOnly value={JSON.stringify(config, null, 2)} /><p className={styles.note}>Выделите и скопируйте JSON. Он откроется как новая несохранённая копия.</p></div>}
      {dialog === "copy" && copyPreview && <div>
        <p>Материал {recipeLabel(copyPreview)} · полная проверенная копия.</p>
        {dirty && <p className={styles.note}>Черновик фона изменён. При переходе можно сохранить его, отбросить или вернуться.</p>}
        <RecipeSummary recipe={copyPreview} bindings={bindings} />
        <button className={`${styles.control} ${styles.primary}`} data-initial-focus type="button"
          onClick={() => request({ label: "Открыть копию кнопки", action: () => editor.openRecipe(copyPreview, "button-import") })}>Взять в черновик</button>
      </div>}
      {dialog === "import" && <div>
        <p className={styles.note}>До 64 KiB. Сначала проверка полной конфигурации, затем открытие новой копии.</p>
        <textarea aria-label="Импорт пробы" rows={9} value={importText} maxLength={65537} onChange={event => { setImportText(event.target.value); setImportPreview(null); setNotice(""); }} />
        <button className={styles.control} type="button" onClick={() => { try { setImportPreview(parseRecipeImport(importText, parse)); setNotice(""); } catch (error) { setImportPreview(null); setNotice((error as Error).message); } }}>Проверить JSON</button>
        {notice && <p role="alert">{notice}</p>}
        {importPreview && <div className={styles.importPreview} role="region" aria-label="Предпросмотр импорта"><p>{recipeLabel(importPreview)} · полная конфигурация · новая копия</p>
          <RecipeSummary recipe={importPreview} bindings={bindings} />
          <button className={`${styles.control} ${styles.primary}`} type="button" onClick={() => request({ label: "Открыть импорт", action: () => editor.openRecipe(importPreview, "import") })}>Открыть копию</button></div>}
      </div>}
      {dialog === "source" && <div>
        <p>{shownDescriptor?.description ?? "Оригинальные SVG / CSS-композиции прежней лаборатории: конечный отклик света и плоскостей. Это не Silk и не Fluid solver."}</p>
        {shownDescriptor && <><p><a href={shownDescriptor.provenance.sourceUrl} target="_blank" rel="noreferrer">Первоисточник ↗</a></p><p>{shownDescriptor.provenance.license}</p><code>{shownDescriptor.provenance.revision}</code><ul>{shownDescriptor.provenance.changes.map(change => <li key={change}>{change}</li>)}</ul></>}
        {runtime?.diagnostics && <dl className={styles.diagnostics}><dt>Качество</dt><dd>{runtime.diagnostics.quality}</dd><dt>Проходов / кадр</dt><dd>{runtime.diagnostics.passesPerFrame}</dd><dt>GPU targets</dt><dd>{runtime.diagnostics.targetCount}</dd><dt>Память targets</dt><dd>{Math.round(runtime.diagnostics.allocatedBytes / 1024)} KiB</dd></dl>}
        <p className={styles.note}>Сохранение содержит параметры, seed и разрешённые asset IDs. Оно не фиксирует кадр, поле жидкости или движения указателя.</p>
      </div>}
    </SandboxDialog>}
  </div>;
}
