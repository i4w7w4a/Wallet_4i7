"use client";

import { useEffect, useState } from "react";
import { MONO_PALETTE_GROUPS } from "@wallet/ui";
import { PresetHttpError, presetClient } from "../preset-library/preset-client";
import type { PresetView, PresetVisibility } from "../preset-library/preset-types";
import { exportMonoPalettePreset, importMonoPalettePreset, type MonoPaletteFragmentScope } from "./mono-preset-codec";
import type { MonoColorLabState } from "./mono-color-lab";
import "./mono-preset-library.css";

const copyScopes: Array<{ id: MonoPaletteFragmentScope; label: string }> = [
  { id: "entire", label: "Весь пресет" }, { id: "dark", label: "Только Dark" },
  { id: "light", label: "Только Light" }, { id: "palette", label: "Палитра" },
  { id: "background", label: "Фон" }, { id: "glass-color", label: "Цвет стекла" },
];
const stripRoles = ["canvas", "surfaceRaised", "textPrimary", ...MONO_PALETTE_GROUPS.decorative.slice(0, 4)] as const;
const slugPattern = /^[A-Za-z0-9_-]{32}$/;

function slugFromInput(input: string): string {
  const trimmed = input.trim();
  if (slugPattern.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    const candidate = url.searchParams.get("preset") ?? url.pathname.split("/").filter(Boolean).at(-1) ?? "";
    if (slugPattern.test(candidate)) return candidate;
  } catch { /* User input can be a bare code. */ }
  throw new Error("Нужна ссылка на пресет или его 32-символьный код.");
}

function errorMessage(error: unknown): string {
  if (error instanceof PresetHttpError) {
    if (error.status === 503 || error.status === null) return "Сервер пресетов сейчас недоступен. Локальная библиотека и экспорт JSON доступны.";
    if (error.status === 429) return "Лимит сохранений достигнут. Сохраните JSON локально и повторите позже.";
    if (error.status === 409) return "Пресет уже изменён в другом окне. Обновите список перед новой ревизией.";
    if (error.status === 404) return "Пресет по этой ссылке не найден.";
    if (error.status === 403) return "Нет права изменять этот пресет. Создайте ответвление.";
  }
  return error instanceof Error ? error.message : "Операция с серверной библиотекой не выполнена.";
}

const isUnavailable = (error: unknown) => error instanceof PresetHttpError &&
  (error.status === 503 || error.kind === "network");

function PaletteStrips({ entry }: { entry: PresetView }) {
  return <div className="mono-preset-library__strips">
    {(["dark", "light"] as const).map(mode => <div className="mono-preset-library__strip" key={mode} aria-label={`${mode === "dark" ? "Dark" : "Light"} палитра`}>
      <span aria-hidden="true">{mode === "dark" ? "D" : "L"}</span>
      {stripRoles.map(role => {
        const { r, g, b } = entry.preset.resolved[mode].srgb[role];
        return <i key={role} title={role} style={{ backgroundColor: `rgb(${Math.round(r * 255)} ${Math.round(g * 255)} ${Math.round(b * 255)})` }} />;
      })}
    </div>)}
  </div>;
}

