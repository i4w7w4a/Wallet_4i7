import "@testing-library/jest-dom/vitest";

import { readFileSync } from "node:fs";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { type PreferenceStorage } from "@wallet/core";

import { ThemeProvider } from "../theme/theme-provider";
import { BottomNavigation, type DashboardSection } from "./bottom-navigation";
import { DemoActionSheet } from "./demo-action-sheet";
import { QuickActions, type DashboardAction } from "./quick-actions";
import { SectionPlaceholder } from "./section-placeholder";

const ACTIONS = [
  ["send", "Отправить"],
  ["receive", "Получить"],
  ["swap", "Обменять"],
  ["buy", "Купить"],
] as const satisfies ReadonlyArray<readonly [DashboardAction, string]>;

const SECTIONS = [
  ["home", "Главная"],
  ["portfolio", "Портфель"],
  ["explore", "Обзор"],
  ["settings", "Настройки"],
] as const satisfies ReadonlyArray<readonly [DashboardSection, string]>;

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  stubMatchMedia();
  stubCssSupports(true);
});

describe("QuickActions", () => {
  it("показывает четыре ActionButton и передаёт точный DashboardAction", () => {
    const onAction = vi.fn();

    renderWithTheme(<QuickActions reducedMotion={false} onAction={onAction} />);

    const group = screen.getByRole("group", { name: "Быстрые действия" });
    for (const [action, label] of ACTIONS) {
      const button = screen.getByRole("button", { name: label });
      expect(group).toContainElement(button);
      expect(button.querySelector("svg")).toHaveAttribute("viewBox", "0 0 24 24");
      fireEvent.click(button);
      expect(onAction).toHaveBeenLastCalledWith(action);
    }
    expect(onAction).toHaveBeenCalledTimes(4);
    expect(group).not.toHaveTextContent(/[↗↙⇄⌂◫◇⚙+]/);
  });
});

describe("BottomNavigation", () => {
  it("показывает четыре раздела, aria-current и передаёт точный DashboardSection", () => {
    const onSectionChange = vi.fn();

    renderWithTheme(
      <BottomNavigation
        activeSection="portfolio"
        reducedMotion={false}
        onSectionChange={onSectionChange}
      />,
    );

    const navigation = screen.getByRole("navigation", { name: "Основная навигация" });
    expect(navigation.querySelectorAll("svg")).toHaveLength(4);
    expect(navigation.querySelector("[data-glass-nested='true']")).not.toBeInTheDocument();

    for (const [section, label] of SECTIONS) {
      const button = screen.getByRole("button", { name: label });
      expect(navigation).toContainElement(button);
      if (section === "portfolio") {
        expect(button).toHaveAttribute("aria-current", "page");
      } else {
        expect(button).not.toHaveAttribute("aria-current");
      }
      fireEvent.click(button);
      expect(onSectionChange).toHaveBeenLastCalledWith(section);
    }
    expect(onSectionChange).toHaveBeenCalledTimes(4);
    expect(navigation).not.toHaveTextContent(/[↗↙⇄⌂◫◇⚙+]/);
  });
});

describe("DemoActionSheet", () => {
  it.each(ACTIONS)("открывает demo sheet %s с заголовком «%s»", (action, title) => {
    renderWithTheme(<DemoActionSheet action={action} onClose={() => undefined} />);

    expect(screen.getByRole("dialog", { name: title })).toBeVisible();
    expect(
      screen.getByRole("form", { name: `Демонстрационная форма: ${title}` }),
    ).toBeVisible();
  });

  it("показывает безопасный демонстрационный QR без камеры и wallet-адреса", () => {
    renderWithTheme(<DemoActionSheet action="receive" onClose={() => undefined} />);

    const dialog = screen.getByRole("dialog", { name: "Получить" });
    const qr = screen.getByRole("img", { name: "Демонстрационный QR-код" });
    expect(dialog).toContainElement(qr);
    expect(qr).toHaveAttribute("data-demo-only", "true");
    expect(dialog).not.toHaveTextContent(/0x[0-9a-f]+|bc1[a-z0-9]+/i);
    expect(screen.queryByRole("button", { name: /камера|сканировать/i })).not.toBeInTheDocument();
  });

  it.each(ACTIONS)(
    "подтверждает %s только точным demo-сообщением и ничего не отправляет",
    (action, title) => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      renderWithTheme(<DemoActionSheet action={action} onClose={() => undefined} />);

      const form = screen.getByRole("form", {
        name: `Демонстрационная форма: ${title}`,
      });
      expect(form).not.toHaveAttribute("action");
      expect(form).not.toHaveAttribute("method");
      fireEvent.submit(form);

      expect(screen.getByRole("status")).toHaveTextContent("Демо: данные не отправлены");
      expect(fetchMock).not.toHaveBeenCalled();
      expect(screen.queryByText(/успешн.*(перевод|покуп|обмен)/i)).not.toBeInTheDocument();
    },
  );

  it("сохраняет focus trap, закрытие по Escape и возврат фокуса BottomSheet", async () => {
    function Harness() {
      const [action, setAction] = useState<DashboardAction | null>(null);

      return (
        <>
          <button type="button" onClick={() => setAction("send")}>
            Открыть отправку
          </button>
          <DemoActionSheet action={action} onClose={() => setAction(null)} />
        </>
      );
    }

    renderWithTheme(<Harness />);
    const opener = screen.getByRole("button", { name: "Открыть отправку" });
    opener.focus();
    fireEvent.click(opener);

    const dialog = screen.getByRole("dialog", { name: "Отправить" });
    const close = screen.getByRole("button", { name: "Закрыть" });
    const confirm = screen.getByRole("button", { name: "Подтвердить демо" });
    expect(dialog).toContainElement(document.activeElement as HTMLElement);

    confirm.focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(close).toHaveFocus();
    close.focus();
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(confirm).toHaveFocus();

    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Отправить" })).not.toBeInTheDocument();
    });
    expect(opener).toHaveFocus();
  });
});

describe("SectionPlaceholder", () => {
  it.each(SECTIONS)("показывает выбранный раздел %s как обычную surface-карточку", (section, title) => {
    renderWithTheme(<SectionPlaceholder section={section} />);

    const region = screen.getByRole("region", { name: title });
    expect(region).toHaveAttribute("data-dashboard-surface", "content");
    expect(region.closest("[data-glass-variant]")).not.toBeInTheDocument();
  });
});

describe("dashboard-controls.css", () => {
  it("использует mobile-first touch targets и существующие токены темы", () => {
    const css = readFileSync("src/dashboard/dashboard-controls.css", "utf8");

    expect(css).toMatch(/min-height:\s*44px/);
    expect(css).toContain("--radius");
    expect(css).toContain("--density");
    expect(css).toContain("--color-accent");
    expect(css).toContain("--color-glass-tint");
    expect(css).toContain("--motion-intensity");
    expect(css).toContain("prefers-reduced-motion: reduce");
  });
});

function renderWithTheme(children: ReactNode) {
  return render(
    <ThemeProvider storage={createMemoryStorage()}>{children}</ThemeProvider>,
  );
}

function createMemoryStorage(): PreferenceStorage {
  const store = new Map<string, string>();

  return {
    getItem(key) {
      return store.get(key) ?? null;
    },
    setItem(key, value) {
      store.set(key, value);
    },
    removeItem(key) {
      store.delete(key);
    },
  };
}

function stubMatchMedia() {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
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
