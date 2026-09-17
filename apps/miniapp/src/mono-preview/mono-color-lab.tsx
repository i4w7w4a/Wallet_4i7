"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  MONO_PALETTE_GROUPS, MONO_PALETTE_HARMONIES, MONO_PALETTE_RECIPE_BOUNDS, MONO_PALETTE_ROLE_SCHEMA,
  resolveMonoPalette, srgbToOklch, validateMonoPaletteApply,
  type MonoPaletteGroup, type MonoPaletteRole, type MonoPaletteRecipe, type MonoPaletteScope,
} from "@wallet/ui";
import {
  beginMonoPaletteTransaction, createMonoPaletteWorkspace, editMonoPaletteRecipe, editMonoPaletteRole,
  enableMonoPalette, endMonoPaletteTransaction, previewMonoThemesLink, randomizeMonoPaletteWorkspace,
  redoMonoPaletteWorkspace, replaceMonoPaletteConfig, resetMonoPaletteSlot, setMonoPaletteRoleMode,
  setMonoPaletteSeed, setMonoPaletteWorkspaceLock, setMonoThemesLinked, switchMonoPaletteSlot,
  switchMonoPaletteTheme, toggleMonoPaletteCompare, undoMonoPaletteWorkspace, type MonoPaletteWorkspace,
} from "./mono-palette-workspace";
import { applyMonoPaletteActive, loadMonoPaletteActive, loadMonoPaletteLibrary,
  readMonoPaletteWorkspace, saveMonoPaletteLibrary, saveMonoPaletteWorkspace, type MonoPaletteLibraryEntry } from "./mono-palette-storage";
import { exportMonoPalettePreset, createMonoPaletteFragment, importMonoPalettePreset, previewMonoPaletteFragment,
  type MonoPaletteFragmentScope, type MonoPaletteMerge } from "./mono-preset-codec";
import { monoPaletteStyle } from "./mono-palette-tokens";
import { saveMonoPalettePrepaint } from "./mono-palette-prepaint";
import "./mono-color-lab.css";

type Edit = (workspace: MonoPaletteWorkspace) => MonoPaletteWorkspace;
type NumericRecipe = keyof typeof MONO_PALETTE_RECIPE_BOUNDS;
const labels: Record<NumericRecipe, string> = { anchorHue: "Мастер-пигмент", anchorChroma: "Насыщенность", temperature: "Температура",
  iridescence: "Перелив", exposure: "Экспозиция", contrast: "Контраст", surfaceResponse: "Материал" };
const harmonyLabels: Record<MonoPaletteRecipe["harmony"], string> = { "spectral-graphite": "Спектральный графит", mineral: "Минерал", "thermal-duet": "Тепловой дуэт", "analog-mist": "Соседние оттенки", "split-prism": "Разделённая призма" };
const groups: Record<MonoPaletteGroup, string> = { core: "Поверхности", content: "Содержание", structure: "Структура", decorative: "Акценты", system: "Системные" };

