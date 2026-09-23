import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MonoBalance } from "./mono-balance";
import { MONO_BALANCE_DEFAULT } from "./mono-scene-lab-contract";

afterEach(cleanup);
const props = { value: 12840.75, format: { locale: "ru-RU", currency: "USD" },
  change24h: -2.34, hidden: false, appearance: MONO_BALANCE_DEFAULT };

it("keeps the whole Intl amount in DOM order and announces one unambiguous currency value", () => {
  const { container } = render(<MonoBalance {...props} />);
  expect(container.querySelector("[data-mono-balance-visual]")).toHaveTextContent("12 840,75 $");
  expect(container.querySelector('[data-number-part="fraction"]')).toHaveTextContent("75");
  expect(screen.getByRole("img", { name: /12.*840,75.*доллара США/ })).toBeInTheDocument();
  expect(screen.getByText("−", { exact: true })).toBeInTheDocument();
});

it("removes private amounts and change from both visible and accessible DOM", () => {
  const { container } = render(<MonoBalance {...props} hidden />);
  expect(screen.getByRole("img", { name: "Баланс скрыт" })).toBeInTheDocument();
  expect(container.innerHTML).not.toMatch(/840|75|2,34/);
});

it("requests a controlled privacy change without storing or mutating it locally", () => {
  const onHiddenChange = vi.fn();
  render(<MonoBalance {...props} onHiddenChange={onHiddenChange} />);
  fireEvent.click(screen.getByRole("button", { name: "Скрыть баланс" }));
  expect(onHiddenChange).toHaveBeenCalledExactlyOnceWith(true);
  expect(screen.queryByRole("img", { name: "Баланс скрыт" })).not.toBeInTheDocument();
});
