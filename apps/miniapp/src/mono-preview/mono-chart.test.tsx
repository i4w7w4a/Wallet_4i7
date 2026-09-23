import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MonoChart } from "./mono-chart";
import { MONO_CHART_DEFAULT } from "./mono-scene-lab-contract";

afterEach(cleanup);
const props = { values: [12540, 12610, 12840.75], format: { locale: "ru-RU", currency: "USD" },
  hidden: false, period: "1D" as const, appearance: MONO_CHART_DEFAULT };

it("removes the complete chart including footer and period controls when switched off", () => {
  const { container } = render(<MonoChart {...props} appearance={{ ...props.appearance, visible: false }} />);
  expect(container).toBeEmptyDOMElement();
});

it("keeps private values out of SVG, labels and fallback content", () => {
  const { container } = render(<MonoChart {...props} hidden />);
  expect(screen.getByText("График скрыт")).toBeInTheDocument();
  expect(container.querySelector("svg")).toBeNull();
  expect(container.innerHTML).not.toMatch(/12540|12.540|840|12610/);
});

it("requests an actual data period from the parent", () => {
  const onPeriodChange = vi.fn();
  render(<MonoChart {...props} onPeriodChange={onPeriodChange} />);
  fireEvent.click(screen.getByRole("button", { name: "За неделю" }));
  expect(onPeriodChange).toHaveBeenCalledExactlyOnceWith("1W");
  expect(screen.getByRole("button", { name: "За день" })).toHaveAttribute("aria-pressed", "true");
});

it("makes the original values available for all three chart variants", () => {
  const { rerender } = render(<MonoChart {...props} />);
  for (const variant of ["line", "area", "step"] as const) {
    rerender(<MonoChart {...props} appearance={{ visible: true, variant }} />);
    expect(screen.getByRole("img", { name: /Динамика баланса/ })).toHaveAccessibleDescription(/12.*540.*12.*610.*12.*840,75/);
  }
});

it("shows an unavailable state for an invalid dataset, never a misleading line", () => {
  const { container } = render(<MonoChart {...props} values={[NaN]} />);
  expect(screen.getByText("Нет данных за этот период")).toBeInTheDocument();
  expect(container.querySelector("svg")).toBeNull();
});
