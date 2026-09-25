import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MaterialWorkbench } from "./material-workbench";

let compact = false;
beforeEach(() => {
  compact = false;
  vi.stubGlobal("matchMedia", () => ({ get matches() { return compact; }, addEventListener() {}, removeEventListener() {} }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function shell(modalOpen = false) {
  return <MaterialWorkbench activeLab="background" title="Проба Павла" status="Изменено"
    toolbar={<button type="button">Сохранить пробу</button>}
    left={<><button type="button" style={{ display: "none" }}>Скрытый контроль</button><button type="button">Выбрать материал</button></>}
    right={<button type="button">Настроить краситель</button>}
    footer={<p>Локальный черновик</p>} modalOpen={modalOpen}>
    <div>Живая сцена</div>
  </MaterialWorkbench>;
}

it("keeps navigation, one toolbar and the scene between separate named rails", () => {
  render(shell());
  expect(screen.getByRole("link", { name: "Фоны" })).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("link", { name: "Кнопки" })).toHaveAttribute("href", "/design-lab/buttons");
  expect(screen.getByRole("heading", { name: "Проба Павла" })).toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("Изменено");
  expect(screen.getByRole("button", { name: "Сохранить пробу" })).toBeInTheDocument();
  expect(screen.getByRole("region", { name: "Сцена" })).toHaveTextContent("Живая сцена");
  expect(screen.getByRole("complementary", { name: "Материалы" })).not.toHaveAttribute("aria-hidden");
  expect(screen.getByRole("complementary", { name: "Настройки" })).not.toHaveAttribute("aria-hidden");
  expect(screen.getByText("Локальный черновик")).toBeInTheDocument();
});

it("opens one mobile rail as a focus-trapped dialog and returns focus on Escape", () => {
  compact = true;
  render(shell());
  const launcher = screen.getByRole("button", { name: "Материалы" });
  expect(document.querySelector('[data-workbench-rail="left"]')).toHaveAttribute("aria-hidden", "true");
  expect(document.querySelector('[data-workbench-rail="right"]')).toHaveAttribute("inert");
  fireEvent.click(launcher);
  const drawer = screen.getByRole("dialog", { name: "Материалы" });
  expect(drawer).toHaveAttribute("aria-modal", "true");
  expect(screen.getByRole("region", { name: "Сцена", hidden: true })).toHaveAttribute("inert");
  expect(within(drawer).getByRole("button", { name: "Выбрать материал" })).toHaveFocus();
  const last = within(drawer).getByRole("button", { name: "Закрыть материалы" });
  act(() => last.focus());
  fireEvent.keyDown(last, { key: "Tab" });
  expect(within(drawer).getByRole("button", { name: "Выбрать материал" })).toHaveFocus();
  fireEvent.keyDown(drawer, { key: "Escape" });
  expect(screen.queryByRole("dialog", { name: "Материалы" })).toBeNull();
  expect(launcher).toHaveFocus();
});

it("returns focus to the drawer launcher when its scrim is clicked", () => {
  compact = true;
  render(shell());
  const launcher = screen.getByRole("button", { name: "Материалы" });
  fireEvent.click(launcher);
  fireEvent.click(document.querySelector("[data-workbench-scrim]")!);
  expect(screen.queryByRole("dialog", { name: "Материалы" })).toBeNull();
  expect(launcher).toHaveFocus();
});

it("suspends its drawer during a caller modal, then restores it without stealing focus", async () => {
  compact = true;
  const view = render(shell());
  fireEvent.click(screen.getByRole("button", { name: "Настройки" }));
  const railControl = within(screen.getByRole("dialog", { name: "Настройки" })).getByRole("button", { name: "Настроить краситель" });
  view.rerender(shell(true));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Настройки" })).toBeNull());
  expect(screen.getByRole("button", { name: "Настройки" })).toBeDisabled();
  view.rerender(shell(false));
  expect(screen.getByRole("dialog", { name: "Настройки" })).toBeInTheDocument();
  act(() => railControl.focus());
  expect(railControl).toHaveFocus();
});
