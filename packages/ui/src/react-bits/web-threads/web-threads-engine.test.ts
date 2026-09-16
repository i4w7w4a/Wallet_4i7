import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_VISUAL_EFFECTS } from "@wallet/core";

const oglMock = vi.hoisted(() => {
  const state = {
    rendererOptions: [] as Array<Record<string, unknown>>,
    renderers: [] as Renderer[],
    programs: [] as Program[],
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
      state.renderers.push(this);
      const canvas = options.canvas as HTMLCanvasElement;
      this.gl = canvas.getContext("webgl2") as WebGL2RenderingContext;
    }
  }

  class Program {
    readonly uniforms: Record<string, { value: unknown }>;
    readonly remove = state.programRemove;

    constructor(_gl: WebGL2RenderingContext, options: Record<string, unknown>) {
      this.uniforms = options.uniforms as Record<string, { value: unknown }>;
      state.programs.push(this);
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
  oglMock.state.renderers.length = 0;
  oglMock.state.programs.length = 0;
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
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("createWebThreadsEngine", () => {
  it("обновляет mouse uniforms от window pointer относительно canvas и снимает listener", () => {
    const { canvas } = createCanvasWithContext();
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      left: 100,
      top: 50,
      width: 200,
      height: 100,
      right: 300,
      bottom: 150,
      x: 100,
      y: 50,
      toJSON: () => ({}),
    });
    let frameCallback: FrameRequestCallback | undefined;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      frameCallback = callback;
      return 1;
    });
    const removeListener = vi.spyOn(window, "removeEventListener");
    const engine = createWebThreadsEngine(canvas, createInput(vi.fn()));

    engine?.setRunning(true);
    window.dispatchEvent(
      new MouseEvent("pointermove", { clientX: 150, clientY: 75 }),
    );
    frameCallback?.(16);

    const uniforms = oglMock.state.programs[0]?.uniforms;
    expect(uniforms?.uMouse?.value).toEqual(
      new Float32Array([0.4875, 0.5125]),
    );
    expect(uniforms?.uMouseActive?.value).toBeCloseTo(0.05);

    engine?.dispose();
    expect(removeListener).toHaveBeenCalledWith(
      "pointermove",
      expect.any(Function),
    );
    expect(removeListener).toHaveBeenCalledWith(
      "pointerenter",
      expect.any(Function),
    );
    expect(removeListener).toHaveBeenCalledWith(
      "pointerleave",
      expect.any(Function),
    );
  });

  it("игнорирует pointer за пределами мобильной сцены", () => {
    const { canvas } = createCanvasWithContext();
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      left: 272,
      top: 0,
      width: 480,
      height: 900,
      right: 752,
      bottom: 900,
      x: 272,
      y: 0,
      toJSON: () => ({}),
    });
    let frameCallback: FrameRequestCallback | undefined;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      frameCallback = callback;
      return 1;
    });
    const engine = createWebThreadsEngine(canvas, createInput(vi.fn()));

    engine?.setRunning(true);
    window.dispatchEvent(
      new MouseEvent("pointermove", { clientX: 40, clientY: 200 }),
    );
    frameCallback?.(16);

    const uniforms = oglMock.state.programs[0]?.uniforms;
    expect(uniforms?.uMouse?.value).toEqual(new Float32Array([0.5, 0.5]));
    expect(uniforms?.uMouseActive?.value).toBe(0);
    engine?.dispose();
  });

  it("не меняет mouse uniforms при отключённом pointer interaction", () => {
    const { canvas } = createCanvasWithContext();
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: 200,
      height: 100,
      right: 200,
      bottom: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    let frameCallback: FrameRequestCallback | undefined;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      frameCallback = callback;
      return 1;
    });
    const engine = createWebThreadsEngine(canvas, {
      ...createInput(vi.fn()),
      mouseInteraction: false,
    });

    engine?.setRunning(true);
    window.dispatchEvent(
      new MouseEvent("pointermove", { clientX: 50, clientY: 25 }),
    );
    frameCallback?.(16);

    const uniforms = oglMock.state.programs[0]?.uniforms;
    expect(uniforms?.uMouse?.value).toEqual(new Float32Array([0.5, 0.5]));
    expect(uniforms?.uMouseActive?.value).toBe(0);
    engine?.dispose();
  });

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
    const renderer = oglMock.state.renderers[0];
    const program = oglMock.state.programs[0];

    expect(oglMock.state.rendererOptions[0]).toEqual(
      expect.objectContaining({ canvas, webgl: 2, dpr: 1.5 }),
    );

    engine?.update({
      ...createInput(vi.fn(), 900),
      effects: { ...DEFAULT_VISUAL_EFFECTS, speed: 1.7, threadCount: 4 },
      colors: {
        color1: "#ff0000",
        color2: "#00ff00",
        color3: "#0000ff",
        backgroundColor: "#804020",
      },
    });

    expect(oglMock.state.renderers).toHaveLength(1);
    expect(oglMock.state.programs).toHaveLength(1);
    expect(oglMock.state.renderers[0]).toBe(renderer);
    expect(oglMock.state.programs[0]).toBe(program);
    expect(program?.uniforms.uSpeed?.value).toBe(1.7);
    expect(program?.uniforms.uThreadCount?.value).toBe(4);
    expect(program?.uniforms.uColor1?.value).toEqual(
      new Float32Array([1, 0, 0]),
    );
    expect(program?.uniforms.uColor2?.value).toEqual(
      new Float32Array([0, 1, 0]),
    );
    expect(program?.uniforms.uColor3?.value).toEqual(
      new Float32Array([0, 0, 1]),
    );
    expect(program?.uniforms.uBackgroundColor?.value).toEqual(
      new Float32Array([128 / 255, 64 / 255, 32 / 255]),
    );
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
    expect(loseContext).not.toHaveBeenCalled();
  });

  it("после dispose позволяет повторно создать движок на том же canvas", () => {
    const canvas = document.createElement("canvas");
    let contextAvailable = true;
    const context = {
      canvas,
      clearColor: vi.fn(),
      drawingBufferWidth: 300,
      drawingBufferHeight: 150,
      getExtension: vi.fn((name: string) =>
        name === "WEBGL_lose_context"
          ? { loseContext: () => (contextAvailable = false) }
          : null,
      ),
    } as unknown as WebGL2RenderingContext;
    Object.defineProperty(canvas, "getContext", {
      value: vi.fn(() => (contextAvailable ? context : null)),
    });
    const unavailable = vi.fn();

    const firstEngine = createWebThreadsEngine(canvas, createInput(unavailable));
    firstEngine?.dispose();
    const secondEngine = createWebThreadsEngine(canvas, createInput(unavailable));

    expect(firstEngine).not.toBeNull();
    expect(secondEngine).not.toBeNull();
    expect(unavailable).not.toHaveBeenCalled();
    secondEngine?.dispose();
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
