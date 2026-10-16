import "@testing-library/jest-dom/vitest";
import { StrictMode } from "react";
import { renderToString } from "react-dom/server";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MonoGoldLiquidBackground } from "./mono-gold-liquid-background";
import { normalizeGoldLiquidSettings } from "./mono-gold-liquid-settings";

const gpu = vi.hoisted(() => ({ create: vi.fn(), resize: vi.fn(), render: vi.fn(), update: vi.fn(), dispose: vi.fn() }));
vi.mock("./mono-gold-liquid-renderer", async () => ({
  ...await vi.importActual<typeof import("./mono-gold-liquid-renderer")>("./mono-gold-liquid-renderer"),
  createGoldLiquidRenderer: gpu.create,
}));
const frames = new Map<number, FrameRequestCallback>();
const media = new Map<string, EventTarget & { matches: boolean }>();
let nextFrame = 0;
let visible = "visible";
beforeEach(() => {
  frames.clear(); media.clear(); nextFrame = 0; visible = "visible";
  gpu.create.mockReset().mockReturnValue(gpu); gpu.resize.mockReset().mockReturnValue(true);
  gpu.render.mockReset().mockReturnValue(true); gpu.update.mockReset(); gpu.dispose.mockReset();
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { frames.set(++nextFrame, callback); return nextFrame; });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  vi.stubGlobal("IntersectionObserver", undefined);
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  vi.stubGlobal("matchMedia", (query: string) => {
    if (!media.has(query)) media.set(query, Object.assign(new EventTarget(), { matches: false, media: query }));
    return media.get(query);
  });
  vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visible as DocumentVisibilityState);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 390, 844));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); frames.clear(); });
function changeMedia(query: string, matches: boolean) {
  const entry = media.get(query)!; entry.matches = matches;
  act(() => entry.dispatchEvent(new Event("change")));
}
function step(timestamp: number) {
  act(() => {
    const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback(timestamp));
  });
}
function pointerDown(target: HTMLElement, x = 195, y = 211) {
  const event = new Event("pointerdown", { bubbles: true, cancelable: true });
  Object.assign(event, { clientX: x, clientY: y, button: 0, isPrimary: true, pointerType: "touch" });
  fireEvent(target, event);
  return event;
}

