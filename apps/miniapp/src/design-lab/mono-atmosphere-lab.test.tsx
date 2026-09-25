import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MonoAtmosphereLab } from "./mono-atmosphere-lab";
import { LIBRARY_KEY, LEGACY_KEY, WORKSPACE_KEY } from "./background-sandbox/storage";
import { V2_LIBRARY_KEY } from "./background-sandbox/storage-v2";
import { V3_LIBRARY_KEY, V3_WORKSPACE_KEY } from "./background-sandbox/storage-v3";
import { MONO_BACKGROUND_DEFAULTS } from "../mono-preview/mono-background-recipes";

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("hover: hover"), addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal("navigator", { ...navigator, locks: { request: async (_name: string, task: () => unknown) => task() } });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function intensity(value: number) {
  const slider = screen.getByRole("slider", { name: "Интенсивность" });
  fireEvent.pointerDown(slider); fireEvent.change(slider, { target: { value } }); fireEvent.pointerUp(slider);
}
async function saveAs(name: string, first = false) {
  if (first) fireEvent.click(screen.getByRole("button", { name: "Сохранить пробу" }));
  else {
    fireEvent.click(screen.getByRole("button", { name: "Дополнительно" }));
    fireEvent.click(screen.getByRole("button", { name: "Сохранить как…" }));
  }
  fireEvent.change(screen.getByRole("textbox", { name: "Имя пробы" }), { target: { value: name } });
  fireEvent.click(screen.getByRole("button", { name: "Сохранить пробу" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
}

it("keeps a clean standalone stage and three independent comparison slots", () => {
  render(<MonoAtmosphereLab />);
  const stage = screen.getByRole("region", { name: "Сцена материала" });
  expect(within(stage).queryByRole("button")).toBeNull();
  expect(stage.querySelector("[data-mono-logo], .mono-app-header__mark")).toBeNull();
  expect(screen.queryByRole("button", { name: "Края" })).toBeNull();
  intensity(81);
  fireEvent.click(screen.getByRole("button", { name: "Слот 2" }));
  expect(screen.getByRole("slider", { name: "Интенсивность" })).toHaveValue("60");
  fireEvent.click(screen.getByRole("button", { name: "Слот 1" }));
  expect(screen.getByRole("slider", { name: "Интенсивность" })).toHaveValue("81");
  fireEvent.click(screen.getByRole("button", { name: "Отменить" }));
  expect(screen.getByRole("slider", { name: "Интенсивность" })).toHaveValue("60");
  fireEvent.click(screen.getByRole("button", { name: "Повторить" }));
  expect(screen.getByRole("slider", { name: "Интенсивность" })).toHaveValue("81");
  expect(localStorage.getItem(LIBRARY_KEY)).toBeNull();
});

it("keeps material selection and controls in separate rails while the scene stays in the workbench center", () => {
  render(<MonoAtmosphereLab />);
  expect(document.querySelector("[data-material-workbench]")).toBeInTheDocument();
  const left = screen.getByRole("complementary", { name: "Материалы" });
  const right = screen.getByRole("complementary", { name: "Настройки" });
  const scene = screen.getByRole("region", { name: "Сцена" });
  expect(within(left).getByRole("combobox", { name: "Материал" })).toBeInTheDocument();
  expect(within(left).getByRole("button", { name: "Слот 3" })).toBeInTheDocument();
  expect(within(right).getByRole("slider", { name: "Интенсивность" })).toBeInTheDocument();
  expect(within(scene).getByRole("region", { name: "Сцена материала" })).toBeInTheDocument();
  const toolbar = screen.getByRole("toolbar", { name: "Действия пробы" });
  expect(within(toolbar).getByRole("button", { name: "В рабочий пресет MONO…" })).toBeInTheDocument();
  expect(within(toolbar).getByRole("button", { name: "Сохранить пробу" })).toBeInTheDocument();
});

it("saves two names, returns to each after reload, and toggles pinned A without editing B", async () => {
  localStorage.setItem("wallet4i7.mono.working-presets.v2", "untouched");
  const view = render(<MonoAtmosphereLab />);
  intensity(25); await saveAs("Мягкий", true);
  intensity(85); await saveAs("Яркий");
  fireEvent.click(screen.getByRole("button", { name: "Открыть библиотеку" }));
  fireEvent.click(screen.getByRole("button", { name: "Закрепить «Мягкий» как A" }));
  fireEvent.click(screen.getByRole("button", { name: "Открыть «Мягкий»" }));
  expect(screen.getByRole("slider", { name: "Интенсивность" })).toHaveValue("25");
  fireEvent.click(screen.getByRole("button", { name: "Открыть библиотеку" }));
  fireEvent.click(screen.getByRole("button", { name: "Открыть «Яркий»" }));
  await waitFor(() => expect(localStorage.getItem(V3_WORKSPACE_KEY)).toContain("Яркий"));
  view.unmount(); render(<MonoAtmosphereLab />);
  expect(screen.getByRole("slider", { name: "Интенсивность" })).toHaveValue("85");
  fireEvent.click(screen.getByRole("button", { name: "Показать A" }));
  expect(screen.getByRole("slider", { name: "Интенсивность" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Показать B" }));
  expect(screen.getByRole("slider", { name: "Интенсивность" })).toHaveValue("85");
  expect(localStorage.getItem("wallet4i7.mono.working-presets.v2")).toBe("untouched");
  expect(localStorage.getItem(LEGACY_KEY)).toBeNull();
  expect(localStorage.getItem(LIBRARY_KEY)).toBeNull();
  expect(localStorage.getItem(WORKSPACE_KEY)).toBeNull();
  expect(localStorage.getItem(V3_LIBRARY_KEY)).toContain("Яркий");
  expect(localStorage.getItem(V2_LIBRARY_KEY)).toBeNull();
});

it("guards dirty material switches and retains edits when Back is chosen", () => {
  render(<MonoAtmosphereLab />);
  intensity(74);
  fireEvent.change(screen.getByRole("combobox", { name: "Материал" }), { target: { value: "legacy-aperture" } });
  expect(screen.getByRole("dialog", { name: "Несохранённая проба" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Вернуться" }));
  expect(screen.getByRole("slider", { name: "Интенсивность" })).toHaveValue("74");
  fireEvent.change(screen.getByRole("combobox", { name: "Материал" }), { target: { value: "legacy-aperture" } });
  fireEvent.click(screen.getByRole("button", { name: "Отбросить и перейти" }));
  expect(screen.getByRole("combobox", { name: "Материал" })).toHaveValue("legacy-aperture");
  expect(screen.getByRole("slider", { name: "Интенсивность" })).toHaveValue("58");
});

it("shows save errors without Saved, preserves draft, and gives JSON only on request", async () => {
  render(<MonoAtmosphereLab />);
  expect(screen.queryByRole("textbox")).toBeNull();
  intensity(79);
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
  fireEvent.click(screen.getByRole("button", { name: "Сохранить пробу" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Имя пробы" }), { target: { value: "Не потерять" } });
  fireEvent.click(screen.getByRole("button", { name: "Сохранить пробу" }));
  await waitFor(() => expect(screen.getAllByText(/Не удалось сохранить/).length).toBeGreaterThan(0));
  expect(screen.queryByText("Сохранено")).toBeNull();
  expect(localStorage.getItem(LIBRARY_KEY)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Закрыть диалог" }));
  expect(screen.getByRole("slider", { name: "Интенсивность" })).toHaveValue("79");
});

it("rejects unknown import atomically and ignores slot hotkeys while typing", () => {
  render(<MonoAtmosphereLab />);
  fireEvent.click(screen.getByRole("button", { name: "Дополнительно" }));
  fireEvent.click(screen.getByRole("button", { name: "Импорт JSON" }));
  const input = screen.getByRole("textbox", { name: "Импорт пробы" });
  fireEvent.change(input, { target: { value: '{"version":99}' } });
  fireEvent.keyDown(input, { key: "2" });
  fireEvent.click(screen.getByRole("button", { name: "Проверить JSON" }));
  expect(screen.queryByRole("button", { name: "Открыть копию" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Закрыть диалог" }));
  expect(screen.getByRole("button", { name: "Слот 1" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("slider", { name: "Интенсивность" })).toHaveValue("60");
});

it("focuses the name, traps focus, and returns to the Save button on Escape", () => {
  render(<MonoAtmosphereLab />);
  const save = screen.getByRole("button", { name: "Сохранить пробу" });
  act(() => save.focus()); fireEvent.click(save);
  const input = screen.getByRole("textbox", { name: "Имя пробы" });
  expect(input).toHaveFocus();
  const last = screen.getByRole("button", { name: "Сохранить пробу" });
  act(() => last.focus()); fireEvent.keyDown(last, { key: "Tab" });
  expect(screen.getByRole("button", { name: "Закрыть диалог" })).toHaveFocus();
  act(() => input.focus()); fireEvent.keyDown(input, { key: "Escape" });
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(save).toHaveFocus();
});

it("previews imported parameter values before opening a new unsaved copy", () => {
  render(<MonoAtmosphereLab />);
  fireEvent.click(screen.getByRole("button", { name: "Дополнительно" }));
  fireEvent.click(screen.getByRole("button", { name: "Импорт JSON" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Импорт пробы" }), { target: { value: JSON.stringify({
    version: 1, recipe: "obsidian", intensity: .7, speed: .45, pointerResponse: .55, character: "fluid", calm: false,
  }) } });
  fireEvent.click(screen.getByRole("button", { name: "Проверить JSON" }));
  const preview = screen.getByRole("region", { name: "Предпросмотр импорта" });
  expect(preview).toHaveTextContent("Интенсивность");
  expect(preview).toHaveTextContent("70%");
  fireEvent.click(screen.getByRole("button", { name: "Открыть копию" }));
  expect(screen.getByRole("slider", { name: "Интенсивность" })).toHaveValue("70");
  expect(screen.getByRole("status")).toHaveTextContent("Изменено");
  expect(localStorage.getItem(LIBRARY_KEY)).toBeNull();
});

it("commits the shared numeric input as one complete undo transaction", () => {
  render(<MonoAtmosphereLab />);
  const number = screen.getByRole("spinbutton", { name: "Интенсивность — значение" });
  fireEvent.focus(number); fireEvent.change(number, { target: { value: "81" } }); fireEvent.keyDown(number, { key: "Enter" });
  expect(screen.getByRole("slider", { name: "Интенсивность" })).toHaveValue("81");
  fireEvent.click(screen.getByRole("button", { name: "Отменить" }));
  expect(screen.getByRole("slider", { name: "Интенсивность" })).toHaveValue("60");
  expect(screen.getByRole("button", { name: "Отменить" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Повторить" }));
  expect(screen.getByRole("slider", { name: "Интенсивность" })).toHaveValue("81");
});

it("shows an unavailable recovered workspace instead of rendering a substitute material", () => {
  localStorage.setItem(V3_WORKSPACE_KEY, '{"version":999}');
  render(<MonoAtmosphereLab />);
  expect(document.querySelector("[data-mono-background-recipe]")).toBeNull();
  expect(screen.getByRole("slider", { name: "Интенсивность" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Дополнительно" }));
  expect(screen.getByRole("button", { name: "Экспорт JSON" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Сохранить как…" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Закрыть диалог" }));
  fireEvent.click(screen.getByRole("button", { name: "Начать новую пробу" }));
  expect(document.querySelector("[data-mono-background-recipe]")).toBeInTheDocument();
  expect(localStorage.getItem(V3_WORKSPACE_KEY)).toBe('{"version":999}');
});

it("opens a historical v1 trial only after an explicit copy and preserves its bytes", async () => {
  const oldRaw = JSON.stringify({ version: 1, revision: 1, nextId: 2, trials: [
    { id: "trial-1", name: "Архив", revision: 1, recipe: { ...MONO_BACKGROUND_DEFAULTS.obsidian, intensity: .33 } },
  ] });
  localStorage.setItem(LIBRARY_KEY, oldRaw);
  render(<MonoAtmosphereLab />);
  expect(screen.getByRole("slider", { name: "Интенсивность" })).toHaveValue("60");
  fireEvent.click(screen.getByRole("button", { name: "Открыть библиотеку" }));
  expect(screen.getByRole("region", { name: "Данные v1 · только чтение" })).toHaveTextContent("Архив");
  fireEvent.click(screen.getByRole("button", { name: "Копировать v1 «Архив»" }));
  expect(screen.getByRole("slider", { name: "Интенсивность" })).toHaveValue("33");
  expect(screen.getByRole("status")).toHaveTextContent("Изменено");
  await saveAs("Архив v3", true);
  expect(localStorage.getItem(LIBRARY_KEY)).toBe(oldRaw);
  expect(localStorage.getItem(V3_LIBRARY_KEY)).toContain("Архив v3");
});
