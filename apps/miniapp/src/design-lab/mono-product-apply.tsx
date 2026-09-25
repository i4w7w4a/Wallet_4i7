"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ButtonTargetId, MaterialTargetBinding } from "@wallet/ui";
import { MONO_LOGO_PREVIEW_KEY } from "../mono-preview/mono-logo-preview";
import { applyMonoMaterialPatch, type MonoMaterialPatch } from "../mono-preview/mono-material-transfer";
import { MONO_PALETTE_ACTIVE_KEY, MONO_PALETTE_PRESETS_KEY, MONO_PALETTE_WORKSPACE_KEY } from "../mono-preview/mono-palette-storage";
import { MONO_SHAPE_STORAGE_KEY, type MonoShapePreset } from "../mono-preview/mono-shape-preview";
import { createMonoWorkingDocument, loadMonoWorkingLibrary, MONO_WORKING_PRESETS_KEY,
  saveMonoWorkingLibrary, type MonoWorkingLibrary } from "../mono-preview/mono-working-presets";
import type { BackgroundLabDocumentV1 } from "./background-sandbox/document-v3";
import type { ButtonLabDocument, ButtonLabWorkspace } from "./button-workshop/model";
import { backgroundPatchFromLab, buttonPatchFromLab } from "./mono-product-apply-source";
import styles from "./mono-product-apply.module.css";

type Shared = { disabled?: boolean; onDialogChange?: (open: boolean) => void;
  onNavigateToMono?: () => void };
export type MonoProductApplyProps = Shared & (
  | { scope: "background"; document: BackgroundLabDocumentV1 }
  | { scope: "buttons"; document: ButtonLabDocument<ButtonTargetId, MaterialTargetBinding>;
      selection: ButtonLabWorkspace<ButtonTargetId, MaterialTargetBinding>["selection"] }
);

type Success = { id: string; name: string; direction: MonoShapePreset };
const DIRECTIONS: readonly { id: MonoShapePreset; name: string }[] = [
  { id: "ledger", name: "Ledger" }, { id: "frost", name: "Frost" }, { id: "mercury", name: "Mercury" },
];
const RECOVERY_KEYS = [MONO_PALETTE_ACTIVE_KEY, MONO_PALETTE_PRESETS_KEY, MONO_PALETTE_WORKSPACE_KEY,
  "wallet4i7.mono.palette-workspace.v1", "wallet4i7.mono.palette-presets.v1",
  MONO_SHAPE_STORAGE_KEY, MONO_LOGO_PREVIEW_KEY, "wallet4i7.mono.optical-preview.v1",
  "wallet4i7.mono.environment-preview.v1"];
const message = (error: unknown) => error instanceof Error ? error.message : "Материал не удалось применить.";

function hasPreviousMonoData(): boolean {
  return RECOVERY_KEYS.some(key => localStorage.getItem(key) !== null);
}

async function withWorkingLock<T>(task: () => T): Promise<T> {
  if (navigator.locks?.request) return navigator.locks.request(MONO_WORKING_PRESETS_KEY, task);
  return task();
}

async function rejectDirtyTarget(targetId: string): Promise<void> {
  if (typeof BroadcastChannel === "undefined") return;
  const channel = new BroadcastChannel(MONO_WORKING_PRESETS_KEY);
  const requestId = crypto.randomUUID();
  let dirty = false;
  channel.onmessage = event => {
    const answer = event.data as { kind?: unknown; requestId?: unknown; targetId?: unknown; dirty?: unknown };
    if (answer?.kind === "material-apply-status" && answer.requestId === requestId &&
      answer.targetId === targetId && answer.dirty === true) dirty = true;
  };
  try {
    channel.postMessage({ kind: "material-apply-check", requestId, targetId });
    await new Promise(resolve => setTimeout(resolve, 180));
    if (dirty) throw new Error("В MONO есть несохранённая проба этого пресета. Сначала примените или отмените её там.");
  } finally { channel.close(); }
}

function patchLabel(patch: MonoMaterialPatch | null): string {
  if (!patch) return "";
  if (patch.scope === "background") return "Фон";
  const layer = { fill: "Поверхность", icon: "Иконка", border: "Кромка" }[patch.selection.layer];
  const target = { "quick.send": "Отправить", "quick.receive": "Получить",
    "quick.swap": "Обменять", "quick.buy": "Купить" };
  const action = patch.value.bindings.length === 0 ? `Снять ${layer.toLowerCase()}` : layer;
  return `${action} · ${patch.selection.target === "all" ? "Все четыре кнопки" : target[patch.selection.target]}`;
}

