"use client";

import { useEffect, useId, useRef, type ChangeEvent } from "react";
import type { ThemeConfig } from "@wallet/core";

import { useTheme } from "./theme-provider";
import "./theme-studio.css";

const COLOR_FIELDS: Array<{ key: keyof Pick<ThemeConfig, "background" | "surface" | "accent" | "glassTint">; label: string }> =
  [
    { key: "background", label: "Фон" },
    { key: "surface", label: "Поверхность" },
    { key: "accent", label: "Акцент" },
    { key: "glassTint", label: "Оттенок стекла" },
  ];

const SLIDER_FIELDS: Array<{
  key: keyof Pick<
    ThemeConfig,
    | "radius"
    | "density"
    | "glassOpacity"
    | "glassBlur"
    | "highlightIntensity"
    | "refractionIntensity"
    | "motionIntensity"
  >;
  label: string;
  min: number;
  max: number;
  step: number;
}> = [
  { key: "radius", label: "Скругление", min: 12, max: 32, step: 1 },
  { key: "density", label: "Плотность", min: 0.85, max: 1.15, step: 0.01 },
  { key: "glassOpacity", label: "Прозрачность стекла", min: 0.12, max: 0.4, step: 0.01 },
  { key: "glassBlur", label: "Размытие стекла", min: 8, max: 28, step: 1 },
  { key: "highlightIntensity", label: "Интенсивность блика", min: 0, max: 1, step: 0.01 },
  { key: "refractionIntensity", label: "Интенсивность рефракции", min: 0, max: 1, step: 0.01 },
  { key: "motionIntensity", label: "Интенсивность движения", min: 0, max: 1, step: 0.01 },
];

export function ThemeStudio(props: { open: boolean; onClose(): void }) {
  const { open, onClose } = props;
  const { theme, setTheme, resetTheme } = useTheme();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const first = panelRef.current?.querySelector<HTMLElement>("button, input, [href], select, textarea, [tabindex]:not([tabindex='-1'])");
    first?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const nodes = getFocusable(panelRef.current);
      if (nodes.length === 0) {
        return;
      }

      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previousFocus.current?.focus();
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div
      ref={panelRef}
      className="theme-studio"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="theme-studio__header">
        <h2 id={titleId}>Студия темы</h2>
        <button type="button" onClick={onClose}>
          Закрыть
        </button>
      </div>

      <div className="theme-studio__fields">
        {COLOR_FIELDS.map((field) => (
          <label key={field.key} className="theme-studio__field">
            <span>{field.label}</span>
            <input
              type="color"
              aria-label={field.label}
              value={toColorInputValue(String(theme[field.key]))}
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                setTheme({ [field.key]: event.target.value } as Partial<ThemeConfig>);
              }}
            />
            <span className="theme-studio__value">{theme[field.key]}</span>
          </label>
        ))}

        {SLIDER_FIELDS.map((field) => (
          <label key={field.key} className="theme-studio__field">
            <span>{field.label}</span>
            <input
              type="range"
              aria-label={field.label}
              min={field.min}
              max={field.max}
              step={field.step}
              value={Number(theme[field.key])}
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                const next = Number(event.target.value);
                const clamped = Math.min(field.max, Math.max(field.min, next));
                setTheme({ [field.key]: clamped } as Partial<ThemeConfig>);
              }}
            />
            <span className="theme-studio__value">{theme[field.key]}</span>
          </label>
        ))}
      </div>

      <button type="button" onClick={resetTheme}>
        Сбросить тему
      </button>
    </div>
  );
}

function getFocusable(root: HTMLElement | null): HTMLElement[] {
  if (!root) {
    return [];
  }

  return [...root.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )].filter((element) => element.getAttribute("aria-hidden") !== "true");
}

function toColorInputValue(hex: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(hex) ? hex.toLowerCase() : "#000000";
}
