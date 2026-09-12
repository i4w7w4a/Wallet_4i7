import "@testing-library/jest-dom/vitest";

import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_THEME,
  type PreferenceStorage,
} from "@wallet/core";

import { ThemeProvider } from "../theme/theme-provider";
import type {
  WebThreadsEngine,
  WebThreadsEngineInput,
} from "../react-bits/web-threads/web-threads-engine";
import { VisualEffectsProvider } from "./visual-effects-provider";
import {
  WalletVisualLayer,
  type VisualRuntimeCapabilities,
} from "./wallet-visual-layer";

const ACTIVE_RUNTIME: VisualRuntimeCapabilities = {
  hostActive: true,
  documentVisible: true,
  reducedMotion: false,
  reducedTransparency: false,
  saveData: false,
  coarsePointer: false,
};

afterEach(cleanup);

describe("WalletVisualLayer", () => {
  it("показывает один canvas и передаёт цвета темы в engine", async () => {
    const engine = createEngineMock();
    const factory = vi.fn(
      (canvas: HTMLCanvasElement, input: WebThreadsEngineInput) => {
        void canvas;
        void input;
        return engine;
      },
    );

    renderLayer(ACTIVE_RUNTIME, factory);

    expect(screen.getByTestId("wallet-visual-layer")).toHaveAttribute(
      "data-active",
      "true",
    );
    expect(document.querySelectorAll("canvas[data-web-threads]")).toHaveLength(1);
    expect(screen.queryByTestId("visual-fallback")).not.toBeInTheDocument();
    await waitFor(() => expect(factory).toHaveBeenCalledTimes(1));
    expect(factory.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        colors: expect.objectContaining({
          color1: DEFAULT_THEME.accent,
          color2: "#67E8FF",
          color3: "#8AF4FF",
          backgroundColor: DEFAULT_THEME.background,
        }),
      }),
    );
  });

  it("сохраняет engine при временной неактивности и накрывает canvas poster-ом", async () => {
    const engine = createEngineMock();
    const factory = vi.fn(() => engine);
    const view = renderLayer(ACTIVE_RUNTIME, factory);

    await waitFor(() => expect(factory).toHaveBeenCalledTimes(1));
    view.rerender(layerTree({ ...ACTIVE_RUNTIME, hostActive: false }, factory));

    expect(document.querySelector("canvas[data-web-threads]")).toBeInTheDocument();
    expect(screen.getByTestId("visual-fallback")).toHaveAttribute(
      "src",
      "/media/liquid-hero-poster.avif",
    );
    await waitFor(() => expect(engine.setRunning).toHaveBeenLastCalledWith(false));
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it.each(["reducedMotion", "saveData"] as const)(
    "не монтирует WebGL при %s",
    (capability) => {
      const factory = vi.fn(() => createEngineMock());

      renderLayer({ ...ACTIVE_RUNTIME, [capability]: true }, factory);

      expect(document.querySelector("canvas[data-web-threads]")).not.toBeInTheDocument();
      expect(screen.getByTestId("visual-fallback")).toBeInTheDocument();
      expect(factory).not.toHaveBeenCalled();
    },
  );

  it("удаляет canvas после недоступности WebGL и сохраняет fallback до remount", async () => {
    const engine = createEngineMock();
    let input: WebThreadsEngineInput | undefined;
    const factory = vi.fn(
      (_canvas: HTMLCanvasElement, nextInput: WebThreadsEngineInput) => {
        input = nextInput;
        return engine;
      },
    );
    const view = renderLayer(ACTIVE_RUNTIME, factory);

    await waitFor(() => expect(input).toBeDefined());
    act(() => input?.onUnavailable("webgl2"));

    expect(document.querySelector("canvas[data-web-threads]")).not.toBeInTheDocument();
    expect(screen.getByTestId("visual-fallback")).toBeInTheDocument();
    view.rerender(layerTree({ ...ACTIVE_RUNTIME, documentVisible: false }, factory));
    view.rerender(layerTree(ACTIVE_RUNTIME, factory));
    expect(factory).toHaveBeenCalledTimes(1);
  });
});

function renderLayer(
  runtime: VisualRuntimeCapabilities,
  engineFactory: (
    canvas: HTMLCanvasElement,
    input: WebThreadsEngineInput,
  ) => WebThreadsEngine,
) {
  return render(layerTree(runtime, engineFactory));
}

function layerTree(
  runtime: VisualRuntimeCapabilities,
  engineFactory: (
    canvas: HTMLCanvasElement,
    input: WebThreadsEngineInput,
  ) => WebThreadsEngine,
) {
  const storage = createMemoryStorage();

  return (
    <ThemeProvider storage={storage}>
      <VisualEffectsProvider storage={storage}>
        <WalletVisualLayer runtime={runtime} engineFactory={engineFactory} />
      </VisualEffectsProvider>
    </ThemeProvider>
  );
}

function createEngineMock(): WebThreadsEngine {
  return {
    update: vi.fn(),
    setRunning: vi.fn(),
    dispose: vi.fn(),
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
