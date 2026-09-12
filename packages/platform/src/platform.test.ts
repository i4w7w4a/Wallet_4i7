import { describe, expect, it, vi } from "vitest";

import {
  BrowserPlatformAdapter,
  TelegramPlatformAdapter,
  detectPlatformBridge,
  type HapticType,
} from "./index";
import type {
  TelegramActivityEvent,
  TelegramWebApp,
} from "./telegram-platform-adapter";

describe("detectPlatformBridge", () => {
  it("возвращает browser fallback без window во время SSR", () => {
    const platform = detectPlatformBridge();

    expect(platform).toBeInstanceOf(BrowserPlatformAdapter);
    expect(platform.kind).toBe("browser");
  });

  it("выбирает browser без Telegram WebApp", () => {
    expect(detectPlatformBridge({}).kind).toBe("browser");
    expect(detectPlatformBridge({ Telegram: {} }).kind).toBe("browser");
  });

  it("выбирает Telegram при наличии WebApp API", () => {
    const webApp = new FakeTelegramWebApp();

    expect(detectPlatformBridge({ Telegram: { WebApp: webApp } })).toBeInstanceOf(
      TelegramPlatformAdapter,
    );
  });
});

describe("BrowserPlatformAdapter", () => {
  it("возвращает демонстрационный профиль Holder и нулевой safe-area", () => {
    const platform = new BrowserPlatformAdapter();

    expect(platform.getUser()).toEqual({ id: "0x3a…f79D", name: "Holder" });
    expect(platform.getSafeArea()).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
    expect(platform.isActive()).toBe(true);
  });

  it.each<HapticType>(["selection", "impact", "success", "warning"])(
    "не вызывает вибрацию для haptic %s и не бросает ошибку",
    (type) => {
      const vibrate = vi.fn();
      const platform = new BrowserPlatformAdapter({ navigator: { vibrate } });

      expect(() => platform.haptic(type)).not.toThrow();
      expect(vibrate).not.toHaveBeenCalled();
    },
  );

  it("открывает только безопасные HTTP-ссылки в новом изолированном окне", () => {
    const open = vi.fn();
    const platform = new BrowserPlatformAdapter({ open });

    platform.openLink("https://wallet.example/help");
    platform.openLink("javascript:alert(1)");
    platform.openLink("not a url");

    expect(open).toHaveBeenCalledOnce();
    expect(open).toHaveBeenCalledWith(
      "https://wallet.example/help",
      "_blank",
      "noopener,noreferrer",
    );
  });
});

