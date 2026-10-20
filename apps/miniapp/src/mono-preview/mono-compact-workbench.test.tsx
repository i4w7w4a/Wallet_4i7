import "@testing-library/jest-dom/vitest";
import { webcrypto } from "node:crypto";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MockWalletRepository } from "@wallet/core";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { HOME_PINS_STORAGE_KEY } from "../mono-product/home-pins";
import { createDefaultActionArtworkMap } from "./action-artwork/model";
import { createFirstMonoWorkingDocument } from "./mono-first-button-preset";
import { editMonoPaletteRecipe } from "./mono-palette-workspace";
import { MonoPreview } from "./mono-preview";
import { createMonoSevenLibrary, createMonoWorkingDocument, MONO_SEVEN_PRESETS_KEY,
  parseMonoSevenLibrary } from "./mono-working-presets";

beforeEach(() => {
  localStorage.clear(); history.replaceState(null, "", "/mono");
  vi.stubGlobal("crypto", webcrypto);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  vi.stubGlobal("matchMedia", (media: string) => ({ matches: media.includes("reduced-motion"), media,
    addEventListener() {}, removeEventListener() {} }));
  // Publication/network services are outside this local workbench test.
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: "unconfigured" }, { status: 503 })));
});
afterEach(async () => { await act(async () => { cleanup(); }); vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear(); });

function seedDocuments() {
  const library = createMonoSevenLibrary(null, createFirstMonoWorkingDocument());
  for (const record of library.slots) {
    const document = record.document;
    document.appearance.ledger.chart = { visible: record.slot % 2 === 0, variant: "step" };
    document.appearance.ledger.layout.chartPosition = "bottom";
    document.appearance.ledger.balance.composition = "centered";
    document.appearance.ledger.logo.hue = record.slot * 30;
    document.palette = editMonoPaletteRecipe(document.palette, { anchorHue: record.slot * 35 });
  }
  library.archive = [{ id: "retained-archive", name: "Старый документ", revision: 9,
    document: createMonoWorkingDocument() }];
  localStorage.setItem(MONO_SEVEN_PRESETS_KEY, JSON.stringify(library));
  return library;
}
const stored = () => parseMonoSevenLibrary(localStorage.getItem(MONO_SEVEN_PRESETS_KEY)!);
const tool = (name: string) => fireEvent.click(within(screen.getByRole("toolbar", { name: "Инструменты оформления" }))
  .getByRole("button", { name }));
async function start() {
  const view = render(<MonoPreview snapshot={await new MockWalletRepository().getSnapshot()} />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Пресет 1: Пресет 1" })).toBeEnabled());
  return view;
}
function exportDocument() {
  fireEvent.click(screen.getByRole("button", { name: "Действия с пресетом" }));
  fireEvent.click(screen.getByRole("button", { name: /^Экспортировать пресет/ }));
  return JSON.parse((screen.getByRole("textbox", { name: "JSON рабочего пресета" }) as HTMLTextAreaElement).value).document;
}

// Turning off compact at the actual workbench boundary must reveal the old Home and fail.
it("uses compact Home/History in all seven editable documents without replacing palette history or the archive", async () => {
  const source = seedDocuments();
  const { container } = await start();
  for (const record of source.slots) {
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: `Пресет ${record.slot}: Пресет ${record.slot}` })); });
    expect(screen.getByRole("button", { name: "Мои средства" })).toBeVisible();
    expect(container.querySelector("[data-mono-preview]")).not.toHaveAttribute("data-mono-presentation");
    expect(container.querySelector(".mono-promo-frame, .mono-product-funds__list")).toBeNull();
    fireEvent.click(within(screen.getByRole("navigation", { name: "Разделы кошелька" })).getByRole("button", { name: "История" }));
    expect(screen.getByRole("region", { name: "История операций" })).toHaveAttribute("data-history-presentation", "compact");
    expect(screen.getByRole("heading", { name: "27 сентября 2026 г." })).toBeVisible();
    fireEvent.click(within(screen.getByRole("navigation", { name: "Разделы кошелька" })).getByRole("button", { name: "Обзор" }));
    expect(stored().slots[record.slot - 1]).toEqual(record);
  }
  expect(stored().slots).toEqual(source.slots);
  expect(stored().archive).toEqual(source.archive);
}, 20_000);

