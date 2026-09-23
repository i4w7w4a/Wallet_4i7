import "@testing-library/jest-dom/vitest";
import { webcrypto } from "node:crypto";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MockWalletRepository } from "@wallet/core";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MonoPreview } from "./mono-preview";
import { createMonoWorkingDocument, MONO_WORKING_PRESETS_KEY, saveMonoWorkingLibrary } from "./mono-working-presets";

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("crypto", webcrypto);
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduced-motion"), media: query,
    addEventListener() {}, removeEventListener() {} }));
  saveMonoWorkingLibrary(localStorage, { version: 2, skinId: "mono-ledger-v1", generation: 1, activeId: "a",
    records: [{ id: "a", name: "А", revision: 1, document: createMonoWorkingDocument() },
      { id: "b", name: "Б", revision: 1, document: createMonoWorkingDocument() }] }, 0);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

async function start() {
  const result = render(<MonoPreview snapshot={await new MockWalletRepository().getSnapshot()} />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Пресет оформления: А" })).toBeEnabled());
  return result;
}
const tool = (name: string) => fireEvent.click(screen.getByRole("button", { name }));

it("switches one inspector without mutating the accepted working document", async () => {
  const { container } = await start();
  const saved = localStorage.getItem(MONO_WORKING_PRESETS_KEY);
  tool("Баланс");
  expect(container.querySelectorAll("[data-mono-inspector]")).toHaveLength(1);
  expect(screen.getByRole("combobox", { name: "Композиция баланса" })).toBeVisible();
  expect(screen.queryByRole("slider", { name: "Преломление" })).toBeNull();
  tool("Активы");
  expect(screen.getByRole("combobox", { name: "Оформление активов" })).toBeVisible();
  expect(localStorage.getItem(MONO_WORKING_PRESETS_KEY)).toBe(saved);
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
  const library = JSON.parse(localStorage.getItem(MONO_WORKING_PRESETS_KEY)!);
  expect(library.records[0].document.appearance.ledger.balance.composition).toBe("centered");
  expect(library.records[0].document.appearance.ledger.assets.variant).toBe("ledger");
  tool("Активы");
  expect(screen.getByLabelText("Оформление активов")).toHaveValue("tiles");
  fireEvent.click(screen.getByRole("button", { name: "Отменить пробу" }));
  expect(screen.getByLabelText("Оформление активов")).toHaveValue("ledger");
});

it("guards a named preset switch and can discard trials before continuing", async () => {
  await start();
  tool("Баланс");
  fireEvent.change(screen.getByLabelText("Композиция баланса"), { target: { value: "centered" } });
  fireEvent.click(screen.getByRole("button", { name: "Пресет оформления: А" }));
  fireEvent.click(screen.getByRole("button", { name: "Выбрать Б" }));
  expect(screen.getByRole("dialog", { name: "Неприменённые пробы" })).toBeVisible();
  expect(JSON.parse(localStorage.getItem(MONO_WORKING_PRESETS_KEY)!).activeId).toBe("a");
  fireEvent.click(screen.getByRole("button", { name: "Отменить пробы и продолжить" }));
  expect(screen.getByRole("button", { name: "Пресет оформления: Б" })).toBeVisible();
  expect(screen.getByLabelText("Композиция баланса")).toHaveValue("ledger");
  const library = JSON.parse(localStorage.getItem(MONO_WORKING_PRESETS_KEY)!);
  expect(library.records[0].document.appearance.ledger.balance.composition).toBe("ledger");
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