describe("TelegramPlatformAdapter", () => {
  it("считывает Telegram user только как профиль отображения и использует content safe-area", () => {
    const webApp = new FakeTelegramWebApp();
    const platform = new TelegramPlatformAdapter(webApp);

    expect(platform.getUser()).toEqual({
      id: "42",
      name: "Ada Lovelace",
      username: "ada",
      avatarUrl: "https://example.test/ada.jpg",
    });
    expect(platform.getSafeArea()).toEqual({ top: 11, right: 12, bottom: 13, left: 14 });
    expect(webApp.initData).toBe("forged-unverified-data");
  });

  it("использует hardware safe-area как fallback для старого клиента", () => {
    const webApp: TelegramWebApp = {
      safeAreaInset: { top: 1, right: 2, bottom: 3, left: 4 },
    };

    expect(new TelegramPlatformAdapter(webApp).getSafeArea()).toEqual({
      top: 1,
      right: 2,
      bottom: 3,
      left: 4,
    });
  });

  it("показывает Back Button, вызывает handler и снимает его idempotent cleanup", () => {
    const webApp = new FakeTelegramWebApp();
    const platform = new TelegramPlatformAdapter(webApp);
    let calls = 0;

    const cleanup = platform.setBackHandler(() => {
      calls += 1;
    });

    expect(webApp.backVisible).toBe(true);
    webApp.pressBack();
    expect(calls).toBe(1);

    cleanup();
    cleanup();
    webApp.pressBack();

    expect(calls).toBe(1);
    expect(webApp.backVisible).toBe(false);
    expect(webApp.backOffCalls).toBe(1);
  });

  it("скрывает Back Button при пустом handler", () => {
    const webApp = new FakeTelegramWebApp();
    webApp.BackButton?.show?.();
    const platform = new TelegramPlatformAdapter(webApp);

    const cleanup = platform.setBackHandler(null);
    cleanup();
    cleanup();

    expect(webApp.backVisible).toBe(false);
    expect(webApp.backOffCalls).toBe(0);
  });

  it("отображает четыре haptic-сигнала на Telegram API", () => {
    const webApp = new FakeTelegramWebApp();
    const platform = new TelegramPlatformAdapter(webApp);

    platform.haptic("selection");
    platform.haptic("impact");
    platform.haptic("success");
    platform.haptic("warning");

    expect(webApp.haptics).toEqual([
      "selection",
      "impact:medium",
      "notification:success",
      "notification:warning",
    ]);
  });

  it("обновляет activity и снимает обе подписки ровно один раз", () => {
    const webApp = new FakeTelegramWebApp();
    const platform = new TelegramPlatformAdapter(webApp);
    const changes: boolean[] = [];

    const cleanup = platform.subscribeActivity((active) => changes.push(active));

    webApp.emit("deactivated");
    expect(platform.isActive()).toBe(false);
    webApp.emit("activated");
    expect(platform.isActive()).toBe(true);
    expect(changes).toEqual([false, true]);

    cleanup();
    cleanup();
    webApp.emit("deactivated");

    expect(changes).toEqual([false, true]);
    expect(webApp.activityOffCalls).toEqual(["activated", "deactivated"]);
  });

  it("открывает только безопасные HTTP-ссылки через Telegram", () => {
    const webApp = new FakeTelegramWebApp();
    const platform = new TelegramPlatformAdapter(webApp);

    platform.openLink("http://wallet.example/legal");
    platform.openLink("data:text/html,unsafe");

    expect(webApp.openedLinks).toEqual(["http://wallet.example/legal"]);
  });

  it("не падает, когда старый клиент не предоставляет методы", () => {
    const platform = new TelegramPlatformAdapter({});

    expect(platform.getUser()).toEqual({ id: "telegram", name: "Пользователь Telegram" });
    expect(platform.getSafeArea()).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
    expect(() => platform.haptic("selection")).not.toThrow();
    expect(() => platform.setBackHandler(() => undefined)()).not.toThrow();
    expect(() => platform.subscribeActivity(() => undefined)()).not.toThrow();
    expect(() => platform.openLink("https://wallet.example")).not.toThrow();
  });
});

class FakeTelegramWebApp implements TelegramWebApp {
  readonly initData = "forged-unverified-data";
  readonly initDataUnsafe = {
    user: {
      id: 42,
      first_name: "Ada",
      last_name: "Lovelace",
      username: "ada",
      photo_url: "https://example.test/ada.jpg",
    },
  };
  readonly safeAreaInset = { top: 1, right: 2, bottom: 3, left: 4 };
  readonly contentSafeAreaInset = { top: 11, right: 12, bottom: 13, left: 14 };
  readonly haptics: string[] = [];
  readonly openedLinks: string[] = [];
  readonly activityOffCalls: TelegramActivityEvent[] = [];
  readonly #backHandlers = new Set<() => void>();
  readonly #activityHandlers = new Map<TelegramActivityEvent, Set<() => void>>();
  backVisible = false;
  backOffCalls = 0;

  readonly BackButton = {
    show: () => {
      this.backVisible = true;
    },
    hide: () => {
      this.backVisible = false;
    },
    onClick: (handler: () => void) => {
      this.#backHandlers.add(handler);
    },
    offClick: (handler: () => void) => {
      this.backOffCalls += 1;
      this.#backHandlers.delete(handler);
    },
  };

  readonly HapticFeedback = {
    selectionChanged: () => {
      this.haptics.push("selection");
    },
    impactOccurred: (style: "medium") => {
      this.haptics.push(`impact:${style}`);
    },
    notificationOccurred: (type: "success" | "warning") => {
      this.haptics.push(`notification:${type}`);
    },
  };

  onEvent(event: TelegramActivityEvent, handler: () => void): void {
    const handlers = this.#activityHandlers.get(event) ?? new Set();
    handlers.add(handler);
    this.#activityHandlers.set(event, handlers);
  }

  offEvent(event: TelegramActivityEvent, handler: () => void): void {
    this.activityOffCalls.push(event);
    this.#activityHandlers.get(event)?.delete(handler);
  }

  openLink(url: string): void {
    this.openedLinks.push(url);
  }

  pressBack(): void {
    for (const handler of this.#backHandlers) {
      handler();
    }
  }

  emit(event: TelegramActivityEvent): void {
    for (const handler of this.#activityHandlers.get(event) ?? []) {
      handler();
    }
  }
}
