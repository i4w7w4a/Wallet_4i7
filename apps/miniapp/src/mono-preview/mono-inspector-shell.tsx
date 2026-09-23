import type { ReactNode } from "react";
import { MonoLabIconButton } from "./mono-lab-controls";
import { MONO_TOOL_LABELS, type MonoToolId } from "./mono-tool-dock";
import "./mono-inspector-shell.css";

const APPLY_LABELS: Partial<Record<MonoToolId, string>> = {
  shape: "Применить форму", optics: "Применить оптику",
};
const CANCEL_LABELS: Partial<Record<MonoToolId, string>> = {
  shape: "Отменить пробу формы", optics: "Отменить пробу оптики",
};

export function MonoInspectorShell({ tool, children, dirty = false, busy = false,
  onApply, onCancel, onClose, note }: {
  tool: MonoToolId; children: ReactNode; dirty?: boolean; busy?: boolean;
  onApply?: () => void; onCancel?: () => void; onClose?: () => void; note?: string;
}) {
  return <section id="mono-active-inspector" className="mono-inspector-shell"
    data-mono-inspector={tool} aria-labelledby="mono-active-inspector-title">
    <header className="mono-inspector-shell__head">
      <div><span>НАСТРОЙКА</span><h2 id="mono-active-inspector-title">{MONO_TOOL_LABELS[tool]}</h2></div>
      {onClose && <MonoLabIconButton label="К инструментам" onClick={onClose}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m14 5-7 7 7 7" /></svg>
      </MonoLabIconButton>}
    </header>
    <div className="mono-inspector-shell__body">{children}</div>
    {(note || onApply || onCancel) && <footer className="mono-inspector-shell__footer">
      <p role="status">{note ?? (busy ? "Подготовка…" : dirty ? "Проба · ещё не применена" : "Применено к пресету")}</p>
      {onApply && onCancel && <div>
        <button type="button" disabled={!dirty || busy} aria-label={CANCEL_LABELS[tool] ?? "Отменить пробу"}
          onClick={onCancel}>Отменить</button>
        <button type="button" disabled={!dirty || busy} aria-label={APPLY_LABELS[tool] ?? "Применить настройку"}
          className="mono-inspector-shell__apply" onClick={onApply}>Применить</button>
      </div>}
    </footer>}
  </section>;
}
