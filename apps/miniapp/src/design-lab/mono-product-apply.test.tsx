import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DEFAULT_BACKGROUND_EDGE_FINISH, materialCatalogV2,
  type ButtonTargetId, type MaterialTargetBinding } from "@wallet/ui";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createMonoWorkingDocument, loadMonoWorkingLibrary, saveMonoWorkingLibrary,
  type MonoWorkingLibrary } from "../mono-preview/mono-working-presets";
import { MonoProductApply } from "./mono-product-apply";
import { BUTTON_TARGETS } from "./button-workshop/binding";
import { createButtonDocument } from "./button-workshop/model";

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

const fluid = materialCatalogV2.materials.find(item => item.id === "fluid")!.presets[0]!.recipe;
const background = { kind: "novex-background-lab" as const, version: 1 as const,
  material: fluid, edgeFinish: DEFAULT_BACKGROUND_EDGE_FINISH };

it("writes a current lab background into an explicitly chosen working preset and direction", async () => {
  const library: MonoWorkingLibrary = { version: 2, skinId: "mono-ledger-v1", generation: 1,
    activeId: "first", records: [
      { id: "first", name: "Первый", revision: 1, document: createMonoWorkingDocument() },
      { id: "second", name: "Второй", revision: 4, document: createMonoWorkingDocument() },
    ] };
  saveMonoWorkingLibrary(localStorage, library, 0);
  render(<MonoProductApply scope="background" document={background} />);
  fireEvent.click(screen.getByRole("button", { name: "В рабочий пресет MONO…" }));
  fireEvent.change(screen.getByLabelText("Рабочий пресет"), { target: { value: "second" } });
  fireEvent.change(screen.getByLabelText("Направление"), { target: { value: "frost" } });
  fireEvent.click(screen.getByRole("button", { name: "Применить в MONO" }));

  await waitFor(() => expect(loadMonoWorkingLibrary(localStorage)?.records[1].document.materials.frost.background?.recipe)
    .toEqual(fluid));
  const saved = loadMonoWorkingLibrary(localStorage)!;
  expect(saved.activeId).toBe("second");
  expect(saved.records[0]).toEqual(library.records[0]);
  expect(saved.records[1].document.materials.ledger.background).toBeNull();
  expect(screen.getByRole("link", { name: "Открыть MONO" }).getAttribute("href"))
    .toBe("/mono?working=second&direction=frost");
});

it("creates a named working preset from a clean browser and applies only the selected direction", async () => {
  render(<MonoProductApply scope="background" document={background} />);
  fireEvent.click(screen.getByRole("button", { name: "В рабочий пресет MONO…" }));
  fireEvent.change(screen.getByLabelText("Название нового рабочего пресета"), { target: { value: "Мой металл" } });
  fireEvent.change(screen.getByLabelText("Направление"), { target: { value: "mercury" } });
  fireEvent.click(screen.getByRole("button", { name: "Применить в MONO" }));
  await waitFor(() => expect(loadMonoWorkingLibrary(localStorage)?.records[0].document.materials.mercury.background?.recipe)
    .toEqual(fluid));
  const saved = loadMonoWorkingLibrary(localStorage)!;
  expect(saved.records[0].name).toBe("Мой металл");
  expect(saved.records[0].document.materials.ledger.background).toBeNull();
  expect(saved.records[0].document.materials.frost.background).toBeNull();
});

it("shows the active record and its direction before explicit confirmation", () => {
  const document = createMonoWorkingDocument();
  document.palette.activeSlotId = 2;
  saveMonoWorkingLibrary(localStorage, { version: 2, skinId: "mono-ledger-v1", generation: 1,
    activeId: "mine", records: [{ id: "mine", name: "Мой", revision: 1, document }] }, 0);
  render(<MonoProductApply scope="background" document={background} />);
  fireEvent.click(screen.getByRole("button", { name: /В рабочий пресет MONO|Применить в MONO/ }));
  expect((screen.getByLabelText("Рабочий пресет") as HTMLSelectElement).value).toBe("mine");
  expect((screen.getByLabelText("Направление") as HTMLSelectElement).value).toBe("frost");
});

