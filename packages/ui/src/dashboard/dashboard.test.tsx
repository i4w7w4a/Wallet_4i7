import "@testing-library/jest-dom/vitest";

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PreferenceStorage, WalletSnapshot } from "@wallet/core";
import type { PlatformBridge } from "@wallet/platform";

import { VisualEffectsProvider } from "../appearance/visual-effects-provider";
import type { VisualRuntimeCapabilities } from "../appearance/wallet-visual-layer";
import { ThemeProvider } from "../theme/theme-provider";
import { Dashboard } from "./dashboard";

const SNAPSHOT: WalletSnapshot = {
  profile: {
    name: "Демо пользователь",
    shortAddress: "0x4i7…A91F",
    avatarUrl: null,
  },
  balance: {
    amount: 12840.75,
    currency: "USD",
    change24h: 2.34,
    hidden: false,
  },
  chart: {
    "1D": [12540, 12610, 12588, 12735, 12840.75],
    "1W": [11980, 12150, 12070, 12390, 12520, 12695, 12840.75],
    "1M": [11240, 11680, 11420, 12010, 12360, 12190, 12620, 12840.75],
    "1Y": [8360, 9120, 8840, 10110, 10980, 11740, 12420, 12840.75],
    ALL: [4200, 5180, 4760, 6390, 7210, 8980, 10420, 11780, 12840.75],
  },
  assets: [
    {
      symbol: "BTC",
      name: "Bitcoin",
      amount: 0.12,
      value: 8040.25,
      change24h: 2.8,
      sparkline: [64, 67, 65, 70, 72, 74],
    },
    {
      symbol: "ETH",
      name: "Ethereum",
      amount: 1.1,
      value: 3900.5,
      change24h: 1.7,
      sparkline: [42, 45, 44, 48, 47, 51],
    },
  ],
  notifications: [
    { id: "welcome", title: "Добро пожаловать в Wallet_4i7", unread: true },
    { id: "demo", title: "Все операции работают в деморежиме", unread: false },
  ],
};

const RUNTIME: VisualRuntimeCapabilities = {
  hostActive: true,
  documentVisible: true,
  reducedMotion: false,
  reducedTransparency: false,
  saveData: false,
  coarsePointer: true,
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  window.matchMedia = () => createMediaQueryList(false);
  Object.defineProperty(window.CSS, "supports", {
    configurable: true,
    value: () => true,
  });
});

