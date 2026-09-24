import { useRef, useState, type KeyboardEvent } from "react";
import { previewMonoWorkingImport, type MonoWorkingImport } from "./mono-working-presets";

export type MonoWorkingPresetChoice = { id: string; name: string; legacyPalette: boolean };

export function MonoWorkingPresetBar({ activeName, activeId, choices, ready, status, onExport, onImport, onOpenArchive, onSelect, onCreate, onCopy, onRename, onRetry }: {
  activeName: string;
  activeId: string | null;
  choices: MonoWorkingPresetChoice[];
  ready: boolean;
  status: string;
  onExport: () => string;
  onImport: (imported: MonoWorkingImport) => boolean;
  onOpenArchive: () => void;
  onSelect: (id: string) => boolean;
  onCreate: (name: string) => boolean;
  onCopy: (name: string) => boolean;
  onRename: (name: string) => boolean;
  onRetry: () => boolean;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [actionsOpen, setActionsOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportJson, setExportJson] = useState("");
  const [exportMessage, setExportMessage] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [importJson, setImportJson] = useState("");
  const [importPreview, setImportPreview] = useState<MonoWorkingImport | null>(null);
  const [importError, setImportError] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const [copyName, setCopyName] = useState("");
  const statusError = status.includes("Не удалось") || status.includes("Изменён в другой вкладке") ||
    status.includes("нельзя прочитать") || status.includes("нельзя перенести") || status.includes("Сначала примените");
  const pickerRef = useRef<HTMLButtonElement>(null);
  const actionsRef = useRef<HTMLButtonElement>(null);

  const escape = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Escape" || (!pickerOpen && !actionsOpen && !copyOpen && !renameOpen && !exportOpen && !importOpen)) return;
    event.preventDefault();
    event.stopPropagation();
    if (copyOpen || actionsOpen || importOpen) {
      setCopyOpen(false);
      setRenameOpen(false);
      setExportOpen(false);
      setImportOpen(false);
      setActionsOpen(false);
      actionsRef.current?.focus();
    } else {
      setCreateOpen(false);
      setPickerOpen(false);
      pickerRef.current?.focus();
    }
  };

  return <div className="mono-working-preset" onKeyDown={escape}>
    <div className="mono-working-preset__row">
      <button ref={pickerRef} type="button" className="mono-working-preset__selector"
        disabled={!ready}
        aria-label={`Пресет оформления: ${activeName}`} aria-controls="mono-working-preset-choices"
        aria-expanded={pickerOpen} onClick={() => { setPickerOpen(!pickerOpen); setCreateOpen(false); setActionsOpen(false); setCopyOpen(false); setRenameOpen(false); setExportOpen(false); setImportOpen(false); }}>
        <span className="mono-working-preset__caption">Пресет оформления</span>
        <strong title={activeName}>{activeName}</strong><span aria-hidden="true">⌄</span>
      </button>
      <button ref={actionsRef} type="button" className="mono-working-preset__actions-trigger"
        disabled={!ready}
        aria-label="Действия с пресетом" aria-controls="mono-working-preset-actions"
        aria-expanded={actionsOpen} onClick={() => { setActionsOpen(!actionsOpen); setPickerOpen(false); setCreateOpen(false); setCopyOpen(false); setRenameOpen(false); setExportOpen(false); setImportOpen(false); }}>⋯</button>
    </div>
    <p className="mono-working-preset__status" data-working-status={statusError ? "error" : "normal"}
      role={statusError ? "alert" : undefined}>{status}</p>
    {status.endsWith(" · Повторить") && activeId && <button type="button" className="mono-working-preset__retry"
      onClick={onRetry}>Повторить сохранение</button>}
    <div id="mono-working-preset-choices" className="mono-working-preset__panel" hidden={!pickerOpen}
      role="group" aria-label="Пресеты">
      {choices.map(choice => <button key={choice.id} type="button" aria-label={`Выбрать ${choice.name}`}
        aria-pressed={choice.id === activeId} onClick={() => { if (onSelect(choice.id)) setPickerOpen(false); }}>
        <span aria-hidden="true">{choice.id === activeId ? "✓" : ""}</span>
        <span>{choice.name}{choice.legacyPalette && <small> · палитра</small>}</span>
      </button>)}
      {!createOpen ? <button type="button" onClick={() => { setCreateName(""); setCreateOpen(true); }}>Создать пресет</button>
        : <form onSubmit={event => {
          event.preventDefault();
          if (onCreate(createName.trim())) { setCreateOpen(false); setPickerOpen(false); }
        }}>
          <label>Название пресета<input autoFocus maxLength={80} value={createName}
            onChange={event => setCreateName(event.currentTarget.value)} /></label>
          <button type="submit" disabled={!createName.trim()}>Сохранить пресет</button>
        </form>}
    </div>
    <div id="mono-working-preset-actions" className="mono-working-preset__panel" hidden={!actionsOpen}
      role="group" aria-label="Действия с текущим пресетом">
      {!copyOpen && !renameOpen && !exportOpen && !importOpen && <>
        {activeId && <button type="button" onClick={() => { setCopyName(activeName); setRenameOpen(true); }}>Переименовать</button>}
        <button type="button" onClick={() => { setCopyName(`${activeName} · копия`); setCopyOpen(true); }}>Создать копию</button>
        <button type="button" onClick={() => { setImportJson(""); setImportPreview(null); setImportError(""); setImportOpen(true); }}>Импортировать</button>
        <button type="button" onClick={() => { setExportJson(onExport()); setExportMessage(""); setExportOpen(true); }}>Экспортировать</button>
        <button type="button" onClick={() => { onOpenArchive(); setActionsOpen(false); }}>Архив палитр и сервер</button>
      </>}
      {(copyOpen || renameOpen) && <form onSubmit={event => {
        event.preventDefault();
        if (renameOpen ? onRename(copyName.trim()) : onCopy(copyName.trim())) {
          setCopyOpen(false); setRenameOpen(false); setActionsOpen(false);
        }
      }}>
        <label>Название пресета<input autoFocus maxLength={80} value={copyName}
          onChange={event => setCopyName(event.currentTarget.value)} /></label>
        <button type="submit" disabled={!copyName.trim()}>{renameOpen ? "Сохранить название" : "Сохранить копию"}</button>
      </form>}
      {exportOpen && <div className="mono-working-preset__export">
        <label>JSON рабочего пресета<textarea aria-label="JSON рабочего пресета" readOnly value={exportJson}
          onFocus={event => event.currentTarget.select()} /></label>
        <button type="button" onClick={() => {
          if (!navigator.clipboard?.writeText) {
            setExportMessage("Копирование недоступно. Используйте скачивание или выделите текст.");
            return;
          }
          void navigator.clipboard.writeText(exportJson).then(() => setExportMessage("JSON скопирован."))
            .catch(() => setExportMessage("Не удалось скопировать. Используйте скачивание или выделите текст."));
        }}>Скопировать JSON</button>
        <button type="button" onClick={() => {
          const url = URL.createObjectURL(new Blob([exportJson], { type: "application/json" }));
          const link = document.createElement("a");
          link.href = url; link.download = "mono-working-preset.json"; link.click();
          URL.revokeObjectURL(url);
          setExportMessage("JSON-файл подготовлен для скачивания.");
        }}>Скачать JSON</button>
        {exportMessage && <p role="status">{exportMessage}</p>}
        <button type="button" onClick={() => setExportOpen(false)}>Закрыть экспорт</button>
      </div>}
      {importOpen && <div className="mono-working-preset__import">
        <label>JSON для импорта<textarea aria-label="JSON для импорта" maxLength={2_000_000}
          value={importJson} onChange={event => { setImportJson(event.currentTarget.value); setImportPreview(null); setImportError(""); }} /></label>
        <label>Файл JSON<input type="file" accept=".json,application/json" onChange={event => {
          const file = event.currentTarget.files?.[0];
          if (!file) return;
          if (file.size > 2_000_000) { setImportError("Импорт слишком велик."); setImportPreview(null); return; }
          void file.text().then(value => { setImportJson(value); setImportPreview(null); setImportError(""); })
            .catch(() => setImportError("Не удалось прочитать файл."));
        }} /></label>
        <button type="button" disabled={!importJson.trim() || importBusy} onClick={() => {
          setImportBusy(true); setImportError(""); setImportPreview(null);
          void previewMonoWorkingImport(importJson).then(setImportPreview)
            .catch(error => setImportError(error instanceof Error ? error.message : "Импорт отклонён."))
            .finally(() => setImportBusy(false));
        }}>Проверить импорт</button>
        {importError && <p role="alert">{importError}</p>}
        {importPreview && <div role="region" aria-label="Предпросмотр импорта">
          <p>{importPreview.kind === "full"
            ? `Будет создана отдельная копия полного рабочего пресета «${importPreview.name}».`
            : "Будет создана отдельная копия палитры. Форма, оптика и фон — исходные MONO defaults; другие настройки старый JSON не содержит."}</p>
          <button type="button" onClick={() => { if (onImport(importPreview)) { setImportOpen(false); setActionsOpen(false); } }}>
            Создать копию из импорта
          </button>
        </div>}
      </div>}
    </div>
  </div>;
}
