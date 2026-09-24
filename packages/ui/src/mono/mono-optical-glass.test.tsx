import "@testing-library/jest-dom/vitest";

import { StrictMode } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const gpu = vi.hoisted(() => {
  const state = {
    renderers: [] as Array<{
      render: ReturnType<typeof vi.fn>;
      setSize: ReturnType<typeof vi.fn>;
    }>,
    programs: [] as Array<{ uniforms: Record<string, { value: unknown }> }>,
    textures: [] as Array<{ image: unknown; texture: object }>,
    failProgramConstruction: false,
    failRendererConstruction: false,
    failMeshConstruction: false,
    failTextureConstruction: false,
    failGeometryConstruction: false,
    rendererWebgl2: true,
    programRemove: vi.fn(),
    geometryRemove: vi.fn(),
  };

  class Renderer {
    readonly gl: WebGL2RenderingContext;
    readonly isWebgl2 = state.rendererWebgl2;
    readonly render = vi.fn();
    readonly setSize = vi.fn();

    constructor(options: { canvas: HTMLCanvasElement }) {
      this.gl = options.canvas.getContext("webgl2") as WebGL2RenderingContext;
      state.renderers.push(this);
      if (state.failRendererConstruction) throw new Error("Renderer initialization failed");
    }
  }

  class Program {
    readonly uniforms: Record<string, { value: unknown }>;
    readonly remove = state.programRemove;
    readonly program = {};

    constructor(_gl: WebGL2RenderingContext, options: { uniforms: Record<string, { value: unknown }> }) {
      if (state.failProgramConstruction) throw new Error("GPU program construction failed");
      this.uniforms = options.uniforms;
      state.programs.push(this);
    }
  }

  class Triangle {
    readonly remove = state.geometryRemove;
    constructor() {
      if (state.failGeometryConstruction) throw new Error("GPU geometry construction failed");
    }
  }

  class Mesh {
    constructor() {
      if (state.failMeshConstruction) throw new Error("GPU mesh construction failed");
    }
  }

  class Texture {
    readonly image: unknown;
    readonly texture = {};

    constructor(_gl: WebGL2RenderingContext, options: { image: unknown }) {
      if (state.failTextureConstruction) throw new Error("GPU texture construction failed");
      this.image = options.image;
      state.textures.push(this);
    }
  }

  return { state, Renderer, Program, Triangle, Mesh, Texture };
});

vi.mock("ogl", () => ({
  Renderer: gpu.Renderer,
  Program: gpu.Program,
  Triangle: gpu.Triangle,
  Mesh: gpu.Mesh,
  Texture: gpu.Texture,
}));

import * as monoGlass from "./mono-optical-glass";

const { MonoOpticalGlass } = monoGlass;

