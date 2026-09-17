import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";
import { MockWalletRepository } from "@wallet/core";
import { MONO_PALETTE_ROLES, MONO_PALETTE_ROLE_SCHEMA, normalizeMonoPaletteConfig, resolveMonoPalette } from "@wallet/ui";
import { MonoPreview } from "./mono-preview";
import { useMonoColorLab } from "./mono-color-lab";
import { createMonoPaletteWorkspace } from "./mono-palette-workspace";
import { exportMonoPalettePreset } from "./mono-preset-codec";
import type { PresetView } from "../preset-library/preset-types";
import { MONO_PALETTE_ACTIVE_KEY, MONO_PALETTE_PRESETS_KEY, MONO_PALETTE_WORKSPACE_KEY, applyMonoPaletteActive, saveMonoPaletteWorkspace } from "./mono-palette-storage";

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("crypto", webcrypto);
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduced-motion"), media: query, addEventListener() {}, removeEventListener() {} }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
async function open() {
  render(<MonoPreview snapshot={await new MockWalletRepository().getSnapshot()} />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Включить палитру" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Включить палитру" }));
}
const hue = () => screen.getByRole("slider", { name: "Тон" });
const editHue = (value: string) => fireEvent.change(hue(), { target: { value } });
const openExact = () => fireEvent.click(screen.getByRole("button", { name: "Точная настройка" }));
function pointer(element: Element, type: string, pointerId: number, clientX: number, clientY: number) {
  const event = new Event(type, { bubbles: true });
  Object.defineProperties(event, { pointerId: { value: pointerId }, clientX: { value: clientX }, clientY: { value: clientY } });
  fireEvent(element, event);
}

