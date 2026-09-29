import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { previewMonoWorkingImport, type MonoSevenSlot, type MonoWorkingImport } from "./mono-working-presets";
import type { MonoShapePreset } from "./mono-shape-preview";

export type MonoWorkingPresetChoice = { slot: MonoSevenSlot; name: string };
export type MonoWorkingArchiveChoice = { index: number; name: string; direction: MonoShapePreset };

type Props = {
  activeSlot: MonoSevenSlot;
  choices: MonoWorkingPresetChoice[];
  archive: MonoWorkingArchiveChoice[];
  ready: boolean;
  status: string;
  onSelect: (slot: MonoSevenSlot) => boolean;
  onRename: (name: string) => boolean;
  onCopy: (target: MonoSevenSlot) => boolean;
  onImport: (imported: MonoWorkingImport, target: MonoSevenSlot) => boolean;
  onRestore: (archiveIndex: number, target: MonoSevenSlot, direction: MonoShapePreset) => boolean;
  onExport: () => string;
  onExportArchive: (archiveIndex: number) => string;
  onOpenPaletteArchive: () => void;
  onRetry: () => boolean;
  portableShare?: ReactNode;
};

const NUMBERS = [1, 2, 3, 4, 5, 6, 7] as const;
const DIRECTIONS: readonly { id: MonoShapePreset; name: string }[] = [
  { id: "ledger", name: "Ledger" }, { id: "frost", name: "Frost" }, { id: "mercury", name: "Mercury" },
];

