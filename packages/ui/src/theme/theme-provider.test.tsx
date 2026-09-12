import "@testing-library/jest-dom/vitest";

import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PreferenceStorage } from "@wallet/core";
import { DEFAULT_THEME } from "@wallet/core";

import { ThemeProvider, useTheme } from "./theme-provider";
import { ThemeStudio } from "./theme-studio";

const STORAGE_KEY = "wallet4i7.theme.v1";
const NEXT_ACCENT = "#ff00aa";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

beforeEach(() => {
  stubMatchMedia({});
});

describe("ThemeProvider", () => {
  it("обновляет --color-accent и сохраняет ThemeConfig с version 1", async () => {
    const storage = createMemoryStorage();

    render(
      <ThemeProvider storage={storage}>
        <ThemeControls />
      </ThemeProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Сменить акцент" }));

    expect(themeRoot().style.getPropertyValue("--color-accent")).toBe(NEXT_ACCENT);
    expect(storage.getItem(STORAGE_KEY)).toBeNull();

    await flushAnimationFrame();

    const saved = JSON.parse(String(storage.getItem(STORAGE_KEY))) as {
      version: number;
      accent: string;
    };
    expect(saved.version).toBe(1);
    expect(saved.accent).toBe(NEXT_ACCENT);
  });

  it("сбрасывает повреждённый JSON к безопасной теме и уведомляет один раз", async () => {
    const storage = createMemoryStorage({ [STORAGE_KEY]: "{broken-json" });

    render(
      <ThemeProvider storage={storage}>
        <ThemeControls />
      </ThemeProvider>,
    );

    expect(themeRoot().style.getPropertyValue("--color-accent")).toBe(DEFAULT_THEME.accent);
    expect(screen.getByRole("status")).toHaveTextContent("Тема сброшена: сохранённые настройки повреждены");

    await flushAnimationFrame();
    expect(JSON.parse(String(storage.getItem(STORAGE_KEY)))).toMatchObject({
      version: 1,
      accent: DEFAULT_THEME.accent,
    });
  });

  it("resetTheme возвращает стандартную тему", async () => {
    const storage = createMemoryStorage();

    render(
      <ThemeProvider storage={storage}>
        <ThemeControls />
      </ThemeProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Сменить акцент" }));
    fireEvent.click(screen.getByRole("button", { name: "Сбросить тему" }));

    expect(themeRoot().style.getPropertyValue("--color-accent")).toBe(DEFAULT_THEME.accent);
    await flushAnimationFrame();
    expect(JSON.parse(String(storage.getItem(STORAGE_KEY))).accent).toBe(DEFAULT_THEME.accent);
  });

  it("применяет четыре базовых цвета как CSS custom properties", () => {
    const storage = createMemoryStorage();

    render(
      <ThemeProvider storage={storage}>
        <ThemeControls />
      </ThemeProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Сменить четыре цвета" }));

    const root = themeRoot();
    expect(root.style.getPropertyValue("--color-background")).toBe("#101820");
    expect(root.style.getPropertyValue("--color-surface")).toBe("#182430");
    expect(root.style.getPropertyValue("--color-accent")).toBe("#123abc");
    expect(root.style.getPropertyValue("--color-glass-tint").toLowerCase()).toBe("#89abcd");
  });

  it("выставляет data-атрибуты reduced motion и повышенного контраста", () => {
    stubMatchMedia({
      "(prefers-reduced-motion: reduce)": true,
      "(prefers-contrast: more)": true,
      "(prefers-reduced-transparency: reduce)": true,
    });

    render(
      <ThemeProvider storage={createMemoryStorage()}>
        <span>контент</span>
      </ThemeProvider>,
    );

    const root = themeRoot();
    expect(root).toHaveAttribute("data-reduced-motion", "reduce");
    expect(root).toHaveAttribute("data-contrast", "more");
    expect(root).toHaveAttribute("data-reduced-transparency", "reduce");
  });
});

describe("Theme Studio", () => {
  it("ограничивает значения бегунков утверждёнными диапазонами", () => {
    render(
      <ThemeProvider storage={createMemoryStorage()}>
        <ThemeStudio open onClose={() => undefined} />
      </ThemeProvider>,
    );

    const studio = screen.getByRole("dialog", { name: "Студия темы" });

    expectSliderRange(studio, "Скругление", "12", "32");
    expectSliderRange(studio, "Плотность", "0.85", "1.15");
    expectSliderRange(studio, "Прозрачность стекла", "0.12", "0.4");
    expectSliderRange(studio, "Размытие стекла", "8", "28");
    expectSliderRange(studio, "Интенсивность блика", "0", "1");
    expectSliderRange(studio, "Интенсивность рефракции", "0", "1");
    expectSliderRange(studio, "Интенсивность движения", "0", "1");

    const radius = within(studio).getByRole("slider", { name: "Скругление" });
    fireEvent.change(radius, { target: { value: "48" } });
    expect(radius).toHaveValue(String(32));
    expect(within(studio).getByText("32")).toBeVisible();
  });

  it("не объявляет движение бегунка в live region", () => {
    render(
      <ThemeProvider storage={createMemoryStorage()}>
        <ThemeStudio open onClose={() => undefined} />
      </ThemeProvider>,
    );

    fireEvent.change(screen.getByRole("slider", { name: "Скругление" }), {
      target: { value: "24" },
    });

    expect(screen.queryByText("Тема сброшена: сохранённые настройки повреждены")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("возвращает фокус инициатору после закрытия", () => {
    function Harness() {
      const [open, setOpen] = useState(false);

      return (
        <ThemeProvider storage={createMemoryStorage()}>
          <button type="button" onClick={() => setOpen(true)}>
            Открыть тему
          </button>
          <ThemeStudio open={open} onClose={() => setOpen(false)} />
        </ThemeProvider>
      );
    }

    render(<Harness />);

    const opener = screen.getByRole("button", { name: "Открыть тему" });
    opener.focus();
    fireEvent.click(opener);
    expect(screen.getByRole("dialog", { name: "Студия темы" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Закрыть" }));
    expect(screen.queryByRole("dialog", { name: "Студия темы" })).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });
});

function ThemeControls() {
  const { setTheme, resetTheme } = useTheme();

  return (
    <>
      <button type="button" onClick={() => setTheme({ accent: NEXT_ACCENT })}>
        Сменить акцент
      </button>
      <button
        type="button"
        onClick={() =>
          setTheme({
            background: "#101820",
            surface: "#182430",
            accent: "#123abc",
            glassTint: "#89ABCD",
          })
        }
      >
        Сменить четыре цвета
      </button>
      <button type="button" onClick={() => resetTheme()}>
        Сбросить тему
      </button>
    </>
  );
}

function themeRoot(): HTMLElement {
  const root = document.querySelector("[data-theme-root]");
  if (!(root instanceof HTMLElement)) {
    throw new Error("корневой контейнер темы не найден");
  }
  return root;
}

function expectSliderRange(studio: HTMLElement, name: string, min: string, max: string) {
  const slider = within(studio).getByRole("slider", { name });
  expect(slider).toHaveAttribute("min", min);
  expect(slider).toHaveAttribute("max", max);
}

function createMemoryStorage(initial: Record<string, string> = {}): PreferenceStorage {
  const store = new Map(Object.entries(initial));

  return {
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
    removeItem(key: string) {
      store.delete(key);
    },
  };
}

async function flushAnimationFrame() {
  await act(async () => {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  });
}

function stubMatchMedia(matches: Record<string, boolean>) {
  window.matchMedia = (query: string) => {
    const mediaQuery: MediaQueryList = {
      matches: Boolean(matches[query]),
      media: query,
      onchange: null,
      addEventListener() {
        return undefined;
      },
      removeEventListener() {
        return undefined;
      },
      addListener() {
        return undefined;
      },
      removeListener() {
        return undefined;
      },
      dispatchEvent() {
        return false;
      },
    };

    return mediaQuery;
  };
}
