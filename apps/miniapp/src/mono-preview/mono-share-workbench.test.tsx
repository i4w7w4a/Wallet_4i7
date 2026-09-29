import "@testing-library/jest-dom/vitest";
import { webcrypto } from "node:crypto";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MockWalletRepository } from "@wallet/core";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { MonoAppearanceEnvelope } from "./mono-preset-envelope";
import { MONO_SEVEN_PRESETS_KEY } from "./mono-working-presets";

const share = vi.hoisted(() => vi.fn(async (...args: [MonoAppearanceEnvelope, string]) => {
  void args;
  return "http://localhost:3000/mono/view#mono=shared";
}));
vi.mock("./mono-share-codec", () => ({ createMonoShareUrl: share }));
import { MonoPreview } from "./mono-preview";

beforeEach(() => {
  localStorage.clear(); share.mockClear();
  vi.stubGlobal("crypto", webcrypto);
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduced-motion"), media: query,
    addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => setTimeout(() => callback(performance.now()), 0));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

async function renderReady() {
  render(<MonoPreview snapshot={await new MockWalletRepository().getSnapshot()} />);
  await waitFor(() => expect(screen.getByRole("button", { name: /^Пресет 1:/ })).toBeEnabled());
  return screen.getByRole("button", { name: "Скопировать ссылку" });
}

it("asks before sharing a trial, then copies the accepted First snapshot after Cancel", async () => {
  const copy = await renderReady();
  fireEvent.click(screen.getByRole("button", { name: "Баланс" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "Моргание глаза" }));
  fireEvent.click(copy);
  expect(screen.getByRole("dialog", { name: "Неприменённые пробы" })).toBeVisible();
  expect(share).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Отменить пробы и продолжить" }));
  await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
  const envelope = share.mock.calls[0][0] as MonoAppearanceEnvelope;
  expect(envelope.appearance.eye.blinkEnabled).toBe(true);
  expect(envelope.material.buttons?.bindings).toHaveLength(4);
  expect(JSON.parse(localStorage.getItem(MONO_SEVEN_PRESETS_KEY)!).slots).toHaveLength(7);
});

it("applies a trial explicitly, then rekeys and copies the newly accepted snapshot", async () => {
  const copy = await renderReady();
  fireEvent.click(screen.getByRole("button", { name: "Баланс" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "Моргание глаза" }));
  fireEvent.click(copy);
  fireEvent.click(screen.getByRole("button", { name: "Применить пробы и продолжить" }));
  await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
  const envelope = share.mock.calls[0][0] as MonoAppearanceEnvelope;
  expect(envelope.appearance.eye.blinkEnabled).toBe(false);
  expect(envelope.material.buttons?.bindings).toHaveLength(4);
  const saved = JSON.parse(localStorage.getItem(MONO_SEVEN_PRESETS_KEY)!);
  expect(saved.slots[0].revision).toBe(2);
  expect(saved.slots[0].document.appearance.ledger.eye.blinkEnabled).toBe(false);
  expect(screen.getByRole("textbox", { name: "Ссылка на кошелёк" })).toHaveValue("http://localhost:3000/mono/view#mono=shared");
});

it("flushes an already accepted palette/theme change before encoding without applying another trial", async () => {
  await renderReady();
  fireEvent.click(screen.getByRole("button", { name: "Light" }));
  // Direct palette acceptance increments revision and remounts the share actions.
  fireEvent.click(screen.getByRole("button", { name: "Скопировать ссылку" }));
  await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
  const envelope = share.mock.calls[0][0] as MonoAppearanceEnvelope;
  expect(envelope.appearance.environment.theme).toBe("light");
  const saved = JSON.parse(localStorage.getItem(MONO_SEVEN_PRESETS_KEY)!);
  expect(saved.slots[0].revision).toBe(2);
  expect(saved.slots[0].document.palette.slots[0].present.mode).toBe("light");
});

it("refuses same-tab sharing after a prior save failure so Back cannot lose accepted changes", async () => {
  await renderReady();
  const original = Storage.prototype.setItem;
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function(this: Storage, key, value) {
    if (key === MONO_SEVEN_PRESETS_KEY) throw new Error("quota");
    return original.call(this, key, value);
  });
  fireEvent.click(screen.getByRole("button", { name: "Light" }));
  await waitFor(() => expect(screen.getByText(/Не удалось сохранить · Повторить/)).toBeVisible());
  fireEvent.click(screen.getByRole("button", { name: "Скопировать ссылку" }));
  expect(share).not.toHaveBeenCalled();
  expect(await within(screen.getByRole("region", { name: "Поделиться готовым кошельком" }))
    .findByRole("alert")).toHaveTextContent(/Не удалось сохранить/);
});
