"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { MATERIAL_BORDER_BOUNDS, MATERIAL_RADIUS_BOUNDS,
  type ButtonMaterialLayer, type ButtonTargetId, type ButtonWorkshopBindings,
  type MaterialQualityProfile, type MaterialRecipeV2, type MaterialTargetBinding } from "@wallet/ui";
import { SandboxDialog } from "./background-sandbox/dialog";
import { MaterialControls } from "./material-controls";
import { createButtonBinding, replaceBindingRecipe, parseButtonBinding,
  buttonDocumentBindings, BUTTON_TARGETS } from "./button-workshop/binding";
import { boundedButtonJson, parseButtonImport } from "./button-workshop/codec";
import { createButtonDocument, editButtonBinding, isButtonSlotDirty } from "./button-workshop/model";
import { createButtonSession } from "./button-workshop/session";
import { ACCEPTED_KEY, LIBRARY_KEY, WORKSPACE_KEY } from "./button-workshop/storage";
import { BACKGROUND_TO_BUTTONS_KEY, BUTTONS_TO_BACKGROUND_KEY,
  createButtonsToBackgroundTransfer, parseBackgroundToButtonsTransfer } from "./button-workshop/transfer";
import styles from "./mono-buttons-lab.module.css";

const ACTION_LABEL: Readonly<Record<ButtonTargetId, string>> = {
  "quick.send": "Отправить", "quick.receive": "Получить", "quick.swap": "Обменять", "quick.buy": "Купить",
};
const LAYER_LABEL: Readonly<Record<ButtonMaterialLayer, string>> = { fill: "Поверхность", icon: "Иконка", border: "Кромка" };
const EDITOR_LAYERS: readonly ButtonMaterialLayer[] = ["border", "fill", "icon"];
const WIDTHS = [320, 390, 430, 480] as const;
type Dialog = "library" | "name" | "guard" | "more" | "import" | "export" | "material-import" | "material-export" | null;
type Transition = { label: string; action(): void };
const TITLES: Record<Exclude<Dialog, null>, string> = {
  library: "Библиотека кнопок", name: "Сохранить пробу", guard: "Несохранённая проба", more: "Дополнительно",
  import: "Импорт конфигурации кнопок", export: "Экспорт конфигурации кнопок",
  "material-import": "Получить материал", "material-export": "Передать материал",
};

function valueOrThrow<T>(result: { ok: true; value: T } | { ok: false; issues: readonly { message: string }[] }): T {
  if (!result.ok) throw new Error(result.issues.map(issue => issue.message).join(" ") || "Материал недоступен.");
  return result.value;
}
function capability(layer: ButtonMaterialLayer) { return `button-${layer}` as const; }
function startingButtonDraft(catalog: ButtonWorkshopBindings["materialCatalog"]) {
  let draft = createButtonDocument<ButtonTargetId, MaterialTargetBinding>(BUTTON_TARGETS);
  for (const [effectId, layer] of [["pulsing-border", "border"]] as const) {
    const material = catalog.materials.find(item => item.id === effectId && item.capabilities.includes(capability(layer)));
    const recipe = material?.presets[0]?.recipe;
    if (!recipe) continue;
    try { draft = editButtonBinding(draft, BUTTON_TARGETS, "all", layer,
      target => createButtonBinding(target, layer, recipe, catalog)); } catch { /* Missing adapter leaves the baseline action usable. */ }
  }
  return draft;
}

