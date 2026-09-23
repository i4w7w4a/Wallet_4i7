// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MONO_BACKGROUND_DEFAULTS } from "./mono-background-recipes";
import { mountMonoBackgroundMotion } from "./mono-background-recipes-runtime";

describe("event-driven atmosphere lifecycle", () => {
  let surface: HTMLDivElement;
  let layer: HTMLDivElement;
  let dispose: (() => void) | undefined;
  let hidden: boolean;
  let fine: MediaQueryList & { matches: boolean };
  let reduced: MediaQueryList & { matches: boolean };
  let connection: EventTarget & { saveData: boolean };
  let visibility: IntersectionObserverCallback;
  const move = () => {
    const event = new MouseEvent("pointermove", { clientX: 355, clientY: 555 });
    Object.defineProperty(event, "pointerType", { value: "mouse" });
    surface.dispatchEvent(event);
  };
  beforeEach(() => {
    surface = document.createElement("div"); layer = document.createElement("div");
    surface.append(layer); document.body.append(surface);
    surface.getBoundingClientRect = () => ({ left: 0, top: 0, width: 390, height: 844 }) as DOMRect;
    const media = (matches: boolean) => Object.assign(new EventTarget(), { matches }) as unknown as typeof fine;
    fine = media(true); reduced = media(false); hidden = false;
    connection = Object.assign(new EventTarget(), { saveData: false });
    vi.stubGlobal("matchMedia", (query: string) => query.includes("reduced-motion") ? reduced : fine);
    vi.stubGlobal("IntersectionObserver", class {
      constructor(callback: IntersectionObserverCallback) { visibility = callback; }
      observe() {} disconnect() {}
    });
    vi.spyOn(document, "visibilityState", "get").mockImplementation(() => hidden ? "hidden" : "visible");
    Object.defineProperty(navigator, "connection", { value: connection, configurable: true });
  });
  afterEach(() => { dispose?.(); document.body.replaceChildren(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
  const mount = (overrides = {}) => mountMonoBackgroundMotion(layer, surface,
    MONO_BACKGROUND_DEFAULTS.obsidian, { active: true, hostActive: true, effectsDisabled: false, ...overrides });

  it("moves only decorative variables, resets on leave and owns no RAF or timer", () => {
    const raf = vi.spyOn(window, "requestAnimationFrame");
    const timer = vi.spyOn(window, "setTimeout");
    dispose = mount(); move();
    expect(layer.dataset.motion).toBe("ready");
    expect(layer.style.getPropertyValue("--recipe-x")).not.toBe("0px");
    expect(surface.style.cssText).toBe("");
    surface.dispatchEvent(new Event("pointerleave"));
    expect(layer.style.getPropertyValue("--recipe-x")).toBe("0px");
    expect(raf).not.toHaveBeenCalled(); expect(timer).not.toHaveBeenCalled();
    dispose(); move(); expect(layer.style.getPropertyValue("--recipe-x")).toBe("0px");
  });
  it("detaches tracking on hidden, reduced, coarse, saveData and offscreen, then resumes", () => {
    dispose = mount(); move();
    hidden = true; document.dispatchEvent(new Event("visibilitychange")); move();
    expect(layer.dataset.motion).toBe("hidden");
    expect(layer.style.getPropertyValue("--recipe-x")).toBe("0px");
    hidden = false; document.dispatchEvent(new Event("visibilitychange")); move();
    expect(layer.style.getPropertyValue("--recipe-x")).not.toBe("0px");
    reduced.matches = true; reduced.dispatchEvent(new Event("change")); move();
    expect(layer.dataset.motion).toBe("reduced");
    reduced.matches = false; reduced.dispatchEvent(new Event("change"));
    fine.matches = false; fine.dispatchEvent(new Event("change")); move();
    expect(layer.dataset.motion).toBe("coarse");
    fine.matches = true; fine.dispatchEvent(new Event("change"));
    connection.saveData = true; connection.dispatchEvent(new Event("change")); move();
    expect(layer.dataset.motion).toBe("save-data");
    connection.saveData = false; connection.dispatchEvent(new Event("change"));
    visibility([{ isIntersecting: false }] as IntersectionObserverEntry[], {} as IntersectionObserver); move();
    expect(layer.dataset.motion).toBe("offscreen");
    expect(layer.style.getPropertyValue("--recipe-x")).toBe("0px");
  });
  it("does not acquire pointer listeners or observers for inactive/effects-off scenes", () => {
    const listen = vi.spyOn(surface, "addEventListener");
    for (const overrides of [{ active: false }, { hostActive: false }, { effectsDisabled: true }]) {
      dispose = mount(overrides); move();
      expect(layer.style.getPropertyValue("--recipe-x")).toBe("0px");
      dispose();
    }
    expect(listen).not.toHaveBeenCalled();
  });
});
