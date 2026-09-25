import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { BackgroundSandboxBindings, MaterialDescriptorV2, MaterialRecipeV2, MaterialStageRequestV2 } from "@wallet/ui";
import { MonoAtmosphereLab } from "./mono-atmosphere-lab";
import { V2_LIBRARY_KEY, V2_WORKSPACE_KEY } from "./background-sandbox/storage-v2";
import { LIBRARY_KEY, WORKSPACE_KEY } from "./background-sandbox/storage";

const initial: MaterialRecipeV2 = { kind: "novex-material", version: 2, effectId: "fluid", effectVersion: 2,
  seed: 21, params: { colors: ["#112233", "#445566"], speed: .25 }, assetIds: [] };
const descriptor: MaterialDescriptorV2 = {
  id: "fluid", effectVersion: 2, label: "Fluid v2", description: "Расширенный Fluid", capabilities: ["background", "button-fill"],
  actions: [{ kind: "seeded-splats", label: "Всплеск", minCount: 1, maxCount: 6 }],
  provenance: { id: "fluid-fixture", sourceUrl: "https://example.invalid/fluid", revision: "fixture", license: "MIT", changes: [] },
  presets: [{ id: "default", label: "По умолчанию", recipe: initial }],
  parseRecipe(input) {
    if (!input || typeof input !== "object" || !("kind" in input) || input.kind !== "novex-material" ||
      !("effectVersion" in input) || input.effectVersion !== 2) return { ok: false, issues: [{ code: "invalid", message: "Неизвестная версия." }] };
    return { ok: true, value: input as MaterialRecipeV2 };
  },
  readControls(recipe) { const params = recipe.params as { colors: readonly string[]; speed: number };
    return [
      { control: { key: "colors", label: "Цвета", kind: "color-list" as const, group: "color" as const, minItems: 1, maxItems: 3 }, value: params.colors },
      { control: { key: "speed", label: "Скорость", kind: "range" as const, group: "motion" as const, min: 0, max: 1, step: .05 }, value: params.speed },
    ];
  },
  updateParameter(recipe, key, value) {
    if (key !== "speed" && key !== "colors") return { ok: false, issues: [{ code: "invalid", message: "Неизвестный параметр." }] };
    return { ok: true, value: { ...recipe, params: { ...(recipe.params as object), [key]: value } } };
  },
};
function bindings(requests: MaterialStageRequestV2[]): BackgroundSandboxBindings {
  return {
    materials: [], renderStage: () => null, fittingAvailable: false,
    parseRecipe: () => ({ ok: false, issues: [{ code: "invalid", message: "V1 отсутствует." }] }),
    materialCatalogV2: { materials: [descriptor], parseRecipe: input => descriptor.parseRecipe(input),
      copyForTarget: input => descriptor.parseRecipe(input) },
    renderMaterialStageV2: request => { requests.push(request); return <div data-testid="v2-stage" />; },
  };
}

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear();
  vi.stubGlobal("navigator", { ...navigator, locks: { request: async (_name: string, task: () => unknown) => task() } });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("edits a v2 palette and separates runtime quality and splats from the saved artistic snapshot", async () => {
  const requests: MaterialStageRequestV2[] = [];
  render(<MonoAtmosphereLab bindings={bindings(requests)} />);
  expect(screen.getByTestId("v2-stage")).toBeInTheDocument();
  expect(screen.getByRole("combobox", { name: "Материал" })).toHaveValue("material:fluid:2");
  fireEvent.change(screen.getByRole("combobox", { name: "Качество просмотра" }), { target: { value: "detail" } });
  expect(requests.at(-1)?.quality).toBe("detail");
  expect(localStorage.getItem(V2_WORKSPACE_KEY)).toBeNull();

  fireEvent.change(screen.getByRole("textbox", { name: "Цвета · цвет 1 — HEX" }), { target: { value: "#abcdef" } });
  fireEvent.blur(screen.getByRole("textbox", { name: "Цвета · цвет 1 — HEX" }));
  await waitFor(() => expect(localStorage.getItem(V2_WORKSPACE_KEY)).toContain("#abcdef"));
  expect(screen.getByRole("status")).toHaveTextContent("Изменено");

  fireEvent.click(screen.getByRole("button", { name: "Физика" }));
  fireEvent.change(screen.getByRole("combobox", { name: "Число всплесков" }), { target: { value: "3" } });
  fireEvent.click(screen.getByRole("button", { name: "Всплеск" }));
  expect(requests.at(-1)?.transientAction?.action).toEqual({ kind: "seeded-splats", count: 3 });
  expect(localStorage.getItem(V2_WORKSPACE_KEY)).not.toContain("seeded-splats");

  fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Имя пробы" }), { target: { value: "Холодный" } });
  fireEvent.click(screen.getByRole("button", { name: "Сохранить пробу" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  const saved = localStorage.getItem(V2_LIBRARY_KEY);
  expect(saved).toContain("#abcdef");
  expect(saved).not.toContain("detail");
  expect(saved).not.toContain("seeded-splats");
  expect(localStorage.getItem(LIBRARY_KEY)).toBeNull();
  expect(localStorage.getItem(WORKSPACE_KEY)).toBeNull();
});

it("copies a normalized full snapshot only by an explicit compatible link", () => {
  const requests: MaterialStageRequestV2[] = [];
  render(<MonoAtmosphereLab bindings={bindings(requests)} />);
  const link = screen.getByRole("link", { name: "Копировать в мастерскую кнопок" });
  expect(link).toHaveAttribute("href", "/design-lab/buttons");
  expect(sessionStorage.getItem("wallet4i7.material-copy.background-to-buttons.v1")).toBeNull();
  link.addEventListener("click", event => event.preventDefault());
  fireEvent.click(link);
  const raw = sessionStorage.getItem("wallet4i7.material-copy.background-to-buttons.v1");
  expect(JSON.parse(raw ?? "null")).toEqual({ version: 1, target: "buttons", recipe: initial });
  expect(localStorage.getItem(V2_LIBRARY_KEY)).toBeNull();
});

it("previews an incoming button snapshot and guards a dirty background draft before taking it", async () => {
  const requests: MaterialStageRequestV2[] = [];
  const view = render(<MonoAtmosphereLab bindings={bindings(requests)} />);
  fireEvent.click(screen.getByRole("button", { name: "Движение" }));
  fireEvent.change(screen.getByRole("slider", { name: "Скорость" }), { target: { value: ".5" } });
  await waitFor(() => expect(localStorage.getItem(V2_WORKSPACE_KEY)).toContain('"speed":0.5'));
  view.unmount();

  const copied = { ...initial, params: { colors: ["#abcdef", "#445566"], speed: .1 } };
  sessionStorage.setItem("wallet4i7.material-copy.buttons-to-background.v1",
    JSON.stringify({ version: 1, target: "background", recipe: copied }));
  render(<MonoAtmosphereLab bindings={bindings(requests)} />);
  const preview = await screen.findByRole("dialog", { name: "Копия из мастерской кнопок" });
  expect(preview).toHaveTextContent("Черновик фона изменён");
  expect(preview).toHaveTextContent("#abcdef");
  expect(sessionStorage.getItem("wallet4i7.material-copy.buttons-to-background.v1")).toBeNull();
  expect(localStorage.getItem(V2_LIBRARY_KEY)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Взять в черновик" }));
  expect(screen.getByRole("dialog", { name: "Несохранённая проба" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Отбросить и перейти" }));
  expect(screen.getByRole("textbox", { name: "Цвета · цвет 1 — HEX" })).toHaveValue("#abcdef");
  expect(screen.getByRole("status")).toHaveTextContent("Изменено");
  expect(localStorage.getItem(V2_LIBRARY_KEY)).toBeNull();
});

it("rejects a misaddressed incoming envelope without opening or changing a draft", async () => {
  sessionStorage.setItem("wallet4i7.material-copy.buttons-to-background.v1",
    JSON.stringify({ version: 1, target: "buttons", recipe: initial }));
  render(<MonoAtmosphereLab bindings={bindings([])} />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Неверный адрес копии материала");
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.getByRole("combobox", { name: "Материал" })).toHaveValue("material:fluid:2");
  expect(localStorage.getItem(V2_LIBRARY_KEY)).toBeNull();
  expect(sessionStorage.getItem("wallet4i7.material-copy.buttons-to-background.v1")).toBeNull();
});
