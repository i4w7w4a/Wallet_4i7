import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_VISUAL_EFFECTS } from "@wallet/core";

const oglMock = vi.hoisted(() => {
  const state = {
    rendererOptions: [] as Array<Record<string, unknown>>,
    render: vi.fn(),
    setSize: vi.fn(),
    programRemove: vi.fn(),
    geometryRemove: vi.fn(),
  };

  class Renderer {
    readonly gl: WebGL2RenderingContext;
    readonly isWebgl2 = true;
    readonly render = state.render;
    readonly setSize = state.setSize;

    constructor(options: Record<string, unknown>) {
      state.rendererOptions.push(options);
      const canvas = options.canvas as HTMLCanvasElement;
      this.gl = canvas.getContext("webgl2") as WebGL2RenderingContext;
    }
  }

  class Program {
    readonly uniforms: Record<string, { value: unknown }>;
    readonly remove = state.programRemove;

    constructor(_gl: WebGL2RenderingContext, options: Record<string, unknown>) {
      this.uniforms = options.uniforms as Record<string, { value: unknown }>;
    }
  }

  class Triangle {
    readonly remove = state.geometryRemove;
  }

  class Mesh {}

  return { state, Renderer, Program, Triangle, Mesh };
});

vi.mock("ogl", () => ({
  Renderer: oglMock.Renderer,
  Program: oglMock.Program,
  Triangle: oglMock.Triangle,
  Mesh: oglMock.Mesh,
}));

import {
  createWebThreadsEngine,
  type WebThreadsColors,
  type WebThreadsEngineInput,
} from "./web-threads-engine";

const COLORS: WebThreadsColors = {
  color1: "#112233",
  color2: "#445566",
  color3: "#ffffff",
  backgroundColor: "#000000",
};

let resizeDisconnect: ReturnType<typeof vi.fn>;
let intersectionDisconnect: ReturnType<typeof vi.fn>;
let intersectionCallback: IntersectionObserverCallback | undefined;

beforeEach(() => {
  vi.useFakeTimers();
  oglMock.state.rendererOptions.length = 0;
  oglMock.state.render.mockClear();
  oglMock.state.setSize.mockClear();
  oglMock.state.programRemove.mockClear();
  oglMock.state.geometryRemove.mockClear();
  resizeDisconnect = vi.fn();
  intersectionDisconnect = vi.fn();
  intersectionCallback = undefined;

  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe = vi.fn();
      disconnect = resizeDisconnect;
    },
  );
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe = vi.fn();
      disconnect = intersectionDisconnect;

      constructor(callback: IntersectionObserverCallback) {
        intersectionCallback = callback;
      }
    },
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("createWebThreadsEngine", () => {
  it("отказывается от WebGL1 fallback, если WebGL2 недоступен", () => {
    const canvas = document.createElement("canvas");
    Object.defineProperty(canvas, "getContext", { value: vi.fn(() => null) });
    const unavailable = vi.fn();

    const engine = createWebThreadsEngine(canvas, createInput(unavailable));

    expect(engine).toBeNull();
    expect(unavailable).toHaveBeenCalledWith("webgl2");
    expect(oglMock.state.rendererOptions).toHaveLength(0);
  });

  it("создаёт WebGL2 renderer с ограниченным DPR и обновляет существующие uniforms", () => {
    const { canvas } = createCanvasWithContext();
    vi.stubGlobal("devicePixelRatio", 3);
    const engine = createWebThreadsEngine(canvas, createInput(vi.fn(), 420));

    expect(oglMock.state.rendererOptions[0]).toEqual(
      expect.objectContaining({ canvas, webgl: 2, dpr: 1.5 }),
    );

    engine?.update({
      ...createInput(vi.fn(), 900),
      effects: { ...DEFAULT_VISUAL_EFFECTS, speed: 1.7, threadCount: 4 },
      colors: { ...COLORS, color1: "#ff0000" },
    });

    const program = oglMock.state.rendererOptions.length;
    expect(program).toBe(1);
    engine?.dispose();
  });

  it("не дублирует RAF, умеет pause/resume и полностью очищает ресурсы", () => {
    const { canvas, loseContext } = createCanvasWithContext();
    const requestFrame = vi.spyOn(window, "requestAnimationFrame");
    const cancelFrame = vi.spyOn(window, "cancelAnimationFrame");
    const engine = createWebThreadsEngine(canvas, createInput(vi.fn()));

    engine?.setRunning(true);
    engine?.setRunning(true);
    expect(requestFrame).toHaveBeenCalledTimes(1);

    engine?.setRunning(false);
    expect(cancelFrame).toHaveBeenCalledTimes(1);
    engine?.setRunning(true);
    engine?.dispose();
    engine?.dispose();

    expect(resizeDisconnect).toHaveBeenCalledTimes(1);
    expect(intersectionDisconnect).toHaveBeenCalledTimes(1);
    expect(oglMock.state.programRemove).toHaveBeenCalledTimes(1);
    expect(oglMock.state.geometryRemove).toHaveBeenCalledTimes(1);
    expect(loseContext).toHaveBeenCalledTimes(1);
  });

  it("останавливается при выходе из viewport и сообщает о context loss", () => {
    const { canvas } = createCanvasWithContext();
    const unavailable = vi.fn();
    const engine = createWebThreadsEngine(canvas, createInput(unavailable));
    const preventDefault = vi.fn();

    engine?.setRunning(true);
    intersectionCallback?.(
      [{ isIntersecting: false } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );
    canvas.dispatchEvent(
      Object.assign(new Event("webglcontextlost"), { preventDefault }),
    );

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(unavailable).toHaveBeenCalledWith("context-lost");
    engine?.dispose();
  });
});

function createInput(
  onUnavailable: WebThreadsEngineInput["onUnavailable"],
  viewportWidth = 800,
): WebThreadsEngineInput {
  return {
    effects: DEFAULT_VISUAL_EFFECTS,
    colors: COLORS,
    viewportWidth,
    mouseInteraction: true,
    onUnavailable,
  };
}

function createCanvasWithContext() {
  const canvas = document.createElement("canvas");
  const loseContext = vi.fn();
  const context = {
    canvas,
    clearColor: vi.fn(),
    drawingBufferWidth: 300,
    drawingBufferHeight: 150,
    getExtension: vi.fn((name: string) =>
      name === "WEBGL_lose_context" ? { loseContext } : null,
    ),
  } as unknown as WebGL2RenderingContext;
  Object.defineProperty(canvas, "getContext", { value: vi.fn(() => context) });

  return { canvas, loseContext };
}
