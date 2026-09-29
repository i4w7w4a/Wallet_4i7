import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DEFAULT_BACKGROUND_EDGE_FINISH, materialCatalogV2,
  type ButtonTargetId, type MaterialTargetBinding } from "@wallet/ui";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createMonoWorkingDocument, loadMonoSevenLibrary, migrateMonoSevenLibrary,
  saveMonoSevenLibrary } from "../mono-preview/mono-working-presets";
import { createDefaultActionArtwork } from "../mono-preview/action-artwork/model";
import { MonoProductApply } from "./mono-product-apply";
import { BUTTON_TARGETS } from "./button-workshop/binding";
import { createButtonDocument, editButtonArtwork } from "./button-workshop/model";

beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const fluid = materialCatalogV2.materials.find(item => item.id === "fluid")!.presets[0]!.recipe;
const background = { kind: "novex-background-lab" as const, version: 1 as const,
  material: fluid, edgeFinish: DEFAULT_BACKGROUND_EDGE_FINISH };

function seven() { return migrateMonoSevenLibrary(localStorage, createMonoWorkingDocument()); }

it("chooses one of seven numbers and patches only that number's selected direction", async () => {
  const start = seven();
  const slots = [...start.slots] as typeof start.slots;
  const second = structuredClone(slots[1]);
  second.document.palette.activeSlotId = 2;
  slots[1] = second;
  saveMonoSevenLibrary(localStorage, { ...start, slots, generation: 2 }, 1);
  render(<MonoProductApply scope="background" document={background} />);
  fireEvent.click(screen.getByRole("button", { name: "В рабочий пресет MONO…" }));
  expect(screen.getByLabelText("Пресет 1–7")).toHaveValue("1");
  expect(screen.queryByLabelText("Направление")).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Пресет 1–7"), { target: { value: "2" } });
  fireEvent.click(screen.getByRole("button", { name: "Применить в MONO" }));
  await waitFor(() => expect(loadMonoSevenLibrary(localStorage)?.slots[1].document.materials.frost.background?.recipe)
    .toEqual(fluid));
  const saved = loadMonoSevenLibrary(localStorage)!;
  expect(saved.activeSlot).toBe(2);
  expect(saved.slots[0]).toEqual(start.slots[0]);
  expect(saved.slots[1].document.materials.ledger.background).toBeNull();
  expect(screen.getByRole("link", { name: "Открыть MONO" })).toHaveAttribute("href", "/mono?slot=2");
});

it("requires the seven workspaces to be restored before applying from an empty browser", () => {
  render(<MonoProductApply scope="background" document={background} />);
  fireEvent.click(screen.getByRole("button", { name: "В рабочий пресет MONO…" }));
  expect(screen.getByRole("link", { name: "откройте MONO" })).toHaveAttribute("href", "/mono");
  expect(screen.queryByRole("button", { name: "Применить в MONO" })).not.toBeInTheDocument();
  expect(loadMonoSevenLibrary(localStorage)).toBeNull();
});

it("keeps confirmation visible while a seven-preset Apply transaction is pending", () => {
  class QuietChannel {
    onmessage: ((event: MessageEvent) => void) | null = null;
    postMessage() {}
    close() {}
  }
  vi.stubGlobal("BroadcastChannel", QuietChannel);
  seven();
  render(<MonoProductApply scope="background" document={background} />);
  fireEvent.click(screen.getByRole("button", { name: "В рабочий пресет MONO…" }));
  expect(screen.getByLabelText("Пресет 1–7")).toHaveValue("1");
  fireEvent.click(screen.getByRole("button", { name: "Применить в MONO" }));
  fireEvent.click(screen.getByRole("button", { name: "Закрыть" }));
  expect(screen.getByRole("dialog", { name: "Применить материал в MONO" })).toBeInTheDocument();
  expect(loadMonoSevenLibrary(localStorage)?.slots[0].document.materials.ledger.background).toBeNull();
});

it("rejects a stale number picker without overwriting the newer generation", async () => {
  const initial = seven();
  render(<MonoProductApply scope="background" document={background} />);
  fireEvent.click(screen.getByRole("button", { name: "В рабочий пресет MONO…" }));
  saveMonoSevenLibrary(localStorage, { ...initial, generation: 2 }, 1);
  fireEvent.click(screen.getByRole("button", { name: "Применить в MONO" }));
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/другой вкладке/));
  expect(loadMonoSevenLibrary(localStorage)?.slots[0].document.materials.ledger.background).toBeNull();
});

it("rejects a live MONO draft reported through the seven-workspace channel", async () => {
  class DirtyChannel {
    onmessage: ((event: MessageEvent) => void) | null = null;
    postMessage(message: { kind: string; requestId: string; targetId: string }) {
      if (message.kind === "material-apply-check") queueMicrotask(() => this.onmessage?.({ data: {
        kind: "material-apply-status", requestId: message.requestId, targetId: message.targetId, dirty: true,
      } } as MessageEvent));
    }
    close() {}
  }
  vi.stubGlobal("BroadcastChannel", DirtyChannel);
  seven();
  render(<MonoProductApply scope="background" document={background} />);
  fireEvent.click(screen.getByRole("button", { name: "В рабочий пресет MONO…" }));
  fireEvent.click(screen.getByRole("button", { name: "Применить в MONO" }));
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/несохранённая проба/));
  expect(loadMonoSevenLibrary(localStorage)?.slots[0].document.materials.ledger.background).toBeNull();
});

it("names an empty selected button layer as a clear operation before confirmation", () => {
  const document = createButtonDocument<ButtonTargetId, MaterialTargetBinding>(BUTTON_TARGETS);
  render(<MonoProductApply scope="buttons" document={document}
    selection={{ target: "quick.send", layer: "fill" }} />);
  fireEvent.click(screen.getByRole("button", { name: "В рабочий пресет MONO…" }));
  expect(screen.getByText(/Снять поверхность · Отправить/)).toBeVisible();
});

it("applies selected artwork to the chosen number through explicit confirmation", async () => {
  seven();
  const draft = editButtonArtwork(createButtonDocument<ButtonTargetId, MaterialTargetBinding>(BUTTON_TARGETS),
    BUTTON_TARGETS, "quick.send", { ...createDefaultActionArtwork(), packId: "volume-v1" });
  render(<MonoProductApply scope="artwork" document={draft} selection={{ target: "quick.send" }} />);
  fireEvent.click(screen.getByRole("button", { name: "Иконки в MONO…" }));
  expect(screen.getByText(/Иконки и свет · Отправить/)).toBeTruthy();
  expect(loadMonoSevenLibrary(localStorage)?.slots[0].document.materials.ledger.buttons).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Применить в MONO" }));
  await waitFor(() => expect(loadMonoSevenLibrary(localStorage)?.slots[0].document.materials.ledger.buttons)
    .toMatchObject({ version: 3, artwork: { "quick.send": { packId: "volume-v1" },
      "quick.receive": { packId: "original" } } }));
});
