import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MonoAtmosphereLab, MONO_ATMOSPHERE_LAB_STORAGE_KEY } from "./mono-atmosphere-lab";

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("hover: hover"),
    addEventListener() {}, removeEventListener() {} }));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("compares with iris without losing a draft or writing product storage", async () => {
  render(<MonoAtmosphereLab />);
  fireEvent.change(screen.getByRole("slider", { name: "Интенсивность" }), { target: { value: .83 } });
  fireEvent.click(screen.getByRole("button", { name: "Сравнить с базой" }));
  expect(document.querySelectorAll("[data-mono-background-recipe]")).toHaveLength(1);
  expect(document.querySelector("[data-mono-background-recipe]")).toHaveAttribute("data-mono-background-recipe", "baseline");
  fireEvent.click(screen.getByRole("button", { name: "Вернуться к пробе" }));
  expect(screen.getByRole("slider", { name: "Интенсивность" })).toHaveValue("0.83");
  expect(localStorage.length).toBe(0);
  expect(document.querySelector("canvas")).toBeNull();
});

it("saves only an explicit local atmosphere trial and validates import before preview", async () => {
  const view = render(<MonoAtmosphereLab />);
  fireEvent.click(screen.getByRole("button", { name: "Световой разрез" }));
  fireEvent.click(screen.getByRole("button", { name: "Сохранить пробу" }));
  expect(localStorage.length).toBe(1);
  expect(JSON.parse(localStorage.getItem(MONO_ATMOSPHERE_LAB_STORAGE_KEY)!)).toMatchObject({ recipe: "aperture", version: 1 });
  view.unmount(); render(<MonoAtmosphereLab />);
  expect(screen.getByRole("button", { name: "Световой разрез" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByText("JSON пробы"));
  fireEvent.change(screen.getByRole("textbox", { name: "Импорт пробы" }), { target: { value: '{"version":2}' } });
  fireEvent.click(screen.getByRole("button", { name: "Проверить JSON" }));
  expect(screen.queryByRole("button", { name: "Открыть импорт в примерке" })).toBeNull();
  expect(screen.getByRole("button", { name: "Световой разрез" })).toHaveAttribute("aria-pressed", "true");
});
