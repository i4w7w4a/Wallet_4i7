import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { useState } from "react";
import type { MaterialAction, MaterialDescriptorV2, MaterialRecipeV2, ParameterControl, ParameterValue } from "@wallet/ui";
import { MaterialControls } from "./material-controls";

type Params = { tone: string; colors: readonly string[]; flow: number; drift: number; contour: number;
  shape: string; highlight: number; glow: boolean; viscosity: number; detail: number };
const starting: MaterialRecipeV2 = { kind: "novex-material", version: 2, effectId: "liquid-metal", effectVersion: 1,
  seed: 13, params: { tone: "#33669980", colors: ["#112233", "#223344"], flow: .5, drift: .2, contour: .4,
    shape: "square", highlight: .6, glow: true, viscosity: .3, detail: .7 } satisfies Params, assetIds: [] };
const controls: readonly ParameterControl[] = [
  { key: "tone", label: "Основной цвет", kind: "color", group: "color" },
  { key: "colors", label: "Палитра", kind: "color-list", group: "color", minItems: 1, maxItems: 3 },
  { key: "flow", label: "Течение", kind: "range", group: "motion", min: 0, max: 1, step: .1 },
  { key: "drift", label: "Дрейф", kind: "range", group: "motion", min: 0, max: 1, step: .1 },
  { key: "contour", label: "Контур", kind: "range", group: "surface", min: 0, max: 1, step: .1 },
  { key: "shape", label: "Форма", kind: "select", group: "surface", options: [{ value: "square", label: "Прямоугольник" }, { value: "round", label: "Круг" }] },
  { key: "highlight", label: "Блик", kind: "range", group: "light", min: 0, max: 1, step: .1 },
  { key: "glow", label: "Свечение", kind: "toggle", group: "light" },
  { key: "viscosity", label: "Вязкость", kind: "range", group: "physics", min: 0, max: 1, step: .1 },
  { key: "detail", label: "Детальность", kind: "range", group: "precise", min: 0, max: 1, step: .1 },
];
const descriptor: MaterialDescriptorV2 = {
  id: "liquid-metal", effectVersion: 1, label: "Liquid Metal", description: "Material", capabilities: ["background", "button-fill"],
  provenance: { id: "paper-liquid-metal", sourceUrl: "https://example.invalid/source", revision: "fixture", license: "Apache-2.0", changes: [] },
  presets: [{ id: "default", label: "Default", recipe: starting }],
  actions: [{ kind: "seeded-splats", label: "Добавить всплеск", minCount: 1, maxCount: 6 }],
  parseRecipe(value) { return value && typeof value === "object" && "kind" in value
    ? { ok: true, value: value as MaterialRecipeV2 } : { ok: false, issues: [{ code: "invalid", message: "Недопустимая проба." }] }; },
  readControls(recipe) { const params = recipe.params as Params;
    return controls.map(control => ({ control, value: params[control.key as keyof Params] as ParameterValue })); },
  updateParameter(recipe, key, value) {
    const control = controls.find(item => item.key === key);
    const invalid = !control ||
      (control.kind === "color" && (typeof value !== "string" || !/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(value))) ||
      (control.kind === "color-list" && (!Array.isArray(value) || value.length < control.minItems || value.length > control.maxItems || value.some(color => typeof color !== "string" || !/^#[0-9a-f]{6}$/i.test(color)))) ||
      (control.kind === "range" && (typeof value !== "number" || value < control.min || value > control.max)) ||
      (control.kind === "toggle" && typeof value !== "boolean") ||
      (control.kind === "select" && !control.options.some(option => option.value === value));
    if (invalid) return { ok: false, issues: [{ code: "invalid", message: "Недопустимый цвет или параметр." }] };
    return { ok: true, value: { ...recipe, params: { ...(recipe.params as Params), [key]: value } } };
  },
};
afterEach(() => cleanup());

function Host({ disabled = false, onGesture, onAction, onRecipe }: {
  disabled?: boolean;
  onGesture?: (phase: "start" | "commit") => void;
  onAction?: (action: MaterialAction) => void;
  onRecipe?: (recipe: MaterialRecipeV2) => void;
}) {
  const [recipe, setRecipe] = useState(starting);
  return <MaterialControls descriptor={descriptor} recipe={recipe} disabled={disabled}
    onChange={next => { setRecipe(next); onRecipe?.(next); }}
    onAction={onAction} onGestureStart={() => onGesture?.("start")} onGestureCommit={() => onGesture?.("commit")} />;
}

it("organizes every descriptor control in six independently opened, labelled groups", () => {
  render(<Host />);
  expect(document.querySelectorAll('input[type="range"]')).toHaveLength(6);
  for (const label of ["Цвет", "Движение", "Форма / поверхность", "Свет", "Физика", "Точно"]) {
    expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
  }
  const color = screen.getByRole("button", { name: "Цвет" });
  const motion = screen.getByRole("button", { name: "Движение" });
  expect(color).toHaveAttribute("aria-pressed", "true");
  expect(motion).toHaveAttribute("aria-pressed", "false");
  fireEvent.click(motion);
  expect(color).toHaveAttribute("aria-pressed", "true");
  expect(motion).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("slider", { name: "Течение" })).toHaveValue("0.5");
  fireEvent.click(color);
  expect(color).toHaveAttribute("aria-pressed", "false");
  expect(motion).toHaveAttribute("aria-pressed", "true");
});

it("edits a bounded list as whole validated snapshots and preserves untouched colors", () => {
  render(<Host />);
  const group = screen.getByRole("region", { name: "Цвет · параметры" });
  const add = within(group).getByRole("button", { name: "Добавить цвет в Палитра" });
  expect(within(group).getAllByRole("textbox", { name: /Палитра · цвет \d — HEX/ })).toHaveLength(2);
  fireEvent.click(add);
  expect(within(group).getAllByRole("textbox", { name: /Палитра · цвет \d — HEX/ })).toHaveLength(3);
  expect(add).toBeDisabled();
  fireEvent.change(within(group).getByRole("textbox", { name: "Палитра · цвет 2 — HEX" }), { target: { value: "#445566" } });
  fireEvent.blur(within(group).getByRole("textbox", { name: "Палитра · цвет 2 — HEX" }));
  expect(within(group).getByRole("textbox", { name: "Палитра · цвет 1 — HEX" })).toHaveValue("#112233");
  expect(within(group).getByRole("textbox", { name: "Палитра · цвет 2 — HEX" })).toHaveValue("#445566");
  fireEvent.click(within(group).getByRole("button", { name: "Убрать цвет 3 из Палитра" }));
  fireEvent.click(within(group).getByRole("button", { name: "Убрать цвет 2 из Палитра" }));
  expect(within(group).getByRole("button", { name: "Убрать цвет 1 из Палитра" })).toBeDisabled();
  expect(within(group).getAllByRole("textbox", { name: /Палитра · цвет \d — HEX/ })).toHaveLength(1);
});

it("keeps alpha on picker changes and rejects invalid color text without changing the recipe", () => {
  render(<Host />);
  const field = screen.getByRole("textbox", { name: "Основной цвет — HEX" });
  fireEvent.change(screen.getByLabelText("Основной цвет — палитра"), { target: { value: "#abcdef" } });
  expect(field).toHaveValue("#abcdef80");
  fireEvent.focus(field);
  fireEvent.change(field, { target: { value: "javascript:alert(1)" } });
  fireEvent.blur(field);
  expect(field).toHaveValue("#abcdef80");
  expect(screen.getByRole("alert")).toHaveTextContent("Недопустимый цвет");
});

it("commits a range gesture once and disables fields without hiding their values", () => {
  const phases: string[] = [];
  const view = render(<Host onGesture={phase => phases.push(phase)} />);
  fireEvent.click(screen.getByRole("button", { name: "Движение" }));
  const slider = screen.getByRole("slider", { name: "Течение" });
  fireEvent.keyDown(slider, { key: "ArrowRight" });
  fireEvent.change(slider, { target: { value: ".6" } });
  fireEvent.change(slider, { target: { value: ".7" } });
  fireEvent.keyUp(slider, { key: "ArrowRight" });
  expect(slider).toHaveValue("0.7");
  expect(phases).toEqual(["start", "commit"]);
  view.rerender(<Host disabled />);
  expect(screen.getByRole("slider", { name: "Течение" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Добавить цвет в Палитра" })).toBeDisabled();
});

it("sends an explicit bounded splat command without changing the saved recipe", () => {
  const actions: MaterialAction[] = [];
  const recipes: MaterialRecipeV2[] = [];
  render(<Host onAction={action => actions.push(action)} onRecipe={recipe => recipes.push(recipe)} />);
  fireEvent.click(screen.getByRole("button", { name: "Физика" }));
  fireEvent.change(screen.getByRole("combobox", { name: "Число всплесков" }), { target: { value: "4" } });
  fireEvent.click(screen.getByRole("button", { name: "Добавить всплеск" }));
  expect(actions).toEqual([{ kind: "seeded-splats", count: 4 }]);
  expect(recipes).toEqual([]);
});
