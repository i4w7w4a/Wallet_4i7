import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MonoColorField, monoColorFieldPoint, monoColorFieldPosition } from "./mono-color-field";

function pointer(element: Element, type: string, pointerId: number, clientX: number, clientY: number) {
  const event = new Event(type, { bubbles: true });
  Object.defineProperties(event, {
    pointerId: { value: pointerId }, clientX: { value: clientX }, clientY: { value: clientY },
  });
  fireEvent(element, event);
}

describe("MONO color field geometry", () => {
  it("maps conic-gradient orientation and clamps points outside the circle", () => {
    expect(monoColorFieldPoint(100, 0, 200, 200, 0.2, 44)).toEqual({ hue: 0, chroma: 0.2 });
    expect(monoColorFieldPoint(200, 100, 200, 200, 0.2, 44)).toEqual({ hue: 90, chroma: 0.2 });
    expect(monoColorFieldPoint(100, 200, 200, 200, 0.2, 44)).toEqual({ hue: 180, chroma: 0.2 });
    expect(monoColorFieldPoint(0, 100, 200, 200, 0.2, 44)).toEqual({ hue: 270, chroma: 0.2 });
    expect(monoColorFieldPoint(500, 100, 200, 200, 0.2, 44)).toEqual({ hue: 90, chroma: 0.2 });
  });

  it("uses square radial chroma and preserves hue at the neutral center", () => {
    expect(monoColorFieldPoint(150, 100, 200, 200, 0.2, 44)).toEqual({ hue: 90, chroma: 0.05 });
    expect(monoColorFieldPoint(100, 100, 200, 200, 0.2, 44)).toEqual({ hue: 44, chroma: 0 });
    expect(monoColorFieldPosition(90, 0.05, 0.2)).toEqual({ x: 0.5, y: 0 });
    expect(monoColorFieldPosition(0, 0.2, 0.2)).toEqual({ x: 0, y: -1 });
    expect(monoColorFieldPoint(0, 0, 0, 0, 0.2, 44)).toEqual({ hue: 44, chroma: 0 });
  });
});

describe("MONO color field interaction", () => {
  it("does not start an invisible gesture while the palette is disabled", () => {
    const onChange = vi.fn(), onGestureStart = vi.fn(), onGestureEnd = vi.fn();
    render(<MonoColorField hue={44} chroma={0.05} maxChroma={0.2} disabled
      onChange={onChange} onGestureStart={onGestureStart} onGestureEnd={onGestureEnd} />);
    const field = screen.getByRole("group", { name: "Цветовое поле" });
    Object.defineProperty(field, "getBoundingClientRect", { value: () => ({ left: 0, top: 0, width: 200, height: 200 }) });
    pointer(field, "pointerdown", 9, 200, 100);
    pointer(field, "pointermove", 9, 100, 0);
    pointer(field, "pointerup", 9, 100, 0);
    expect(field).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("slider", { name: "Тон" })).toBeDisabled();
    expect(onGestureStart).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
    expect(onGestureEnd).not.toHaveBeenCalled();
  });

  it("starts and ends exactly one transaction per pointer gesture", () => {
    const onChange = vi.fn(), onGestureStart = vi.fn(), onGestureEnd = vi.fn();
    render(<MonoColorField hue={44} chroma={0.05} maxChroma={0.2}
      onChange={onChange} onGestureStart={onGestureStart} onGestureEnd={onGestureEnd} />);
    const field = screen.getByRole("group", { name: "Цветовое поле" });
    Object.defineProperty(field, "getBoundingClientRect", { value: () => ({ left: 0, top: 0, width: 200, height: 200 }) });
    const capture = vi.fn(), release = vi.fn();
    Object.defineProperty(field, "setPointerCapture", { value: capture });
    Object.defineProperty(field, "releasePointerCapture", { value: release });
    Object.defineProperty(field, "hasPointerCapture", { value: () => true });
    pointer(field, "pointermove", 7, 200, 100);
    expect(onChange).not.toHaveBeenCalled();
    pointer(field, "pointerdown", 7, 100, 0);
    pointer(field, "pointermove", 7, 200, 100);
    pointer(field, "pointerup", 7, 200, 100);
    pointer(field, "pointerup", 7, 200, 100);
    expect(capture).toHaveBeenCalledWith(7);
    expect(release).toHaveBeenCalledWith(7);
    expect(onGestureStart).toHaveBeenCalledTimes(1);
    expect(onGestureEnd).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ hue: 90, chroma: 0.2 });
  });

  it("ends a cancelled gesture once and ignores later moves", () => {
    const onChange = vi.fn(), onGestureStart = vi.fn(), onGestureEnd = vi.fn();
    render(<MonoColorField hue={44} chroma={0.05} maxChroma={0.2}
      onChange={onChange} onGestureStart={onGestureStart} onGestureEnd={onGestureEnd} />);
    const field = screen.getByRole("group", { name: "Цветовое поле" });
    Object.defineProperty(field, "getBoundingClientRect", { value: () => ({ left: 0, top: 0, width: 200, height: 200 }) });
    Object.defineProperty(field, "setPointerCapture", { value: vi.fn() });
    pointer(field, "pointerdown", 8, 100, 0);
    pointer(field, "pointercancel", 8, 100, 0);
    pointer(field, "pointermove", 8, 200, 100);
    expect(onGestureStart).toHaveBeenCalledTimes(1);
    expect(onGestureEnd).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("exposes native labelled sliders as a keyboard alternative", () => {
    const onChange = vi.fn();
    render(<MonoColorField hue={44} chroma={0.05} maxChroma={0.2}
      onChange={onChange} onGestureStart={vi.fn()} onGestureEnd={vi.fn()} />);
    fireEvent.change(screen.getByRole("slider", { name: "Тон" }), { target: { value: "180" } });
    fireEvent.change(screen.getByRole("slider", { name: "Интенсивность" }), { target: { value: "75" } });
    expect(onChange).toHaveBeenNthCalledWith(1, { hue: 180, chroma: 0.05 });
    expect(onChange).toHaveBeenNthCalledWith(2, { hue: 44, chroma: 0.15 });
  });
});