describe("Dashboard", () => {
  it("собирает весь premium dashboard с доступными русскими именами", () => {
    const platform = createPlatformHarness();
    renderDashboard(platform.bridge);

    expect(document.querySelector("[data-wallet-visual-layer]")).toBeInTheDocument();
    expect(document.querySelectorAll("canvas[data-web-threads]")).toHaveLength(0);
    expect(document.querySelector("[data-visual-fallback]")).toBeInTheDocument();
    expect(document.querySelector("video")).not.toBeInTheDocument();
    expect(document.querySelector(".wallet-dashboard__foreground")).toBeInTheDocument();
    expect(screen.getByText("Демо пользователь")).toBeVisible();
    const balance = screen.getByRole("region", { name: "Баланс" });
    expect(balance).toBeVisible();
    expect(balance).not.toHaveClass("dashboard-card");
    for (const period of ["1Д", "1Н", "1М", "1Г", "Всё"]) {
      expect(screen.getByRole("button", { name: period })).toBeVisible();
    }
    const quickActions = screen.getByRole("group", { name: "Быстрые действия" });
    for (const action of ["Отправить", "Получить", "Обменять", "Купить"]) {
      expect(within(quickActions).getByRole("button", { name: action })).toBeVisible();
    }
    expect(screen.getByRole("region", { name: "Обмен" })).toHaveAttribute(
      "data-spotlight",
    );
    expect(screen.getByRole("region", { name: "Активы" })).toHaveAttribute(
      "data-spotlight",
    );
    expect(screen.getByRole("region", { name: "Портфель" })).toHaveAttribute(
      "data-spotlight",
    );

    const navigation = screen.getByRole("navigation", { name: "Основная навигация" });
    for (const section of ["Главная", "Портфель", "Обзор", "Настройки"]) {
      expect(within(navigation).getByRole("button", { name: section })).toBeVisible();
    }
  });

  it.each([
    ["Отправить", "Отправить"],
    ["Получить", "Получить"],
    ["Обменять", "Обменять"],
    ["Купить", "Купить"],
  ])("открывает собственную demo-панель действия %s", (buttonName, dialogName) => {
    const platform = createPlatformHarness();
    renderDashboard(platform.bridge);

    fireEvent.click(
      within(screen.getByRole("group", { name: "Быстрые действия" })).getByRole("button", {
        name: buttonName,
      }),
    );

    expect(screen.getByRole("dialog", { name: dialogName })).toBeVisible();
    expect(platform.haptic).toHaveBeenLastCalledWith("selection");
  });

  it("показывает безопасный демонстрационный QR без камеры", () => {
    renderDashboard(createPlatformHarness().bridge);

    fireEvent.click(screen.getByRole("button", { name: "Получить" }));

    expect(screen.getByRole("img", { name: "Демонстрационный QR-код" })).toHaveAttribute(
      "data-demo-only",
      "true",
    );
    expect(screen.queryByRole("button", { name: /камера|сканировать/i })).not.toBeInTheDocument();
  });

  it("меняет период графика и скрывает цифровой баланс", () => {
    renderDashboard(createPlatformHarness().bridge);
    const chart = screen.getByRole("img", { name: /График баланса за 1 день/ });
    const initialPath = chart.querySelector("path")?.getAttribute("d");

    fireEvent.click(screen.getByRole("button", { name: "1Н" }));

    const weeklyChart = screen.getByRole("img", { name: /График баланса за 1 неделю/ });
    expect(weeklyChart.querySelector("path")?.getAttribute("d")).not.toBe(initialPath);

    fireEvent.click(screen.getByRole("button", { name: "Скрыть баланс" }));
    expect(screen.getByText("••••••")).toBeVisible();
    expect(screen.getByRole("img", { name: /Сумма скрыта/ })).toBeVisible();
  });

  it("открывает mock-details актива, поиск, уведомления и Theme Studio", () => {
    renderDashboard(createPlatformHarness().bridge);

    fireEvent.click(screen.getByRole("button", { name: /Bitcoin/ }));
    expect(screen.getByRole("dialog", { name: "Bitcoin" })).toHaveTextContent("0,12 BTC");
    fireEvent.click(screen.getByRole("button", { name: "Закрыть" }));

    fireEvent.click(screen.getByRole("button", { name: "Поиск" }));
    const searchDialog = screen.getByRole("dialog", { name: "Поиск" });
    const searchbox = within(searchDialog).getByRole("searchbox", { name: "Поиск по кошельку" });
    fireEvent.change(searchbox, { target: { value: "bit" } });
    expect(within(searchDialog).getByRole("button", { name: /Bitcoin/ })).toBeVisible();
    expect(within(searchDialog).queryByRole("button", { name: /Ethereum/ })).not.toBeInTheDocument();
    fireEvent.click(within(searchDialog).getByRole("button", { name: /Bitcoin/ }));
    expect(screen.getByRole("dialog", { name: "Bitcoin" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Закрыть" }));

    fireEvent.click(screen.getByRole("button", { name: /Уведомления/ }));
    expect(screen.getByRole("dialog", { name: "Уведомления" })).toHaveTextContent(
      "Добро пожаловать в Wallet_4i7",
    );
    fireEvent.click(screen.getByRole("button", { name: "Закрыть" }));

    fireEvent.click(screen.getByRole("button", { name: "Студия темы" }));
    expect(screen.getByRole("dialog", { name: "Студия темы" })).toBeVisible();
    expect(screen.getByLabelText("Акцент")).toHaveAttribute("type", "color");
    expect(document.querySelector("[data-theme-overlay]")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Закрыть студию темы" }));
    expect(screen.queryByRole("dialog", { name: "Студия темы" })).not.toBeInTheDocument();
  });

  it("переключает раздел и показывает его mock-контент", () => {
    renderDashboard(createPlatformHarness().bridge);
    const navigation = screen.getByRole("navigation", { name: "Основная навигация" });

    fireEvent.click(within(navigation).getByRole("button", { name: "Портфель" }));

    expect(screen.getByRole("region", { name: "Портфель" })).toHaveTextContent(
      "Состав и распределение демонстрационного портфеля появятся здесь",
    );
    expect(within(navigation).getByRole("button", { name: "Портфель" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.queryByRole("region", { name: "Баланс" })).not.toBeInTheDocument();
  });

  it("Back Button сначала закрывает панель, затем возвращает предыдущий раздел и очищается", async () => {
    const platform = createPlatformHarness();
    const view = renderDashboard(platform.bridge);
    const navigation = screen.getByRole("navigation", { name: "Основная навигация" });

    fireEvent.click(within(navigation).getByRole("button", { name: "Портфель" }));
    fireEvent.click(screen.getByRole("button", { name: "Поиск" }));
    expect(screen.getByRole("dialog", { name: "Поиск" })).toBeVisible();

    act(() => platform.back());
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Поиск" })).not.toBeInTheDocument();
    });
    expect(screen.getByRole("region", { name: "Портфель" })).toBeVisible();

    act(() => platform.back());
    await waitFor(() => {
      expect(screen.getByRole("region", { name: "Баланс" })).toBeVisible();
    });

    view.unmount();
    expect(platform.cleanup).toHaveBeenCalled();
    expect(platform.currentBackHandler()).toBeNull();
  });

  it("не сохраняет demo-результат после закрытия action sheet через Back Button", async () => {
    const platform = createPlatformHarness();
    renderDashboard(platform.bridge);
    const actions = screen.getByRole("group", { name: "Быстрые действия" });

    fireEvent.click(within(actions).getByRole("button", { name: "Отправить" }));
    fireEvent.submit(screen.getByRole("form", { name: /Демонстрационная форма/ }));
    expect(screen.getByRole("status")).toHaveTextContent("Демо: данные не отправлены");

    act(() => platform.back());
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Отправить" })).not.toBeInTheDocument();
    });

    fireEvent.click(within(actions).getByRole("button", { name: "Отправить" }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});

function renderDashboard(platform: PlatformBridge) {
  const storage = createMemoryStorage();

  return render(
    <ThemeProvider storage={storage}>
      <VisualEffectsProvider storage={storage}>
        <Dashboard snapshot={SNAPSHOT} platform={platform} runtime={RUNTIME} />
      </VisualEffectsProvider>
    </ThemeProvider>,
  );
}

function createPlatformHarness() {
  let handler: (() => void) | null = null;
  const cleanup = vi.fn(() => {
    handler = null;
  });
  const haptic = vi.fn();
  const bridge: PlatformBridge = {
    kind: "browser",
    getUser: () => ({ id: "demo", name: "Демо пользователь" }),
    getSafeArea: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
    isActive: () => true,
    haptic,
    setBackHandler: vi.fn((next) => {
      handler = next;
      return cleanup;
    }),
    subscribeActivity: () => () => undefined,
    openLink: () => undefined,
  };

  return {
    bridge,
    cleanup,
    haptic,
    back() {
      handler?.();
    },
    currentBackHandler() {
      return handler;
    },
  };
}

function createMemoryStorage(): PreferenceStorage {
  const values = new Map<string, string>();

  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

function createMediaQueryList(matches: boolean): MediaQueryList {
  return {
    matches,
    media: "",
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  };
}