it("keeps the confirmation visible while an Apply transaction is pending", () => {
  class QuietChannel {
    onmessage: ((event: MessageEvent) => void) | null = null;
    postMessage() {}
    close() {}
  }
  vi.stubGlobal("BroadcastChannel", QuietChannel);
  saveMonoWorkingLibrary(localStorage, { version: 2, skinId: "mono-ledger-v1", generation: 1,
    activeId: "mine", records: [{ id: "mine", name: "Мой", revision: 1,
      document: createMonoWorkingDocument() }] }, 0);
  render(<MonoProductApply scope="background" document={background} />);
  fireEvent.click(screen.getByRole("button", { name: /В рабочий пресет MONO|Применить в MONO/ }));
  fireEvent.change(screen.getByLabelText("Рабочий пресет"), { target: { value: "mine" } });
  fireEvent.change(screen.getByLabelText("Направление"), { target: { value: "ledger" } });
  fireEvent.click(screen.getByRole("button", { name: "Применить в MONO" }));
  fireEvent.click(screen.getByRole("button", { name: "Закрыть" }));
  expect(screen.queryByLabelText("Применить материал в MONO")).not.toBeNull();
});

it("rejects a stale picker instead of overwriting another tab's working preset", async () => {
  const initial: MonoWorkingLibrary = { version: 2, skinId: "mono-ledger-v1", generation: 1,
    activeId: "mine", records: [{ id: "mine", name: "Мой", revision: 1,
      document: createMonoWorkingDocument() }] };
  saveMonoWorkingLibrary(localStorage, initial, 0);
  render(<MonoProductApply scope="background" document={background} />);
  fireEvent.click(screen.getByRole("button", { name: "В рабочий пресет MONO…" }));
  saveMonoWorkingLibrary(localStorage, { ...initial, generation: 2 }, 1);
  fireEvent.click(screen.getByRole("button", { name: "Применить в MONO" }));
  await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/другой вкладке/));
  expect(loadMonoWorkingLibrary(localStorage)?.records[0].document.materials.ledger.background).toBeNull();
});

it("rejects a target that another live MONO tab reports as having an unsaved draft", async () => {
  class DirtyChannel {
    onmessage: ((event: MessageEvent) => void) | null = null;
    postMessage(message: { kind: string; requestId: string; targetId: string }) {
      if (message.kind === "material-apply-check") queueMicrotask(() => this.onmessage?.({ data: {
        kind: "material-apply-status", requestId: message.requestId, targetId: message.targetId,
        dirty: true,
      } } as MessageEvent));
    }
    close() {}
  }
  vi.stubGlobal("BroadcastChannel", DirtyChannel);
  saveMonoWorkingLibrary(localStorage, { version: 2, skinId: "mono-ledger-v1", generation: 1,
    activeId: "mine", records: [{ id: "mine", name: "Мой", revision: 1,
      document: createMonoWorkingDocument() }] }, 0);
  render(<MonoProductApply scope="background" document={background} />);
  fireEvent.click(screen.getByRole("button", { name: "В рабочий пресет MONO…" }));
  fireEvent.click(screen.getByRole("button", { name: "Применить в MONO" }));
  await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/несохранённая проба/));
  expect(loadMonoWorkingLibrary(localStorage)?.records[0].document.materials.ledger.background).toBeNull();
});

it("names an empty selected button layer as a clear operation before confirmation", () => {
  const document = createButtonDocument<ButtonTargetId, MaterialTargetBinding>(BUTTON_TARGETS);
  render(<MonoProductApply scope="buttons" document={document}
    selection={{ target: "quick.send", layer: "fill" }} />);
  fireEvent.click(screen.getByRole("button", { name: "В рабочий пресет MONO…" }));
  expect(screen.getByText(/Снять поверхность · Отправить/)).toBeTruthy();
});
