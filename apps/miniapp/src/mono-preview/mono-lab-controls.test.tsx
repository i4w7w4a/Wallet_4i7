import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MonoLabIconButton, MonoLabSliderRow } from "./mono-lab-controls";

afterEach(cleanup);

describe("compact lab controls", () => {
  it("exposes the icon command and a dismissible focus tooltip without stealing clicks", () => {
    const click = vi.fn();
    render(<MonoLabIconButton label="Вернуть исходное" onClick={click}><span>↺</span></MonoLabIconButton>);
    const button = screen.getByRole("button", { name: "Вернуть исходное" });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    fireEvent.focus(button);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Вернуть исходное");
    fireEvent.keyDown(button, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    fireEvent.click(button);
    expect(click).toHaveBeenCalledOnce();
  });

  it("coalesces keyboard repeats into one gesture and does not commit twice on blur", () => {
    const change = vi.fn(), commit = vi.fn(), start = vi.fn();
    render(<MonoLabSliderRow label="Размер" min={10} max={20} step={1} value={15} onChange={change} onCommit={commit} onStart={start} />);
    const slider = screen.getByRole("slider", { name: "Размер" });
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    fireEvent.change(slider, { target: { value: "16" } });
    fireEvent.keyDown(slider, { key: "ArrowRight", repeat: true });
    fireEvent.change(slider, { target: { value: "17" } });
    fireEvent.keyUp(slider, { key: "ArrowRight" });
    fireEvent.blur(slider);
    expect(change.mock.calls).toEqual([[16], [17]]);
    expect(start).toHaveBeenCalledOnce();
    expect(commit.mock.calls).toEqual([[17]]);
  });

  it("accepts an editable numeric value, clamps on commit and restores an empty edit", () => {
    const change = vi.fn(), commit = vi.fn();
    render(<MonoLabSliderRow label="Межстрочный" min={1.42} max={1.6} step={0.01} value={1.46} onChange={change} onCommit={commit} />);
    const field = screen.getByRole("spinbutton", { name: "Межстрочный — значение" });
    fireEvent.focus(field);
    fireEvent.change(field, { target: { value: "2.1" } });
    expect(change).not.toHaveBeenCalled();
    fireEvent.blur(field);
    expect(change).toHaveBeenLastCalledWith(1.6);
    expect(commit).toHaveBeenLastCalledWith(1.6);
    fireEvent.focus(field);
    fireEvent.change(field, { target: { value: "" } });
    fireEvent.blur(field);
    expect(change).toHaveBeenCalledOnce();
    expect(field).toHaveValue(1.46);
  });

  it("cancels numeric edits with Escape and commits Enter only once", () => {
    const change = vi.fn(), commit = vi.fn();
    render(<MonoLabSliderRow label="Вес" min={100} max={700} step={10} value={400} onChange={change} onCommit={commit} />);
    const field = screen.getByRole("spinbutton", { name: "Вес — значение" });
    act(() => field.focus());
    fireEvent.change(field, { target: { value: "500" } });
    fireEvent.keyDown(field, { key: "Escape" });
    expect(change).not.toHaveBeenCalled();
    act(() => field.focus());
    fireEvent.change(field, { target: { value: "600" } });
    fireEvent.keyDown(field, { key: "Enter" });
    expect(change.mock.calls).toEqual([[600]]);
    expect(commit.mock.calls).toEqual([[600]]);
  });
});
