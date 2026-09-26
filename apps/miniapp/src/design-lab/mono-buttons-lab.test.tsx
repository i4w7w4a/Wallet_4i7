import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test } from "vitest";
import type { ButtonWorkshopBindings, MaterialCapability, MaterialDescriptorV2, MaterialRecipeV2 } from "@wallet/ui";
import { MonoButtonsLab } from "./mono-buttons-lab";
import { createFirstButtonDocument } from "../mono-preview/mono-first-button-preset";

const metal: MaterialRecipeV2<"liquid-metal"> = { kind: "novex-material", version: 2, effectId: "liquid-metal", effectVersion: 1,
  seed: 1, params: { colorTint: "#aabbcc" }, assetIds: [] };
const border: MaterialRecipeV2<"pulsing-border"> = { kind: "novex-material", version: 2, effectId: "pulsing-border", effectVersion: 1,
  seed: 2, params: { roundness: 0, thickness: 2 }, assetIds: [] };
const provenance = { id: "test", sourceUrl: "https://example.test/", revision: "test", license: "test", changes: [] };
function descriptor(id: "liquid-metal" | "pulsing-border", label: string, capabilities: MaterialCapability[], recipe: MaterialRecipeV2): MaterialDescriptorV2 {
  return { id, effectVersion: 1, label, description: "Проверка редактора", capabilities, provenance,
    presets: [{ id: "source", label: "Исходный", recipe }],
    parseRecipe(input) { const value = input as MaterialRecipeV2; return value.effectId === id ? { ok: true, value } : { ok: false, issues: [{ code: "invalid", message: "Invalid" }] }; },
    readControls() { return []; }, updateParameter(value) { return { ok: true, value }; } };
}
const materials = [descriptor("liquid-metal", "Liquid Metal", ["background", "button-fill", "button-icon"], metal),
  descriptor("pulsing-border", "Pulsing Border", ["background", "button-border"], border)];
const bindings: ButtonWorkshopBindings = {
  materialCatalog: {
    materials,
    parseRecipe(input) { const value = input as MaterialRecipeV2; return materials.some(item => item.id === value.effectId)
      ? { ok: true, value } : { ok: false, issues: [{ code: "invalid", message: "Invalid" }] }; },
    copyForTarget(input, capability) { const value = input as MaterialRecipeV2; return materials.some(item => item.id === value.effectId && item.capabilities.includes(capability))
      ? { ok: true, value: structuredClone(value) } : { ok: false, issues: [{ code: "incompatible", message: "Материал не подходит." }] }; },
  },
  renderStage(request) { return <output data-testid="button-stage" data-frame-mode={request.frameMode}>{request.bindings.map(item => `${item.targetId}:${item.layer}:${item.recipe.effectId}`).join("|")}</output>; },
};

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  Object.defineProperty(navigator, "locks", { configurable: true, value: { request: async (_name: string, task: () => unknown) => task() } });
});
afterEach(() => cleanup());

test("separate button lab sends four real target bindings and keeps icon edits individual", () => {
  render(<MonoButtonsLab bindings={bindings} />);
  const stage = screen.getByTestId("button-stage");
  expect(stage.textContent?.split("|")).toHaveLength(4);
  expect(stage).not.toHaveTextContent(":fill:");
  expect(stage).toHaveTextContent("quick.buy:border:pulsing-border");
  expect(screen.getByRole("tab", { name: "Кромка" })).toHaveAttribute("aria-selected", "true");
  expect(screen.getByRole("heading", { name: /Кромка · Все четыре/ })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("tab", { name: "Поверхность" }));
  fireEvent.change(screen.getByRole("combobox", { name: "Материал" }), { target: { value: "liquid-metal" } });
  expect(stage.textContent?.split("|")).toHaveLength(8);
  fireEvent.click(screen.getByRole("tab", { name: "Кромка" }));
  fireEvent.change(screen.getByRole("combobox", { name: "Материал" }), { target: { value: "pulsing-border" } });
  expect(stage.textContent?.split("|")).toHaveLength(8);
  fireEvent.click(screen.getByRole("button", { name: "Отправить" }));
  fireEvent.click(screen.getByRole("tab", { name: "Иконка" }));
  fireEvent.change(screen.getByRole("combobox", { name: "Материал" }), { target: { value: "liquid-metal" } });
  expect(stage).toHaveTextContent("quick.send:icon:liquid-metal");
  expect(stage).not.toHaveTextContent("quick.receive:icon:liquid-metal");
  expect(within(screen.getByRole("group", { name: "Редактируемые кнопки" })).getByRole("button", { name: "Отправить" })).toHaveAttribute("aria-pressed", "true");
});