describe("Color Lab interactions", () => {
  it("does not edit a hidden draft through the wheel before palette activation", async () => {
    render(<MonoPreview snapshot={await new MockWalletRepository().getSnapshot()} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Включить палитру" })).toBeEnabled());
    const field = screen.getByRole("group", { name: "Цветовое поле" });
    Object.defineProperty(field, "getBoundingClientRect", { value: () => ({ left: 0, top: 0, width: 200, height: 200 }) });
    pointer(field, "pointerdown", 9, 200, 100);
    pointer(field, "pointerup", 9, 200, 100);
    expect(field).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(screen.getByRole("button", { name: "Включить палитру" }));
    expect(hue()).toHaveValue("250");
    expect(screen.getByRole("button", { name: "Отменить цвет" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Отменить цвет" }));
    expect(document.querySelector("[data-mono-preview]")).toHaveAttribute("data-palette-enabled", "false");
  });

  it("starts with a human color layer and keeps technical controls in exact settings", async () => {
    await open();
    expect(screen.getByRole("group", { name: "Цветовое поле" })).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "Тон" })).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "Интенсивность" })).toBeInTheDocument();
    for (const name of ["Графит", "Один тон", "Дымка", "Дуэт"])
      expect(screen.getByRole("radio", { name })).toBeInTheDocument();
    for (const zone of ["Основа", "Акценты", "Стекло"])
      expect(screen.getByRole("button", { name: `Не менять ${zone}` })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Новый вариант" })).toBeInTheDocument();
    expect(screen.getByText("Seed")).not.toBeVisible();
    expect(screen.queryByRole("button", { name: "Случайная палитра" })).not.toBeInTheDocument();
    openExact();
    expect(screen.getByLabelText("Seed")).toBeVisible();
  });
  it("chooses a harmony by eye and undoes it without touching the other theme", async () => {
    await open();
    fireEvent.click(screen.getByRole("radio", { name: "Дымка" }));
    expect(screen.getByRole("radio", { name: "Дымка" })).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Отменить цвет" }));
    expect(screen.getByRole("radio", { name: "Графит" })).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Light" }));
    expect(screen.getByRole("radio", { name: "Графит" })).toBeChecked();
  });
  it("makes a deterministic new variant and preserves a locked foundation", async () => {
    await open();
    const foundation = screen.getByText("Основа").closest(".mono-color-lab__zone")!;
    const colors = () => Array.from(foundation.querySelectorAll("i")).map(item => (item as HTMLElement).style.background);
    const original = colors();
    fireEvent.click(screen.getByRole("button", { name: "Не менять Основа" }));
    expect(screen.getByRole("button", { name: "Не менять Основа" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Новый вариант" }));
    expect(colors()).toEqual(original);
    const firstHue = (hue() as HTMLInputElement).value;
    expect(firstHue).not.toBe("250");
    fireEvent.click(screen.getByRole("button", { name: "Отменить цвет" }));
    fireEvent.click(screen.getByRole("button", { name: "Новый вариант" }));
    expect(hue()).toHaveValue(firstHue);
  });
  it("explains in plain language when every visual zone is protected", async () => {
    await open();
    openExact();
    fireEvent.click(screen.getByRole("tab", { name: "Цвет · детали" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Смысловая роль" }), { target: { value: "textPrimary" } });
    fireEvent.click(screen.getByRole("button", { name: "Не менять: Содержание" }));
    for (const zone of ["Основа", "Акценты", "Стекло"])
      fireEvent.click(screen.getByRole("button", { name: `Не менять ${zone}` }));
    fireEvent.click(screen.getByRole("button", { name: "Новый вариант" }));
    const status = screen.getByRole("button", { name: "Новый вариант" }).closest("section")!.querySelector('p[role="status"]');
    expect(status).toHaveTextContent("Новый вариант не изменил видимые цвета. Проверьте замки и режимы цветов");
    expect(hue()).toHaveValue("250");
  });
  it("explains a no-op caused by manual colors without falsely claiming a lock", async () => {
    const config = normalizeMonoPaletteConfig();
    const theme = config.themes.dark;
    const colors = resolveMonoPalette(theme).roles;
    for (const role of MONO_PALETTE_ROLES) {
      if (role === "focus" || MONO_PALETTE_ROLE_SCHEMA[role].group === "system") continue;
      theme.roles[role].mode = "manual";
      theme.roles[role].value = { ...colors[role] };
    }
    saveMonoPaletteWorkspace(localStorage, createMonoPaletteWorkspace(config));
    await open();
    fireEvent.click(screen.getByRole("button", { name: "Новый вариант" }));
    const status = screen.getByRole("button", { name: "Новый вариант" }).closest("section")!.querySelector('p[role="status"]');
    expect(status).toHaveTextContent("Новый вариант не изменил видимые цвета. Проверьте замки и режимы цветов");
    expect(status).not.toHaveTextContent("Снимите один из замков");
  });
  it("announces an inherited exact lock as protected in the quick view", async () => {
    await open();
    openExact();
    fireEvent.click(screen.getByRole("tab", { name: "Цвет · детали" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Смысловая роль" }), { target: { value: "canvas" } });
    fireEvent.click(screen.getByRole("button", { name: "Не менять: Поверхности" }));
    const foundation = screen.getByRole("button", { name: "Не менять Основа" });
    expect(foundation).toBeDisabled();
    expect(foundation).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Закреплено в точной настройке")).toBeInTheDocument();
  });
  it("commits one circle gesture as one Undo step", async () => {
    await open();
    const field = screen.getByRole("group", { name: "Цветовое поле" });
    Object.defineProperty(field, "getBoundingClientRect", { value: () => ({ left: 0, top: 0, width: 200, height: 200 }) });
    Object.defineProperty(field, "setPointerCapture", { value: vi.fn() });
    pointer(field, "pointerdown", 5, 100, 0);
    pointer(field, "pointermove", 5, 200, 100);
    pointer(field, "pointerup", 5, 200, 100);
    expect(hue()).toHaveValue("90");
    fireEvent.click(screen.getByRole("button", { name: "Отменить цвет" }));
    expect(hue()).toHaveValue("250");
  });

  it("recovers a valid Applied appearance when the workspace record is corrupt", async () => {
    applyMonoPaletteActive(localStorage, normalizeMonoPaletteConfig());
    localStorage.setItem(MONO_PALETTE_WORKSPACE_KEY, "{bad-json");
    render(<MonoPreview snapshot={await new MockWalletRepository().getSnapshot()} />);
    await waitFor(() => expect(document.querySelector("[data-mono-preview]")).toHaveAttribute("data-palette-enabled", "true"));
  });
  it("keeps original material until explicit activation and restores it with Undo", async () => {
    await open();
    expect(document.querySelector("[data-mono-preview]")).toHaveAttribute("data-palette-enabled", "true");
    fireEvent.click(screen.getByRole("button", { name: "Отменить цвет" }));
    expect(document.querySelector("[data-mono-preview]")).toHaveAttribute("data-palette-enabled", "false");
    expect(localStorage.getItem(MONO_PALETTE_ACTIVE_KEY)).toBeNull();
  });
  it("restores independent Dark and Light hue and coalesces a gesture into one Undo", async () => {
    await open();
    fireEvent.pointerDown(hue()); editHue("40"); editHue("80"); fireEvent.pointerUp(hue());
    fireEvent.click(screen.getByRole("button", { name: "Отменить цвет" }));
    expect(hue()).toHaveValue("250");
    fireEvent.click(screen.getByRole("button", { name: "Повторить цвет" }));
    expect(hue()).toHaveValue("80");
    fireEvent.click(screen.getByRole("button", { name: "Light" })); editHue("170");
    fireEvent.click(screen.getByRole("button", { name: "Dark" })); expect(hue()).toHaveValue("80");
    fireEvent.click(screen.getByRole("button", { name: "Light" })); expect(hue()).toHaveValue("170");
  });
  it("freezes manual and locked roles, and replays deterministic randomize through Undo", async () => {
    await open();
    openExact();
    fireEvent.click(screen.getByRole("tab", { name: "Цвет · детали" }));
    const role = screen.getByRole("combobox", { name: "Смысловая роль" });
    fireEvent.change(role, { target: { value: "edgeCool" } });
    const hex = () => screen.getByLabelText("HEX");
    const original = (hex() as HTMLInputElement).value;
    fireEvent.change(screen.getByRole("combobox", { name: "Режим роли" }), { target: { value: "manual" } });
    expect(hex()).toHaveValue(original);
    editHue("120"); expect(hex()).toHaveValue(original);
    fireEvent.click(screen.getByRole("button", { name: "Не менять «Холодная кромка»" }));
    fireEvent.click(screen.getByRole("button", { name: "Новый вариант" }));
    expect(hex()).toHaveValue(original);
    fireEvent.change(role, { target: { value: "edgeWarm" } });
    const randomized = (hex() as HTMLInputElement).value;
    fireEvent.click(screen.getByRole("button", { name: "Отменить цвет" }));
    fireEvent.click(screen.getByRole("button", { name: "Новый вариант" }));
    expect(hex()).toHaveValue(randomized);
  });
  it("saves a named local revision without Apply; Apply does not mutate its saved revision", async () => {
    await open(); openExact(); editHue("40");
    fireEvent.change(screen.getByLabelText("Имя пресета"), { target: { value: "Камень" } });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить новый" }));
    await waitFor(() => expect(localStorage.getItem(MONO_PALETTE_PRESETS_KEY)).toContain("Камень"));
    const saved = localStorage.getItem(MONO_PALETTE_PRESETS_KEY);
    expect(localStorage.getItem(MONO_PALETTE_ACTIVE_KEY)).toBeNull();
    editHue("160"); fireEvent.click(screen.getByRole("button", { name: "Применить палитру" }));
    expect(localStorage.getItem(MONO_PALETTE_ACTIVE_KEY)).toContain('"anchorHue":160');
    expect(localStorage.getItem(MONO_PALETTE_PRESETS_KEY)).toBe(saved);
    fireEvent.click(within(screen.getByRole("article", { name: "Камень" })).getByRole("button", { name: "Загрузить" }));
    expect(hue()).toHaveValue("160");
    fireEvent.click(screen.getByRole("button", { name: "Принять в черновик" }));
    expect(hue()).toHaveValue("40");
  });
  it("previews a local load before changing the live draft", async () => {
    await open(); openExact(); editHue("40");
    fireEvent.change(screen.getByLabelText("Имя пресета"), { target: { value: "Камень" } });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить новый" }));
    await waitFor(() => expect(screen.getByRole("article", { name: "Камень" })).toBeInTheDocument());
    editHue("160");
    fireEvent.click(within(screen.getByRole("article", { name: "Камень" })).getByRole("button", { name: "Загрузить" }));
    expect(hue()).toHaveValue("160");
    expect(screen.getByRole("region", { name: "Различия импорта" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Принять в черновик" }));
    expect(hue()).toHaveValue("40");
  });
  it("invalidates a pending load after another draft edit", async () => {
    await open(); openExact(); editHue("40");
    fireEvent.change(screen.getByLabelText("Имя пресета"), { target: { value: "Камень" } });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить новый" }));
    await waitFor(() => expect(screen.getByRole("article", { name: "Камень" })).toBeInTheDocument());
    editHue("160");
    fireEvent.click(within(screen.getByRole("article", { name: "Камень" })).getByRole("button", { name: "Загрузить" }));
    editHue("180");
    expect(screen.queryByRole("region", { name: "Различия импорта" })).not.toBeInTheDocument();
    expect(hue()).toHaveValue("180");
  });
  it("keeps one canvas, excludes text inputs from history shortcuts and compares without editing", async () => {
    await open(); openExact(); editHue("40");
    const canvas = document.querySelector("canvas");
    const input = screen.getByLabelText("Имя пресета");
    fireEvent.keyDown(input, { key: "z", ctrlKey: true }); expect(hue()).toHaveValue("40");
    fireEvent.keyDown(screen.getByRole("button", { name: "Отменить цвет" }), { key: "z", ctrlKey: true });
    expect(hue()).toHaveValue("250");
    await waitFor(() => expect(localStorage.getItem(MONO_PALETTE_WORKSPACE_KEY)).toContain('"anchorHue":250'));
    const storedBeforeCompare = localStorage.getItem(MONO_PALETTE_WORKSPACE_KEY);
    fireEvent.click(screen.getByRole("button", { name: "Сравнить A/B" }));
    expect(document.querySelector("canvas")).toBe(canvas);
    expect(document.querySelectorAll("canvas")).toHaveLength(1);
    expect(localStorage.getItem(MONO_PALETTE_ACTIVE_KEY)).toBeNull();
    expect(localStorage.getItem(MONO_PALETTE_WORKSPACE_KEY)).toBe(storedBeforeCompare);
  });
  it("leaves A/B before a theme edit and cannot Apply an unseen draft", async () => {
    await open();
    openExact();
    fireEvent.click(screen.getByRole("button", { name: "Сравнить A/B" }));
    expect(screen.getByRole("button", { name: "Применить палитру" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Light" }));
    expect(document.querySelector("[data-mono-preview]")).toHaveAttribute("data-mono-theme", "light");
    expect(screen.getByRole("button", { name: "Сравнить A/B" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Применить палитру" })).toBeEnabled();
  });
  it("does not allow hidden inspector edits while A/B shows the baseline", async () => {
    await open();
    openExact();
    fireEvent.click(screen.getByRole("tab", { name: "Цвет · детали" }));
    fireEvent.click(screen.getByRole("button", { name: "Сравнить A/B" }));
    expect(screen.getByRole("button", { name: "Не менять «Основной акцент»" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Режим роли" })).toBeDisabled();
  });
  it("records foreign provenance after accepting only its background", async () => {
    const config = normalizeMonoPaletteConfig();
    config.themes.dark.recipe.anchorHue = 43;
    const preset = JSON.parse(await exportMonoPalettePreset(config));
    const entry = { id: "11111111-1111-4111-8111-111111111111", slug: "ffffffffffffffffffffffffffffffff", preset } as PresetView;
    const { result } = renderHook(() => useMonoColorLab());
    await waitFor(() => expect(result.current.ready).toBe(true));
    await act(async () => { await result.current.previewRemotePreset(entry, "background"); });
    expect(result.current.pending?.diff.length).toBeGreaterThan(0);
    act(() => result.current.acceptPending());
    expect(result.current.activeRemoteSource).toEqual({ id: entry.id, slug: entry.slug });
  });
});
