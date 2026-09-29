import "@testing-library/jest-dom/vitest";
import { webcrypto } from "node:crypto";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MockWalletRepository } from "@wallet/core";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MonoPreview } from "./mono-preview";
import { createMonoWorkingDocument, MONO_SEVEN_BACKUP_KEY, MONO_SEVEN_PRESETS_KEY,
  MONO_WORKING_PRESETS_KEY, saveMonoWorkingLibrary } from "./mono-working-presets";

beforeEach(() => {
  localStorage.clear();
  history.replaceState(null, "", "/mono");
  vi.stubGlobal("crypto", webcrypto);
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduced-motion"), media: query,
    addEventListener() {}, removeEventListener() {} }));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("shows exactly seven numbered workspaces and retains the owner's active legacy direction", async () => {
  const first = createMonoWorkingDocument();
  first.palette.activeSlotId = 2;
  first.appearance.frost.logo.hue = 245;
  saveMonoWorkingLibrary(localStorage, { version: 2, skinId: "mono-ledger-v1", generation: 1,
    activeId: "owner", records: [{ id: "owner", name: "Первый · перелив", revision: 4, document: first }] }, 0);
  const raw = localStorage.getItem(MONO_WORKING_PRESETS_KEY);
  render(<MonoPreview snapshot={await new MockWalletRepository().getSnapshot()} />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Пресет 1: Первый · перелив" })).toBeEnabled());
  expect(screen.getAllByRole("button", { name: /^Пресет [1-7]:/ })).toHaveLength(7);
  expect(screen.queryByRole("group", { name: "Варианты дизайна" })).not.toBeInTheDocument();
  expect(document.querySelector(".mono-page")).toHaveAttribute("data-mono-preset", "frost");
  expect(localStorage.getItem(MONO_SEVEN_BACKUP_KEY)).toBe(raw);
  expect(JSON.parse(localStorage.getItem(MONO_SEVEN_PRESETS_KEY)!).slots).toHaveLength(7);
});

it("repeatedly choosing preset 1 never creates the old hidden First copies", async () => {
  const first = createMonoWorkingDocument();
  saveMonoWorkingLibrary(localStorage, { version: 2, skinId: "mono-ledger-v1", generation: 1,
    activeId: "owner", records: [{ id: "owner", name: "Первый · перелив", revision: 1, document: first }] }, 0);
  render(<MonoPreview snapshot={await new MockWalletRepository().getSnapshot()} />);
  const button = await screen.findByRole("button", { name: "Пресет 1: Первый · перелив" });
  await waitFor(() => expect(button).toBeEnabled());
  const before = localStorage.getItem(MONO_SEVEN_PRESETS_KEY);
  for (let index = 0; index < 4; index++) fireEvent.click(button);
  expect(localStorage.getItem(MONO_SEVEN_PRESETS_KEY)).toBe(before);
  const library = JSON.parse(before!);
  expect(library.slots).toHaveLength(7);
  expect(library.archive).toHaveLength(1);
});

it("keys 1–7 select presets, but typing, IME and a foreign dialog do not", async () => {
  render(<MonoPreview snapshot={await new MockWalletRepository().getSnapshot()} />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Пресет 1: Пресет 1" })).toBeEnabled());
  fireEvent.keyDown(window, { key: "4" });
  expect(screen.getByRole("button", { name: "Пресет 4: Пресет 4" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "Действия с пресетом" }));
  fireEvent.click(screen.getByRole("button", { name: "Переименовать пресет 4" }));
  const input = screen.getByRole("textbox", { name: "Новое имя" });
  fireEvent.keyDown(input, { key: "2" });
  expect(screen.getByRole("button", { name: "Пресет 4: Пресет 4" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.keyDown(window, { key: "3", isComposing: true });
  expect(screen.getByRole("button", { name: "Пресет 4: Пресет 4" })).toHaveAttribute("aria-pressed", "true");
  const foreign = document.createElement("dialog"); foreign.open = true; document.body.append(foreign);
  fireEvent.keyDown(window, { key: "6" });
  expect(screen.getByRole("button", { name: "Пресет 4: Пресет 4" })).toHaveAttribute("aria-pressed", "true");
  foreign.remove();
});
