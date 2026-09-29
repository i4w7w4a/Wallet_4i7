"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ButtonTargetId, MaterialTargetBinding } from "@wallet/ui";
import { applyMonoSevenMaterialPatch, type MonoMaterialPatch } from "../mono-preview/mono-material-transfer";
import { loadMonoSevenLibrary, MONO_SEVEN_PRESETS_KEY, MONO_SEVEN_SLOTS,
  saveMonoSevenLibrary, type MonoSevenLibrary, type MonoSevenSlot } from "../mono-preview/mono-working-presets";
import type { BackgroundLabDocumentV1 } from "./background-sandbox/document-v3";
import type { ButtonLabDocument, ButtonLabWorkspace } from "./button-workshop/model";
import { artworkPatchFromLab, backgroundPatchFromLab, buttonPatchFromLab } from "./mono-product-apply-source";
import styles from "./mono-product-apply.module.css";

type Shared = { disabled?: boolean; onDialogChange?: (open: boolean) => void;
  onNavigateToMono?: () => void };
export type MonoProductApplyProps = Shared & (
  | { scope: "background"; document: BackgroundLabDocumentV1 }
  | { scope: "buttons"; document: ButtonLabDocument<ButtonTargetId, MaterialTargetBinding>;
      selection: ButtonLabWorkspace<ButtonTargetId, MaterialTargetBinding>["selection"] }
  | { scope: "artwork"; document: ButtonLabDocument<ButtonTargetId, MaterialTargetBinding>;
      selection: Pick<ButtonLabWorkspace<ButtonTargetId, MaterialTargetBinding>["selection"], "target"> }
);

type Success = { slot: MonoSevenSlot; name: string };
const message = (error: unknown) => error instanceof Error ? error.message : "Материал не удалось применить.";

async function withWorkingLock<T>(task: () => T): Promise<T> {
  if (navigator.locks?.request) return navigator.locks.request(MONO_SEVEN_PRESETS_KEY, task);
  return task();
}

async function rejectDirtyTarget(targetId: string): Promise<void> {
  if (typeof BroadcastChannel === "undefined") return;
  const channel = new BroadcastChannel(MONO_SEVEN_PRESETS_KEY);
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
  if (patch.scope === "artwork") {
    const target = { "quick.send": "Отправить", "quick.receive": "Получить",
      "quick.swap": "Обменять", "quick.buy": "Купить" };
    return `Иконки и свет · ${patch.selection.target === "all" ? "Все четыре кнопки" : target[patch.selection.target]}`;
  }
  const layer = { fill: "Поверхность", icon: "Иконка", border: "Кромка" }[patch.selection.layer];
  const target = { "quick.send": "Отправить", "quick.receive": "Получить",
    "quick.swap": "Обменять", "quick.buy": "Купить" };
  const action = patch.value.bindings.length === 0 ? `Снять ${layer.toLowerCase()}` : layer;
  const frame = patch.value.version === 2 ? ` · ${{ group: "Общий блок", separate: "Отдельные кнопки",
    icons: "Иконки + подписи" }[patch.value.frameMode]}` : "";
  return `${action} · ${patch.selection.target === "all" ? "Все четыре кнопки" : target[patch.selection.target]}${frame}`;
}

/** Explicit product transfer, separate from a workshop's own accepted preview. */
export function MonoProductApply(props: MonoProductApplyProps) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [library, setLibrary] = useState<MonoSevenLibrary | null>(null);
  const [patch, setPatch] = useState<MonoMaterialPatch | null>(null);
  const [slot, setSlot] = useState<MonoSevenSlot | "">("");
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
    setError(""); setSuccess(null); setSlot("");
    try {
      setPatch(props.scope === "background" ? backgroundPatchFromLab(props.document)
        : props.scope === "artwork" ? artworkPatchFromLab(props.document, props.selection)
        : buttonPatchFromLab(props.document, props.selection));
      const nextLibrary = loadMonoSevenLibrary(localStorage);
      setLibrary(nextLibrary);
      if (nextLibrary) setSlot(nextLibrary.activeSlot);
    } catch (cause) {
      setPatch(null); setLibrary(null); setError(message(cause));
    }
    changeOpen(true);
  };

  const confirm = async () => {
    if (!patch || !slot || saving) return;
    if (!library) { setError("Сначала откройте MONO и восстановите семь пресетов."); return; }
    setSaving(true); setError("");
    try {
      const selected = library.slots[slot - 1];
      await rejectDirtyTarget(selected.id);
      const result = await withWorkingLock((): Success => {
        const current = loadMonoSevenLibrary(localStorage);
        if (current?.generation !== library.generation)
          throw new Error("Библиотека изменилась в другой вкладке. Откройте выбор заново.");
        if (!current) throw new Error("Пресеты не найдены.");
        const next = applyMonoSevenMaterialPatch(current, { slot, expectedGeneration: library.generation,
          expectedRevision: selected.revision, patch });
        saveMonoSevenLibrary(localStorage, next, library.generation);
        return { slot, name: selected.name };
      });
      setSuccess(result);
      setLibrary(loadMonoSevenLibrary(localStorage));
    } catch (cause) { setError(message(cause)); }
    finally { setSaving(false); }
  };

  return <>
    <button ref={launcher} type="button" disabled={props.disabled} onClick={prepare}>
      {props.scope === "artwork" ? "Иконки в MONO…" : "В рабочий пресет MONO…"}
    </button>
    {open && <dialog ref={dialog} className={styles.dialog} aria-label="Применить материал в MONO"
      onCancel={event => { event.preventDefault(); changeOpen(false); }}>
      <h2>Применить в MONO</h2>
      <p>Перенос: <strong>{patchLabel(patch)}</strong>. Проба мастерской останется отдельной.</p>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      {success ? <>
        <p role="status">Применено в пресет {success.slot} · {success.name}.</p>
        <a href={`/mono?slot=${success.slot}`}
          onClick={event => {
            if (event.button === 0 && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey)
              props.onNavigateToMono?.();
          }}>Открыть MONO</a>
      </> : patch && <>
        {library ? <label htmlFor={`${id}-target`}>Пресет 1–7
          <select id={`${id}-target`} value={slot} onChange={event => {
            const chosen = Number(event.currentTarget.value);
            setSlot(MONO_SEVEN_SLOTS.includes(chosen as MonoSevenSlot) ? chosen as MonoSevenSlot : "");
          }}>
            <option value="">Выберите номер</option>
            {library.slots.map(record => <option key={record.slot} value={record.slot}>
              {record.slot} · {record.name}</option>)}
          </select>
        </label> : <p>Сначала <a href="/mono">откройте MONO</a>, чтобы восстановить семь пресетов, затем вернитесь сюда.</p>}
        {library && <button type="button" disabled={saving || !slot}
          onClick={() => { void confirm(); }}>Применить в MONO</button>}
      </>}
      <button type="button" disabled={saving} onClick={() => changeOpen(false)}>Закрыть</button>
    </dialog>}
  </>;
}