it("disables removed chart targets, keeps real balance/assets controls and retains hidden settings through Apply/export", async () => {
  const source = seedDocuments();
  const pins = '{ "version": 2, "groups": ["depositary", "custodial"], "totalOnly": false }';
  localStorage.setItem(HOME_PINS_STORAGE_KEY, pins);
  const before = localStorage.getItem(MONO_SEVEN_PRESETS_KEY);
  await start();
  const dock = within(screen.getByRole("toolbar", { name: "Инструменты оформления" }));
  expect(dock.getByRole("button", { name: "График" })).toBeDisabled();
  expect(screen.getByText(/график, промоблок и закрепления.*настройки.*сохранены/i)).toBeVisible();
  fireEvent.click(dock.getByRole("button", { name: "График" }));
  expect(screen.queryByLabelText("Показывать график")).toBeNull();
  expect(localStorage.getItem(MONO_SEVEN_PRESETS_KEY)).toBe(before);
  tool("Активы");
  expect(screen.getByText(/Мои средства.*Активы.*настройки списка/i)).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Мои средства" }));
  fireEvent.change(screen.getByLabelText("Оформление активов"), { target: { value: "tiles" } });
  expect(document.querySelector(".mono-product-funds")).toHaveAttribute("data-variant", "tiles");
  fireEvent.click(screen.getByRole("button", { name: "Отменить пробу" }));
  expect(screen.getByLabelText("Оформление активов")).toHaveValue("ledger");
  tool("Баланс");
  expect(screen.getByLabelText("Композиция баланса")).toBeEnabled();
  fireEvent.change(screen.getByLabelText("Размер дробной части"), { target: { value: "small" } });
  fireEvent.click(screen.getByRole("button", { name: "Применить настройку" }));
  const expected = structuredClone(source.slots[0].document);
  expected.appearance.ledger.balance.fractionSize = "small";
  expect(stored().slots[0].document).toEqual(expected);
  expect(stored().slots.slice(1)).toEqual(source.slots.slice(1));
  expect(stored().archive).toEqual(source.archive);
  expect(exportDocument()).toEqual(expected);
  expect(localStorage.getItem(HOME_PINS_STORAGE_KEY)).toBe(pins);
});

it("keeps optics only for an actual shared host, with readable retained values and no Apply when that target disappears", async () => {
  const source = seedDocuments();
  const { container } = await start();
  tool("Оптика");
  expect(screen.getByText(/Оптика применяется к всплывающим стеклянным панелям/)).toBeVisible();
  const ior = screen.getByRole("slider", { name: "Преломление" });
  expect(ior).toBeEnabled();
  fireEvent.change(ior, { target: { value: "0.75" } });
  const footer = container.querySelector('[data-mono-inspector="optics"] > footer')!;
  fireEvent.click(within(footer as HTMLElement).getByRole("button", { name: "Отменить пробу оптики" }));
  expect(ior).toHaveValue("1.34");
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Пресет 2: Пресет 2" })); });
  expect(screen.getByRole("button", { name: "Оптика" })).toBeDisabled();
  expect(screen.getByRole("slider", { name: "Преломление" })).toBeDisabled();
  expect(screen.getByRole("slider", { name: "Преломление" })).toHaveValue("1.34");
  expect(screen.getByText(/Нет оптической поверхности.*значения.*сохранены/i)).toBeVisible();
  expect(container.querySelector('[data-mono-inspector="optics"] > footer')).toBeNull();
  expect(screen.getByRole("button", { name: "Применить" })).toBeDisabled();
  expect(stored().slots).toEqual(source.slots);
  const dock = screen.getByRole("toolbar", { name: "Инструменты оформления" });
  const tabStop = dock.querySelector<HTMLButtonElement>('button:not(:disabled)[tabindex="0"]');
  expect(tabStop).toBeInTheDocument();
  act(() => { tabStop!.focus(); });
  fireEvent.keyDown(tabStop!, { key: "End" });
  expect(within(dock).getByRole("button", { name: "Среда" })).toHaveFocus();
});

it("does not mistake retained invisible icon-frame bindings for an available optical target", async () => {
  const library = seedDocuments();
  const border = createFirstMonoWorkingDocument().materials.ledger.buttons!.bindings[0];
  library.slots[0].document.materials.ledger.buttons = { version: 3, frameMode: "icons",
    artwork: createDefaultActionArtworkMap(), bindings: [border] };
  localStorage.setItem(MONO_SEVEN_PRESETS_KEY, JSON.stringify(library));
  await start();
  expect(screen.getByRole("button", { name: "Оптика" })).toBeDisabled();
  expect(stored().slots[0].document.materials.ledger.buttons).toEqual(library.slots[0].document.materials.ledger.buttons);
});

it("still guards a live trial when switching compact workspaces and accepts only after the explicit choice", async () => {
  const source = seedDocuments();
  await start();
  tool("Баланс");
  fireEvent.change(screen.getByLabelText("Размер дробной части"), { target: { value: "small" } });
  fireEvent.click(screen.getByRole("button", { name: "Пресет 2: Пресет 2" }));
  const guard = screen.getByRole("dialog", { name: "Неприменённые пробы" });
  expect(guard).toBeVisible();
  expect(stored().activeSlot).toBe(1);
  await act(async () => { fireEvent.click(within(guard).getByRole("button", { name: "Применить пробы и продолжить" })); });
  expect(stored().activeSlot).toBe(2);
  expect(stored().slots[0].document.appearance.ledger.balance.fractionSize).toBe("small");
  expect(stored().slots[0].document.appearance.ledger.chart).toEqual(source.slots[0].document.appearance.ledger.chart);
  expect(stored().slots[0].document.appearance.ledger.layout).toEqual(source.slots[0].document.appearance.ledger.layout);
});
