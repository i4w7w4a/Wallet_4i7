import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_THEME } from "@wallet/core";
import { THEME_STORAGE_KEY } from "@wallet/ui";

import Page from "../app/page";

beforeEach(() => {
  window.localStorage.clear();
  window.matchMedia = (query: string) => createMediaQueryList(query, false);
  Object.defineProperty(window.CSS, "supports", {
    configurable: true,
    value: () => true,
  });
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: "visible",
  });
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  Reflect.deleteProperty(window, "Telegram");
});

describe("страница miniapp", () => {
  it("загружает mock-снимок и показывает интерактивный Dashboard", async () => {
    render(await Page());

    expect(await screen.findByRole("region", { name: "Баланс" })).toBeVisible();
    expect(screen.getByText("Holder")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Получить" }));
    expect(screen.getByRole("dialog", { name: "Получить" })).toBeVisible();
  });

  it("восстанавливает сохранённую тему из localStorage", async () => {
    window.localStorage.setItem(
      THEME_STORAGE_KEY,
      JSON.stringify({ ...DEFAULT_THEME, accent: "#ff37d1" }),
    );

    render(await Page());

    await screen.findByRole("region", { name: "Баланс" });
    expect(document.querySelector("[data-theme-root]")).toHaveStyle({
      "--color-accent": "#ff37d1",
    });
  });

  it("останавливает hero-видео, когда вкладка становится скрытой", async () => {
    const pause = vi.spyOn(HTMLMediaElement.prototype, "pause");
    render(await Page());
    await screen.findByRole("region", { name: "Баланс" });

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));

    await waitFor(() => expect(pause).toHaveBeenCalled());
  });

  it("определяет Telegram bridge и показывает пользователя host", async () => {
    Object.defineProperty(window, "Telegram", {
      configurable: true,
      value: {
        WebApp: {
          initDataUnsafe: {
            user: { id: 47, first_name: "Liquid", last_name: "Holder" },
          },
        },
      },
    });

    render(await Page());

    expect(await screen.findByText("Liquid Holder")).toBeVisible();
    expect(document.querySelector('[data-platform="telegram"]')).toBeInTheDocument();
  });
});

function createMediaQueryList(query: string, matches: boolean): MediaQueryList {
  return {
    matches,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  };
}
