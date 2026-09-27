import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MonoActionArtwork } from "./mono-action-artwork";
import { createDefaultActionArtwork } from "./model";

type FakeAnimation = { cancel: ReturnType<typeof vi.fn> };

let animations: FakeAnimation[];
let reduced: EventTarget & { matches: boolean };
let connection: EventTarget & { saveData: boolean };
let intersection: IntersectionObserverCallback;
const priorAnimate = Object.getOwnPropertyDescriptor(Element.prototype, "animate");

beforeEach(() => {
  animations = [];
  Object.defineProperty(Element.prototype, "animate", { configurable: true, value: vi.fn(() => {
    const animation = { cancel: vi.fn() };
    animations.push(animation);
    return animation;
  }) });
  reduced = Object.assign(new EventTarget(), { matches: false });
  vi.stubGlobal("matchMedia", vi.fn(() => reduced as MediaQueryList));
  connection = Object.assign(new EventTarget(), { saveData: false });
  Object.defineProperty(navigator, "connection", { configurable: true, value: connection });
  vi.stubGlobal("IntersectionObserver", class {
    constructor(callback: IntersectionObserverCallback) { intersection = callback; }
    observe() {}
    disconnect() {}
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  if (priorAnimate) Object.defineProperty(Element.prototype, "animate", priorAnimate);
  else Reflect.deleteProperty(Element.prototype, "animate");
  Reflect.deleteProperty(navigator, "connection");
});

const volume = { ...createDefaultActionArtwork(), packId: "volume-v1" as const };

describe("MONO action artwork lifecycle", () => {
  it("renders only allowlisted decorative PNG artwork; Original has no layer or animation", () => {
    const { container, rerender } = render(<MonoActionArtwork actionId="quick.send" config={createDefaultActionArtwork()} active trigger={5} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<MonoActionArtwork actionId="quick.send" config={volume} active trigger={5} />);
    const image = container.querySelector("img");
    expect(image).toHaveAttribute("src", "/action-icons/novex-owner-v1/volume-v1/send.png");
    expect(image).toHaveAttribute("aria-hidden", "true");
    expect(image).toHaveAttribute("draggable", "false");
    expect(Element.prototype.animate).not.toHaveBeenCalled();
  });

  it("starts one finite passage and afterglow per new trigger, replacing an unfinished pair", () => {
    const config = { ...volume, energy: { enabled: true, intensity: 0.55, durationMs: 860, width: 0.4 } };
    const { container, rerender } = render(<MonoActionArtwork actionId="quick.send" config={config} active trigger={1} />);
    expect(animations).toHaveLength(0);
    rerender(<MonoActionArtwork actionId="quick.send" config={config} active trigger={2} />);
    expect(animations).toHaveLength(2);
    expect(animations[0]?.cancel).not.toHaveBeenCalled();
    const options = vi.mocked(Element.prototype.animate).mock.calls.map(call => call[1] as KeyframeAnimationOptions);
    const passage = vi.mocked(Element.prototype.animate).mock.calls[0]?.[0] as Keyframe[];
    expect(options[0]?.duration).toBeLessThanOrEqual(860);
    expect(options[0]?.iterations).toBe(1);
    expect(options[1]?.delay).toBeGreaterThan(0);
    expect(passage[1]?.opacity).toBeGreaterThan(0);
    expect(passage[1]?.transform).not.toBe(passage[2]?.transform);
    expect(container.firstElementChild).toHaveStyle({ "--energy-width": "40%" });
    rerender(<MonoActionArtwork actionId="quick.send" config={config} active trigger={2} />);
    expect(animations).toHaveLength(2);
    rerender(<MonoActionArtwork actionId="quick.send" config={config} active trigger={3} />);
    expect(animations).toHaveLength(4);
    expect(animations[0]?.cancel).toHaveBeenCalledOnce();
    expect(animations[1]?.cancel).toHaveBeenCalledOnce();
    rerender(<MonoActionArtwork actionId="quick.send" config={config} active={false} trigger={3} />);
    expect(animations[2]?.cancel).toHaveBeenCalledOnce();
    expect(animations[3]?.cancel).toHaveBeenCalledOnce();
  });

  it("cancels on hidden/offscreen and never replays a skipped trigger on resume", () => {
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    const { container, rerender } = render(<MonoActionArtwork actionId="quick.receive" config={volume} active trigger={1} />);
    rerender(<MonoActionArtwork actionId="quick.receive" config={volume} active trigger={2} />);
    expect(animations).toHaveLength(2);
    visibility.mockReturnValue("hidden");
    fireEvent(document, new Event("visibilitychange"));
    expect(animations[0]?.cancel).toHaveBeenCalledOnce();
    rerender(<MonoActionArtwork actionId="quick.receive" config={volume} active trigger={3} />);
    expect(animations).toHaveLength(2);
    visibility.mockReturnValue("visible");
    fireEvent(document, new Event("visibilitychange"));
    expect(animations).toHaveLength(2);
    rerender(<MonoActionArtwork actionId="quick.receive" config={volume} active trigger={4} />);
    expect(animations).toHaveLength(4);
    act(() => intersection([{ isIntersecting: false, target: container.firstElementChild } as IntersectionObserverEntry], {} as IntersectionObserver));
    expect(animations[2]?.cancel).toHaveBeenCalledOnce();
    rerender(<MonoActionArtwork actionId="quick.receive" config={volume} active trigger={5} />);
    expect(animations).toHaveLength(4);
  });

  it("respects reduced motion and saveData, and releases animation on unmount", () => {
    const { rerender, unmount } = render(<MonoActionArtwork actionId="quick.swap" config={volume} active trigger={1} />);
    rerender(<MonoActionArtwork actionId="quick.swap" config={volume} active trigger={2} />);
    reduced.matches = true;
    act(() => reduced.dispatchEvent(new Event("change")));
    expect(animations[0]?.cancel).toHaveBeenCalledOnce();
    rerender(<MonoActionArtwork actionId="quick.swap" config={volume} active trigger={3} />);
    expect(animations).toHaveLength(2);
    reduced.matches = false;
    act(() => reduced.dispatchEvent(new Event("change")));
    rerender(<MonoActionArtwork actionId="quick.swap" config={volume} active trigger={4} />);
    expect(animations).toHaveLength(4);
    connection.saveData = true;
    act(() => connection.dispatchEvent(new Event("change")));
    expect(animations[2]?.cancel).toHaveBeenCalledOnce();
    connection.saveData = false;
    act(() => connection.dispatchEvent(new Event("change")));
    rerender(<MonoActionArtwork actionId="quick.swap" config={volume} active trigger={5} />);
    expect(animations).toHaveLength(6);
    unmount();
    expect(animations[4]?.cancel).toHaveBeenCalledOnce();
  });
});