export function useMonoColorLab() {
  const [workspace, setWorkspace] = useState(createMonoPaletteWorkspace);
  const current = useRef(workspace);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState("");
  const [expert, setExpert] = useState(false);
  const [role, setRole] = useState<MonoPaletteRole>("accentPrimary");
  const [library, setLibrary] = useState<MonoPaletteLibraryEntry[]>([]);
  const [name, setName] = useState("");
  const [json, setJson] = useState("");
  const [pending, setPending] = useState<MonoPaletteMerge | null>(null);
  const [linkDiff, setLinkDiff] = useState<ReturnType<typeof previewMonoThemesLink> | null>(null);
  const [busy, setBusy] = useState(false);
  const pendingRecipe = useRef<Partial<MonoPaletteRecipe>>({});
  const frame = useRef<number | null>(null);

  const commit = useCallback((edit: Edit) => {
    try {
      const next = edit(current.current);
      current.current = next;
      setWorkspace(next);
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
      saveMonoPaletteWorkspace(localStorage, workspace);
      saveMonoPalettePrepaint(localStorage, workspace);
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
    try { setPending(previewMonoPaletteFragment(present.config, createMonoPaletteFragment(entry.preset, scope))); }
    catch (error) { setStatus(String(error)); }
  };
  const output = () => run(async () => {
    const value = await exportMonoPalettePreset(present.config); setJson(value);
    try { await navigator.clipboard.writeText(value); setStatus("JSON скопирован."); }
    catch { setStatus("JSON готов в поле ниже; можно скопировать вручную."); }
  });
  const download = () => run(async () => {
    const value = await exportMonoPalettePreset(present.config);
    const url = URL.createObjectURL(new Blob([value], { type: "application/json" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "mono-palette.json"; anchor.click(); URL.revokeObjectURL(url);
  });
  return { workspace, present, shown, theme, resolved, style, issues, ready, status, setStatus, expert, setExpert, role, setRole,
    library, name, setName, json, setJson, pending, setPending, linkDiff, setLinkDiff, busy, commit, begin, end, editRecipe,
    randomize, save, remove, previewFragment, output, download,
    importPreview: () => run(async () => { const imported = await importMonoPalettePreset(json); setPending(previewMonoPaletteFragment(present.config, createMonoPaletteFragment(imported, "entire"))); }),
    switchTheme: (mode: "dark" | "light") => { end(); commit(state => switchMonoPaletteTheme(state, mode)); },
    switchSlot: (id: 1 | 2 | 3) => { end(); commit(state => switchMonoPaletteSlot(state, id)); },
  };
}

export type MonoColorLabState = ReturnType<typeof useMonoColorLab>;

export function MonoColorLab({ lab }: { lab: MonoColorLabState }) {
  const { present, theme, workspace, commit } = lab;
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
    <fieldset disabled={!enabled}><legend>Характер</legend>
      <label>Гармония<select value={theme.recipe.harmony} onChange={event => lab.editRecipe({ harmony: event.target.value as MonoPaletteRecipe["harmony"] })}>
        {MONO_PALETTE_HARMONIES.filter(id => lab.expert || id !== "split-prism" || theme.recipe.harmony === id).map(id => <option key={id} value={id}>{harmonyLabels[id]}</option>)}
      </select></label>
      {(Object.keys(MONO_PALETTE_RECIPE_BOUNDS) as NumericRecipe[]).filter(id => lab.expert || ["anchorHue", "anchorChroma", "iridescence"].includes(id)).map(id => {
        const bound = MONO_PALETTE_RECIPE_BOUNDS[id];
        return <label key={id}>{labels[id]}<output>{theme.recipe[id].toFixed(id === "anchorHue" ? 0 : 3)}</output>
          <input type="range" aria-label={labels[id]} min={bound.min} max={bound.max} step={id === "anchorHue" ? 1 : 0.001} value={theme.recipe[id]}
            onPointerDown={() => lab.begin(id)} onPointerUp={lab.end} onPointerCancel={lab.end} onBlur={lab.end}
            onKeyDown={event => { if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"].includes(event.key)) lab.begin(id); }} onKeyUp={lab.end}
            onChange={event => lab.editRecipe({ [id]: Number(event.target.value) })} />
        </label>;
      })}
      <button type="button" aria-pressed={present.config.linkedThemes} onClick={link}>Связать темы</button>
      {lab.linkDiff && <div className="mono-color-lab__diff" role="region" aria-label="Различия перед связыванием">
        <p>Характер второй темы изменится. Ручные роли сохранятся.</p>
        {lab.linkDiff.map(item => <p key={item.key}>{item.key}: {item.dark} → {item.light}</p>)}
        <button type="button" onClick={() => { commit(state => setMonoThemesLinked(state, true, { confirm: true })); lab.setLinkDiff(null); }}>Подтвердить связь</button>
        <button type="button" onClick={() => lab.setLinkDiff(null)}>Отмена связи</button>
      </div>}
      <label>Seed<input value={present.config.seed} maxLength={256} onChange={event => commit(state => setMonoPaletteSeed(state, event.target.value))} /></label>
      <button type="button" onClick={() => lab.randomize({ kind: "global" })}>Случайная палитра</button>
    </fieldset>
    <button type="button" aria-pressed={lab.expert} onClick={() => lab.setExpert(!lab.expert)}>Эксперт</button>
    <div className="mono-color-lab__row">
      <button type="button" aria-label="Отменить цвет" disabled={!slot.past.length} onClick={() => { lab.end(); commit(undoMonoPaletteWorkspace); }}>↶ Undo</button>
      <button type="button" aria-label="Повторить цвет" disabled={!slot.future.length} onClick={() => commit(redoMonoPaletteWorkspace)}>↷ Redo</button>
    </div>
    <button type="button" aria-label="Сравнить A/B" aria-pressed={workspace.compare === "baseline"} onClick={() => commit(toggleMonoPaletteCompare)}>
      {workspace.compare === "baseline" ? "A · Исходный материал" : "B · Черновик"}
    </button>
    <button type="button" onClick={() => commit(resetMonoPaletteSlot)}>Сбросить цвет</button>
    <button type="button" disabled={!enabled || lab.issues.length > 0 || workspace.compare === "baseline"} onClick={() => {
      try { applyMonoPaletteActive(localStorage, present.config); lab.setStatus("Палитра применена локально. Библиотека не изменена."); }
      catch (error) { lab.setStatus(String(error)); }
    }}>Применить палитру</button>
    {lab.issues.length > 0 && <div role="note" aria-label="Ограничения Apply">{lab.issues.map((issue, index) => <p key={index}>{issue.message}</p>)}</div>}
    {workspace.compare === "baseline" && <p role="note">Сейчас показан A · исходный материал. Вернитесь к B, чтобы сохранить или применить черновик.</p>}
    <fieldset disabled={!enabled || lab.busy || workspace.compare === "baseline"}><legend>Локальная библиотека</legend>
      <label>Имя пресета<input maxLength={80} value={lab.name} onChange={event => lab.setName(event.target.value)} /></label>
      <button type="button" onClick={() => void lab.save()}>Сохранить новый</button>
      {lab.library.map(entry => <article key={entry.id} aria-label={entry.name}>
        <strong>{entry.name}</strong><small>Ревизия {entry.revision}</small>
        {(["dark", "light"] as const).map(mode => <div key={mode} className="mono-color-lab__strip" aria-label={`${mode} палитра`}>
          {MONO_PALETTE_GROUPS.decorative.slice(0, 5).map(role => { const color = entry.preset.resolved[mode].srgb[role]; return <i key={role} style={{ background: `rgb(${color.r*255} ${color.g*255} ${color.b*255})` }} />; })}
        </div>)}
        <button type="button" onClick={() => commit(state => replaceMonoPaletteConfig(state, entry.preset.config))}>Загрузить</button>
        <div className="mono-color-lab__row"><button type="button" onClick={() => void lab.save(entry)}>Обновить</button><button type="button" onClick={() => lab.remove(entry)}>Удалить</button></div>
        <label>Скопировать модуль<select defaultValue="" onChange={event => { if (event.target.value) lab.previewFragment(entry, event.target.value as MonoPaletteFragmentScope); event.target.value = ""; }}>
          <option value="" disabled>Выбрать…</option>{["entire", "dark", "light", "palette", "background", "glass-color"].map(scope => <option key={scope} value={scope}>{scope}</option>)}
        </select></label>
      </article>)}
      <div className="mono-color-lab__row"><button type="button" onClick={() => void lab.output()}>Копировать JSON</button><button type="button" onClick={() => void lab.download()}>Скачать JSON</button></div>
      <label>JSON пресета<textarea value={lab.json} maxLength={131072} onChange={event => lab.setJson(event.target.value)} /></label>
      <button type="button" onClick={() => void lab.importPreview()}>Предпросмотр импорта</button>
    </fieldset>
    {lab.pending && <div className="mono-color-lab__diff" role="region" aria-label="Различия импорта">
      <p>Изменений: {lab.pending.diff.length}. Сохранено замков: {lab.pending.skipped.length}.</p>
      <ul>{lab.pending.diff.map(item => <li key={item.path}>{item.path}: {JSON.stringify(item.before)} → {JSON.stringify(item.after)}</li>)}</ul>
      {lab.pending.issues.map(issue => <p key={issue}>{issue}</p>)}
      <button type="button" onClick={() => { const config = lab.pending!.config; commit(state => replaceMonoPaletteConfig(state, config)); lab.setPending(null); }}>Принять в черновик</button>
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
    {!lab.expert ? <p>Включите «Эксперт» слева, чтобы управлять отдельными ролями.</p> : <>
      <label>Смысловая роль<select value={role} onChange={event => { lab.setRole(event.target.value as MonoPaletteRole); setHexDraft(null); }}>
        {Object.entries(MONO_PALETTE_GROUPS).map(([id, roles]) => <optgroup key={id} label={groups[id as MonoPaletteGroup]}>{roles.map(item => <option key={item} value={item}>{item}</option>)}</optgroup>)}
      </select></label>
      <div className="mono-color-lab__swatch" style={{ background: hex } as CSSProperties} aria-hidden="true" />
      <fieldset disabled={!lab.present.paletteEnabled || group === "system"}><legend>{groups[group]}</legend>
        <label>Режим роли<select value={state.mode} disabled={locked} onChange={event => { setHexDraft(null); commit(workspace => setMonoPaletteRoleMode(workspace, role, event.target.value as "linked" | "offset" | "manual")); }}>
          <option value="linked">Связанный</option><option value="offset">С поправкой</option><option value="manual">Ручной</option>
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
        <button type="button" aria-label="Замок роли" aria-pressed={state.locked} disabled={theme.groupLocks[group]} onClick={() => commit(workspace => setMonoPaletteWorkspaceLock(workspace, { kind: "point", role }, !state.locked))}>{state.locked ? "Роль закреплена" : "Закрепить роль"}</button>
        <button type="button" aria-pressed={theme.groupLocks[group]} onClick={() => commit(workspace => setMonoPaletteWorkspaceLock(workspace, { kind: "group", group }, !theme.groupLocks[group]))}>{theme.groupLocks[group] ? "Снять замок группы" : "Закрепить группу"}</button>
        <button type="button" disabled={locked || role === "focus"} onClick={() => lab.randomize({ kind: "point", role })}>Случайная роль</button>
        <button type="button" disabled={theme.groupLocks[group]} onClick={() => lab.randomize({ kind: "group", group })}>Случайная группа</button>
      </fieldset>
      {group === "system" && <p>Системная роль защищена от эстетических изменений.</p>}
      {locked && <p>Значение закреплено и не меняется вместе с рецептом.</p>}
    </>}
  </section>;
}
