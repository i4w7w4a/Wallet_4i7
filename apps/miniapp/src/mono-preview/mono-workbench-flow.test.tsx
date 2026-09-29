import "@testing-library/jest-dom/vitest";
import { webcrypto } from "node:crypto";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MockWalletRepository } from "@wallet/core";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MonoPreview } from "./mono-preview";
import { createMonoWorkingDocument, migrateMonoSevenLibrary, MONO_SEVEN_PRESETS_KEY,
  saveMonoSevenLibrary, saveMonoWorkingLibrary, type MonoSevenLibrary } from "./mono-working-presets";

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("crypto", webcrypto);
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduced-motion"), media: query,
    addEventListener() {}, removeEventListener() {} }));
  saveMonoWorkingLibrary(localStorage, { version: 2, skinId: "mono-ledger-v1", generation: 1, activeId: "a",
    records: [{ id: "a", name: "А", revision: 1, document: createMonoWorkingDocument() },
      { id: "b", name: "Б", revision: 1, document: createMonoWorkingDocument() }] }, 0);
  const migrated = migrateMonoSevenLibrary(localStorage);
  const slots = [...migrated.slots] as MonoSevenLibrary["slots"];
  slots[1] = { ...slots[1], name: "Б" };
  saveMonoSevenLibrary(localStorage, { ...migrated, slots, generation: 2 }, 1);
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

async function start() {
  const result = render(<MonoPreview snapshot={await new MockWalletRepository().getSnapshot()} />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Пресет 1: А" })).toBeEnabled());
  return result;
}
const tool = (name: string) => fireEvent.click(within(screen.getByRole("toolbar", { name: "Инструменты оформления" })).getByRole("button", { name }));
const storedLibrary = () => JSON.parse(localStorage.getItem(MONO_SEVEN_PRESETS_KEY)!) as MonoSevenLibrary;

function seedHiddenChart() {
  const library = storedLibrary();
  library.slots[0].document.appearance.ledger.chart = { visible: false, variant: "line" };
  localStorage.setItem(MONO_SEVEN_PRESETS_KEY, JSON.stringify(library));
}

function blockWorkingWrites() {
  const nativeSetItem = Storage.prototype.setItem;
  return vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
    if (key === MONO_SEVEN_PRESETS_KEY) throw new DOMException("quota", "QuotaExceededError");
    return nativeSetItem.call(this, key, value);
  });
}

it("recovers a failed Apply only through its inspector without accepting other trials or overwriting later saves", async () => {
  seedHiddenChart();
  await start();
  const before = localStorage.getItem(MONO_SEVEN_PRESETS_KEY);
  const write = blockWorkingWrites();
  tool("Активы");
  fireEvent.change(screen.getByLabelText("Оформление активов"), { target: { value: "tiles" } });
  tool("График");
  fireEvent.click(screen.getByLabelText("Показывать график"));
  fireEvent.change(screen.getByLabelText("Вид графика"), { target: { value: "area" } });
  fireEvent.change(screen.getByLabelText("Положение графика"), { target: { value: "bottom" } });
  fireEvent.click(screen.getByRole("button", { name: "Применить настройку" }));
  expect(localStorage.getItem(MONO_SEVEN_PRESETS_KEY)).toBe(before);
  expect(screen.queryByRole("button", { name: "Повторить сохранение" })).toBeNull();
  expect(screen.getByText(/Повторите «Применить» в инструменте «График»/)).toBeVisible();

  write.mockRestore();
  tool("Баланс");
  fireEvent.change(screen.getByLabelText("Композиция баланса"), { target: { value: "centered" } });
  fireEvent.click(screen.getByRole("button", { name: "Применить настройку" }));
  tool("График");
  fireEvent.click(screen.getByRole("button", { name: "Применить настройку" }));
  const accepted = storedLibrary().slots[0];
  expect(accepted.document.appearance.ledger.chart).toEqual({ visible: true, variant: "area" });
  expect(accepted.document.appearance.ledger.layout.chartPosition).toBe("bottom");
  expect(accepted.document.appearance.ledger.balance.composition).toBe("centered");
  expect(accepted.document.appearance.ledger.assets.variant).toBe("ledger");
  expect(accepted.revision).toBe(3);
  expect(screen.getByText("Сохранено в этом браузере")).toBeVisible();
  tool("Активы");
  expect(screen.getByLabelText("Оформление активов")).toHaveValue("tiles");
});

