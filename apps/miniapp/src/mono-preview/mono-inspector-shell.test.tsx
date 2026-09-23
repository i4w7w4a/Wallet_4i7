import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MonoToolDock } from "./mono-tool-dock";
import { MonoInspectorShell } from "./mono-inspector-shell";

afterEach(cleanup);

it("exposes nine named tools and selects a tool without committing its trial", () => {
  const select = vi.fn();
  render(<MonoToolDock selected="color" onSelect={select} dirtyTools={["shape"]} />);
  expect(screen.getByRole("toolbar", { name: "Инструменты оформления" })).toBeVisible();
  expect(screen.getAllByRole("button")).toHaveLength(9);
  expect(screen.getByRole("button", { name: "Цвет" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: "Форма и кнопки" })).toHaveAttribute("data-dirty", "true");
  fireEvent.click(screen.getByRole("button", { name: "Баланс" }));
  expect(select).toHaveBeenCalledWith("balance");
});

it("supports arrow navigation with one tab stop and skips unavailable tools", () => {
  const select = vi.fn();
  render(<MonoToolDock selected="color" onSelect={select} unavailableTools={["shape"]} />);
  const color = screen.getByRole("button", { name: "Цвет" });
  color.focus();
  fireEvent.keyDown(color, { key: "ArrowRight" });
  expect(screen.getByRole("button", { name: "Логотип" })).toHaveFocus();
  expect(select).toHaveBeenCalledWith("logo");
  expect(screen.getAllByRole("button").filter(button => button.tabIndex === 0)).toHaveLength(1);
});

it("only commits a dirty slice through explicit Apply and keeps Cancel separate", () => {
  const apply = vi.fn();
  const cancel = vi.fn();
  const { rerender } = render(<MonoInspectorShell tool="shape" dirty={false} onApply={apply} onCancel={cancel}>
    <label>Радиус<input defaultValue="12" /></label>
  </MonoInspectorShell>);
  expect(screen.getByRole("button", { name: "Применить форму" })).toHaveAttribute("aria-disabled", "true");
  rerender(<MonoInspectorShell tool="shape" dirty onApply={apply} onCancel={cancel}>
    <label>Радиус<input defaultValue="12" /></label>
  </MonoInspectorShell>);
  expect(apply).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Отменить пробу формы" }));
  expect(cancel).toHaveBeenCalledOnce();
  expect(apply).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Применить форму" }));
  expect(apply).toHaveBeenCalledOnce();
});

it("retains Apply focus and its tab stop after acceptance while ignoring repeated activation", () => {
  const apply = vi.fn();
  const props = { tool: "shape" as const, onApply: apply, onCancel: vi.fn(), children: <p>Форма</p> };
  const { rerender } = render(<MonoInspectorShell {...props} dirty />);
  const button = screen.getByRole("button", { name: "Применить форму" });
  button.focus();
  fireEvent.click(button);
  rerender(<MonoInspectorShell {...props} dirty={false} />);
  expect(button).toHaveFocus();
  expect(button).toBeEnabled();
  expect(button).toHaveAttribute("aria-disabled", "true");
  fireEvent.click(button);
  expect(apply).toHaveBeenCalledOnce();
});

it("leaves existing palette acceptance actions inside the palette inspector", () => {
  render(<MonoInspectorShell tool="color" note="Прямые правки сохраняются в текущем пресете.">
    <button type="button">Сохранить палитру</button>
  </MonoInspectorShell>);
  expect(screen.getByRole("heading", { name: "Цвет" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Сохранить палитру" })).toBeVisible();
  expect(screen.queryByRole("button", { name: /^Применить/ })).toBeNull();
});
