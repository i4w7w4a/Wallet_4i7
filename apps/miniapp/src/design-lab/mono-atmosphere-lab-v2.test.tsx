import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { materialCatalogV2, type BackgroundSandboxBindings, type MaterialDescriptorV2, type MaterialRecipeV2, type MaterialStageRequestV2 } from "@wallet/ui";
import { MonoAtmosphereLab } from "./mono-atmosphere-lab";
import { V2_LIBRARY_KEY, V2_WORKSPACE_KEY } from "./background-sandbox/storage-v2";
import { V3_LIBRARY_KEY, V3_WORKSPACE_KEY } from "./background-sandbox/storage-v3";
import { createWorkspace } from "./background-sandbox/model";
import { recipeKey } from "./background-sandbox/recipes";
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

it("starts a new background workspace with living Pavel Fluid v2 as the clear first material", () => {
  const requests: MaterialStageRequestV2[] = [];
  render(<MonoAtmosphereLab bindings={{ ...bindings(requests), materialCatalogV2 }} />);
  const selector = screen.getByRole("combobox", { name: "Материал" });
  expect(selector).toHaveValue("material:fluid:2");
  expect(within(selector).getAllByRole("option")[0]).toHaveValue("material:fluid:2");
  expect(screen.getByRole("option", { name: /Живая жидкость · Pavel Fluid/ })).toBeInTheDocument();
  expect((requests.at(-1)?.recipe as MaterialRecipeV2).params).toMatchObject({ mode: "ambient" });
  expect(localStorage.getItem(V3_WORKSPACE_KEY)).toBeNull();
});

