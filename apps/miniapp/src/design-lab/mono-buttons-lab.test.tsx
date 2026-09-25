import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test } from "vitest";
import type { ButtonWorkshopBindings, MaterialCapability, MaterialDescriptorV2, MaterialRecipeV2 } from "@wallet/ui";
import { MonoButtonsLab } from "./mono-buttons-lab";

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
  descriptor("pulsing-border", "Pulsing Border", ["button-border"], border)];
const bindings: ButtonWorkshopBindings = {
  materialCatalog: {
    materials,
    parseRecipe(input) { const value = input as MaterialRecipeV2; return materials.some(item => item.id === value.effectId)
      ? { ok: true, value } : { ok: false, issues: [{ code: "invalid", message: "Invalid" }] }; },
    copyForTarget(input, capability) { const value = input as MaterialRecipeV2; return materials.some(item => item.id === value.effectId && item.capabilities.includes(capability))
      ? { ok: true, value: structuredClone(value) } : { ok: false, issues: [{ code: "incompatible", message: "Материал не подходит." }] }; },
  },
  renderStage(request) { return <output data-testid="button-stage">{request.bindings.map(item => `${item.targetId}:${item.layer}:${item.recipe.effectId}`).join("|")}</output>; },
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
  expect(stage.textContent?.split("|")).toHaveLength(8);
  expect(stage).toHaveTextContent("quick.send:fill:liquid-metal");
  expect(stage).toHaveTextContent("quick.buy:border:pulsing-border");
  fireEvent.change(screen.getByRole("combobox", { name: "Материал" }), { target: { value: "liquid-metal" } });
  expect(stage.textContent?.split("|")).toHaveLength(8);
  fireEvent.click(screen.getByRole("tab", { name: "Рамка" }));
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
  fireEvent.click(screen.getByRole("button", { name: "Применить" }));
  await screen.findByText(/Применено в локальной примерке/);
  fireEvent.click(screen.getByRole("tab", { name: "Рамка" }));
  fireEvent.change(screen.getByRole("combobox", { name: "Материал" }), { target: { value: "" } });
  fireEvent.click(screen.getByRole("button", { name: "Отменить пробу" }));
  expect(screen.getByTestId("button-stage").textContent?.split("|")).toHaveLength(8);
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
    version: 1, target: "background", recipe: metal,
  });
});

test("named Save, Open and reload keep a complete accepted preview and separate library", async () => {
  const view = render(<MonoButtonsLab bindings={bindings} />);
  fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
  let dialog = screen.getByRole("dialog", { name: "Сохранить пробу" });
  fireEvent.change(within(dialog).getByRole("textbox", { name: "Имя пробы" }), { target: { value: "Metal and border" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Сохранить пробу" }));
  await waitFor(() => expect(screen.getByText("Сохранено")).toBeInTheDocument());
  fireEvent.click(screen.getByRole("button", { name: "Применить" }));
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
  expect(screen.getByTestId("button-stage").textContent?.split("|")).toHaveLength(8);
  await waitFor(() => expect(localStorage.getItem("wallet4i7.button-sandbox.workspace.v1")).not.toBeNull());
  view.unmount();
  render(<MonoButtonsLab bindings={bindings} />);
  expect(screen.getByTestId("button-stage").textContent?.split("|")).toHaveLength(8);
  expect(screen.getByRole("heading", { name: "Metal and border" })).toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem("wallet4i7.button-sandbox.library.v1")!).trials).toHaveLength(1);
});
