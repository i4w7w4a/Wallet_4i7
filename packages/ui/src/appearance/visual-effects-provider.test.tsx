import "@testing-library/jest-dom/vitest";

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_VISUAL_EFFECTS,
  type PreferenceStorage,
  type VisualEffectsConfig,
} from "@wallet/core";

import {
  VISUAL_EFFECTS_STORAGE_KEY,
  VisualEffectsProvider,
  useVisualEffects,
} from "./visual-effects-provider";

const THEME_STORAGE_KEY = "wallet4i7.theme.v1";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("VisualEffectsProvider", () => {
  it("использует defaults без записи при пустом storage", () => {
    const storage = createMemoryStorage();

    renderProvider(storage);

    expect(screen.getByLabelText("Скорость")).toHaveTextContent("0.75");
    expect(storage.getItem(VISUAL_EFFECTS_STORAGE_KEY)).toBeNull();
    expect(
      screen.queryByText("Эффекты сброшены: сохранённые настройки повреждены"),
    ).not.toBeInTheDocument();
  });

  it("восстанавливает валидную visual-конфигурацию", () => {
    const saved = { ...DEFAULT_VISUAL_EFFECTS, speed: 1.5, threadCount: 4 };
    const storage = createMemoryStorage({
      [VISUAL_EFFECTS_STORAGE_KEY]: JSON.stringify(saved),
    });

    renderProvider(storage);

    expect(screen.getByLabelText("Скорость")).toHaveTextContent("1.5");
    expect(screen.getByLabelText("Количество нитей")).toHaveTextContent("4");
    expect(
      screen.queryByText("Эффекты сброшены: сохранённые настройки повреждены"),
    ).not.toBeInTheDocument();
  });

  it("нормализует live update и сохраняет его по одному animation frame", () => {
    vi.useFakeTimers();
    const storage = createMemoryStorage();

    renderProvider(storage);
    fireEvent.click(screen.getByRole("button", { name: "Ускорить" }));

    expect(screen.getByLabelText("Скорость")).toHaveTextContent("2.5");
    expect(storage.getItem(VISUAL_EFFECTS_STORAGE_KEY)).toBeNull();

    act(() => vi.runAllTimers());

    expect(readEffects(storage)).toMatchObject({ version: 1, speed: 2.5 });
  });

  it("resetEffects не изменяет сохранённую тему", () => {
    vi.useFakeTimers();
    const themeValue = JSON.stringify({ version: 1, accent: "#123456" });
    const storage = createMemoryStorage({
      [VISUAL_EFFECTS_STORAGE_KEY]: JSON.stringify({
        ...DEFAULT_VISUAL_EFFECTS,
        speed: 2,
      }),
      [THEME_STORAGE_KEY]: themeValue,
    });

    renderProvider(storage);
    fireEvent.click(screen.getByRole("button", { name: "Сбросить эффекты" }));
    act(() => vi.runAllTimers());

    expect(readEffects(storage)).toEqual(DEFAULT_VISUAL_EFFECTS);
    expect(storage.getItem(THEME_STORAGE_KEY)).toBe(themeValue);
  });

  it("восстанавливает повреждённый preset, уведомляет и сохраняет theme key", () => {
    vi.useFakeTimers();
    const themeValue = "theme-remains-untouched";
    const storage = createMemoryStorage({
      [VISUAL_EFFECTS_STORAGE_KEY]: "{broken-json",
      [THEME_STORAGE_KEY]: themeValue,
    });

    renderProvider(storage);

    expect(
      screen.getByText("Эффекты сброшены: сохранённые настройки повреждены"),
    ).toHaveAttribute("role", "status");
    expect(screen.getByLabelText("Скорость")).toHaveTextContent("0.75");

    act(() => vi.runAllTimers());

    expect(readEffects(storage)).toEqual(DEFAULT_VISUAL_EFFECTS);
    expect(storage.getItem(THEME_STORAGE_KEY)).toBe(themeValue);
  });

  it("отменяет ожидающую запись при unmount", () => {
    vi.useFakeTimers();
    const storage = createMemoryStorage();
    const view = renderProvider(storage);

    fireEvent.click(screen.getByRole("button", { name: "Ускорить" }));
    view.unmount();
    act(() => vi.runAllTimers());

    expect(storage.getItem(VISUAL_EFFECTS_STORAGE_KEY)).toBeNull();
  });

  it("отклоняет useVisualEffects вне provider", () => {
    expect(() => render(<Probe />)).toThrow(
      "useVisualEffects должен вызываться внутри VisualEffectsProvider",
    );
  });
});

function Probe() {
  const { effects, setEffects, resetEffects } = useVisualEffects();

  return (
    <>
      <output aria-label="Скорость">{effects.speed}</output>
      <output aria-label="Количество нитей">{effects.threadCount}</output>
      <button type="button" onClick={() => setEffects({ speed: 2.5 })}>
        Ускорить
      </button>
      <button type="button" onClick={resetEffects}>
        Сбросить эффекты
      </button>
    </>
  );
}

function renderProvider(storage: PreferenceStorage) {
  return render(
    <VisualEffectsProvider storage={storage}>
      <Probe />
    </VisualEffectsProvider>,
  );
}

function createMemoryStorage(initial: Record<string, string> = {}): PreferenceStorage {
  const values = new Map(Object.entries(initial));

  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

function readEffects(storage: PreferenceStorage): VisualEffectsConfig {
  return JSON.parse(String(storage.getItem(VISUAL_EFFECTS_STORAGE_KEY))) as VisualEffectsConfig;
}