describe("Gold decorative canvas lifecycle", () => {
  it("answers touch and scroll in one finite loop without intercepting controls or retaining a halo", () => {
    const view = render(<div data-material-scrollport><button>Wallet action</button>
      <MonoGoldLiquidBackground settings={normalizeGoldLiquidSettings({ flowSpeed: 0 })} /></div>);
    const host = view.container.firstElementChild as HTMLElement;
    expect(frames.size).toBe(0);
    const event = pointerDown(view.getByRole("button", { name: "Wallet action" }));
    expect(event.defaultPrevented).toBe(false);
    expect(frames.size).toBe(1);
    step(0); step(40);
    expect(gpu.render.mock.calls.at(-1)?.[1]).toMatchObject({ tapUv: [0.5, 0.75], tapStrength: 1 });
    host.scrollTop = 100;
    const scroll = new Event("scroll", { cancelable: true });
    fireEvent(host, scroll);
    expect(scroll.defaultPrevented).toBe(false);
    expect(frames.size).toBe(1);
    step(80);
    expect(gpu.render.mock.calls.at(-1)?.[1]?.scrollShiftCss).toBeGreaterThan(0);
    expect(gpu.render.mock.calls.at(-1)?.[1]?.scrollShiftCss).toBeLessThanOrEqual(6);
    for (let stamp = 120; stamp <= 1040; stamp += 40) step(stamp);
    expect(gpu.render.mock.calls.at(-1)?.[1]).toBeUndefined();
    expect(frames.size).toBe(0);
    expect(gpu.create).toHaveBeenCalledTimes(1);
    expect(view.getByRole("button", { name: "Wallet action" })).toBeEnabled();
    const draws = gpu.render.mock.calls.length;
    view.unmount();
    pointerDown(host); host.scrollTop = 200; fireEvent.scroll(host);
    step(1200);
    expect(frames.size).toBe(0);
    expect(gpu.render.mock.calls.length).toBe(draws);
    expect(gpu.dispose).toHaveBeenCalledTimes(1);
  });
  it("resets response on pause and ignores reduced, inactive and clean-zero interactions", () => {
    const still = normalizeGoldLiquidSettings({ flowSpeed: 0 });
    const view = render(<div data-material-scrollport><button>Wallet action</button>
      <MonoGoldLiquidBackground settings={still} /></div>);
    const target = view.getByRole("button", { name: "Wallet action" });
    pointerDown(target); step(0); step(40);
    expect(gpu.render.mock.calls.at(-1)?.[1]?.tapStrength).toBe(1);
    changeMedia("(prefers-reduced-motion: reduce)", true);
    expect(frames.size).toBe(0);
    expect(gpu.render.mock.calls.at(-1)?.[1]).toBeUndefined();
    pointerDown(target); expect(frames.size).toBe(0);
    changeMedia("(prefers-reduced-motion: reduce)", false);
    pointerDown(target); expect(frames.size).toBe(1);
    visible = "hidden";
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(frames.size).toBe(0);
    visible = "visible";
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(gpu.render.mock.calls.at(-1)?.[1]).toBeUndefined();
    expect(frames.size).toBe(0);
    view.rerender(<div data-material-scrollport><button>Wallet action</button>
      <MonoGoldLiquidBackground active={false} settings={still} /></div>);
    pointerDown(view.getByRole("button", { name: "Wallet action" })); expect(frames.size).toBe(0);
    view.rerender(<div data-material-scrollport><button>Wallet action</button>
      <MonoGoldLiquidBackground settings={normalizeGoldLiquidSettings({ ior: 0 })} /></div>);
    pointerDown(view.getByRole("button", { name: "Wallet action" })); expect(frames.size).toBe(0);
    expect(gpu.create).toHaveBeenCalledTimes(1);
  });
  it("expires a pending response after a stalled visible frame while keeping ambient time bounded", () => {
    const view = render(<div data-material-scrollport><button>Wallet action</button>
      <MonoGoldLiquidBackground settings={normalizeGoldLiquidSettings({ flowSpeed: 0 })} /></div>);
    pointerDown(view.getByRole("button", { name: "Wallet action" }));
    step(0); step(40);
    expect(gpu.render.mock.calls.at(-1)?.[1]?.tapStrength).toBe(1);
    step(2000);
    expect(gpu.render.mock.calls.at(-1)?.[1]).toBeUndefined();
    expect(gpu.render.mock.calls.at(-1)?.[0]).toBeCloseTo(0.09);
    expect(frames.size).toBe(0);
    expect(gpu.create).toHaveBeenCalledTimes(1);
  });
  it("keeps response listeners passive and excludes disabled targets and cancelled gestures", () => {
    const listen = vi.spyOn(HTMLElement.prototype, "addEventListener");
    const view = render(<div data-material-scrollport><button disabled>Disabled</button><button>Ready</button>
      <MonoGoldLiquidBackground settings={normalizeGoldLiquidSettings({ flowSpeed: 0 })} /></div>);
    const host = view.container.firstElementChild as HTMLElement;
    for (const type of ["pointerdown", "pointercancel", "scroll"]) {
      const registration = listen.mock.calls.find((call, index) => call[0] === type && listen.mock.contexts[index] === host);
      expect(registration?.[2]).toEqual({ passive: true });
    }
    pointerDown(view.getByRole("button", { name: "Disabled" })); expect(frames.size).toBe(0);
    pointerDown(view.getByRole("button", { name: "Ready" })); expect(frames.size).toBe(1);
    fireEvent(host, new Event("pointercancel", { bubbles: true }));
    step(0); step(40);
    expect(gpu.render.mock.calls.at(-1)?.[1]).toBeUndefined();
    expect(frames.size).toBe(0);
  });
  it("leaves accessible DOM with a hidden decorative canvas on GL failure", () => {
    gpu.create.mockReturnValue(null);
    const view = render(<div><button>Wallet action</button><MonoGoldLiquidBackground /></div>);
    expect(view.getByRole("button", { name: "Wallet action" })).toBeEnabled();
    expect(view.container.querySelector("[data-gold-liquid-state]")).toHaveAttribute("data-gold-liquid-state", "fallback");
    expect(view.container.querySelector("canvas")).toHaveAttribute("hidden");
    expect(view.container.querySelector("canvas")).toHaveAttribute("aria-hidden", "true");
    expect(frames.size).toBe(0);
  });
  it("pauses on scene/document gates and resumes without allocating another renderer", () => {
    const view = render(<MonoGoldLiquidBackground active />);
    expect(frames.size).toBe(1);
    const pausedCallbacks = [...frames.values()];
    view.rerender(<MonoGoldLiquidBackground active={false} />);
    act(() => pausedCallbacks.forEach(callback => callback(100)));
    expect(frames.size).toBe(0);
    view.rerender(<MonoGoldLiquidBackground active />);
    expect(frames.size).toBe(1);
    visible = "hidden";
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(frames.size).toBe(0);
    visible = "visible";
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(frames.size).toBe(1);
    expect(gpu.create).toHaveBeenCalledTimes(1);
    view.unmount();
    expect(frames.size).toBe(0);
    expect(gpu.dispose).toHaveBeenCalledTimes(1);
  });
  it("stops motion immediately and uses opaque fallback for system/effects gates", () => {
    const view = render(<MonoGoldLiquidBackground />);
    changeMedia("(prefers-reduced-motion: reduce)", true);
    expect(frames.size).toBe(0);
    expect(view.container.querySelector("[data-gold-liquid-state]")).toHaveAttribute("data-gold-liquid-state", "ready");
    changeMedia("(prefers-reduced-transparency: reduce)", true);
    expect(view.container.querySelector("canvas")).toHaveAttribute("hidden");
    expect(gpu.dispose).toHaveBeenCalledTimes(1);
    view.rerender(<MonoGoldLiquidBackground effectsDisabled />);
    expect(frames.size).toBe(0);
    expect(gpu.create).toHaveBeenCalledTimes(1);
  });
  it("never initializes GPU when forced colors or effectsDisabled are already active", () => {
    const first = render(<MonoGoldLiquidBackground effectsDisabled />);
    expect(gpu.create).not.toHaveBeenCalled(); first.unmount();
    media.set("(forced-colors: active)", Object.assign(new EventTarget(), { matches: true }));
    const view = render(<MonoGoldLiquidBackground />);
    expect(gpu.create).not.toHaveBeenCalled();
    expect(view.container.querySelector("canvas")).toHaveAttribute("hidden");
  });
  it("releases context loss into fallback and only rebuilds on the restore event", () => {
    const view = render(<MonoGoldLiquidBackground />);
    const canvas = view.container.querySelector("canvas")!;
    act(() => canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true })));
    expect(frames.size).toBe(0);
    expect(canvas).toHaveAttribute("hidden");
    act(() => window.dispatchEvent(new Event("resize")));
    expect(gpu.create).toHaveBeenCalledTimes(1);
    act(() => canvas.dispatchEvent(new Event("webglcontextrestored")));
    expect(gpu.create).toHaveBeenCalledTimes(2);
    expect(frames.size).toBe(1);
  });
  it("caps draws at 30/s, uses viewport geometry and cleans StrictMode/late callbacks", () => {
    const view = render(<StrictMode><MonoGoldLiquidBackground /></StrictMode>);
    const step = (timestamp: number) => act(() => {
      const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback(timestamp));
    });
    const before = gpu.render.mock.calls.length;
    step(0); step(16); step(32); step(48); step(64); step(80);
    expect(gpu.render.mock.calls.length - before).toBeLessThanOrEqual(2);
    expect(gpu.resize.mock.calls.at(-1)?.slice(0, 2)).toEqual([390, 844]);
    const late = [...frames.values()]; view.unmount(); const draws = gpu.render.mock.calls.length;
    act(() => late.forEach(callback => callback(1000)));
    expect(gpu.render.mock.calls.length).toBe(draws);
    expect(frames.size).toBe(0);
    expect(gpu.dispose.mock.calls.length).toBe(gpu.create.mock.calls.length);
  });
  it("does not initialize browser resources during SSR", () => {
    expect(renderToString(<MonoGoldLiquidBackground />)).toContain("aria-hidden=\"true\"");
    expect(gpu.create).not.toHaveBeenCalled();
    expect(frames.size).toBe(0);
  });
  it("allocates only onscreen and ignores observer callbacks after cleanup", () => {
    let intersect: (visible: boolean) => void = () => undefined;
    vi.stubGlobal("IntersectionObserver", class {
      constructor(callback: IntersectionObserverCallback) {
        intersect = value => callback([{ isIntersecting: value, intersectionRatio: value ? 1 : 0 } as IntersectionObserverEntry],
          this as unknown as IntersectionObserver);
      }
      observe() {} disconnect() {}
    });
    const view = render(<MonoGoldLiquidBackground />);
    expect(gpu.create).not.toHaveBeenCalled();
    act(() => intersect(true)); expect(frames.size).toBe(1);
    act(() => intersect(false)); expect(frames.size).toBe(0);
    view.unmount();
    act(() => intersect(true));
    expect(gpu.create).toHaveBeenCalledTimes(1);
    expect(frames.size).toBe(0);
  });
  it("redraws after a temporarily zero viewport without leaving the canvas hidden", () => {
    const view = render(<MonoGoldLiquidBackground />);
    const box = vi.mocked(HTMLElement.prototype.getBoundingClientRect);
    box.mockReturnValue(new DOMRect());
    act(() => window.dispatchEvent(new Event("resize")));
    expect(view.container.querySelector("canvas")).toHaveAttribute("hidden");
    box.mockReturnValue(new DOMRect(0, 0, 390, 844));
    act(() => window.dispatchEvent(new Event("resize")));
    for (const timestamp of [0, 48]) act(() => {
      const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback(timestamp));
    });
    expect(view.container.querySelector("canvas")).not.toHaveAttribute("hidden");
    expect(gpu.create).toHaveBeenCalledTimes(1);
  });
});
