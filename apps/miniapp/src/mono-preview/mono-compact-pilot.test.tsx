import "@testing-library/jest-dom/vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