beforeEach(() => {
  gpu.state.renderers.length = 0;
  gpu.state.programs.length = 0;
  gpu.state.textures.length = 0;
  gpu.state.failProgramConstruction = false;
  gpu.state.failRendererConstruction = false;
  gpu.state.failMeshConstruction = false;
  gpu.state.failTextureConstruction = false;
  gpu.state.failGeometryConstruction = false;
  gpu.state.rendererWebgl2 = true;
  gpu.state.programRemove.mockClear();
  gpu.state.geometryRemove.mockClear();
  vi.stubGlobal("ResizeObserver", class {
    observe = vi.fn();
    disconnect = vi.fn();
  });
  vi.stubGlobal("IntersectionObserver", class {
    observe = vi.fn();
    disconnect = vi.fn();
  });
  vi.stubGlobal("requestAnimationFrame", vi.fn(() => 17));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("MonoOpticalGlass", () => {
  it("registers approved optics with a shared host without acquiring a private canvas or context", () => {
    const acquire = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    const registrations: Array<{ element: HTMLElement; settings: { ior: number }; disposed: boolean }> = [];
    const sharedHost = {
      subscribe: () => () => undefined,
      getSnapshot: () => true,
      register(element: HTMLElement, settings: { ior: number }) {
        const registration = { element, settings, disposed: false };
        registrations.push(registration);
        return { update(next: { ior: number }) { registration.settings = next; }, dispose() { registration.disposed = true; } };
      },
    };
    const view = render(<MonoOpticalGlass preset="ledger" {...{ sharedHost }}><button>Read account</button></MonoOpticalGlass>);
    expect(acquire).not.toHaveBeenCalled();
    expect(view.container.querySelector("canvas")).toBeNull();
    expect(registrations[0]?.element).toBe(screen.getByTestId("mono-optical-glass"));
    expect(registrations[0]?.settings.ior).toBe(1.34);
    expect(screen.getByRole("button", { name: "Read account" })).toBeInTheDocument();
    view.rerender(<MonoOpticalGlass preset="ledger" settings={{ ior: 0 }} {...{ sharedHost }}><button>Read account</button></MonoOpticalGlass>);
    expect(registrations).toHaveLength(1);
    expect(registrations[0]?.settings.ior).toBe(0);
    view.unmount();
    expect(registrations[0]?.disposed).toBe(true);
  });

  it("keeps live DOM content and a neutral static fallback when WebGL2 is unavailable", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);

    render(<MonoOpticalGlass preset="ledger"><button>Open account</button></MonoOpticalGlass>);

    expect(screen.getByRole("button", { name: "Open account" })).toBeInTheDocument();
    expect(screen.getByTestId("mono-optical-glass")).toHaveAttribute("data-optics", "fallback");
    expect(gpu.state.renderers).toHaveLength(0);
  });

  it("reuses one source texture and renderer while switching recipes", () => {
    const context = {
      drawingBufferWidth: 600,
      drawingBufferHeight: 300,
      clearColor: vi.fn(),
      deleteTexture: vi.fn(),
      getProgramParameter: vi.fn(() => true),
    } as unknown as WebGL2RenderingContext;
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context);

    const view = render(<MonoOpticalGlass preset="ledger"><span>Private banking</span></MonoOpticalGlass>);
    const firstCanvas = view.container.querySelector("canvas");
    const firstRenderer = gpu.state.renderers[0];

    expect(firstCanvas).not.toBeNull();
    expect(gpu.state.renderers).toHaveLength(1);
    expect(gpu.state.textures).toHaveLength(1);
    expect(gpu.state.textures[0]?.image).toBeInstanceOf(Uint8Array);
    expect(screen.getByText("Private banking")).toBeInTheDocument();
    expect(gpu.state.programs[0]?.uniforms.uIOR?.value).toBe(1.34);

    view.rerender(<MonoOpticalGlass preset="mercury"><span>Private banking</span></MonoOpticalGlass>);

    expect(view.container.querySelector("canvas")).toBe(firstCanvas);
    expect(gpu.state.renderers).toEqual([firstRenderer]);
    expect(gpu.state.textures).toHaveLength(1);
    expect(gpu.state.programs[0]?.uniforms.uIOR?.value).toBe(-0.83);
    expect(gpu.state.programs[0]?.uniforms.uDispersion?.value).toBe(0);

    view.unmount();
    expect(gpu.state.programRemove).toHaveBeenCalledOnce();
    expect(gpu.state.geometryRemove).toHaveBeenCalledOnce();
    expect(context.deleteTexture).toHaveBeenCalledOnce();
  });

  it("sizes the optical buffer from the untransformed layout box", () => {
    const context = {
      drawingBufferWidth: 600,
      drawingBufferHeight: 300,
      clearColor: vi.fn(),
      deleteTexture: vi.fn(),
      getProgramParameter: vi.fn(() => true),
    } as unknown as WebGL2RenderingContext;
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context);
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(400);
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(158);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: 394,
      height: 155.63,
      top: 0,
      right: 394,
      bottom: 155.63,
      left: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    render(<MonoOpticalGlass preset="frost"><span>Private data</span></MonoOpticalGlass>);

    expect(gpu.state.renderers[0]?.setSize).toHaveBeenLastCalledWith(400, 158);
  });

  it("starts Ledger with the approved optical recipe on one renderer and one RAF", () => {
    const context = {
      drawingBufferWidth: 600,
      drawingBufferHeight: 300,
      clearColor: vi.fn(),
      deleteTexture: vi.fn(),
      getProgramParameter: vi.fn(() => true),
    } as unknown as WebGL2RenderingContext;
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context);

    render(<MonoOpticalGlass preset="ledger" />);

    const uniforms = gpu.state.programs[0]?.uniforms;
    expect(gpu.state.renderers).toHaveLength(1);
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
    expect({
      ior: uniforms?.uIOR?.value,
      edgeThickness: uniforms?.uEdgeThickness?.value,
      edgeDarkening: uniforms?.uEdgeDarkening?.value,
      highlightStrength: uniforms?.uHighlightStrength?.value,
      reflectionStrength: uniforms?.uReflectionStrength?.value,
      causticStrength: uniforms?.uCausticStrength?.value,
      fieldEnabled: uniforms?.uFieldEnabled?.value,
      fieldFadeMode: uniforms?.uFieldFadeMode?.value,
      fieldStart: uniforms?.uFieldStart?.value,
      fieldSoftness: uniforms?.uFieldSoftness?.value,
      fieldCurve: uniforms?.uFieldCurve?.value,
      fieldStrength: uniforms?.uFieldStrength?.value,
      flowEnabled: uniforms?.uFlowEnabled?.value,
      flowMode: uniforms?.uFlowMode?.value,
      flowSpeed: uniforms?.uFlowSpeed?.value,
      flowStrength: uniforms?.uFlowStrength?.value,
      flowScale: uniforms?.uFlowScale?.value,
      pointerStrength: uniforms?.uPointerStrength?.value,
    }).toEqual({
      ior: 1.34,
      edgeThickness: 0.165,
      edgeDarkening: 0.5,
      highlightStrength: 0.54,
      reflectionStrength: 0.59,
      causticStrength: 0.63,
      fieldEnabled: 1,
      fieldFadeMode: 1,
      fieldStart: 0.34,
      fieldSoftness: 0.99,
      fieldCurve: 2.69,
      fieldStrength: 1.92,
      flowEnabled: 1,
      flowMode: 5,
      flowSpeed: 0.29,
      flowStrength: 0.44,
      flowScale: 4.47,
      pointerStrength: 0.23,
    });
  });

  it("normalizes unsafe overrides without allowing color or uncurated flow modes", () => {
    const normalize = Reflect.get(monoGlass, "normalizeMonoGlassSettings") as
      | ((preset: "ledger" | "frost", values: Record<string, unknown>) => Record<string, unknown>)
      | undefined;
    const resolved = normalize?.("frost", {
      ior: Number.POSITIVE_INFINITY,
      fieldStrength: 100,
      highlightStrength: -4,
      fieldEnabled: false,
      flowMode: 4,
      dispersion: 0.08,
    });

    expect(resolved).toEqual(expect.objectContaining({
      ior: -0.62,
      fieldStrength: 2.5,
      highlightStrength: 0,
      fieldEnabled: false,
      flowMode: 9,
    }));
    expect(resolved).not.toHaveProperty("dispersion");
    expect(normalize?.("ledger", { flowEnabled: true, flowMode: 0 })).toEqual(expect.objectContaining({
      flowEnabled: false,
      flowMode: 0,
    }));
  });

  it("hot-updates safe optical overrides without replacing the renderer or source", () => {
    const context = {
      drawingBufferWidth: 600,
      drawingBufferHeight: 300,
      clearColor: vi.fn(),
      deleteTexture: vi.fn(),
      getProgramParameter: vi.fn(() => true),
    } as unknown as WebGL2RenderingContext;
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context);
    const view = render(<MonoOpticalGlass preset="frost" settings={{ ior: 0, reflectionStrength: 0.8 }} />);
    const firstRenderer = gpu.state.renderers[0];

    expect(gpu.state.programs[0]?.uniforms.uIOR?.value).toBe(0);
    expect(gpu.state.programs[0]?.uniforms.uReflectionStrength?.value).toBe(0.8);

    view.rerender(<MonoOpticalGlass preset="frost" settings={{ ior: -1.25, reflectionStrength: 0.4 }} />);

    expect(gpu.state.renderers).toEqual([firstRenderer]);
    expect(gpu.state.textures).toHaveLength(1);
    expect(gpu.state.programs[0]?.uniforms.uIOR?.value).toBe(-1.25);
    expect(gpu.state.programs[0]?.uniforms.uReflectionStrength?.value).toBe(0.4);
  });

  it("provides sharp neutral source boundaries that refraction can visibly bend", () => {
    const context = {
      drawingBufferWidth: 600,
      drawingBufferHeight: 300,
      clearColor: vi.fn(),
      deleteTexture: vi.fn(),
      getProgramParameter: vi.fn(() => true),
    } as unknown as WebGL2RenderingContext;
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context);
    render(<MonoOpticalGlass preset="mercury" />);
    const pixels = gpu.state.textures[0]?.image as Uint8Array;
    const width = 512;
    let maxAdjacentContrast = 0;
    for (let y = 0; y < 256; y += 1) {
      for (let x = 1; x < width; x += 1) {
        const i = (y * width + x) * 4;
        maxAdjacentContrast = Math.max(maxAdjacentContrast, Math.abs((pixels[i] ?? 0) - (pixels[i - 4] ?? 0)));
        if (x % 17 === 0 && y % 19 === 0) {
          expect(pixels[i]).toBe(pixels[i + 1]);
          expect(pixels[i]).toBe(pixels[i + 2]);
        }
      }
    }
    expect(maxAdjacentContrast).toBeGreaterThan(24);
  });

  it("pauses its sole animation frame when deactivated", () => {
    const context = {
      drawingBufferWidth: 600,
      drawingBufferHeight: 300,
      clearColor: vi.fn(),
      deleteTexture: vi.fn(),
      getProgramParameter: vi.fn(() => true),
    } as unknown as WebGL2RenderingContext;
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context);

    const view = render(<MonoOpticalGlass preset="frost" active />);
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);

    act(() => view.rerender(<MonoOpticalGlass preset="frost" active={false} />));
    expect(cancelAnimationFrame).toHaveBeenCalledWith(17);
    expect(gpu.state.renderers).toHaveLength(1);
  });

  it("stops and resumes its RAF when reduced motion changes at runtime", () => {
    const context = {
      drawingBufferWidth: 600,
      drawingBufferHeight: 300,
      clearColor: vi.fn(),
      deleteTexture: vi.fn(),
      getProgramParameter: vi.fn(() => true),
    } as unknown as WebGL2RenderingContext;
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context);
    let reducedMotion = false;
    const listeners = new Set<EventListener>();
    const mediaQuery = {
      get matches() { return reducedMotion; },
      addEventListener: vi.fn((_type: string, listener: EventListener) => listeners.add(listener)),
      removeEventListener: vi.fn((_type: string, listener: EventListener) => listeners.delete(listener)),
    } as unknown as MediaQueryList;
    vi.stubGlobal("matchMedia", vi.fn(() => mediaQuery));

    render(<MonoOpticalGlass preset="ledger" active />);
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);

    reducedMotion = true;
    act(() => listeners.forEach((listener) => listener(new Event("change"))));
    expect(screen.getByTestId("mono-optical-glass")).toHaveAttribute("data-optics", "fallback");
    expect(cancelAnimationFrame).toHaveBeenCalledWith(17);
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);

    reducedMotion = false;
    act(() => listeners.forEach((listener) => listener(new Event("change"))));
    expect(screen.getByTestId("mono-optical-glass")).toHaveAttribute("data-optics", "webgl");
    expect(gpu.state.renderers).toHaveLength(2);
    expect(requestAnimationFrame).toHaveBeenCalledTimes(2);
  });

  it("stops and resumes its RAF when saveData changes at runtime", () => {
    const context = {
      drawingBufferWidth: 600,
      drawingBufferHeight: 300,
      clearColor: vi.fn(),
      deleteTexture: vi.fn(),
      getProgramParameter: vi.fn(() => true),
    } as unknown as WebGL2RenderingContext;
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context);
    let saveData = false;
    const listeners = new Set<EventListener>();
    const connection = {
      get saveData() { return saveData; },
      addEventListener: vi.fn((_type: string, listener: EventListener) => listeners.add(listener)),
      removeEventListener: vi.fn((_type: string, listener: EventListener) => listeners.delete(listener)),
    };
    vi.stubGlobal("navigator", Object.assign(Object.create(window.navigator), { connection }));

    render(<MonoOpticalGlass preset="ledger" active />);
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);

    saveData = true;
    act(() => listeners.forEach((listener) => listener(new Event("change"))));
    expect(screen.getByTestId("mono-optical-glass")).toHaveAttribute("data-optics", "fallback");
    expect(cancelAnimationFrame).toHaveBeenCalledWith(17);
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);

    saveData = false;
    act(() => listeners.forEach((listener) => listener(new Event("change"))));
    expect(screen.getByTestId("mono-optical-glass")).toHaveAttribute("data-optics", "webgl");
    expect(gpu.state.renderers).toHaveLength(2);
    expect(requestAnimationFrame).toHaveBeenCalledTimes(2);
  });

  it("keeps the fallback and never restarts RAF after WebGL context loss", () => {
    const context = {
      drawingBufferWidth: 600,
      drawingBufferHeight: 300,
      clearColor: vi.fn(),
      deleteTexture: vi.fn(),
      getProgramParameter: vi.fn(() => true),
    } as unknown as WebGL2RenderingContext;
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context);
    const view = render(<MonoOpticalGlass preset="frost" active />);
    const canvas = view.container.querySelector("canvas");
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);

    act(() => { canvas?.dispatchEvent(new Event("webglcontextlost", { cancelable: true })); });
    expect(screen.getByTestId("mono-optical-glass")).toHaveAttribute("data-optics", "fallback");
    expect(cancelAnimationFrame).toHaveBeenCalledWith(17);

    view.rerender(<MonoOpticalGlass preset="frost" active={false} />);
    view.rerender(<MonoOpticalGlass preset="frost" active />);
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
  });

  it("falls back and releases GPU allocations if the shader program cannot link", () => {
    const loseContext = vi.fn();
    const context = {
      drawingBufferWidth: 600,
      drawingBufferHeight: 300,
      clearColor: vi.fn(),
      deleteTexture: vi.fn(),
      getProgramParameter: vi.fn(() => false),
      getExtension: vi.fn((name: string) => name === "WEBGL_lose_context" ? { loseContext } : null),
    } as unknown as WebGL2RenderingContext;
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context);

    render(<MonoOpticalGlass preset="mercury"><button>Read details</button></MonoOpticalGlass>);

    expect(screen.getByTestId("mono-optical-glass")).toHaveAttribute("data-optics", "fallback");
    expect(screen.getByRole("button", { name: "Read details" })).toBeInTheDocument();
    expect(gpu.state.programRemove).toHaveBeenCalledOnce();
    expect(gpu.state.geometryRemove).toHaveBeenCalledOnce();
    expect(context.deleteTexture).toHaveBeenCalledOnce();
    expect(loseContext).toHaveBeenCalledOnce();
  });

  it("releases the source texture and geometry if program construction throws", () => {
    const context = {
      drawingBufferWidth: 600,
      drawingBufferHeight: 300,
      clearColor: vi.fn(),
      deleteTexture: vi.fn(),
      getProgramParameter: vi.fn(() => true),
    } as unknown as WebGL2RenderingContext;
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context);
    gpu.state.failProgramConstruction = true;

    render(<MonoOpticalGlass preset="ledger"><span>Account details</span></MonoOpticalGlass>);

    expect(screen.getByTestId("mono-optical-glass")).toHaveAttribute("data-optics", "fallback");
    expect(screen.getByText("Account details")).toBeInTheDocument();
    expect(gpu.state.textures).toHaveLength(1);
    expect(gpu.state.geometryRemove).toHaveBeenCalledOnce();
    expect(context.deleteTexture).toHaveBeenCalledOnce();
    expect(requestAnimationFrame).not.toHaveBeenCalled();
  });

  it("releases a rejected renderer context before showing the fallback", () => {
    const loseContext = vi.fn();
    const context = {
      drawingBufferWidth: 600,
      drawingBufferHeight: 300,
      clearColor: vi.fn(),
      getExtension: vi.fn((name: string) => name === "WEBGL_lose_context" ? { loseContext } : null),
    } as unknown as WebGL2RenderingContext;
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context);
    gpu.state.rendererWebgl2 = false;

    render(<MonoOpticalGlass preset="ledger"><span>Private data</span></MonoOpticalGlass>);

    expect(screen.getByTestId("mono-optical-glass")).toHaveAttribute("data-optics", "fallback");
    expect(loseContext).toHaveBeenCalledOnce();
    expect(gpu.state.textures).toHaveLength(0);
  });

  it("releases the acquired context when renderer initialization throws", () => {
    const loseContext = vi.fn();
    const context = {
      getExtension: vi.fn((name: string) => name === "WEBGL_lose_context" ? { loseContext } : null),
    } as unknown as WebGL2RenderingContext;
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context);
    gpu.state.failRendererConstruction = true;

    render(<MonoOpticalGlass preset="ledger"><span>Private data</span></MonoOpticalGlass>);

    expect(screen.getByTestId("mono-optical-glass")).toHaveAttribute("data-optics", "fallback");
    expect(loseContext).toHaveBeenCalledOnce();
    expect(gpu.state.textures).toHaveLength(0);
  });

  it("releases all initialized GPU resources when mesh construction throws", () => {
    const loseContext = vi.fn();
    const context = {
      drawingBufferWidth: 600,
      drawingBufferHeight: 300,
      clearColor: vi.fn(),
      deleteTexture: vi.fn(),
      getProgramParameter: vi.fn(() => true),
      getExtension: vi.fn((name: string) => name === "WEBGL_lose_context" ? { loseContext } : null),
    } as unknown as WebGL2RenderingContext;
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context);
    gpu.state.failMeshConstruction = true;

    render(<MonoOpticalGlass preset="frost"><span>Private data</span></MonoOpticalGlass>);

    expect(screen.getByTestId("mono-optical-glass")).toHaveAttribute("data-optics", "fallback");
    expect(gpu.state.programRemove).toHaveBeenCalledOnce();
    expect(gpu.state.geometryRemove).toHaveBeenCalledOnce();
    expect(context.deleteTexture).toHaveBeenCalledOnce();
    expect(loseContext).toHaveBeenCalledOnce();
  });

  it("releases the context if texture construction throws", () => {
    const loseContext = vi.fn();
    const context = {
      clearColor: vi.fn(),
      getExtension: vi.fn((name: string) => name === "WEBGL_lose_context" ? { loseContext } : null),
    } as unknown as WebGL2RenderingContext;
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context);
    gpu.state.failTextureConstruction = true;

    render(<MonoOpticalGlass preset="ledger" />);

    expect(screen.getByTestId("mono-optical-glass")).toHaveAttribute("data-optics", "fallback");
    expect(loseContext).toHaveBeenCalledOnce();
    expect(gpu.state.programs).toHaveLength(0);
  });

  it("releases the source texture if geometry construction throws", () => {
    const loseContext = vi.fn();
    const context = {
      clearColor: vi.fn(),
      deleteTexture: vi.fn(),
      getExtension: vi.fn((name: string) => name === "WEBGL_lose_context" ? { loseContext } : null),
    } as unknown as WebGL2RenderingContext;
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context);
    gpu.state.failGeometryConstruction = true;

    render(<MonoOpticalGlass preset="ledger" />);

    expect(screen.getByTestId("mono-optical-glass")).toHaveAttribute("data-optics", "fallback");
    expect(gpu.state.textures).toHaveLength(1);
    expect(context.deleteTexture).toHaveBeenCalledOnce();
    expect(loseContext).toHaveBeenCalledOnce();
  });

  it("releases each Strict Mode setup before replaying the effect", () => {
    const context = {
      drawingBufferWidth: 600,
      drawingBufferHeight: 300,
      clearColor: vi.fn(),
      deleteTexture: vi.fn(),
      getProgramParameter: vi.fn(() => true),
    } as unknown as WebGL2RenderingContext;
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context);

    const view = render(<StrictMode><MonoOpticalGlass preset="frost" active /></StrictMode>);

    expect(gpu.state.renderers).toHaveLength(2);
    expect(gpu.state.programRemove).toHaveBeenCalledOnce();
    expect(gpu.state.geometryRemove).toHaveBeenCalledOnce();
    expect(context.deleteTexture).toHaveBeenCalledOnce();
    expect(requestAnimationFrame).toHaveBeenCalledTimes(2);
    expect(cancelAnimationFrame).toHaveBeenCalledTimes(1);

    view.unmount();
    expect(gpu.state.programRemove).toHaveBeenCalledTimes(2);
    expect(gpu.state.geometryRemove).toHaveBeenCalledTimes(2);
    expect(context.deleteTexture).toHaveBeenCalledTimes(2);
    expect(cancelAnimationFrame).toHaveBeenCalledTimes(2);
  });

  it("releases GPU resources if observer setup fails after rendering is initialized", () => {
    const loseContext = vi.fn();
    const context = {
      drawingBufferWidth: 600,
      drawingBufferHeight: 300,
      clearColor: vi.fn(),
      deleteTexture: vi.fn(),
      getProgramParameter: vi.fn(() => true),
      getExtension: vi.fn((name: string) => name === "WEBGL_lose_context" ? { loseContext } : null),
    } as unknown as WebGL2RenderingContext;
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context);
    vi.stubGlobal("ResizeObserver", class {
      constructor() { throw new Error("Observer initialization failed"); }
    });

    render(<MonoOpticalGlass preset="frost"><span>Private data</span></MonoOpticalGlass>);

    expect(screen.getByTestId("mono-optical-glass")).toHaveAttribute("data-optics", "fallback");
    expect(gpu.state.programRemove).toHaveBeenCalledOnce();
    expect(gpu.state.geometryRemove).toHaveBeenCalledOnce();
    expect(context.deleteTexture).toHaveBeenCalledOnce();
    expect(loseContext).toHaveBeenCalledOnce();
  });
});