it("does not resurrect a cancelled failed Apply after switching and saving another preset", async () => {
  seedHiddenChart();
  await start();
  const before = storedLibrary().slots[0];
  const write = blockWorkingWrites();
  tool("График");
  fireEvent.click(screen.getByLabelText("Показывать график"));
  fireEvent.click(screen.getByRole("button", { name: "Применить настройку" }));
  write.mockRestore();
  fireEvent.click(screen.getByRole("button", { name: "Отменить пробу" }));
  expect(screen.getByLabelText("Показывать график")).not.toBeChecked();
  expect(screen.queryByRole("button", { name: "Повторить сохранение" })).toBeNull();
  expect(screen.queryByText(/Повторите «Применить»/)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Пресет 2: Б" }));
  tool("Баланс");
  fireEvent.change(screen.getByLabelText("Композиция баланса"), { target: { value: "centered" } });
  fireEvent.click(screen.getByRole("button", { name: "Применить настройку" }));
  const library = storedLibrary();
  expect(library.activeSlot).toBe(2);
  expect(library.slots[0]).toEqual(before);
  expect(library.slots[1].document.appearance.ledger.balance.composition).toBe("centered");
});

it("keeps palette recovery after a failed pre-Apply flush and chart Cancel", async () => {
  seedHiddenChart();
  await start();
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  const before = storedLibrary();
  const write = blockWorkingWrites();
  tool("График");
  fireEvent.click(screen.getByLabelText("Показывать график"));
  tool("Цвет");
  fireEvent.click(screen.getByRole("button", { name: "Включить палитру" }));
  fireEvent.change(screen.getByRole("slider", { name: "Тон" }), { target: { value: "160" } });
  expect(write.mock.calls.some(([key]) => key === MONO_SEVEN_PRESETS_KEY)).toBe(false);
  tool("График");
  fireEvent.click(screen.getByRole("button", { name: "Применить настройку" }));
  expect(storedLibrary()).toEqual(before);
  fireEvent.click(screen.getByRole("button", { name: "Отменить пробу" }));
  expect(screen.getByLabelText("Показывать график")).not.toBeChecked();
  expect(screen.getByText("Не удалось сохранить палитру · Повторить")).toBeVisible();
  const retry = screen.getByRole("button", { name: "Повторить сохранение" });
  write.mockRestore();
  fireEvent.click(retry);
  const recovered = storedLibrary().slots[0].document;
  expect(recovered.palette.slots[0].present.config.themes.dark.recipe.anchorHue).toBe(160);
  expect(recovered.appearance.ledger.chart.visible).toBe(false);
  expect(screen.getByText("Сохранено в этом браузере")).toBeVisible();
});

it("switches one inspector without mutating the accepted working document", async () => {
  const { container } = await start();
  const saved = localStorage.getItem(MONO_SEVEN_PRESETS_KEY);
  tool("Баланс");
  expect(container.querySelectorAll("[data-mono-inspector]")).toHaveLength(1);
  expect(screen.getByRole("combobox", { name: "Композиция баланса" })).toBeVisible();
  expect(screen.queryByRole("slider", { name: "Преломление" })).toBeNull();
  tool("Активы");
  expect(screen.getByRole("combobox", { name: "Оформление активов" })).toBeVisible();
  expect(localStorage.getItem(MONO_SEVEN_PRESETS_KEY)).toBe(saved);
});

it("keeps tool trials through panel changes and only applies the selected slice", async () => {
  await start();
  tool("Баланс");
  fireEvent.change(screen.getByLabelText("Композиция баланса"), { target: { value: "centered" } });
  tool("Активы");
  fireEvent.change(screen.getByLabelText("Оформление активов"), { target: { value: "tiles" } });
  tool("Баланс");
  expect(screen.getByLabelText("Композиция баланса")).toHaveValue("centered");
  fireEvent.click(screen.getByRole("button", { name: "Применить настройку" }));
  const library = JSON.parse(localStorage.getItem(MONO_SEVEN_PRESETS_KEY)!);
  expect(library.slots[0].document.appearance.ledger.balance.composition).toBe("centered");
  expect(library.slots[0].document.appearance.ledger.assets.variant).toBe("ledger");
  tool("Активы");
  expect(screen.getByLabelText("Оформление активов")).toHaveValue("tiles");
  fireEvent.click(screen.getByRole("button", { name: "Отменить пробу" }));
  expect(screen.getByLabelText("Оформление активов")).toHaveValue("ledger");
});

it("guards a named preset switch and can discard trials before continuing", async () => {
  await start();
  tool("Баланс");
  fireEvent.change(screen.getByLabelText("Композиция баланса"), { target: { value: "centered" } });
  fireEvent.click(screen.getByRole("button", { name: "Пресет 2: Б" }));
  expect(screen.getByRole("dialog", { name: "Неприменённые пробы" })).toBeVisible();
  expect(JSON.parse(localStorage.getItem(MONO_SEVEN_PRESETS_KEY)!).activeSlot).toBe(1);
  fireEvent.click(screen.getByRole("button", { name: "Отменить пробы и продолжить" }));
  expect(screen.getByRole("button", { name: "Пресет 2: Б" })).toBeVisible();
  expect(screen.getByLabelText("Композиция баланса")).toHaveValue("ledger");
  const library = JSON.parse(localStorage.getItem(MONO_SEVEN_PRESETS_KEY)!);
  expect(library.slots[0].document.appearance.ledger.balance.composition).toBe("ledger");
});

it("restores an applied complete appearance after reload", async () => {
  const first = await start();
  tool("Среда");
  fireEvent.click(screen.getByRole("button", { name: "Обсидиан" }));
  fireEvent.click(screen.getByRole("button", { name: "Применить настройку" }));
  first.unmount();
  const { container } = await start();
  await waitFor(() => expect(container.querySelector('[data-mono-background-recipe="obsidian"]')).not.toBeNull());
  expect(container.querySelectorAll("canvas")).toHaveLength(1);
  expect(container.querySelector("[data-mono-atmosphere]")).toBeNull();
});