it("shows the touch gesture hint only while Pavel Fluid v2 is in draw mode", () => {
  render(<MonoAtmosphereLab bindings={{ ...bindings([]), materialCatalogV2 }} />);
  const hint = "Касание или движение вбок — рисунок; вертикальный свайп — прокрутка";
  expect(screen.queryByText(hint)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Движение" }));
  fireEvent.change(screen.getByRole("combobox", { name: "Режим" }), { target: { value: "draw" } });
  expect(screen.getByText(hint)).toBeInTheDocument();
  fireEvent.change(screen.getByRole("combobox", { name: "Режим" }), { target: { value: "ambient" } });
  expect(screen.queryByText(hint)).toBeNull();
});

it("changes only the v2 background edge finish and restores the off state with Undo", () => {
  const requests: MaterialStageRequestV2[] = [];
  render(<MonoAtmosphereLab bindings={bindings(requests)} />);
  fireEvent.click(screen.getByRole("button", { name: "Края" }));
  const darkening = screen.getByRole("slider", { name: "Затемнение боков" });
  expect(screen.getByRole("slider", { name: "Ширина тёмной зоны" })).toBeDisabled();
  expect(screen.getByRole("slider", { name: "Мягкость перехода" })).toBeDisabled();
  fireEvent.pointerDown(darkening);
  fireEvent.change(darkening, { target: { value: "0.55" } });
  fireEvent.pointerUp(darkening);
  expect(screen.getByRole("slider", { name: "Ширина тёмной зоны" })).toBeEnabled();
  expect(requests.at(-1)?.edgeFinish).toEqual({ version: 1, sideDarkening: .55, inset: 0, softness: 0 });
  fireEvent.click(screen.getByRole("button", { name: "Отменить" }));
  expect(requests.at(-1)?.edgeFinish).toEqual({ version: 1, sideDarkening: 0, inset: 0, softness: 0 });
});

it("saves edge finish with the named trial and restores it after reload", async () => {
  const requests: MaterialStageRequestV2[] = [];
  const view = render(<MonoAtmosphereLab bindings={bindings(requests)} />);
  fireEvent.click(screen.getByRole("button", { name: "Края" }));
  const darkening = screen.getByRole("slider", { name: "Затемнение боков" });
  fireEvent.pointerDown(darkening);
  fireEvent.change(darkening, { target: { value: "0.45" } });
  fireEvent.pointerUp(darkening);
  fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Имя пробы" }), { target: { value: "Тёмный край" } });
  fireEvent.click(screen.getByRole("button", { name: "Сохранить пробу" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(JSON.parse(localStorage.getItem(V3_LIBRARY_KEY) ?? "null").trials[0].recipe.edgeFinish)
    .toEqual({ version: 1, sideDarkening: .45, inset: 0, softness: 0 });
  view.unmount();
  render(<MonoAtmosphereLab bindings={bindings(requests)} />);
  fireEvent.click(screen.getByRole("button", { name: "Края" }));
  expect(screen.getByRole("slider", { name: "Затемнение боков" })).toHaveValue("0.45");
  expect(localStorage.getItem(V2_LIBRARY_KEY)).toBeNull();
});

it("keeps v2 names and active draft visible while writing only new v3 bytes", async () => {
  const oldRecipe = { ...initial, params: { colors: ["#123456"], speed: .65 } };
  const oldLibrary = JSON.stringify({ version: 2, revision: 1, nextId: 2,
    trials: [{ id: "trial-1", name: "Архив v2", revision: 1, recipe: oldRecipe }] });
  const workspace = createWorkspace(oldRecipe, recipeKey(oldRecipe));
  const oldWorkspace = JSON.stringify({ ...workspace, version: 2 });
  localStorage.setItem(V2_LIBRARY_KEY, oldLibrary);
  localStorage.setItem(V2_WORKSPACE_KEY, oldWorkspace);
  const requests: MaterialStageRequestV2[] = [];
  render(<MonoAtmosphereLab bindings={bindings(requests)} />);
  expect(screen.getByRole("textbox", { name: "Цвета · цвет 1 — HEX" })).toHaveValue("#123456");
  fireEvent.click(screen.getByRole("button", { name: "Открыть библиотеку" }));
  expect(screen.getByRole("button", { name: "Открыть «Архив v2»" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Закрыть диалог" }));
  expect(localStorage.getItem(V3_LIBRARY_KEY)).toBeNull();
  expect(localStorage.getItem(V3_WORKSPACE_KEY)).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: "Края" }));
  fireEvent.change(screen.getByRole("slider", { name: "Затемнение боков" }), { target: { value: "0.35" } });
  await waitFor(() => expect(localStorage.getItem(V3_WORKSPACE_KEY)).toContain('"sideDarkening":0.35'));
  fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Имя пробы" }), { target: { value: "Новая v3" } });
  fireEvent.click(screen.getByRole("button", { name: "Сохранить пробу" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(JSON.parse(localStorage.getItem(V3_LIBRARY_KEY) ?? "null").trials.map((trial: { name: string }) => trial.name))
    .toEqual(["Архив v2", "Новая v3"]);
  fireEvent.click(screen.getByRole("button", { name: "Открыть библиотеку" }));
  expect(screen.getByRole("button", { name: "Открыть «Архив v2»" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Копировать v2 «Архив v2»" })).toBeInTheDocument();
  expect(localStorage.getItem(V2_LIBRARY_KEY)).toBe(oldLibrary);
  expect(localStorage.getItem(V2_WORKSPACE_KEY)).toBe(oldWorkspace);
});

it("imports a complete v3 document with normalized edge finish", () => {
  render(<MonoAtmosphereLab bindings={bindings([])} />);
  fireEvent.click(screen.getByRole("button", { name: "Дополнительно" }));
  fireEvent.click(screen.getByRole("button", { name: "Импорт JSON" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Импорт пробы" }), { target: { value: JSON.stringify({
    kind: "novex-background-lab", version: 1, material: initial,
    edgeFinish: { version: 1, sideDarkening: 4, inset: .12, softness: .04 },
  }) } });
  fireEvent.click(screen.getByRole("button", { name: "Проверить JSON" }));
  expect(screen.getByRole("button", { name: "Открыть копию" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Открыть копию" }));
  fireEvent.click(screen.getByRole("button", { name: "Края" }));
  expect(screen.getByRole("slider", { name: "Затемнение боков" })).toHaveValue("1");
});

it("rejects a later edge-finish version without mutating the current draft", () => {
  render(<MonoAtmosphereLab bindings={bindings([])} />);
  fireEvent.click(screen.getByRole("button", { name: "Дополнительно" }));
  fireEvent.click(screen.getByRole("button", { name: "Импорт JSON" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Импорт пробы" }), { target: { value: JSON.stringify({
    kind: "novex-background-lab", version: 1, material: initial,
    edgeFinish: { version: 2, sideDarkening: .5, inset: .1, softness: .1 },
  }) } });
  fireEvent.click(screen.getByRole("button", { name: "Проверить JSON" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Версия отделки краёв не поддерживается");
  expect(screen.queryByRole("button", { name: "Открыть копию" })).toBeNull();
  expect(localStorage.getItem(V3_WORKSPACE_KEY)).toBeNull();
});

it("edits a v2 palette and separates runtime quality and splats from the saved artistic snapshot", async () => {
  const requests: MaterialStageRequestV2[] = [];
  render(<MonoAtmosphereLab bindings={bindings(requests)} />);
  expect(screen.getByTestId("v2-stage")).toBeInTheDocument();
  expect(screen.getByRole("combobox", { name: "Материал" })).toHaveValue("material:fluid:2");
  fireEvent.change(screen.getByRole("combobox", { name: "Качество просмотра" }), { target: { value: "detail" } });
  expect(requests.at(-1)?.quality).toBe("detail");
  expect(localStorage.getItem(V3_WORKSPACE_KEY)).toBeNull();

  fireEvent.change(screen.getByRole("textbox", { name: "Цвета · цвет 1 — HEX" }), { target: { value: "#abcdef" } });
  fireEvent.blur(screen.getByRole("textbox", { name: "Цвета · цвет 1 — HEX" }));
  await waitFor(() => expect(localStorage.getItem(V3_WORKSPACE_KEY)).toContain("#abcdef"));
  expect(screen.getByRole("status")).toHaveTextContent("Изменено");

  fireEvent.click(screen.getByRole("button", { name: "Физика" }));
  fireEvent.change(screen.getByRole("combobox", { name: "Число всплесков" }), { target: { value: "3" } });
  fireEvent.click(screen.getByRole("button", { name: "Всплеск" }));
  expect(requests.at(-1)?.transientAction?.action).toEqual({ kind: "seeded-splats", count: 3 });
  expect(localStorage.getItem(V3_WORKSPACE_KEY)).not.toContain("seeded-splats");

  fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Имя пробы" }), { target: { value: "Холодный" } });
  fireEvent.click(screen.getByRole("button", { name: "Сохранить пробу" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  const saved = localStorage.getItem(V3_LIBRARY_KEY);
  expect(saved).toContain("#abcdef");
  expect(saved).not.toContain("detail");
  expect(saved).not.toContain("seeded-splats");
  expect(localStorage.getItem(LIBRARY_KEY)).toBeNull();
  expect(localStorage.getItem(WORKSPACE_KEY)).toBeNull();
  expect(localStorage.getItem(V2_LIBRARY_KEY)).toBeNull();
  expect(localStorage.getItem(V2_WORKSPACE_KEY)).toBeNull();
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
  await waitFor(() => expect(localStorage.getItem(V3_WORKSPACE_KEY)).toContain('"speed":0.5'));
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
