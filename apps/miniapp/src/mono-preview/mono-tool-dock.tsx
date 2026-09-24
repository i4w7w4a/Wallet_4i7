"use client";

import { MonoLabIconButton } from "./mono-lab-controls";
import { useId } from "react";
import "./mono-tool-dock.css";

export type MonoToolId = "balance" | "assets" | "chart" | "typography" | "color" | "shape" | "logo" | "environment" | "optics";

export const MONO_TOOL_LABELS: Record<MonoToolId, string> = {
  balance: "Баланс", assets: "Активы", chart: "График", typography: "Шрифты", color: "Цвет",
  shape: "Форма и кнопки", logo: "Логотип", environment: "Среда", optics: "Оптика",
};

const TOOLS: ReadonlyArray<{ id: MonoToolId; path: string }> = [
  { id: "balance", path: "M4 5h16v14H4zM4 9h16M8 14h3m4 0h1" },
  { id: "assets", path: "M4 5h4v4H4zM11 6h9M11 9h6M4 15h4v4H4zM11 16h9m-9 3h6" },
  { id: "chart", path: "M4 4v16h16M7 15l4-5 4 2 5-7" },
  { id: "typography", path: "M4 6h10M9 6v14M6 20h6M3 6v3m12-3v3m0 6h6m-3 0v7m-2 0h4" },
  { id: "color", path: "M12 3c3 5 7 9 7 12a7 7 0 0 1-14 0c0-3 4-7 7-12Zm-3 12a3 3 0 0 0 3 3" },
  { id: "shape", path: "M7 4h10a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3Z" },
  { id: "logo", path: "M5 20V4l14 16V4" },
  { id: "environment", path: "M3 17c4-6 7 6 11 0s5-3 7-1M3 9c4-6 7 6 11 0s5-3 7-1" },
  { id: "optics", path: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 0c4 5 4 13 0 18M3 12h18" },
];

export function MonoToolDock({ selected, onSelect, dirtyTools = [], unavailableTools = [] }: {
  selected: MonoToolId; onSelect: (tool: MonoToolId) => void;
  dirtyTools?: readonly MonoToolId[]; unavailableTools?: readonly MonoToolId[];
}) {
  const trialDescription = useId();
  return <div className="mono-tool-dock" role="toolbar" aria-label="Инструменты оформления">
    {dirtyTools.length > 0 && <span hidden id={trialDescription}>Есть неприменённая проба</span>}
    {TOOLS.map((tool, index) => <MonoLabIconButton key={tool.id} label={MONO_TOOL_LABELS[tool.id]}
      data-mono-tool={tool.id} data-dirty={dirtyTools.includes(tool.id) || undefined}
      aria-pressed={selected === tool.id} aria-controls="mono-active-inspector"
      aria-description={dirtyTools.includes(tool.id) ? "Есть неприменённая проба" : undefined}
      aria-describedby={dirtyTools.includes(tool.id) ? trialDescription : undefined}
      tabIndex={selected === tool.id ? 0 : -1} disabled={unavailableTools.includes(tool.id)}
      onClick={() => onSelect(tool.id)} onKeyDown={event => {
        const offsets: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -3, ArrowDown: 3 };
        if (!(event.key in offsets) && event.key !== "Home" && event.key !== "End") return;
        event.preventDefault();
        let next = event.key === "Home" ? 0 : event.key === "End" ? TOOLS.length - 1
          : (index + offsets[event.key] + TOOLS.length) % TOOLS.length;
        const direction = event.key === "End" || (offsets[event.key] ?? 1) < 0 ? -1 : 1;
        for (let visited = 0; unavailableTools.includes(TOOLS[next].id) && visited < TOOLS.length; visited++)
          next = (next + direction + TOOLS.length) % TOOLS.length;
        if (unavailableTools.includes(TOOLS[next].id)) return;
        onSelect(TOOLS[next].id);
        event.currentTarget.closest('[role="toolbar"]')
          ?.querySelector<HTMLButtonElement>(`[data-mono-tool="${TOOLS[next].id}"]`)?.focus();
      }}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round"><path d={tool.path} /></svg>
    </MonoLabIconButton>)}
  </div>;
}
