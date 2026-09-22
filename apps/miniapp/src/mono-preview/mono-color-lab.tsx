"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  MONO_PALETTE_GROUPS, MONO_PALETTE_HARMONIES, MONO_PALETTE_QUICK_HARMONIES, MONO_PALETTE_RECIPE_BOUNDS, MONO_PALETTE_ROLE_SCHEMA,
  resolveMonoPalette, srgbToOklch, validateMonoPaletteApply,
  type MonoPaletteGroup, type MonoPaletteRole, type MonoPaletteRecipe, type MonoPaletteScope,
} from "@wallet/ui";
import {
  beginMonoPaletteTransaction, createMonoPaletteWorkspace, editMonoPaletteRecipe, editMonoPaletteRole,
  enableMonoPalette, endMonoPaletteTransaction, getMonoPaletteQuickZoneLockState, MONO_PALETTE_QUICK_ZONES,
  previewMonoThemesLink, randomizeMonoPaletteRecipeWorkspace, randomizeMonoPaletteWorkspace,
  redoMonoPaletteWorkspace, replaceMonoPaletteConfig, resetMonoPaletteSlot, setMonoPaletteRoleMode,
  setMonoPaletteSeed, setMonoPaletteWorkspaceLock, setMonoThemesLinked, switchMonoPaletteSlot,
  switchMonoPaletteTheme, toggleMonoPaletteCompare, toggleMonoPaletteQuickZoneLock,
  undoMonoPaletteWorkspace, type MonoPaletteQuickZone, type MonoPaletteWorkspace,
} from "./mono-palette-workspace";
import { MonoColorField } from "./mono-color-field";
import { applyMonoPaletteActive, loadMonoPaletteActive, loadMonoPaletteLibrary,
  readMonoPaletteWorkspace, saveMonoPaletteLibrary, saveMonoPaletteWorkspace, type MonoPaletteLibraryEntry } from "./mono-palette-storage";
import { exportMonoPalettePreset, createMonoPaletteFragment, importMonoPalettePreset, previewMonoPaletteFragment,
  type MonoPaletteFragmentScope, type MonoPaletteMerge } from "./mono-preset-codec";
import { monoPaletteStyle } from "./mono-palette-tokens";
import { saveMonoPalettePrepaint } from "./mono-palette-prepaint";
import type { PresetView } from "../preset-library/preset-types";
import "./mono-color-lab.css";

type Edit = (workspace: MonoPaletteWorkspace) => MonoPaletteWorkspace;
type NumericRecipe = keyof typeof MONO_PALETTE_RECIPE_BOUNDS;
const labels: Record<NumericRecipe, string> = { anchorHue: "Тон", anchorChroma: "Интенсивность", temperature: "Температура",
  iridescence: "Цветовой перелив", exposure: "Экспозиция", contrast: "Контраст", surfaceResponse: "Материал" };
const harmonyLabels: Record<MonoPaletteRecipe["harmony"], string> = { "spectral-graphite": "Спектральный графит", mineral: "Минерал", "thermal-duet": "Тепловой дуэт", "analog-mist": "Соседние оттенки", "split-prism": "Разделённая призма" };
const groups: Record<MonoPaletteGroup, string> = { core: "Поверхности", content: "Содержание", structure: "Структура", decorative: "Акценты", system: "Системные" };
const quickHarmonyLabels = { "spectral-graphite": "Графит", mineral: "Один тон", "analog-mist": "Дымка", "thermal-duet": "Дуэт" } as const;
const quickZoneLabels: Record<MonoPaletteQuickZone, string> = { foundation: "Основа", accents: "Акценты", glass: "Стекло" };
const roleLabels: Record<MonoPaletteRole, string> = {
  canvas: "Фон приложения", surfaceBase: "Основная поверхность", surfaceRaised: "Приподнятая поверхность", surfaceOverlay: "Верхний слой",
  textPrimary: "Основной текст", textSecondary: "Вторичный текст", textMuted: "Приглушённый текст", textDisabled: "Недоступный текст",
  borderSubtle: "Тонкий контур", borderStrong: "Сильный контур", focus: "Контур фокуса", accentPrimary: "Основной акцент",
  accentSecondary: "Второй акцент", glassTint: "Тон стекла", edgeCool: "Холодная кромка", edgeWarm: "Тёплая кромка",
  atmosphereCool: "Холодный фон", atmosphereWarm: "Тёплый фон", chartLine: "Линия графика", selection: "Выделение",
  success: "Успех", warning: "Предупреждение", danger: "Ошибка", info: "Информация",
};
const cssColor = (color: { r: number; g: number; b: number }): string =>
  `rgb(${Math.round(color.r * 255)} ${Math.round(color.g * 255)} ${Math.round(color.b * 255)})`;