/** Explicit product transfer, separate from a workshop's own accepted preview. */
export function MonoProductApply(props: MonoProductApplyProps) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [library, setLibrary] = useState<MonoWorkingLibrary | null>(null);
  const [patch, setPatch] = useState<MonoMaterialPatch | null>(null);
  const [targetId, setTargetId] = useState("");
  const [direction, setDirection] = useState<MonoShapePreset | "">("");
  const [name, setName] = useState("");
  const [previousData, setPreviousData] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<Success | null>(null);

  useEffect(() => {
    if (!open || !dialog.current) return;
    const element = dialog.current;
    if (typeof element.showModal === "function") element.showModal();
    else element.setAttribute("open", "");
    element.querySelector<HTMLElement>("select, input, button")?.focus();
    return () => {
      if (typeof element.close === "function" && element.open) element.close();
      else element.removeAttribute("open");
    };
  }, [open]);

  const changeOpen = (next: boolean) => {
    if (!next && saving) return;
    setOpen(next);
    props.onDialogChange?.(next);
    if (!next) queueMicrotask(() => launcher.current?.focus());
  };

  const prepare = () => {
    setError(""); setSuccess(null); setTargetId(""); setDirection(""); setName("");
    try {
      setPatch(props.scope === "background" ? backgroundPatchFromLab(props.document)
        : buttonPatchFromLab(props.document, props.selection));
      const nextLibrary = loadMonoWorkingLibrary(localStorage);
      setLibrary(nextLibrary);
      setPreviousData(!nextLibrary && hasPreviousMonoData());
      if (nextLibrary) {
        setTargetId(nextLibrary.activeId);
        const active = nextLibrary.records.find(record => record.id === nextLibrary.activeId);
        setDirection(DIRECTIONS[(active?.document.palette.activeSlotId ?? 1) - 1]!.id);
      } else setDirection("ledger");
    } catch (cause) {
      setPatch(null); setLibrary(null); setPreviousData(false); setError(message(cause));
    }
    changeOpen(true);
  };

  const confirm = async () => {
    if (!patch || !direction || saving) return;
    if (library && !targetId) { setError("Выберите рабочий пресет."); return; }
    if (!library && previousData) { setError("Сначала откройте MONO и восстановите прежние настройки."); return; }
    const trimmedName = name.trim();
    if (!library && (!trimmedName || trimmedName.length > 80 || /[\u0000-\u001f\u007f]/.test(trimmedName))) {
      setError("Введите имя рабочего пресета до 80 символов."); return;
    }
    setSaving(true); setError("");
    try {
      if (library) await rejectDirtyTarget(targetId);
      const result = await withWorkingLock((): Success => {
        const current = loadMonoWorkingLibrary(localStorage);
        if ((current?.generation ?? 0) !== (library?.generation ?? 0))
          throw new Error("Библиотека изменилась в другой вкладке. Откройте выбор заново.");
        if (library) {
          const selected = library.records.find(record => record.id === targetId);
          if (!current || !selected) throw new Error("Выбранный пресет больше недоступен.");
          const next = applyMonoMaterialPatch(current, { targetId, direction,
            expectedGeneration: library.generation, expectedRevision: selected.revision, patch });
          saveMonoWorkingLibrary(localStorage, next, library.generation);
          return { id: targetId, name: selected.name, direction };
        }
        if (hasPreviousMonoData()) throw new Error("Появились прежние настройки MONO. Откройте MONO для восстановления.");
        const newId = crypto.randomUUID();
        const initial: MonoWorkingLibrary = { version: 2, skinId: "mono-ledger-v1", generation: 0,
          activeId: newId, records: [{ id: newId, name: trimmedName, revision: 1,
            document: createMonoWorkingDocument() }] };
        const next = applyMonoMaterialPatch(initial, { targetId: newId, direction,
          expectedGeneration: 0, expectedRevision: 1, patch });
        saveMonoWorkingLibrary(localStorage, next, 0);
        return { id: newId, name: trimmedName, direction };
      });
      setSuccess(result);
      setLibrary(loadMonoWorkingLibrary(localStorage));
    } catch (cause) { setError(message(cause)); }
    finally { setSaving(false); }
  };

  return <>
    <button ref={launcher} type="button" disabled={props.disabled} onClick={prepare}>В рабочий пресет MONO…</button>
    {open && <dialog ref={dialog} className={styles.dialog} aria-label="Применить материал в MONO"
      onCancel={event => { event.preventDefault(); changeOpen(false); }}>
      <h2>Применить в MONO</h2>
      <p>Перенос: <strong>{patchLabel(patch)}</strong>. Проба мастерской останется отдельной.</p>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      {success ? <>
        <p role="status">Применено: {success.name} · {DIRECTIONS.find(item => item.id === success.direction)?.name}.</p>
        <a href={`/mono?working=${encodeURIComponent(success.id)}&direction=${success.direction}`}
          onClick={event => {
            if (event.button === 0 && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey)
              props.onNavigateToMono?.();
          }}>Открыть MONO</a>
      </> : patch && <>
        {library ? <label htmlFor={`${id}-target`}>Рабочий пресет
          <select id={`${id}-target`} value={targetId} onChange={event => {
            const nextId = event.target.value;
            setTargetId(nextId);
            const selected = library.records.find(record => record.id === nextId);
            if (selected) setDirection(DIRECTIONS[selected.document.palette.activeSlotId - 1]!.id);
          }}>
            <option value="">Выберите пресет</option>
            {library.records.map(record => <option key={record.id} value={record.id}>{record.name}</option>)}
          </select>
        </label> : previousData ? <p>Прежние настройки существуют. <a href="/mono">Откройте MONO</a> для их восстановления, затем вернитесь сюда.</p>
          : <label htmlFor={`${id}-name`}>Название нового рабочего пресета
            <input id={`${id}-name`} value={name} maxLength={80} onChange={event => setName(event.target.value)} />
          </label>}
        {!previousData && <label htmlFor={`${id}-direction`}>Направление
          <select id={`${id}-direction`} value={direction} onChange={event => setDirection(event.target.value as MonoShapePreset | "")}>
            <option value="">Выберите направление</option>
            {DIRECTIONS.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>}
        {!previousData && <button type="button" disabled={saving || !direction || (library ? !targetId : !name.trim())}
          onClick={() => { void confirm(); }}>Применить в MONO</button>}
      </>}
      <button type="button" disabled={saving} onClick={() => changeOpen(false)}>Закрыть</button>
    </dialog>}
  </>;
}
