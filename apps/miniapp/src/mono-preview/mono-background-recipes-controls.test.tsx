import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MonoBackgroundRecipeControls } from "./mono-background-recipes-controls";
import { MONO_BACKGROUND_DEFAULTS } from "./mono-background-recipes";

afterEach(cleanup);
it("leaves the existing environment untouched and emits nullable controlled appearance", () => {
  const onChange = vi.fn();
  const view = render(<MonoBackgroundRecipeControls value={null} onChange={onChange} />);
  expect(screen.getByRole("button", { name: "Исходный фон" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "Обсидиан" }));
  expect(onChange).toHaveBeenLastCalledWith(MONO_BACKGROUND_DEFAULTS.obsidian);
  view.rerender(<MonoBackgroundRecipeControls value={MONO_BACKGROUND_DEFAULTS.obsidian} onChange={onChange} />);
  fireEvent.click(screen.getByRole("button", { name: "Исходный фон" }));
  expect(onChange).toHaveBeenLastCalledWith(null);
  expect(screen.queryByRole("button", { name: /Сохранить|Применить/ })).toBeNull();
});
