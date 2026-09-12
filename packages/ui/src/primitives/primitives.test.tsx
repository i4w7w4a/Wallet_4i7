import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PreferenceStorage } from "@wallet/core";

import { ThemeProvider } from "../theme/theme-provider";
import { ActionButton } from "./action-button";
import { BottomSheet } from "./bottom-sheet";
import { GlassSurface } from "./glass-surface";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

beforeEach(() => {
  stubMatchMedia({});
  stubCssSupports(true);
});

describe("GlassSurface", () => {
  it("имеет маркер варианта regular по умолчанию и clear по запросу", () => {
    const { rerender } = render(
      <ThemeProvider storage={createMemoryStorage()}>
        <GlassSurface>Навигация</GlassSurface>
      </ThemeProvider>,
    );

    expect(screen.getByText("Навигация").closest("[data-glass-variant]")).toHaveAttribute(
      "data-glass-variant",
      "regular",
    );

    rerender(
      <ThemeProvider storage={createMemoryStorage()}>
        <GlassSurface variant="clear">Поиск</GlassSurface>
      </ThemeProvider>,
    );

    expect(screen.getByText("Поиск").closest("[data-glass-variant]")).toHaveAttribute(
      "data-glass-variant",
      "clear",
    );
  });

  it("не вкладывает стеклянную поверхность в другую стеклянную поверхность", () => {
    render(
      <ThemeProvider storage={createMemoryStorage()}>
        <GlassSurface>
          внешняя
          <GlassSurface>внутренняя</GlassSurface>
        </GlassSurface>
      </ThemeProvider>,
    );

    const nested = screen.getByText("внутренняя").closest("[data-glass-nested]");
    expect(nested).toHaveAttribute("data-glass-nested", "true");
    expect(nested).not.toHaveAttribute("data-glass-variant");
  });

  it("переключается на контрастную поверхность без backdrop-filter", () => {
    stubCssSupports(false);

    render(
      <ThemeProvider storage={createMemoryStorage()}>
        <GlassSurface>Стекло</GlassSurface>
      </ThemeProvider>,
    );

    expect(screen.getByText("Стекло").closest("[data-glass-variant]")).toHaveAttribute(
      "data-backdrop",
      "unsupported",
    );
  });
});

describe("ActionButton", () => {
  it("вызывает callback один раз", () => {
    const onPress = vi.fn();

    render(
      <ThemeProvider storage={createMemoryStorage()}>
        <ActionButton onClick={onPress}>Отправить</ActionButton>
      </ThemeProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Отправить" }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("масштабирует press-состояние через motionIntensity и отключает сдвиг при reduced motion", () => {
    stubMatchMedia({ "(prefers-reduced-motion: reduce)": true });

    render(
      <ThemeProvider storage={createMemoryStorage()}>
        <ActionButton>Обменять</ActionButton>
      </ThemeProvider>,
    );

    expect(screen.getByRole("button", { name: "Обменять" })).toHaveAttribute("data-motion", "fade");
  });
});

describe("BottomSheet", () => {
  it("закрывается по Escape и возвращает фокус инициатору", async () => {
    function Harness() {
      const [open, setOpen] = useState(false);

      return (
        <ThemeProvider storage={createMemoryStorage()}>
          <button type="button" onClick={() => setOpen(true)}>
            Открыть панель
          </button>
          <BottomSheet open={open} title="Получить" onClose={() => setOpen(false)}>
            Демонстрационный QR
          </BottomSheet>
        </ThemeProvider>
      );
    }

    render(<Harness />);

    const opener = screen.getByRole("button", { name: "Открыть панель" });
    opener.focus();
    fireEvent.click(opener);

    const dialog = screen.getByRole("dialog", { name: "Получить" });
    expect(dialog).toBeVisible();
    expect(dialog.contains(document.activeElement)).toBe(true);

    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Получить" })).not.toBeInTheDocument();
    });
    expect(opener).toHaveFocus();
  });

  it("удерживает фокус внутри открытой панели", () => {
    render(
      <ThemeProvider storage={createMemoryStorage()}>
        <button type="button">Снаружи</button>
        <BottomSheet open title="Панель" onClose={() => undefined}>
          <button type="button">Первая</button>
          <button type="button">Вторая</button>
        </BottomSheet>
      </ThemeProvider>,
    );

    const dialog = screen.getByRole("dialog", { name: "Панель" });
    const close = screen.getByRole("button", { name: "Закрыть" });
    const first = screen.getByRole("button", { name: "Первая" });
    const second = screen.getByRole("button", { name: "Вторая" });

    second.focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(close).toHaveFocus();

    close.focus();
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(second).toHaveFocus();

    expect(first).toBeVisible();
  });

  it("заменяет появление панели на fade при reduced motion", () => {
    stubMatchMedia({ "(prefers-reduced-motion: reduce)": true });

    render(
      <ThemeProvider storage={createMemoryStorage()}>
        <BottomSheet open title="Купить" onClose={() => undefined}>
          форма
        </BottomSheet>
      </ThemeProvider>,
    );

    expect(screen.getByRole("dialog", { name: "Купить" })).toHaveAttribute("data-motion", "fade");
  });
});

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

function stubMatchMedia(matches: Record<string, boolean>) {
  window.matchMedia = (query: string) =>
    ({
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
    }) as MediaQueryList;
}

function stubCssSupports(supported: boolean) {
  Object.defineProperty(window.CSS, "supports", {
    configurable: true,
    writable: true,
    value: () => supported,
  });
}