export function MonoPresetLibrary({ lab }: { lab: MonoColorLabState }) {
  const [mine, setMine] = useState<PresetView[]>([]);
  const [opened, setOpened] = useState<PresetView | null>(null);
  const [revisions, setRevisions] = useState<{ slug: string; entries: PresetView[] } | null>(null);
  const [name, setName] = useState("");
  const [visibility, setVisibility] = useState<PresetVisibility>("unlisted");
  const [linkInput, setLinkInput] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [busy, setBusy] = useState(true);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!lab.ready) return;
    const controller = new AbortController();
    let live = true;
    const sharedSlug = new URL(window.location.href).searchParams.get("preset");
    const shared = sharedSlug && slugPattern.test(sharedSlug) ? presetClient.read(sharedSlug, { signal: controller.signal }) : Promise.resolve(null);
    void Promise.allSettled([presetClient.listMine({ signal: controller.signal }), shared]).then(([mineResult, sharedResult]) => {
      if (!live) return;
      if (mineResult.status === "fulfilled") setMine(mineResult.value);
      else if (isUnavailable(mineResult.reason)) setOffline(true);
      else setError(errorMessage(mineResult.reason));
      if (sharedResult.status === "fulfilled" && sharedResult.value) setOpened(sharedResult.value);
      else if (sharedResult.status === "rejected") {
        if (isUnavailable(sharedResult.reason)) setOffline(true);
        else setError(errorMessage(sharedResult.reason));
      }
    }).finally(() => { if (live) setBusy(false); });
    return () => { live = false; controller.abort(); };
  }, [lab.ready]);

  const connectionBusy = busy || !lab.ready || lab.workspace.compare === "baseline";
  const disabled = connectionBusy || offline;
  const operate = async (work: () => Promise<string>) => {
    if (disabled) return;
    setBusy(true); setError(""); setNotice("");
    try { setNotice(await work()); }
    catch (reason) {
      if (isUnavailable(reason)) setOffline(true);
      else setError(errorMessage(reason));
    }
    finally { setBusy(false); }
  };
  const refresh = async () => {
    if (connectionBusy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      setMine(await presetClient.listMine());
      setOffline(false);
      setNotice("Список обновлён.");
    } catch (reason) {
      if (isUnavailable(reason)) setOffline(true);
      else setError(errorMessage(reason));
    } finally { setBusy(false); }
  };
  const title = (fallback = "") => (name.trim() || fallback).slice(0, 80);
  const verifiedDraft = async () => importMonoPalettePreset(await exportMonoPalettePreset(lab.present.config));
  const refreshOwnership = async (saved: PresetView) => {
    setOpened(saved);
    try { setMine(await presetClient.listMine()); }
    catch { setError("Пресет сохранён, но право на новую ревизию пока не подтверждено. Ссылка и JSON доступны."); }
  };
  const saveNew = () => void operate(async () => {
    const value = title();
    if (!value) throw new Error("Укажите название перед сохранением.");
    const saved = await presetClient.create({ name: value, visibility, preset: await verifiedDraft() });
    await refreshOwnership(saved);
    return `Сохранён новый пресет «${saved.name}».`;
  });
  const revise = (entry: PresetView) => void operate(async () => {
    const fresh = await presetClient.listMine();
    setMine(fresh);
    if (!fresh.some(item => item.id === entry.id && item.slug === entry.slug))
      throw new Error("Право владения пресетом не подтверждено. Можно создать ответвление.");
    const saved = await presetClient.revise(entry.slug, {
      expectedRevision: entry.currentRevision, name: title(entry.name),
      description: entry.description, visibility: entry.visibility, preset: await verifiedDraft(),
    });
    setMine(entries => entries.map(item => item.id === saved.id ? saved : item));
    if (opened?.id === saved.id) setOpened(saved);
    return `Создана ревизия ${saved.currentRevision} пресета «${saved.name}».`;
  });
  const fork = (entry: PresetView) => void operate(async () => {
    const value = title(`${entry.name} · ответвление`);
    const edited = lab.activeRemoteSource?.id === entry.id ? await verifiedDraft() : undefined;
    const saved = await presetClient.fork(entry.slug, { name: value, ...(edited ? { preset: edited } : {}) });
    await refreshOwnership(saved);
    return `Создано ответвление «${saved.name}». Исходник сохранён.`;
  });
  const open = () => void operate(async () => {
    const entry = await presetClient.read(slugFromInput(linkInput));
    setOpened(entry); setRevisions(null);
    return `Открыт «${entry.name}». Выберите часть для предпросмотра.`;
  });
  const showHistory = (entry: PresetView) => void operate(async () => {
    const entries = await presetClient.history(entry.slug);
    setRevisions({ slug: entry.slug, entries });
    return `Ревизий: ${entries.length}.`;
  });
  const copyLink = (entry: PresetView) => void operate(async () => {
    const url = new URL("/mono", window.location.origin);
    url.searchParams.set("preset", entry.slug);
    setShareUrl(url.toString());
    try { await navigator.clipboard.writeText(url.toString()); return "Ссылка скопирована."; }
    catch { return "Ссылка готова в поле ниже — скопируйте вручную."; }
  });
  const preview = (entry: PresetView, scope: MonoPaletteFragmentScope) => {
    if (disabled) return;
    lab.previewRemotePreset(entry, scope);
    setNotice(`Предпросмотр «${entry.name}»: ${copyScopes.find(item => item.id === scope)?.label}. Проверьте различия перед принятием.`);
  };
  const ownIds = new Set(mine.map(entry => entry.id));
  const cards = opened && !ownIds.has(opened.id) ? [...mine, opened] : mine;

  return <section className="mono-preset-library" aria-label="Серверная библиотека" aria-busy={busy} data-mono-control>
    <header className="mono-preset-library__head"><span>PRESET / CLOUD</span><h3>Библиотека вариантов</h3></header>
    <p className="mono-preset-library__intro">Черновик живёт отдельно. На сервер он попадает только после явного сохранения.</p>
    <fieldset disabled={disabled}>
      <legend>Новый снимок</legend>
      <label>Название для сервера<input value={name} maxLength={80} onChange={event => setName(event.target.value)} placeholder="Например, Серебряный туман" /></label>
      <label>Доступ<select value={visibility} onChange={event => setVisibility(event.target.value as PresetVisibility)}>
        <option value="unlisted">По ссылке</option><option value="public">Публичный (без каталога)</option>
      </select></label>
      <button type="button" className="mono-preset-library__primary" onClick={saveNew}>Сохранить на сервере</button>
      <div className="mono-preset-library__finder">
        <label>Ссылка или код пресета<input value={linkInput} onChange={event => setLinkInput(event.target.value)} placeholder="Вставьте ссылку" autoComplete="off" /></label>
        <button type="button" onClick={open}>Открыть пресет</button>
      </div>
    </fieldset>
    <button type="button" disabled={connectionBusy} onClick={() => void refresh()}>{offline ? "Повторить соединение" : "Обновить список"}</button>
    {busy && <p className="mono-preset-library__status" role="status">Соединение с библиотекой…</p>}
    {offline && !busy && <p className="mono-preset-library__status" role="status">Серверная библиотека пока недоступна. Локальные пресеты и экспорт JSON работают.</p>}
    {error && <p className="mono-preset-library__error" role="alert">{error}</p>}
    {notice && <p className="mono-preset-library__status" role="status">{notice}</p>}
    {shareUrl && <label className="mono-preset-library__share">Ссылка для передачи<input readOnly value={shareUrl} onFocus={event => event.target.select()} /></label>}
    {cards.length === 0 && !busy && !offline && <p className="mono-preset-library__empty">На этом устройстве пока нет серверных пресетов. Локальная библиотека и экспорт JSON доступны всегда.</p>}
    <div className="mono-preset-library__cards">
      {cards.map(entry => <article className="mono-preset-library__card" key={entry.id} aria-label={entry.name}>
        <div className="mono-preset-library__card-head"><strong>{entry.name}</strong><span>{entry.visibility === "public" ? "Публичный (без каталога)" : "По ссылке"}</span></div>
        <div className="mono-preset-library__meta"><span>Ревизия {entry.currentRevision}</span>{entry.sourcePresetId && <span>Ответвление · {entry.sourcePresetId.slice(0, 8)}</span>}</div>
        <PaletteStrips entry={entry} />
        <div className="mono-preset-library__actions">
          <button type="button" disabled={disabled} onClick={() => preview(entry, "entire")}>Предпросмотр</button>
          <button type="button" disabled={disabled} onClick={() => void copyLink(entry)}>Ссылка</button>
        </div>
        <label>Скопировать часть<select defaultValue="" disabled={disabled} onChange={event => {
          if (event.target.value) preview(entry, event.target.value as MonoPaletteFragmentScope);
          event.target.value = "";
        }}>
          <option value="" disabled>Выберите модуль…</option>
          {copyScopes.filter(scope => scope.id !== "entire").map(scope => <option key={scope.id} value={scope.id}>{scope.label}</option>)}
        </select></label>
        <div className="mono-preset-library__actions">
          {ownIds.has(entry.id) && <button type="button" disabled={disabled} onClick={() => revise(entry)}>Новая ревизия</button>}
          <button type="button" disabled={disabled} onClick={() => fork(entry)}>Создать ответвление</button>
        </div>
        <button type="button" className="mono-preset-library__quiet" disabled={disabled} onClick={() => showHistory(entry)}>История ревизий</button>
        {revisions?.slug === entry.slug && <div className="mono-preset-library__history" aria-label={`История ${entry.name}`}>
          {revisions.entries.map(revision => <button key={revision.revision} type="button" disabled={disabled}
            onClick={() => preview(revision, "entire")}>Ревизия {revision.revision} · {revision.name}</button>)}
        </div>}
      </article>)}
    </div>
    <p className="mono-preset-library__foot">Нет связи? Локальная библиотека и экспорт JSON доступны выше. Серверные пресеты не заменяют черновик без просмотра различий.</p>
  </section>;
}