test("Apply and Cancel affect only local accepted bindings", async () => {
  render(<MonoButtonsLab bindings={bindings} />);
  fireEvent.click(screen.getByRole("button", { name: "Ещё" }));
  fireEvent.click(within(screen.getByRole("dialog", { name: "Дополнительно" })).getByRole("button", { name: "Применить" }));
  await screen.findByText(/Применено в локальной примерке/);
  fireEvent.click(screen.getByRole("tab", { name: "Кромка" }));
  fireEvent.change(screen.getByRole("combobox", { name: "Материал" }), { target: { value: "" } });
  fireEvent.click(screen.getByRole("button", { name: "Ещё" }));
  fireEvent.click(within(screen.getByRole("dialog", { name: "Дополнительно" })).getByRole("button", { name: "Отменить пробу" }));
  expect(screen.getByTestId("button-stage").textContent?.split("|")).toHaveLength(4);
  expect(localStorage.getItem("wallet4i7.mono.working-presets.v2")).toBeNull();
});

test("incoming background material shows a preview and requires a local draft decision", async () => {
  sessionStorage.setItem("wallet4i7.material-copy.background-to-buttons.v1",
    JSON.stringify({ version: 1, target: "buttons", recipe: metal }));
  render(<MonoButtonsLab bindings={bindings} />);
  const dialog = await screen.findByRole("dialog", { name: "Получить материал" });
  expect(within(dialog).getByText(/Liquid Metal/)).toBeInTheDocument();
  expect(sessionStorage.getItem("wallet4i7.material-copy.background-to-buttons.v1")).toBeNull();
  expect(localStorage.getItem("wallet4i7.button-sandbox.accepted.v1")).toBeNull();
  fireEvent.click(within(dialog).getByRole("button", { name: "Взять в черновик" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByTestId("button-stage").textContent?.split("|")).toHaveLength(8);
  expect(screen.getByTestId("button-stage")).toHaveTextContent("quick.send:fill:liquid-metal");
  expect(localStorage.getItem("wallet4i7.button-sandbox.accepted.v1")).toBeNull();
});

test("selected button sends a compatible full material to the separate background workshop", () => {
  render(<MonoButtonsLab bindings={bindings} />);
  fireEvent.click(screen.getByRole("button", { name: "Отправить" }));
  fireEvent.click(screen.getByRole("button", { name: "Ещё" }));
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Передать выбранный материал" }));
  const dialog = screen.getByRole("dialog", { name: "Передать материал" });
  const link = within(dialog).getByRole("link", { name: /мастерскую фонов/i });
  expect(link).toHaveAttribute("href", "/design-lab/atmosphere");
  link.addEventListener("click", event => event.preventDefault());
  fireEvent.click(link);
  expect(JSON.parse(sessionStorage.getItem("wallet4i7.material-copy.buttons-to-background.v1")!)).toEqual({
    version: 1, target: "background", recipe: createFirstButtonDocument().actions["quick.send"].border.recipe,
  });
});

test("named Save, Open and reload keep a complete accepted preview and separate library", async () => {
  const view = render(<MonoButtonsLab bindings={bindings} />);
  fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
  let dialog = screen.getByRole("dialog", { name: "Сохранить пробу" });
  fireEvent.change(within(dialog).getByRole("textbox", { name: "Имя пробы" }), { target: { value: "Metal and border" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Сохранить пробу" }));
  await waitFor(() => expect(screen.getByText("Сохранено")).toBeInTheDocument());
  fireEvent.click(screen.getByRole("button", { name: "Ещё" }));
  fireEvent.click(within(screen.getByRole("dialog", { name: "Дополнительно" })).getByRole("button", { name: "Применить" }));
  await waitFor(() => expect(localStorage.getItem("wallet4i7.button-sandbox.accepted.v1")).not.toBeNull());
  fireEvent.click(screen.getByRole("button", { name: "Слот 2" }));
  fireEvent.click(screen.getByRole("button", { name: "Отправить" }));
  fireEvent.click(screen.getByRole("tab", { name: "Иконка" }));
  fireEvent.change(screen.getByRole("combobox", { name: "Материал" }), { target: { value: "liquid-metal" } });
  fireEvent.click(screen.getByRole("button", { name: "Открыть" }));
  dialog = screen.getByRole("dialog", { name: "Библиотека кнопок" });
  fireEvent.click(within(dialog).getByRole("button", { name: "Открыть" }));
  dialog = screen.getByRole("dialog", { name: "Несохранённая проба" });
  fireEvent.click(within(dialog).getByRole("button", { name: "Отбросить и перейти" }));
  expect(screen.getByTestId("button-stage").textContent?.split("|")).toHaveLength(4);
  await waitFor(() => expect(localStorage.getItem("wallet4i7.button-sandbox.workspace.v1")).not.toBeNull());
  view.unmount();
  render(<MonoButtonsLab bindings={bindings} />);
  expect(screen.getByTestId("button-stage").textContent?.split("|")).toHaveLength(4);
  expect(screen.getByRole("heading", { name: "Metal and border" })).toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem("wallet4i7.button-sandbox.library.v1")!).trials).toHaveLength(1);
});

test("the preview opens on real actions and a parameter edit does not move its scroll", async () => {
  const focusedBindings: ButtonWorkshopBindings = { ...bindings,
    renderStage() { return <div ref={node => {
      if (!node) return;
      const viewport = node.closest<HTMLElement>('[aria-label="Реальные кнопки MONO"]')!;
      const row = node.querySelector<HTMLElement>(".mono-actions")!;
      Object.defineProperty(viewport, "clientHeight", { configurable: true, value: 420 });
      Object.defineProperty(viewport, "scrollHeight", { configurable: true, value: 1100 });
      viewport.getBoundingClientRect = () => ({ top: 100 } as DOMRect);
      row.getBoundingClientRect = () => ({ top: 680 - viewport.scrollTop, height: 120 } as DOMRect);
    }}><div className="mono-actions" /></div>; },
  };
  render(<MonoButtonsLab bindings={focusedBindings} />);
  const viewport = screen.getByRole("region", { name: "Реальные кнопки MONO" });
  await waitFor(() => expect(viewport.scrollTop).toBe(430));
  fireEvent.click(screen.getByText("Форма и слой", { selector: "summary" }));
  viewport.scrollTop = 123;
  fireEvent.change(document.querySelector<HTMLInputElement>('input[type="range"]')!, { target: { value: "14" } });
  expect(viewport.scrollTop).toBe(123);
  fireEvent.click(screen.getByRole("button", { name: "К кнопкам" }));
  expect(viewport.scrollTop).toBe(430);
  viewport.scrollTop = 0;
  fireEvent.click(screen.getByRole("button", { name: "Отправить" }));
  await waitFor(() => expect(viewport.scrollTop).toBe(430));
});

test("compact workbench places target selection apart from material controls", () => {
  render(<MonoButtonsLab bindings={bindings} />);
  const targets = screen.getByRole("complementary", { name: "Материалы" });
  const controls = screen.getByRole("complementary", { name: "Настройки" });
  expect(within(targets).getByRole("group", { name: "Редактируемые кнопки" })).toBeInTheDocument();
  expect(within(targets).getByRole("group", { name: "Независимые слоты" })).toBeInTheDocument();
  expect(within(targets).getByRole("button", { name: "Открыть" })).toBeInTheDocument();
  expect(within(controls).getByRole("tablist", { name: "Слой кнопки" })).toBeInTheDocument();
  expect(within(controls).getByRole("combobox", { name: "Материал" })).toBeInTheDocument();
  expect(screen.getByRole("region", { name: "Реальные кнопки MONO" })).toContainElement(screen.getByTestId("button-stage"));
});

test("target and layer controls are icon sized, with scene settings collapsed in the left rail", () => {
  render(<MonoButtonsLab bindings={bindings} />);
  const targets = screen.getByRole("complementary", { name: "Материалы" });
  const controls = screen.getByRole("complementary", { name: "Настройки" });
  expect(within(targets).getByRole("button", { name: "Отправить" })).not.toHaveTextContent("Отправить");
  expect(within(controls).getByRole("tab", { name: "Поверхность" })).not.toHaveTextContent("Поверхность");
  const sceneToggle = within(targets).getByText("Сцена", { selector: "summary" });
  expect(sceneToggle.parentElement).not.toHaveAttribute("open");
  fireEvent.click(sceneToggle);
  expect(sceneToggle.parentElement).toHaveAttribute("open");
  expect(within(targets).getByRole("group", { name: "Ширина примерки" })).toBeInTheDocument();
});

test("secondary geometry stays collapsed until the editor asks for it", () => {
  render(<MonoButtonsLab bindings={bindings} />);
  const controls = screen.getByRole("complementary", { name: "Настройки" });
  const toggle = within(controls).getByText("Форма и слой", { selector: "summary" });
  expect(toggle.parentElement).not.toHaveAttribute("open");
  fireEvent.click(toggle);
  expect(toggle.parentElement).toHaveAttribute("open");
  expect(within(controls).getByText(/Скругление кромки/)).toBeInTheDocument();
});

test("named first starter uses the owner's saved border recipe without rewriting the library", () => {
  const inspecting: ButtonWorkshopBindings = { ...bindings,
    renderStage(request) { return <output data-testid="owner-stage" data-bindings={JSON.stringify(request.bindings)} />; },
  };
  render(<MonoButtonsLab bindings={inspecting} />);
  const first = JSON.parse(screen.getByTestId("owner-stage").getAttribute("data-bindings")!);
  expect(first).toHaveLength(4);
  expect(first[0]).toMatchObject({ radiusCss: 0, borderWidthCss: 1.5,
    recipe: { effectId: "pulsing-border", params: { rotation: 221, scale: 1.15,
      colors: ["#0dc1fd", "#d915ef", "#ff3f2ecc"] } } });
  fireEvent.click(screen.getByRole("button", { name: "Открыть" }));
  expect(within(screen.getByRole("dialog", { name: "Библиотека кнопок" }))
    .getByRole("button", { name: "Открыть Первый · перелив" })).toBeInTheDocument();
  expect(localStorage.getItem("wallet4i7.button-sandbox.library.v1")).toBeNull();
});

test("frame choice previews immediately and is undone in one step", () => {
  render(<MonoButtonsLab bindings={bindings} />);
  const choices = screen.getByRole("group", { name: "Форма ряда действий" });
  expect(screen.getByTestId("button-stage")).toHaveAttribute("data-frame-mode", "group");
  fireEvent.click(within(choices).getByRole("button", { name: "Отдельные кнопки" }));
  expect(screen.getByTestId("button-stage")).toHaveAttribute("data-frame-mode", "separate");
  expect(within(choices).getByRole("button", { name: "Отдельные кнопки" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "Отменить" }));
  expect(screen.getByTestId("button-stage")).toHaveAttribute("data-frame-mode", "group");
  expect(within(choices).getByRole("button", { name: "Не менять в MONO" })).toHaveAttribute("aria-pressed", "true");
});

test("geometry sliders expose their layer-specific names to assistive technology", () => {
  render(<MonoButtonsLab bindings={bindings} />);
  fireEvent.click(screen.getByText("Форма и слой", { selector: "summary" }));
  expect(screen.getByRole("slider", { name: "Скругление кромки" })).toBeInTheDocument();
  expect(screen.getByRole("slider", { name: "Толщина рамки" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("tab", { name: "Поверхность" }));
  fireEvent.change(screen.getByRole("combobox", { name: "Материал" }), { target: { value: "liquid-metal" } });
  fireEvent.click(screen.getByText("Форма и слой", { selector: "summary" }));
  expect(screen.getByRole("slider", { name: "Скругление поверхности" })).toBeInTheDocument();
});

test("local preview acceptance stays under More while Save is compact in the toolbar", () => {
  render(<MonoButtonsLab bindings={bindings} />);
  const toolbar = screen.getByRole("toolbar", { name: "Действия пробы" });
  expect(within(toolbar).getByRole("button", { name: /MONO/ })).toBeInTheDocument();
  const save = within(toolbar).getByRole("button", { name: "Сохранить" });
  expect(save).not.toHaveTextContent("Сохранить");
  expect(screen.queryByRole("button", { name: "Применить" })).not.toBeInTheDocument();
  fireEvent.click(within(toolbar).getByRole("button", { name: "Ещё" }));
  expect(within(screen.getByRole("dialog", { name: "Дополнительно" })).getByRole("button", { name: "Применить" })).toBeInTheDocument();
});

test("closing More returns focus to its launcher after the workbench becomes interactive", () => {
  render(<MonoButtonsLab bindings={bindings} />);
  const launcher = screen.getByRole("button", { name: "Ещё" });
  act(() => launcher.focus());
  fireEvent.click(launcher);
  const dialog = screen.getByRole("dialog", { name: "Дополнительно" });
  expect(launcher.closest("[inert]")).toBeInTheDocument();
  fireEvent.keyDown(dialog, { key: "Escape" });
  expect(dialog).not.toBeInTheDocument();
  expect(launcher).toHaveFocus();
});

test("switching More to Import keeps the original launcher for focus return", () => {
  render(<MonoButtonsLab bindings={bindings} />);
  const launcher = screen.getByRole("button", { name: "Ещё" });
  act(() => launcher.focus());
  fireEvent.click(launcher);
  fireEvent.click(within(screen.getByRole("dialog", { name: "Дополнительно" })).getByRole("button", { name: "Импорт конфигурации JSON" }));
  const dialog = screen.getByRole("dialog", { name: "Импорт конфигурации кнопок" });
  fireEvent.keyDown(dialog, { key: "Escape" });
  expect(launcher).toHaveFocus();
});

test("preview width is applied inside a separate full-width scrollport", () => {
  render(<MonoButtonsLab bindings={bindings} />);
  const scrollport = screen.getByRole("region", { name: "Реальные кнопки MONO" });
  expect(scrollport).not.toHaveAttribute("style");
  expect(scrollport.firstElementChild).toHaveStyle({ width: "min(100%, 390px)" });
});