export function useMonoColorLab() {
  const [workspace, setWorkspace] = useState(createMonoPaletteWorkspace);
  const current = useRef(workspace);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState("");
  const [expert, setExpert] = useState(false);
  const [variantsOpen, setVariantsOpen] = useState(false);
  const [role, setRole] = useState<MonoPaletteRole>("accentPrimary");
  const [library, setLibrary] = useState<MonoPaletteLibraryEntry[]>([]);
  const [name, setName] = useState("");
  const [json, setJson] = useState("");
  const [pending, setPending] = useState<MonoPaletteMerge | null>(null);
  const [pendingOrigin, setPendingOrigin] = useState<{ source: { id: string; slug: string } | null; scope: MonoPaletteFragmentScope } | null>(null);
  const [remoteSources, setRemoteSources] = useState<Partial<Record<1 | 2 | 3, { id: string; slug: string }>>>({});
  const [linkDiff, setLinkDiff] = useState<ReturnType<typeof previewMonoThemesLink> | null>(null);
  const [busy, setBusy] = useState(false);
  const pendingRecipe = useRef<Partial<MonoPaletteRecipe>>({});
  const frame = useRef<number | null>(null);

  const commit = useCallback((edit: Edit) => {
    try {
      const next = edit(current.current);
      current.current = next;
      setWorkspace(next);
      setPending(null);
      setPendingOrigin(null);
      setStatus("");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Изменение отклонено"); }
  }, []);

  useEffect(() => {
    let alive = true;
    queueMicrotask(() => {
      if (!alive) return;
      try {
        let restored = readMonoPaletteWorkspace(localStorage);
        if (!restored) {
          const active = loadMonoPaletteActive(localStorage);
          restored = active ? enableMonoPalette(createMonoPaletteWorkspace(active.config), true) : createMonoPaletteWorkspace();
          const environment = JSON.parse(localStorage.getItem("wallet4i7.mono.environment-preview.v1") || "null");
          if (environment?.version === 1 && environment.theme === "light") restored = switchMonoPaletteTheme(restored, "light");
        }
        current.current = restored;
        setWorkspace(restored);
        void loadMonoPaletteLibrary(localStorage).then(entries => { if (alive) setLibrary(entries); });
      } catch { setStatus("Хранилище недоступно. Черновик работает в памяти."); }
      setReady(true);
    });
    return () => { alive = false; if (frame.current !== null) cancelAnimationFrame(frame.current); };
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      saveMonoPaletteWorkspace(localStorage, current.current);
      saveMonoPalettePrepaint(localStorage, current.current);
    }
    catch { queueMicrotask(() => setStatus("Не удалось сохранить рабочее место; черновик остаётся в памяти.")); }
  }, [workspace.slots, workspace.activeSlotId, ready]);

  const flush = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    const patch = pendingRecipe.current;
    pendingRecipe.current = {};
    if (Object.keys(patch).length) commit(state => editMonoPaletteRecipe(state, patch));
  }, [commit]);
  const begin = (key: string) => {
    if (!current.current.slots[current.current.activeSlotId - 1].transaction) commit(state => beginMonoPaletteTransaction(state, key));
  };
  const end = () => {
    flush();
    const transaction = current.current.slots[current.current.activeSlotId - 1].transaction;
    if (transaction) commit(state => endMonoPaletteTransaction(state, transaction.key));
  };
  const editRecipe = (patch: Partial<MonoPaletteRecipe>) => {
    if (!current.current.slots[current.current.activeSlotId - 1].transaction) { commit(state => editMonoPaletteRecipe(state, patch)); return; }
    pendingRecipe.current = { ...pendingRecipe.current, ...patch };
    if (frame.current === null) frame.current = requestAnimationFrame(flush);
  };
  const slot = workspace.slots[workspace.activeSlotId - 1];
  const present = slot.present;
  const shown = workspace.compare === "baseline" ? slot.baseline : present;
  const theme = present.config.themes[present.mode];
  const resolved = useMemo(() => resolveMonoPalette(theme), [theme]);
  const style = useMemo(() => shown.paletteEnabled ? monoPaletteStyle(shown.config.themes[shown.mode]) : {}, [shown]);
  const issues = useMemo(() => Object.values(present.config.themes).flatMap(branch => validateMonoPaletteApply(branch).issues), [present.config]);

  const randomize = (scope: MonoPaletteScope) => {
    end();
    const outcome = randomizeMonoPaletteWorkspace(current.current, scope);
    commit(() => outcome.workspace);
    setStatus(`Изменено: ${outcome.result.changed.length}; пропущено: ${outcome.result.skipped.length}. ${outcome.result.status === "error" ? "Ограничения не позволяют применить результат." : ""}`);
  };
  const newVariant = () => {
    end();
    const outcome = randomizeMonoPaletteRecipeWorkspace(current.current);
    if (outcome.result.status === "changed") {
      commit(() => outcome.workspace);
      setStatus(`Новый вариант готов. Закреплённые цвета сохранены${outcome.result.changed.length === 2 ? " в обеих темах" : ""}.`);
    } else setStatus(outcome.result.status === "noop"
      ? "Новый вариант не изменил видимые цвета. Проверьте замки и режимы цветов в «Точной настройке»."
      : "Не удалось подобрать читаемое сочетание с текущими ограничениями. Смягчите настройки цвета или замки.");
  };
  async function run(work: () => Promise<void>) {
    setBusy(true);
    try { await work(); } catch (error) { setStatus(error instanceof Error ? error.message : "Операция не выполнена"); }
    finally { setBusy(false); }
  }
  const save = (entry?: MonoPaletteLibraryEntry) => run(async () => {
    end();
    const title = name.trim() || entry?.name;
    if (!title) { setStatus("Укажите имя пресета."); return; }
    const preset = await importMonoPalettePreset(await exportMonoPalettePreset(current.current.slots[current.current.activeSlotId - 1].present.config));
    const nextEntry = { id: entry?.id ?? `local-${Math.max(0, ...library.map(item => Number(item.id.replace("local-", "")) || 0)) + 1}`,
      name: title.slice(0, 80), revision: (entry?.revision ?? 0) + 1, preset };
    const entries = entry ? library.map(item => item.id === entry.id ? nextEntry : item) : [...library, nextEntry];
    saveMonoPaletteLibrary(localStorage, entries); setLibrary(entries); setStatus(`Сохранено: ${nextEntry.name} · ${nextEntry.revision}`);
  });
  const remove = (entry: MonoPaletteLibraryEntry) => {
    try {
      const entries = library.filter(item => item.id !== entry.id);
      saveMonoPaletteLibrary(localStorage, entries); setLibrary(entries); setStatus(`Удалён локальный пресет: ${entry.name}`);
    } catch { setStatus("Не удалось удалить пресет из хранилища."); }
  };
  const previewFragment = (entry: MonoPaletteLibraryEntry, scope: MonoPaletteFragmentScope) => {
    try {
      setPending(previewMonoPaletteFragment(present.config, createMonoPaletteFragment(entry.preset, scope)));
      setPendingOrigin({ source: null, scope });
    }
    catch (error) { setStatus(String(error)); }
  };
  const previewRemotePreset = (entry: PresetView, scope: MonoPaletteFragmentScope) => run(async () => {
    const verified = await importMonoPalettePreset(JSON.stringify(entry.preset));
    setPending(previewMonoPaletteFragment(current.current.slots[current.current.activeSlotId - 1].present.config,
      createMonoPaletteFragment(verified, scope)));
    setPendingOrigin({ source: { id: entry.id, slug: entry.slug }, scope });
  });
  const acceptPending = () => {
    if (!pending || pending.issues.length || !pending.diff.length || current.current.compare === "baseline") return;
    const origin = pendingOrigin;
    const slotId = current.current.activeSlotId;
    commit(state => replaceMonoPaletteConfig(state, pending.config));
    if (origin?.source) {
      const source = origin.source;
      setRemoteSources(previous => ({ ...previous, [slotId]: source }));
    }
    else if (origin?.scope === "entire") setRemoteSources(previous => ({ ...previous, [slotId]: undefined }));
  };
  const output = () => run(async () => {
    const value = await exportMonoPalettePreset(present.config);
    try { await navigator.clipboard.writeText(value); setStatus("JSON скопирован."); }
    catch { setStatus("Не удалось скопировать JSON. Используйте «Скачать JSON»."); }
  });
  const download = () => run(async () => {
    const value = await exportMonoPalettePreset(present.config);
    const url = URL.createObjectURL(new Blob([value], { type: "application/json" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "mono-palette.json"; anchor.click(); URL.revokeObjectURL(url);
  });
  return { workspace, present, shown, theme, resolved, style, issues, ready, status, setStatus, expert, setExpert,
    variantsOpen, setVariantsOpen, role, setRole,
    library, name, setName, json, setJson, pending, setPending, linkDiff, setLinkDiff, busy, commit, begin, end, editRecipe,
    randomize, newVariant, save, remove, previewFragment, previewRemotePreset, activeRemoteSource: remoteSources[workspace.activeSlotId] ?? null,
    acceptPending, output, download,
    importPreview: () => run(async () => { const imported = await importMonoPalettePreset(json); setPending(previewMonoPaletteFragment(present.config, createMonoPaletteFragment(imported, "entire"))); setPendingOrigin({ source: null, scope: "entire" }); }),
    switchTheme: (mode: "dark" | "light") => { end(); commit(state => switchMonoPaletteTheme(state, mode)); },
    switchSlot: (id: 1 | 2 | 3) => { end(); commit(state => switchMonoPaletteSlot(state, id)); },
  };
}

export type MonoColorLabState = ReturnType<typeof useMonoColorLab>;

export function MonoColorLab({ lab }: { lab: MonoColorLabState }) {
  const { present, theme, workspace, commit } = lab;
  const [saveOpen, setSaveOpen] = useState(false);
  const [extrasOpen, setExtrasOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const slot = workspace.slots[workspace.activeSlotId - 1];
  const enabled = Boolean(present.paletteEnabled);
  const link = () => {
    if (present.config.linkedThemes) commit(state => setMonoThemesLinked(state, false));
    else {
      const diff = previewMonoThemesLink(workspace);
      if (diff.length) lab.setLinkDiff(diff);
      else commit(state => setMonoThemesLinked(state, true));
    }
  };
  return <section className="mono-color-lab" aria-label="Color Lab" data-mono-control
    onKeyDown={event => {
      if (event.nativeEvent.isComposing || (event.target as HTMLElement).closest("input,textarea,select,[contenteditable=true]")) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault(); lab.end(); commit(event.shiftKey ? redoMonoPaletteWorkspace : undoMonoPaletteWorkspace);
      }
    }}>
    <header><span>COLOR / LIVE</span><h2>Цветовая лаборатория</h2></header>
    <p>{enabled ? "Палитра · живой черновик" : "Исходный материал · без изменения цвета"}</p>
    <button type="button" disabled={!lab.ready} aria-pressed={enabled} onClick={() => commit(state => enableMonoPalette(state, !enabled))}>
      {enabled ? "Вернуть исходный материал" : "Включить палитру"}
    </button>
    <div className="mono-color-lab__row" role="group" aria-label="Тема палитры">
      <button type="button" aria-pressed={present.mode === "dark"} onClick={() => lab.switchTheme("dark")}>Dark</button>
      <button type="button" aria-pressed={present.mode === "light"} onClick={() => lab.switchTheme("light")}>Light</button>
    </div>
    <div className="mono-color-lab__quick">
      <div className="mono-color-lab__heading"><span>01 / ЦВЕТ</span><h3>Основной цвет</h3><p>Выберите оттенок. Остальные цвета соберутся вокруг него.</p></div>
      <fieldset disabled={!enabled || workspace.compare === "baseline"} className="mono-color-lab__quick-field">
        <legend className="mono-color-lab__sr-only">Основной цвет</legend>
        <MonoColorField hue={theme.recipe.anchorHue} chroma={theme.recipe.anchorChroma} maxChroma={0.2}
          disabled={!enabled || workspace.compare === "baseline"}
          onChange={value => lab.editRecipe({ anchorHue: value.hue, anchorChroma: value.chroma })}
          onGestureStart={() => lab.begin("color-field")}
          onGestureEnd={lab.end} />
      </fieldset>
      <div className="mono-color-lab__reset-row">
        <span>Сбросит весь черновик этого слота</span>
        <button type="button" onClick={() => commit(resetMonoPaletteSlot)}>Сбросить цвет</button>
      </div>
      <div className="mono-color-lab__heading"><span>02 / СОЧЕТАНИЕ</span><h3>Как звучит цвет</h3></div>
      <fieldset disabled={!enabled || workspace.compare === "baseline"} className="mono-color-lab__harmony-field">
        <legend className="mono-color-lab__sr-only">Сочетание</legend>
        <div className="mono-color-lab__harmonies" role="radiogroup" aria-label="Сочетание">
          {MONO_PALETTE_QUICK_HARMONIES.map(id => {
            const preview = resolveMonoPalette({ ...theme, recipe: { ...theme.recipe, harmony: id } });
            return <label key={id} className="mono-color-lab__harmony-card">
              <input type="radio" name="mono-quick-harmony" value={id} checked={theme.recipe.harmony === id}
                onChange={() => lab.editRecipe({ harmony: id })} />
              <span className="mono-color-lab__harmony-name">{quickHarmonyLabels[id]}</span>
              <span className="mono-color-lab__harmony-strip" aria-hidden="true">
                {(["surfaceBase", "accentPrimary", "edgeCool", "edgeWarm"] as const).map(role =>
                  <i key={role} style={{ background: cssColor(preview.srgb[role]) }} />)}
              </span>
            </label>;
          })}
        </div>
      </fieldset>
      <label className="mono-color-lab__quick-range">Цветовой перелив <output>{Math.round(theme.recipe.iridescence * 100)}%</output>
        <input type="range" aria-label="Цветовой перелив" min="0" max="1" step="0.01" value={theme.recipe.iridescence}
          disabled={!enabled || workspace.compare === "baseline"}
          onPointerDown={() => lab.begin("iridescence")} onPointerUp={lab.end} onPointerCancel={lab.end}
          onChange={event => lab.editRecipe({ iridescence: Number(event.currentTarget.value) })} />
      </label>
      <div className="mono-color-lab__heading"><span>03 / СОХРАНИТЬ</span><h3>Что не менять</h3></div>
      <div className="mono-color-lab__zones">
        {(Object.keys(MONO_PALETTE_QUICK_ZONES) as MonoPaletteQuickZone[]).map(zone => {
          const state = getMonoPaletteQuickZoneLockState(workspace, zone);
          const stateLabel = { unlocked: "Меняется", mixed: "Частично закреплено", locked: "Закреплено", inherited: "Закреплено в точной настройке" }[state];
          return <div key={zone} className="mono-color-lab__zone" data-lock-state={state}>
            <span className="mono-color-lab__zone-strip" aria-hidden="true">
              {MONO_PALETTE_QUICK_ZONES[zone].slice(0, 4).map(role => <i key={role} style={{ background: cssColor(lab.resolved.srgb[role]) }} />)}
            </span>
            <span className="mono-color-lab__zone-copy"><strong>{quickZoneLabels[zone]}</strong><small>{stateLabel}</small></span>
            <button type="button" aria-label={`Не менять ${quickZoneLabels[zone]}`} aria-pressed={state === "locked" || state === "inherited"}
              disabled={!enabled || workspace.compare === "baseline" || state === "inherited"}
              onClick={() => commit(current => toggleMonoPaletteQuickZoneLock(current, zone))}>
              {state === "locked" || state === "inherited" ? "◆" : "◇"}
            </button>
          </div>;
        })}
      </div>
      <button className="mono-color-lab__new-variant" type="button" disabled={!enabled || workspace.compare === "baseline"} onClick={lab.newVariant}>Новый вариант</button>
      <p className="mono-color-lab__hint">Закреплённые части останутся прежними.</p>
    </div>
    <div className="mono-color-lab__actions" aria-label="Управление палитрой">
      <div className="mono-color-lab__toolbar" role="group" aria-label="Инструменты палитры">
        <button type="button" aria-label="Отменить цвет" title="Отменить" disabled={!slot.past.length}
          onClick={() => { lab.end(); commit(undoMonoPaletteWorkspace); }}><span aria-hidden="true">↶</span></button>
        <button type="button" aria-label="Повторить цвет" title="Повторить" disabled={!slot.future.length}
          onClick={() => commit(redoMonoPaletteWorkspace)}><span aria-hidden="true">↷</span></button>
        <button type="button" className="mono-color-lab__compare" aria-label="Сравнить A/B"
          aria-pressed={workspace.compare === "baseline"} onClick={() => commit(toggleMonoPaletteCompare)}>
          {workspace.compare === "baseline" ? "A · Исходный" : "B · Черновик"}
        </button>
        <button type="button" aria-label="Дополнительные действия" title="Дополнительные действия"
          aria-controls="mono-palette-extras" aria-expanded={extrasOpen}
          onClick={() => setExtrasOpen(!extrasOpen)}><span aria-hidden="true">⋯</span></button>
      </div>
      <button type="button" className="mono-color-lab__secondary" disabled={!enabled || workspace.compare === "baseline"}
        onClick={() => lab.randomize({ kind: "global" })}>Другая палитра</button>
      <button type="button" className="mono-color-lab__apply"
        disabled={!enabled || lab.issues.length > 0 || workspace.compare === "baseline"} onClick={() => {
          try { applyMonoPaletteActive(localStorage, present.config); lab.setStatus("Палитра применена локально. Библиотека не изменена."); }
          catch (error) { lab.setStatus(String(error)); }
        }}>Применить палитру</button>
      {lab.issues.length > 0 && <div role="note" aria-label="Ограничения Apply">{lab.issues.map((issue, index) => <p key={index}>{issue.message}</p>)}</div>}
      {workspace.compare === "baseline" && <p role="note">Сейчас показан A · исходный материал. Вернитесь к B, чтобы сохранить или применить черновик.</p>}
      <div className="mono-color-lab__action-row">
        <button type="button" aria-controls="mono-palette-save" aria-expanded={saveOpen} onClick={() => setSaveOpen(!saveOpen)}>Сохранить вариант</button>
        <button type="button" aria-controls="mono-palette-local-variants mono-palette-server-variants"
          aria-expanded={lab.variantsOpen} onClick={() => lab.setVariantsOpen(!lab.variantsOpen)}>Варианты</button>
      </div>
      <fieldset id="mono-palette-save" hidden={!saveOpen} disabled={!enabled || lab.busy || workspace.compare === "baseline"}
        className="mono-color-lab__save-form">
        <legend>Сохранить локально</legend>
        <label>Имя пресета<input maxLength={80} value={lab.name} onChange={event => lab.setName(event.target.value)} /></label>
        <button type="button" onClick={() => void lab.save()}>Сохранить новый</button>
      </fieldset>
      <div id="mono-palette-extras" hidden={!extrasOpen} className="mono-color-lab__extras">
        <div className="mono-color-lab__row">
          <button type="button" onClick={() => void lab.output()}>Копировать JSON</button>
          <button type="button" onClick={() => void lab.download()}>Скачать JSON</button>
        </div>
        <button type="button" aria-controls="mono-palette-import" aria-expanded={importOpen}
          onClick={() => setImportOpen(!importOpen)}>Импорт JSON</button>
        <div id="mono-palette-import" hidden={!importOpen} className="mono-color-lab__import">
          <label>JSON пресета<textarea value={lab.json} maxLength={131072} onChange={event => lab.setJson(event.target.value)} /></label>
          <button type="button" onClick={() => void lab.importPreview()}>Предпросмотр импорта</button>
        </div>
      </div>
    </div>
    <button type="button" className="mono-color-lab__exact-toggle" aria-controls="mono-color-exact" aria-expanded={lab.expert}
      onClick={() => lab.setExpert(!lab.expert)}>Точная настройка <span aria-hidden="true">{lab.expert ? "−" : "+"}</span></button>
    <div id="mono-color-exact" hidden={!lab.expert} className="mono-color-lab__exact">
    <fieldset disabled={!enabled || workspace.compare === "baseline"}><legend>Рецепт и отдельные цвета</legend>
      <label>Гармония · точно<select value={theme.recipe.harmony} onChange={event => lab.editRecipe({ harmony: event.target.value as MonoPaletteRecipe["harmony"] })}>
        {MONO_PALETTE_HARMONIES.map(id => <option key={id} value={id}>{harmonyLabels[id]}</option>)}
      </select></label>
      {(Object.keys(MONO_PALETTE_RECIPE_BOUNDS) as NumericRecipe[]).map(id => {
        const bound = MONO_PALETTE_RECIPE_BOUNDS[id];
        return <label key={id}>{labels[id]}<output>{theme.recipe[id].toFixed(id === "anchorHue" ? 0 : 3)}</output>
          <input type="range" aria-label={`${labels[id]} · точно`} min={bound.min} max={bound.max} step={id === "anchorHue" ? 1 : 0.001} value={theme.recipe[id]}
            onPointerDown={() => lab.begin(id)} onPointerUp={lab.end} onPointerCancel={lab.end} onBlur={lab.end}
            onKeyDown={event => { if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"].includes(event.key)) lab.begin(id); }} onKeyUp={lab.end}
            onChange={event => lab.editRecipe({ [id]: Number(event.target.value) })} />
        </label>;
      })}
      <button type="button" aria-pressed={present.config.linkedThemes} onClick={link}>Один цветовой характер для обеих тем</button>
      {lab.linkDiff && <div className="mono-color-lab__diff" role="region" aria-label="Различия перед связыванием">
        <p>Характер второй темы изменится. Ручные роли сохранятся.</p>
        {lab.linkDiff.map(item => <p key={item.key}>{item.key}: {item.dark} → {item.light}</p>)}
        <button type="button" onClick={() => { commit(state => setMonoThemesLinked(state, true, { confirm: true })); lab.setLinkDiff(null); }}>Подтвердить связь</button>
        <button type="button" onClick={() => lab.setLinkDiff(null)}>Отмена связи</button>
      </div>}
      <label>Seed<input value={present.config.seed} maxLength={256} onChange={event => commit(state => setMonoPaletteSeed(state, event.target.value))} /></label>
    </fieldset>
    </div>
    <div id="mono-palette-local-variants" hidden={!lab.variantsOpen} className="mono-color-lab__local-variants"
      role="region" aria-label="Локальные варианты">
      <div className="mono-color-lab__library-head"><strong>На этом устройстве</strong><small>Локальные · только в этом браузере</small></div>
      {lab.library.length === 0 && <p>Сохранённых локальных вариантов пока нет.</p>}
      <fieldset disabled={!enabled || lab.busy || workspace.compare === "baseline"}>
        <legend className="mono-color-lab__sr-only">Сохранённые локальные варианты</legend>
      {lab.library.map(entry => <article key={entry.id} aria-label={entry.name}>
        <strong>{entry.name}</strong><small>Ревизия {entry.revision}</small>
        {(["dark", "light"] as const).map(mode => <div key={mode} className="mono-color-lab__strip" aria-label={`${mode} палитра`}>
          {MONO_PALETTE_GROUPS.decorative.slice(0, 5).map(role => { const color = entry.preset.resolved[mode].srgb[role]; return <i key={role} style={{ background: `rgb(${color.r*255} ${color.g*255} ${color.b*255})` }} />; })}
        </div>)}
        <button type="button" onClick={() => lab.previewFragment(entry, "entire")}>Загрузить</button>
        <div className="mono-color-lab__row"><button type="button" onClick={() => void lab.save(entry)}>Обновить</button><button type="button" onClick={() => lab.remove(entry)}>Удалить</button></div>
        <label>Скопировать модуль<select defaultValue="" onChange={event => { if (event.target.value) lab.previewFragment(entry, event.target.value as MonoPaletteFragmentScope); event.target.value = ""; }}>
          <option value="" disabled>Выбрать…</option>{["entire", "dark", "light", "palette", "background", "glass-color"].map(scope => <option key={scope} value={scope}>{scope}</option>)}
        </select></label>
      </article>)}
      </fieldset>
    </div>
    {lab.pending && <div className="mono-color-lab__diff" role="region" aria-label="Различия импорта">
      <p>Изменений: {lab.pending.diff.length}. Сохранено замков: {lab.pending.skipped.length}.</p>
      <ul>{lab.pending.diff.map(item => <li key={item.path}>{item.path}: {JSON.stringify(item.before)} → {JSON.stringify(item.after)}</li>)}</ul>
      {lab.pending.issues.map(issue => <p key={issue}>{issue}</p>)}
      <button type="button" disabled={lab.pending.issues.length > 0 || lab.pending.diff.length === 0 || workspace.compare === "baseline"} onClick={lab.acceptPending}>Принять в черновик</button>
      <button type="button" onClick={() => lab.setPending(null)}>Отмена импорта</button>
    </div>}
    <p role="status" aria-live="polite">{lab.status}</p>
  </section>;
}

export function MonoColorInspector({ lab }: { lab: MonoColorLabState }) {
  const { role, theme, resolved, commit } = lab;
  const group = MONO_PALETTE_ROLE_SCHEMA[role].group;
  const state = theme.roles[role];
  const locked = state.locked || theme.groupLocks[group];
  const color = resolved.srgb[role];
  const hex = `#${[color.r, color.g, color.b].map(channel => Math.round(channel * 255).toString(16).padStart(2, "0")).join("")}`;
  const [hexDraft, setHexDraft] = useState<string | null>(null);
  const values = state.mode === "offset" ? state.offset : resolved.roles[role];
  return <section className="mono-color-lab" aria-label="Смысловые цвета" data-mono-control>
    {!lab.expert ? <p>Откройте «Точную настройку» слева, чтобы менять отдельные цвета.</p> : <>
      <label>Смысловая роль<select value={role} onChange={event => { lab.setRole(event.target.value as MonoPaletteRole); setHexDraft(null); }}>
        {Object.entries(MONO_PALETTE_GROUPS).map(([id, roles]) => <optgroup key={id} label={groups[id as MonoPaletteGroup]}>{roles.map(item => <option key={item} value={item}>{roleLabels[item]}</option>)}</optgroup>)}
      </select></label>
      <div className="mono-color-lab__swatch" style={{ background: hex } as CSSProperties} aria-hidden="true" />
      <fieldset disabled={!lab.present.paletteEnabled || group === "system" || lab.workspace.compare === "baseline"}><legend>{groups[group]}</legend>
        <label>Режим роли<select value={state.mode} disabled={locked} onChange={event => { setHexDraft(null); commit(workspace => setMonoPaletteRoleMode(workspace, role, event.target.value as "linked" | "offset" | "manual")); }}>
          <option value="linked">Следует палитре</option><option value="offset">С поправкой</option><option value="manual">Свой цвет</option>
        </select></label>
        <label>HEX<input value={hexDraft ?? hex} disabled={locked || state.mode !== "manual"} onChange={event => setHexDraft(event.target.value)} onBlur={() => {
          if (hexDraft === null) return;
          if (!/^#[0-9a-f]{6}$/i.test(hexDraft)) { lab.setStatus("HEX: укажите # и шесть знаков."); return; }
          const rgb = [1, 3, 5].map(index => parseInt(hexDraft.slice(index, index + 2), 16) / 255);
          commit(workspace => editMonoPaletteRole(workspace, role, srgbToOklch({ r: rgb[0], g: rgb[1], b: rgb[2], alpha: resolved.roles[role].alpha })));
          setHexDraft(null);
        }} /></label>
        {(["l", "c", "h"] as const).map(key => <label key={key}>OKLCH {key.toUpperCase()}<input type="number" step={key === "h" ? 1 : 0.001}
          value={Number(values[key].toFixed(5))} disabled={locked || state.mode === "linked"} onChange={event => {
            if (event.target.value !== "") commit(workspace => editMonoPaletteRole(workspace, role, { [key]: Number(event.target.value) }));
          }} /></label>)}
        <button type="button" aria-label={`Не менять «${roleLabels[role]}»`} aria-pressed={state.locked} disabled={theme.groupLocks[group]} onClick={() => commit(workspace => setMonoPaletteWorkspaceLock(workspace, { kind: "point", role }, !state.locked))}>{state.locked ? "Цвет закреплён" : "Не менять цвет"}</button>
        <button type="button" aria-pressed={theme.groupLocks[group]} onClick={() => commit(workspace => setMonoPaletteWorkspaceLock(workspace, { kind: "group", group }, !theme.groupLocks[group]))}>{theme.groupLocks[group] ? `Закреплено: ${groups[group]}` : `Не менять: ${groups[group]}`}</button>
        <button type="button" disabled={locked || role === "focus"} onClick={() => lab.randomize({ kind: "point", role })}>{`Другой цвет для «${roleLabels[role]}»`}</button>
        <button type="button" disabled={theme.groupLocks[group]} onClick={() => lab.randomize({ kind: "group", group })}>{`Другой вариант для «${groups[group]}»`}</button>
      </fieldset>
      {group === "system" && <p>Системная роль защищена от эстетических изменений.</p>}
      {locked && <p>Значение закреплено и не меняется вместе с рецептом.</p>}
    </>}
  </section>;
}
