import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, renderHook } from "@testing-library/react";
import { StrictMode } from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MockWalletRepository } from "@wallet/core";
import { TelegramPlatformAdapter, type PlatformBridge } from "@wallet/platform";
import { MonoScene, type MonoSceneProps } from "./mono-scene";
import { createMonoAppearanceEnvelope } from "./mono-preset-envelope";
import { MONO_BACKGROUND_DEFAULTS } from "./mono-background-recipes";
import { useMonoSceneActivity } from "./mono-scene-activity";

function telegramEvents() {
  const listeners = new Map<string, Set<() => void>>();
  return {
    onEvent(event: "activated" | "deactivated", handler: () => void) {
      const handlers = listeners.get(event) ?? new Set<() => void>();
      handlers.add(handler); listeners.set(event, handlers);
    },
    offEvent(event: "activated" | "deactivated", handler: () => void) { listeners.get(event)?.delete(handler); },
    emit(event: "activated" | "deactivated") { listeners.get(event)?.forEach((handler) => handler()); },
    size() { return [...listeners.values()].reduce((total, handlers) => total + handlers.size, 0); },
  };
}

beforeEach(() => {
  // jsdom cannot acquire WebGL; keep the real optical component's no-GPU fallback.
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  vi.stubGlobal("matchMedia", (query: string) => Object.assign(new EventTarget(), {
    matches: query.includes("pointer: fine"), media: query,
  }));
});

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function SceneHost({ platform, ...props }: MonoSceneProps & { platform: PlatformBridge }) {
  const hostActive = useMonoSceneActivity(platform);
  return <MonoScene {...props} active={hostActive} />;
}

function ActivityProbe() { return <span>{useMonoSceneActivity() ? "active" : "inactive"}</span>; }

it("stops the actual scene atmosphere after Telegram deactivation while the document remains visible", async () => {
  const webApp = telegramEvents();
  const platform = new TelegramPlatformAdapter(webApp);
  const appearance = { ...createMonoAppearanceEnvelope().appearance, background: { ...MONO_BACKGROUND_DEFAULTS.obsidian } };
  const { container } = render(<SceneHost platform={platform} snapshot={await new MockWalletRepository().getSnapshot()} appearance={appearance} />);
  const layer = container.querySelector("[data-mono-background-recipe]")!;
  const surface = container.querySelector<HTMLElement>("[data-mono-preview]")!;
  vi.spyOn(surface, "getBoundingClientRect").mockReturnValue({ x: 0, y: 0, left: 0, top: 0, width: 390, height: 844, right: 390, bottom: 844, toJSON() {} });
  const move = () => {
    const event = new MouseEvent("pointermove", { clientX: 350, clientY: 600 });
    Object.defineProperty(event, "pointerType", { value: "mouse" });
    surface.dispatchEvent(event);
  };
  expect(layer).toHaveAttribute("data-motion", "ready");
  move();
  expect(layer).toHaveAttribute("data-pointer-active", "true");
  act(() => webApp.emit("deactivated"));
  expect(platform.isActive()).toBe(false);
  expect(document.visibilityState).toBe("visible");
  expect(layer).toHaveAttribute("data-motion", "inactive");
  move();
  expect(layer).toHaveAttribute("data-pointer-active", "false");
  expect((layer as HTMLElement).style.getPropertyValue("--recipe-x")).toBe("0px");
  act(() => webApp.emit("activated"));
  expect(layer).toHaveAttribute("data-motion", "ready");
  move();
  expect(layer).toHaveAttribute("data-pointer-active", "true");
});

it("defaults to an active browser host without reading account data or storage", () => {
  vi.stubGlobal("Telegram", undefined);
  const read = vi.spyOn(Storage.prototype, "getItem");
  const write = vi.spyOn(Storage.prototype, "setItem");
  const { result } = renderHook(() => useMonoSceneActivity());
  expect(result.current).toBe(true);
  expect(read).not.toHaveBeenCalled();
  expect(write).not.toHaveBeenCalled();
});

it("detects the existing Telegram bridge once and keeps its state across rerenders", () => {
  const webApp = telegramEvents();
  Object.defineProperty(webApp, "initDataUnsafe", { get() { throw new Error("Activity must not read profile data"); } });
  vi.stubGlobal("Telegram", { WebApp: webApp });
  const { result, rerender, unmount } = renderHook(() => useMonoSceneActivity());
  expect(result.current).toBe(true);
  act(() => webApp.emit("deactivated"));
  expect(result.current).toBe(false);
  rerender();
  expect(result.current).toBe(false);
  expect(webApp.size()).toBe(2);
  act(() => webApp.emit("activated"));
  expect(result.current).toBe(true);
  unmount();
  expect(webApp.size()).toBe(0);
});

it("respects an already inactive bridge before the hook subscribes", () => {
  const webApp = telegramEvents();
  const platform = new TelegramPlatformAdapter(webApp);
  const bootstrap = platform.subscribeActivity(() => undefined);
  webApp.emit("deactivated");
  bootstrap();
  const { result } = renderHook(() => useMonoSceneActivity(platform));
  expect(result.current).toBe(false);
});

it("releases the previous host on replacement and every subscription on Strict Mode unmount", () => {
  const first = telegramEvents(), second = telegramEvents();
  const firstPlatform = new TelegramPlatformAdapter(first), secondPlatform = new TelegramPlatformAdapter(second);
  const { result, rerender, unmount } = renderHook(({ platform }) => useMonoSceneActivity(platform), {
    initialProps: { platform: firstPlatform }, wrapper: StrictMode,
  });
  act(() => first.emit("deactivated"));
  expect(result.current).toBe(false);
  expect(first.size()).toBe(2);
  rerender({ platform: secondPlatform });
  expect(result.current).toBe(true);
  expect(first.size()).toBe(0);
  expect(second.size()).toBe(2);
  act(() => first.emit("deactivated"));
  expect(result.current).toBe(true);
  unmount();
  expect(second.size()).toBe(0);
});

it("hydrates the server fallback without a mismatch, then observes host events", async () => {
  const webApp = telegramEvents();
  vi.stubGlobal("Telegram", { WebApp: webApp });
  const host = document.createElement("div");
  host.innerHTML = renderToString(<ActivityProbe />);
  document.body.append(host);
  const errors: unknown[] = [];
  let root: Root | undefined;
  try {
    expect(webApp.size()).toBe(0);
    await act(async () => {
      root = hydrateRoot(host, <ActivityProbe />, { onRecoverableError: (error) => errors.push(error) });
    });
    expect(host).toHaveTextContent("active");
    act(() => webApp.emit("deactivated"));
    expect(host).toHaveTextContent("inactive");
    expect(errors).toEqual([]);
  } finally {
    act(() => root?.unmount());
    host.remove();
  }
  expect(webApp.size()).toBe(0);
});