/** The scene is supplied by ORACLE. This component owns only the separate button editor. */
export function MonoButtonsLab({ bindings }: { bindings: ButtonWorkshopBindings }) {
  const catalog = bindings.materialCatalog;
  const [editor] = useState(() => createButtonSession<ButtonTargetId, MaterialTargetBinding>(BUTTON_TARGETS,
    (input, layer, target) => parseButtonBinding(input, layer, target, catalog), startingButtonDraft(catalog)));
  const state = useSyncExternalStore(editor.subscribe, editor.getSnapshot, editor.getServerSnapshot);
  const slot = state.workspace.slots[state.workspace.activeSlot]!;
  const document = slot.present.document;
  const selection = state.workspace.selection;
  const selectedTargets = selection.target === "all" ? BUTTON_TARGETS : [selection.target];
  const selected = selectedTargets.map(target => document.actions[target][selection.layer]);
  const first = selected[0];
  const sharedEffect = first && selected.every(item => item?.recipe.effectId === first.recipe.effectId)
    ? first.recipe.effectId : "";
  const descriptor = catalog.materials.find(item => item.id === sharedEffect);
  const available = catalog.materials.filter(item => item.capabilities.includes(capability(selection.layer)));
  const dirty = isButtonSlotDirty(slot);
  const title = slot.present.source?.name ?? "Новая проба кнопок";
  const saveStatus = state.saveError || state.recoveryError ? "Ошибка записи" : state.saving ? "Сохранение…" :
    slot.present.source && !dirty && !state.externalChange ? "Сохранено" : dirty ? "Изменено" : "Не сохранено";
  const [width, setWidth] = useState<(typeof WIDTHS)[number]>(390);
  const [quality, setQuality] = useState<MaterialQualityProfile>("balanced");
  const [paused, setPaused] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [pending, setPending] = useState<Transition | null>(null);
  const [name, setName] = useState("");
  const [asNew, setAsNew] = useState(false);
  const [importText, setImportText] = useState("");
  const [importPreview, setImportPreview] = useState<ReturnType<typeof editor.shownDocument> | null>(null);
  const [materialPreview, setMaterialPreview] = useState<MaterialRecipeV2 | null>(null);
  const [materialPreviewLayer, setMaterialPreviewLayer] = useState<ButtonMaterialLayer>("fill");
  const [notice, setNotice] = useState("");
  const [runtimeStatus, setRuntimeStatus] = useState("");
  const onRuntimeStatus = useCallback((status: { message: string }) => setRuntimeStatus(status.message), []);

  useEffect(() => {
    const port = { getItem: (key: string) => window.localStorage.getItem(key),
      setItem: (key: string, value: string) => window.localStorage.setItem(key, value) };
    editor.connect(port, navigator.locks?.request ? task => navigator.locks.request("wallet4i7.button-sandbox.v1", task) : undefined);
    function changed(event: StorageEvent) {
      if (event.key === null || event.key === LIBRARY_KEY || event.key === WORKSPACE_KEY || event.key === ACCEPTED_KEY) editor.notifyExternalChange();
    }
    function leaving(event: BeforeUnloadEvent) {
      if (editor.getSnapshot().workspace.slots.some(isButtonSlotDirty)) { event.preventDefault(); event.returnValue = ""; }
    }
    window.addEventListener("storage", changed); window.addEventListener("beforeunload", leaving);
    return () => { window.removeEventListener("storage", changed); window.removeEventListener("beforeunload", leaving); };
  }, [editor]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      let raw: string | null = null;
      try { raw = window.sessionStorage.getItem(BACKGROUND_TO_BUTTONS_KEY); }
      catch { return; }
      if (raw === null) return;
      try {
        const recipe = parseBackgroundToButtonsTransfer(raw, catalog);
        setMaterialPreview(recipe);
        setMaterialPreviewLayer("fill");
        setDialog("material-import");
        setNotice("");
      } catch (error) { setNotice((error as Error).message); }
      finally { try { window.sessionStorage.removeItem(BACKGROUND_TO_BUTTONS_KEY); } catch { /* The preview stays local. */ } }
    });
    return () => { active = false; };
  }, [catalog]);

  useEffect(() => {
    function keyboard(event: KeyboardEvent) {
      if (dialog || event.isComposing || event.defaultPrevented || globalThis.document.querySelector('[role="dialog"], dialog[open]') ||
          (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable="true"]'))) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") { event.preventDefault(); editor.undo(event.shiftKey); }
      else if (!event.ctrlKey && !event.metaKey && !event.altKey && ["1", "2", "3"].includes(event.key)) {
        event.preventDefault(); editor.selectSlot(Number(event.key) - 1);
      }
    }
    window.addEventListener("keydown", keyboard);
    return () => window.removeEventListener("keydown", keyboard);
  }, [dialog, editor]);

  function close() { setDialog(null); setPending(null); setNotice(""); setImportPreview(null); setMaterialPreview(null); }
  function request(transition: Transition) {
    editor.endGesture();
    if (dirty) { setPending(transition); setDialog("guard"); }
    else { transition.action(); close(); }
  }
  function startSave(newCopy: boolean, transition: Transition | null = null) {
    setAsNew(newCopy); setName(newCopy ? "" : slot.present.source?.name ?? ""); setPending(transition); setDialog("name"); setNotice("");
  }
  async function save(transition: Transition | null = null) {
    if (!slot.present.source) { startSave(true, transition); return; }
    if (await editor.save()) { transition?.action(); close(); }
  }
  function changeMaterial(recipe: MaterialRecipeV2 | null, layer: ButtonMaterialLayer = selection.layer): boolean {
    try {
      if (recipe === null) { editor.edit(selection.target, layer, null); setNotice(""); return true; }
      editor.edit(selection.target, layer, target => {
        const currentState = editor.getSnapshot();
        const current = currentState.workspace.slots[currentState.workspace.activeSlot]!.present.document.actions[target][layer];
        return current ? replaceBindingRecipe(current, recipe, catalog) : createButtonBinding(target, layer, recipe, catalog);
      });
      setNotice("");
      return true;
    } catch (error) { setNotice((error as Error).message); return false; }
  }
  function changeBinding(mutator: (binding: MaterialTargetBinding) => MaterialTargetBinding) {
    try {
      editor.edit(selection.target, selection.layer, target => {
        const currentState = editor.getSnapshot();
        const current = currentState.workspace.slots[currentState.workspace.activeSlot]!.present.document.actions[target][selection.layer];
        return current ? parseButtonBinding(mutator(current), selection.layer, target, catalog) : null;
      });
      setNotice("");
    } catch (error) { setNotice((error as Error).message); }
  }
  function prepareImport(raw: string) {
    try {
      const parse = (input: unknown, layer: ButtonMaterialLayer, target: ButtonTargetId) => parseButtonBinding(input, layer, target, catalog);
      setImportPreview(parseButtonImport(raw, BUTTON_TARGETS, parse)); setNotice("");
    } catch (error) { setImportPreview(null); setNotice((error as Error).message); }
  }
  function prepareMaterial(raw: string) {
    try {
      const value = boundedButtonJson(raw, 64 * 1024);
      setMaterialPreview(valueOrThrow(catalog.copyForTarget(value, capability(selection.layer))));
      setMaterialPreviewLayer(selection.layer); setNotice("");
    } catch (error) { setMaterialPreview(null); setNotice((error as Error).message); }
  }

  const shown = editor.shownDocument();
  const stageBindings = useMemo(() => buttonDocumentBindings(shown, catalog), [shown, catalog]);
  const stage = bindings.renderStage({ bindings: stageBindings, width, quality, paused, restartKey: state.restartKey,
    onStatus: onRuntimeStatus });
  const disabled = state.saving || !state.ready || state.recoveryUnavailable || state.comparing;

  return <div className={styles.lab} data-button-workshop>
    <div inert={dialog !== null} aria-hidden={dialog !== null || undefined}>
      <header className={styles.header}><a href="/design-lab">← Design Lab</a><span>BUTTON MATERIAL WORKSHOP</span><a href="/mono">MONO ↗</a></header>
      <div className={styles.toolbar}>
        <button className={styles.control} type="button" onClick={() => { editor.refreshLibrary(); setDialog("library"); }}>Открыть</button>
        <div className={styles.title}><h1>{title}</h1><span role="status" data-save-status={saveStatus}>{saveStatus}</span></div>
        <div className={styles.tools}>
          <button className={styles.control} type="button" aria-label="Отменить" disabled={disabled || !slot.past.length} onClick={() => editor.undo()}>↶</button>
          <button className={styles.control} type="button" aria-label="Повторить" disabled={disabled || !slot.future.length} onClick={() => editor.undo(true)}>↷</button>
          <button className={styles.control} type="button" onClick={() => setPaused(value => !value)}>{paused ? "Продолжить" : "Пауза"}</button>
          <button className={styles.control} type="button" onClick={() => editor.restart()}>Перезапустить</button>
          <div className={styles.compare} role="group" aria-label="Сравнение A/B">
            <button className={styles.control} type="button" aria-pressed={state.comparing} disabled={!state.workspace.pinned} onClick={() => editor.compare(true)}>A</button>
            <button className={styles.control} type="button" aria-pressed={!state.comparing} onClick={() => editor.compare(false)}>B</button>
          </div>
          <button className={`${styles.control} ${styles.primary}`} type="button" disabled={disabled} onClick={() => { void save(); }}>Сохранить</button>
          <button className={styles.control} type="button" onClick={() => setDialog("more")}>Ещё</button>
        </div>
      </div>
      <div className={styles.workspace}>
        <div className={styles.previewColumn}>
          <div className={styles.stageHead}>
            <span>{state.comparing ? `A · ${state.workspace.pinned?.name}` : "B · реальные действия MONO"}</span>
            <label>Качество<select aria-label="Качество" value={quality} onChange={event => setQuality(event.currentTarget.value as MaterialQualityProfile)}>
              <option value="economy">Экономное</option><option value="balanced">Сбалансированное</option><option value="detail">Детальное</option>
            </select></label>
          </div>
          <div className={styles.widths} role="group" aria-label="Ширина примерки">{WIDTHS.map(value =>
            <button className={styles.control} key={value} type="button" aria-pressed={width === value} onClick={() => setWidth(value)}>{value}</button>)}</div>
          <section className={styles.stage} aria-label="Реальные кнопки MONO" style={{ width: `min(100%, ${width}px)` }}>
            {!state.ready ? <p>Подготовка мастерской…</p> : state.recoveryUnavailable ? <div className={styles.unavailable}>
              <p>Черновики не прочитаны. Исходные данные в хранилище сохранены.</p><p>{state.recoveryError}</p>
              <button className={styles.control} type="button" onClick={editor.startFresh}>Начать новую пробу</button>
            </div> : stage}
          </section>
          <p className={styles.stageFoot}>{runtimeStatus || "Техническая примерка. Текст и действия остаются DOM."}</p>
          <div className={styles.applyBar}>
            <span>Принятая проба хранится только для этой dev-мастерской.</span>
            <button className={styles.control} type="button" disabled={disabled || state.acceptedUnavailable} onClick={() => { void editor.apply().then(ok => { if (ok) setNotice("Применено в локальной примерке."); }); }}>Применить</button>
            <button className={styles.control} type="button" disabled={disabled} onClick={() => { editor.cancel(); setNotice("Возвращена принятая проба."); }}>Отменить пробу</button>
          </div>
          <p className={styles.note}>Материалы не меняют опубликованные настройки MONO. <a href="/design-lab" target="_blank" rel="noopener noreferrer">Motion Lab ↗</a> настраивает прежний отклик на нажатие.</p>
        </div>
        <aside className={styles.inspector} aria-label="Инспектор кнопок">
          <div className={styles.inspectorHeading}><h2>{LAYER_LABEL[selection.layer]} · {selection.target === "all" ? "Все четыре" : ACTION_LABEL[selection.target]}</h2><span>Слот {state.workspace.activeSlot + 1}</span></div>
          <div className={styles.slots} role="group" aria-label="Независимые слоты">{[0, 1, 2].map(index =>
            <button className={styles.control} type="button" key={index} aria-label={`Слот ${index + 1}`}
              aria-pressed={state.workspace.activeSlot === index} disabled={state.saving} onClick={() => editor.selectSlot(index)}>{index + 1}{isButtonSlotDirty(state.workspace.slots[index]!) ? " ·" : ""}</button>)}</div>
          <div className={styles.targets} role="group" aria-label="Редактируемые кнопки">
            <button className={styles.control} type="button" aria-pressed={selection.target === "all"} onClick={() => editor.selectTarget("all")}>Все четыре</button>
            {BUTTON_TARGETS.map(target => <button className={styles.control} key={target} type="button"
              aria-pressed={selection.target === target} onClick={() => editor.selectTarget(target)}>{ACTION_LABEL[target]}</button>)}
          </div>
          <div className={styles.layers} role="tablist" aria-label="Слой кнопки">{EDITOR_LAYERS.map(layer =>
            <button className={styles.control} type="button" role="tab" key={layer} aria-selected={selection.layer === layer}
              onClick={() => editor.selectLayer(layer)}>{LAYER_LABEL[layer]}</button>)}</div>
          <p className={styles.layerCue}>{selection.layer === "border" ? "Кромка и боковая грань. Свет идёт по краю; знак и подпись остаются читаемыми." :
            selection.layer === "fill" ? "Поверхность всей кнопки. Яркий материал может уменьшить контраст знака — сравните с кромкой." :
              "Материал только внутри контура знака. Поверхность и кромка сохраняют свои настройки."}</p>
          <label className={styles.field}>Материал<select aria-label="Материал" value={sharedEffect} disabled={disabled}
            onChange={event => {
              const chosen = available.find(item => item.id === event.currentTarget.value);
              changeMaterial(chosen?.presets[0]?.recipe ?? null);
            }}>
            <option value="">Без материала / разные материалы</option>
            {available.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select></label>
          {selection.target === "all" && <p className={styles.note}>Правка «Все четыре» выполняется одним шагом Undo. Настройки остальных слоёв сохраняются.</p>}
          {descriptor && <><p className={styles.description}>{descriptor.description}</p>
            {descriptor.presets.length > 1 && <label className={styles.field}>Начальная проба<select aria-label="Начальная проба" value="" disabled={disabled}
              onChange={event => { const preset = descriptor.presets.find(item => item.id === event.currentTarget.value); if (preset) changeMaterial(preset.recipe); }}>
              <option value="" disabled>Выберите пробу…</option>{descriptor.presets.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select></label>}
            {first && <MaterialControls key={`${selection.target}:${selection.layer}:${descriptor.id}:${descriptor.effectVersion}`} descriptor={descriptor}
              recipe={first.recipe} capability={capability(selection.layer)} disabled={disabled} onChange={changeMaterial}
              onGestureStart={editor.beginGesture} onGestureCommit={editor.endGesture} onError={setNotice} />}
            {first && <div className={styles.geometry}>
              {selection.layer !== "icon" && <label className={styles.field}>Скругление {selection.layer === "border" ? "кромки" : "поверхности"} <output>{first.radiusCss} px</output>
                <input type="range" min={MATERIAL_RADIUS_BOUNDS.min} max={MATERIAL_RADIUS_BOUNDS.max} step="0.5" value={first.radiusCss} disabled={disabled}
                  onPointerDown={editor.beginGesture} onPointerUp={editor.endGesture} onKeyDown={editor.beginGesture} onKeyUp={editor.endGesture}
                  onChange={event => changeBinding(binding => ({ ...binding, radiusCss: Number(event.currentTarget.value) }))} /></label>}
              {selection.layer === "border" && <label className={styles.field}>Толщина рамки <output>{first.borderWidthCss} px</output>
                <input type="range" min={MATERIAL_BORDER_BOUNDS.min} max={MATERIAL_BORDER_BOUNDS.max} step="0.25" value={first.borderWidthCss} disabled={disabled}
                  onPointerDown={editor.beginGesture} onPointerUp={editor.endGesture} onKeyDown={editor.beginGesture} onKeyUp={editor.endGesture}
                  onChange={event => changeBinding(binding => ({ ...binding, borderWidthCss: Number(event.currentTarget.value) }))} /></label>}
              <label className={styles.toggle}><input type="checkbox" checked={first.enabled} disabled={disabled}
                onChange={event => changeBinding(binding => ({ ...binding, enabled: event.currentTarget.checked }))} />Материал включён</label>
              <p className={styles.note}>Выключение скрывает эффект, сохраняя все параметры. Сброс меняет только этот слой и отменяется через Undo.</p>
              <button className={styles.control} type="button" disabled={disabled || !descriptor.presets[0]} onClick={() => {
                if (descriptor.presets[0]) changeMaterial(descriptor.presets[0].recipe);
              }}>Сбросить материал слоя</button>
              <button className={styles.quietControl} type="button" disabled={disabled} onClick={() => changeMaterial(null)}>Очистить слой · можно отменить</button>
            </div>}
          </>}
          {!descriptor && <p className={styles.note}>Выберите материал для выбранного слоя. Контуры, иконки и поверхность меняются независимо.</p>}
        </aside>
      </div>
      <footer className={styles.footer}>
        <p>{state.recovered ? "Черновики восстановлены отдельно от принятой пробы и библиотеки." : "Три слота сохраняют свои черновики отдельно от именованных проб."}</p>
        {!state.writeAvailable && state.ready && <p role="alert">Без Web Locks запись недоступна; можно экспортировать JSON.</p>}
        {(state.saveError || state.libraryError || state.recoveryError || state.acceptedError || state.externalChange || notice) &&
          <p role={state.saveError || state.libraryError || state.recoveryError || state.acceptedError ? "alert" : "status"}>
            {state.saveError || state.libraryError || state.recoveryError || state.acceptedError || notice || "Хранилище изменено в другой вкладке. Обновите библиотеку перед сохранением."}
          </p>}
      </footer>
    </div>
    {dialog && <SandboxDialog key={dialog} title={TITLES[dialog]} close={close} busy={state.saving}>
      {dialog === "library" && <div className={styles.dialogBody}>
        <p>Именованные пробы: {state.library.trials.length} / 32. Каждая содержит все четыре кнопки и три слоя.</p>
        <button className={styles.control} type="button" onClick={editor.refreshLibrary}>Обновить библиотеку</button>
        {state.libraryError && <p role="alert">{state.libraryError}</p>}
        {state.library.trials.map(trial => <div className={styles.trial} key={trial.id}><div><strong>{trial.name}</strong><small>Ревизия {trial.revision}</small></div>
          <button className={styles.control} type="button" onClick={() => request({ label: `Открыть «${trial.name}»`, action: () => editor.openTrial(trial) })}>Открыть</button>
          <button className={styles.control} type="button" aria-label={`Закрепить «${trial.name}» как A`} onClick={() => editor.pin(trial)}>A</button>
        </div>)}
      </div>}
      {dialog === "name" && <form className={styles.dialogBody} onSubmit={event => { event.preventDefault(); void editor.save(name, asNew).then(ok => { if (ok) { pending?.action(); close(); } }); }}>
        <label className={styles.field}>Имя пробы<input data-initial-focus value={name} maxLength={64} required onChange={event => setName(event.currentTarget.value)} /></label>
        <p>Сохраняется полная конфигурация кнопок. Apply выполняется отдельно.</p>
        <button className={`${styles.control} ${styles.primary}`} type="submit" disabled={state.saving}>Сохранить пробу</button>
        {state.saveError && <p role="alert">{state.saveError}</p>}
      </form>}
      {dialog === "guard" && <div className={styles.dialogBody}><p>В «{title}» есть изменения. {pending?.label}?</p>
        <button className={`${styles.control} ${styles.primary}`} type="button" onClick={() => { void save(pending); }}>Сохранить и перейти</button>
        <button className={styles.control} type="button" onClick={() => { editor.cancel(); pending?.action(); close(); }}>Отбросить и перейти</button>
        <button className={styles.control} type="button" data-initial-focus onClick={close}>Вернуться</button>
      </div>}
      {dialog === "more" && <div className={styles.dialogBody}>
        <button className={styles.control} type="button" onClick={() => startSave(true)}>Сохранить как…</button>
        <button className={styles.control} type="button" onClick={() => { setImportText(""); setDialog("import"); }}>Импорт конфигурации JSON</button>
        <button className={styles.control} type="button" onClick={() => setDialog("export")}>Экспорт конфигурации JSON</button>
        <button className={styles.control} type="button" onClick={() => { setImportText(""); setDialog("material-import"); }}>Получить материал из мастерской фонов</button>
        <button className={styles.control} type="button" disabled={!first || selection.target === "all"} onClick={() => setDialog("material-export")}>Передать выбранный материал</button>
      </div>}
      {dialog === "export" && <div className={styles.dialogBody}><p>Полный снимок B. Никаких GPU-полей и финансовых данных.</p>
        <textarea aria-label="Экспорт конфигурации кнопок" readOnly rows={12} value={JSON.stringify(document, null, 2)} /></div>}
      {dialog === "import" && <div className={styles.dialogBody}><p>До 64 KiB. Проверка перед открытием черновика; Apply и Save отдельно.</p>
        <textarea aria-label="Импорт конфигурации кнопок" rows={8} maxLength={65537} value={importText}
          onChange={event => { setImportText(event.currentTarget.value); setImportPreview(null); }} />
        <button className={styles.control} type="button" onClick={() => prepareImport(importText)}>Проверить JSON</button>
        {importPreview && <div><p>Проверен полный снимок четырёх кнопок.</p><button className={styles.control} type="button"
          onClick={() => request({ label: "Открыть импорт", action: () => editor.openDocument(importPreview) })}>Открыть копию в черновике</button></div>}
        {notice && <p role="alert">{notice}</p>}
      </div>}
      {dialog === "material-export" && <div className={styles.dialogBody}><p>Полный снимок материала выбранного слоя. Копия не связана с этой пробой.</p>
        <textarea aria-label="Экспорт материала" readOnly rows={10} value={first ? JSON.stringify(first.recipe, null, 2) : ""} />
        <a href="/design-lab/atmosphere" onClick={event => {
          try {
            if (!first) throw new Error("Сначала выберите материал одной кнопки.");
            const raw = createButtonsToBackgroundTransfer(first.recipe, catalog);
            window.sessionStorage.setItem(BUTTONS_TO_BACKGROUND_KEY, raw);
            if (window.sessionStorage.getItem(BUTTONS_TO_BACKGROUND_KEY) !== raw) throw new Error("Не удалось передать материал.");
          } catch (error) { event.preventDefault(); setNotice((error as Error).message); }
        }}>Открыть мастерскую фонов с копией ↗</a>
        {notice && <p role="alert">{notice}</p>}
      </div>}
      {dialog === "material-import" && <div className={styles.dialogBody}><p>Проверьте полный recipe из мастерской фонов. Изменится {LAYER_LABEL[materialPreviewLayer].toLowerCase()} · {selection.target === "all" ? "все четыре" : ACTION_LABEL[selection.target]}; текущую правку можно вернуть через Undo. Apply и Save остаются отдельными.</p>
        <textarea aria-label="Импорт материала" rows={8} maxLength={65537} value={importText}
          onChange={event => { setImportText(event.currentTarget.value); setMaterialPreview(null); }} />
        <button className={styles.control} type="button" onClick={() => prepareMaterial(importText)}>Проверить материал</button>
        {materialPreview && <div><p>{catalog.materials.find(item => item.id === materialPreview.effectId)?.label ?? materialPreview.effectId} · совместим с выбранным слоем.</p>
          <button className={styles.control} type="button" onClick={() => {
            if (changeMaterial(materialPreview, materialPreviewLayer)) { editor.selectLayer(materialPreviewLayer); close(); }
          }}>Взять в черновик</button></div>}
        {notice && <p role="alert">{notice}</p>}
      </div>}
    </SandboxDialog>}
  </div>;
}
