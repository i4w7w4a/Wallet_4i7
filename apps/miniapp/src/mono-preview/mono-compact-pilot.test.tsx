import "@testing-library/jest-dom/vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import manifest from "../../../../checkpoints/mono-published/2026-10-17/manifest.json";
import preset2 from "../../../../checkpoints/mono-published/2026-10-17/slot-2.appearance.json";
import { parsePublishedRecord } from "./mono-published-contract";
import { canonicalMonoAppearance } from "./mono-preset-envelope";
import MonoCompactPilotPage from "../../app/mono/pilot/2/page";

// Next's request boundary has no HTTP request in this component test.
vi.mock("next/server", () => ({ connection: async () => undefined }));
beforeEach(() => {
  localStorage.clear();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduced-motion"), media: query,
    addEventListener() {}, removeEventListener() {} }));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); localStorage.clear(); });

it.each([undefined, "", "0", "true"])("keeps the local route unavailable when the explicit server flag is %s", async flag => {
  vi.stubEnv("MONO_COMPACT_LOCAL_PREVIEW", flag);
  await expect(MonoCompactPilotPage()).rejects.toMatchObject({ digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
});

it("renders the exact archived preset 2 read-only through the existing material/product host", async () => {
  vi.stubEnv("MONO_COMPACT_LOCAL_PREVIEW", "1");
  const page = await MonoCompactPilotPage();
  const source = JSON.stringify(preset2);
  const view = render(page);
  await waitFor(() => expect(screen.getByRole("button", { name: "Мои средства" })).toBeVisible());
  expect(view.container.querySelector("[data-mono-preview]")).toHaveAttribute("data-mono-theme", "dark");
  expect(view.container.querySelector("[data-mono-product-material]")).toHaveAttribute("data-mono-effect-background", "true");
  expect(view.container.querySelector("[data-mono-rail], [data-mono-workbench], [data-mono-gold-viewer]")).toBeNull();
  expect(screen.queryByText(/редактор|публикац|пароль/i)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Скрыть баланс" }));
  expect(screen.getByRole("button", { name: "Показать баланс" })).toBeVisible();
  expect(JSON.stringify(preset2)).toBe(source);
  expect(localStorage.length).toBe(0);
});

// Restoring a visitor preference must not seed/migrate v2 or rewrite the owner's stored bytes.
it.each([
  { name: "populated legacy v1", preferences: {
    "wallet4i7.mono.home-pins.v1": '{ "version": 1, "groups": ["depositary", "custodial"] }',
  } },
  { name: "populated v2 alongside legacy v1", preferences: {
    "wallet4i7.mono.home-pins.v1": '{ "version": 1, "groups": ["custodial"] }',
    "wallet4i7.mono.home-pins.v2": '{ "version": 2, "groups": ["depositary"], "totalOnly": true }',
  } },
])("leaves every storage key/value untouched with $name through Funds, History and privacy", async ({ preferences }) => {
  vi.stubEnv("MONO_COMPACT_LOCAL_PREVIEW", "1");
  for (const [key, value] of Object.entries(preferences)) localStorage.setItem(key, value!);
  localStorage.setItem("wallet4i7.mono.viewer-theme.v1", '{ "version": 1, "theme": "light" }');
  localStorage.setItem("owner.saved.note", "retain these bytes");
  const storedEntries = () => Array.from({ length: localStorage.length }, (_, index) => {
    const key = localStorage.key(index)!;
    return [key, localStorage.getItem(key)];
  }).sort(([left], [right]) => left!.localeCompare(right!));
  const before = storedEntries();
  const write = vi.spyOn(Storage.prototype, "setItem");
  const remove = vi.spyOn(Storage.prototype, "removeItem");
  const clear = vi.spyOn(Storage.prototype, "clear");
  const view = render(await MonoCompactPilotPage());
  await waitFor(() => expect(screen.getByRole("button", { name: "Мои средства" })).toBeVisible());
  fireEvent.click(screen.getByRole("button", { name: "Мои средства" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Назад в обзор" })).toHaveFocus());
  expect(screen.getByRole("button", { name: "Открыть актив Bitcoin (BTC)" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Открыть профиль" }));
  fireEvent.click(screen.getByRole("button", { name: "Закрыть профиль" }));
  expect(view.container.querySelector("[data-mono-preview]")).toHaveAttribute("data-mono-section", "assets");
  fireEvent.click(screen.getByRole("button", { name: "Назад в обзор" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Мои средства" })).toHaveFocus());
  fireEvent.click(screen.getByRole("button", { name: "Скрыть баланс" }));
  const nav = within(screen.getByRole("navigation", { name: "Разделы кошелька" }));
  fireEvent.click(nav.getByRole("button", { name: "История" }));
  expect(screen.getByRole("region", { name: "История операций" })).toBeVisible();
  fireEvent.click(nav.getByRole("button", { name: "Обзор" }));
  expect(screen.getByRole("button", { name: "Показать баланс" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Показать баланс" }));
  expect(view.container.querySelector("[data-mono-preview]")).toHaveAttribute("data-mono-theme", "dark");
  expect(storedEntries()).toEqual(before);
  expect(write).not.toHaveBeenCalled();
  expect(remove).not.toHaveBeenCalled();
  expect(clear).not.toHaveBeenCalled();
});

// Any changed checkpoint byte/envelope/material value must fail independently of the loader.
it("preserves the seven immutable checkpoint bytes and strict appearance/material envelopes", () => {
  expect(manifest.slots.map(slot => slot.revision)).toEqual([2, 5, 3, 3, 2, 2, 2]);
  for (const slot of manifest.slots) {
    const bytes = readFileSync(resolve(process.cwd(), "../../checkpoints/mono-published/2026-10-17", slot.snapshotFile));
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(slot.fileSha256);
    const input: unknown = JSON.parse(bytes.toString("utf8"));
    const parsed = parsePublishedRecord({ slot: slot.slot, revision: slot.revision, updatedAt: slot.updatedAt, snapshot: input },
      slot.slot as 1 | 2 | 3 | 4 | 5 | 6 | 7);
    expect(parsed.snapshot).toEqual(input);
    expect(createHash("sha256").update(canonicalMonoAppearance(parsed.snapshot)).digest("hex"))
      .toBe(slot.snapshotCanonicalSha256);
  }
});