export function MonoWorkingPresetBar({ activeSlot, choices, archive, ready, status,
  onSelect, onRename, onCopy, onImport, onRestore, onExport, onExportArchive,
  onOpenPaletteArchive, onRetry, portableShare }: Props) {
  const [actionsOpen, setActionsOpen] = useState(false);
  const [action, setAction] = useState<"rename" | "copy" | "import" | "export" | "archive" | "portable" | null>(null);
  const [name, setName] = useState("");
  const [target, setTarget] = useState<MonoSevenSlot | "">("");
  const [importJson, setImportJson] = useState("");
  const [importPreview, setImportPreview] = useState<MonoWorkingImport | null>(null);
  const [importError, setImportError] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const [exportJson, setExportJson] = useState("");
  const [archiveIndex, setArchiveIndex] = useState<number | null>(null);
  const [direction, setDirection] = useState<MonoShapePreset>("ledger");
  const actionsRef = useRef<HTMLButtonElement>(null);
  const importEpoch = useRef(0);
  const activeName = choices.find(choice => choice.slot === activeSlot)?.name ?? `Пресет ${activeSlot}`;
  const statusError = status.includes("Не удалось") || status.includes("Изменён в другой вкладке") ||
    status.includes("нельзя прочитать") || status.includes("нельзя перенести") || status.includes("Сначала примените");

  function invalidateImport() {
    importEpoch.current += 1;
    setImportPreview(null);
    setImportBusy(false);
  }
  function closeActions() {
    invalidateImport();
    setActionsOpen(false); setAction(null);
    actionsRef.current?.focus();
  }
  function escape(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Escape" || !actionsOpen) return;
    event.preventDefault(); event.stopPropagation(); closeActions();
  }
  function pickAction(next: NonNullable<typeof action>) {
    invalidateImport();
    setAction(next); setTarget("");
    if (next === "rename") setName(activeName);
    if (next === "import") { setImportJson(""); setImportPreview(null); setImportError(""); }
    if (next === "export") setExportJson(onExport());
    if (next === "archive") setArchiveIndex(null);
  }
  function chooseArchive(index: number) {
    setArchiveIndex(index); setDirection(archive[index]?.direction ?? "ledger");
    setTarget(""); setExportJson("");
  }
  function download(json: string, filename: string) {
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url);
  }
  const targetPicker = (label: string, excludeActive = false) => <label>{label}
    <select value={target} onChange={event => setTarget(event.currentTarget.value ? Number(event.currentTarget.value) as MonoSevenSlot : "")}>
      <option value="">Выберите номер</option>
      {NUMBERS.filter(number => !excludeActive || number !== activeSlot).map(number =>
        <option key={number} value={number}>{number} · {choices[number - 1]?.name ?? `Пресет ${number}`}</option>)}
    </select>
  </label>;

  return <div className="mono-working-preset" onKeyDown={escape}>
    <div className="mono-working-preset__row">
      <div className="mono-working-preset__current"><span>ПРЕСЕТ · {activeSlot}</span><strong title={activeName}>{activeName}</strong></div>
      <button ref={actionsRef} type="button" className="mono-working-preset__actions-trigger"
        disabled={!ready} aria-label="Действия с пресетом" aria-controls="mono-working-preset-actions"
        aria-expanded={actionsOpen} onClick={() => { invalidateImport(); setActionsOpen(value => !value); setAction(null); }}>⋯</button>
    </div>
    <div className="mono-working-preset__numbers" role="group" aria-label="Пресеты 1–7">
      {choices.map(choice => <button key={choice.slot} type="button"
        aria-label={`Пресет ${choice.slot}: ${choice.name}`} title={`${choice.slot} · ${choice.name}`}
        aria-pressed={choice.slot === activeSlot} disabled={!ready}
        onClick={() => onSelect(choice.slot)}>{choice.slot}</button>)}
    </div>
    <p className="mono-working-preset__status" data-working-status={statusError ? "error" : "normal"}
      role={statusError ? "alert" : undefined}>{status}</p>
    {status.endsWith(" · Повторить") && <button type="button" className="mono-working-preset__retry"
      onClick={onRetry}>Повторить сохранение</button>}
    <div id="mono-working-preset-actions" className="mono-working-preset__panel" hidden={!actionsOpen}
      role="group" aria-label="Действия с текущим пресетом">
      {action === null && <>
        <button type="button" onClick={() => pickAction("rename")}>Переименовать пресет {activeSlot}</button>
        <button type="button" onClick={() => pickAction("copy")}>Копировать в другой пресет…</button>
        <button type="button" onClick={() => pickAction("import")}>Импортировать в пресет…</button>
        <button type="button" onClick={() => pickAction("export")}>Экспортировать пресет {activeSlot}</button>
        {portableShare && <button type="button" onClick={() => pickAction("portable")}>Переносимая ссылка…</button>}
        <button type="button" onClick={() => pickAction("archive")}>Архив рабочих пресетов · {archive.length}</button>
        <button type="button" onClick={() => { onOpenPaletteArchive(); closeActions(); }}>Архив палитр и сервер</button>
      </>}
      {action === "rename" && <form onSubmit={event => {
        event.preventDefault(); if (onRename(name.trim())) closeActions();
      }}><label>Новое имя<input autoFocus maxLength={80} value={name} onChange={event => setName(event.currentTarget.value)} /></label>
        <button type="submit" disabled={!name.trim()}>Сохранить название</button></form>}
      {action === "copy" && <div className="mono-working-preset__subpanel">
        <p>Копия принятого пресета {activeSlot}. Прежнее содержимое выбранного пресета попадёт в архив.</p>
        {targetPicker("Пресет для копии", true)}
        <button type="button" disabled={target === ""} onClick={() => {
          if (target && onCopy(target)) closeActions();
        }}>Заменить выбранный пресет</button>
      </div>}
      {action === "import" && <div className="mono-working-preset__subpanel">
        <label>JSON для импорта<textarea aria-label="JSON для импорта" maxLength={2_000_000}
          value={importJson} onChange={event => { invalidateImport(); setImportJson(event.currentTarget.value); setImportError(""); }} /></label>
        <label>Файл JSON<input type="file" accept=".json,application/json" onChange={event => {
          const file = event.currentTarget.files?.[0];
          if (!file) return;
          invalidateImport();
          if (file.size > 2_000_000) { setImportError("Импорт слишком велик."); setImportPreview(null); return; }
          const request = importEpoch.current;
          setImportBusy(true);
          void file.text().then(value => {
            if (request !== importEpoch.current) return;
            setImportJson(value); setImportPreview(null); setImportError("");
          }).catch(() => { if (request === importEpoch.current) setImportError("Не удалось прочитать файл."); })
            .finally(() => { if (request === importEpoch.current) setImportBusy(false); });
        }} /></label>
        <button type="button" disabled={!importJson.trim() || importBusy} onClick={() => {
          const request = ++importEpoch.current;
          const text = importJson;
          setImportBusy(true); setImportError(""); setImportPreview(null);
          void previewMonoWorkingImport(text).then(value => {
            if (request === importEpoch.current) setImportPreview(value);
          }).catch(error => {
            if (request === importEpoch.current) setImportError(error instanceof Error ? error.message : "Импорт отклонён.");
          }).finally(() => { if (request === importEpoch.current) setImportBusy(false); });
        }}>Проверить импорт</button>
        {importError && <p role="alert">{importError}</p>}
        {importPreview && <>
          <p>Проверено: {importPreview.name}. Заменяемый пресет будет сохранён в архиве.</p>
          {targetPicker("Пресет для импорта")}
          <button type="button" disabled={target === ""} onClick={() => {
            if (target && onImport(importPreview, target)) closeActions();
          }}>Импортировать в выбранный пресет</button>
        </>}
      </div>}
      {action === "export" && <div className="mono-working-preset__subpanel">
        <label>JSON пресета<textarea aria-label="JSON рабочего пресета" readOnly value={exportJson}
          onFocus={event => event.currentTarget.select()} /></label>
        <button type="button" onClick={() => download(exportJson, `mono-workspace-${activeSlot}.json`)}>Скачать JSON</button>
      </div>}
      {action === "portable" && portableShare && <div className="mono-working-preset__subpanel">{portableShare}</div>}
      {action === "archive" && <div className="mono-working-preset__subpanel">
        <p>Исходные записи сохранены полностью. Совпадающие имена не объединены.</p>
        <div className="mono-working-preset__archive-list" role="group" aria-label="Архив рабочих пресетов">
          {archive.map(item => <button key={item.index} type="button" aria-label={`Архив ${item.index + 1}: ${item.name}`}
            aria-pressed={archiveIndex === item.index} onClick={() => chooseArchive(item.index)}>
            {item.index + 1} · {item.name}</button>)}
        </div>
        {archiveIndex !== null && <>
          <label>Направление из старой записи<select value={direction}
            onChange={event => setDirection(event.currentTarget.value as MonoShapePreset)}>
            {DIRECTIONS.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select></label>
          {targetPicker("Восстановить в пресет")}
          <button type="button" disabled={target === ""} onClick={() => {
            if (target && onRestore(archiveIndex, target, direction)) closeActions();
          }}>Восстановить выбранное направление</button>
          <button type="button" onClick={() => setExportJson(onExportArchive(archiveIndex))}>Показать полный архивный JSON</button>
          {exportJson && <label>Архивный JSON<textarea aria-label="Архивный JSON" readOnly value={exportJson}
            onFocus={event => event.currentTarget.select()} /></label>}
        </>}
      </div>}
      {action !== null && <button type="button" onClick={() => { invalidateImport(); setAction(null); }}>Назад к действиям</button>}
    </div>
  </div>;
}
