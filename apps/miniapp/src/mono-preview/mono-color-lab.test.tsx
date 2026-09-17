import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";
import { MockWalletRepository } from "@wallet/core";
import { normalizeMonoPaletteConfig } from "@wallet/ui";
import { MonoPreview } from "./mono-preview";
import { MONO_PALETTE_ACTIVE_KEY, MONO_PALETTE_PRESETS_KEY, MONO_PALETTE_WORKSPACE_KEY, applyMonoPaletteActive } from "./mono-palette-storage";

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
const hue = () => screen.getByRole("slider", { name: "Мастер-пигмент" });
const editHue = (value: string) => fireEvent.change(hue(), { target: { value } });

describe("Color Lab interactions", () => {
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
    fireEvent.click(screen.getByRole("button", { name: "Эксперт" }));
    fireEvent.click(screen.getByRole("tab", { name: "Цвет · детали" }));
    const role = screen.getByRole("combobox", { name: "Смысловая роль" });
    fireEvent.change(role, { target: { value: "edgeCool" } });
    const hex = () => screen.getByLabelText("HEX");
    const original = (hex() as HTMLInputElement).value;
    fireEvent.change(screen.getByRole("combobox", { name: "Режим роли" }), { target: { value: "manual" } });
    expect(hex()).toHaveValue(original);
    editHue("120"); expect(hex()).toHaveValue(original);
    fireEvent.click(screen.getByRole("button", { name: "Замок роли" }));
    fireEvent.click(screen.getByRole("button", { name: "Случайная палитра" }));
    expect(hex()).toHaveValue(original);
    fireEvent.change(role, { target: { value: "edgeWarm" } });
    const randomized = (hex() as HTMLInputElement).value;
    fireEvent.click(screen.getByRole("button", { name: "Отменить цвет" }));
    fireEvent.click(screen.getByRole("button", { name: "Случайная палитра" }));
    expect(hex()).toHaveValue(randomized);
  });
  it("saves a named local revision without Apply; Apply does not mutate its saved revision", async () => {
    await open(); editHue("40");
    fireEvent.change(screen.getByLabelText("Имя пресета"), { target: { value: "Камень" } });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить новый" }));
    await waitFor(() => expect(localStorage.getItem(MONO_PALETTE_PRESETS_KEY)).toContain("Камень"));
    const saved = localStorage.getItem(MONO_PALETTE_PRESETS_KEY);
    expect(localStorage.getItem(MONO_PALETTE_ACTIVE_KEY)).toBeNull();
    editHue("160"); fireEvent.click(screen.getByRole("button", { name: "Применить палитру" }));
    expect(localStorage.getItem(MONO_PALETTE_ACTIVE_KEY)).toContain('"anchorHue":160');
    expect(localStorage.getItem(MONO_PALETTE_PRESETS_KEY)).toBe(saved);
    fireEvent.click(within(screen.getByRole("article", { name: "Камень" })).getByRole("button", { name: "Загрузить" }));
    expect(hue()).toHaveValue("40");
  });
  it("keeps one canvas, excludes text inputs from history shortcuts and compares without editing", async () => {
    await open(); editHue("40");
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
    fireEvent.click(screen.getByRole("button", { name: "Сравнить A/B" }));
    expect(screen.getByRole("button", { name: "Применить палитру" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Light" }));
    expect(document.querySelector("[data-mono-preview]")).toHaveAttribute("data-mono-theme", "light");
    expect(screen.getByRole("button", { name: "Сравнить A/B" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Применить палитру" })).toBeEnabled();
  });
});
