import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MonoWorkingPresetBar } from "./mono-working-preset-bar";
import { createMonoWorkingDocument } from "./mono-working-presets";

const pending = vi.hoisted(() => ({ resolve: null as null | ((value: unknown) => void) }));
vi.mock("./mono-working-presets", async importOriginal => {
  const actual = await importOriginal<typeof import("./mono-working-presets")>();
  return { ...actual, previewMonoWorkingImport: vi.fn(() => new Promise(resolve => { pending.resolve = resolve; })) };
});

afterEach(() => { cleanup(); pending.resolve = null; });
const choices = ([1, 2, 3, 4, 5, 6, 7] as const).map(slot => ({ slot, name: `Пресет ${slot}` }));
function mount() {
  return render(<MonoWorkingPresetBar activeSlot={1} choices={choices} archive={[]} ready status="Сохранено"
    onSelect={() => true} onRename={() => true} onCopy={() => true} onImport={() => true}
    onRestore={() => true} onExport={() => "{}"} onExportArchive={() => "{}"}
    onOpenPaletteArchive={() => {}} onRetry={() => true} />);
}
function openImport() {
  fireEvent.click(screen.getByRole("button", { name: "Действия с пресетом" }));
  fireEvent.click(screen.getByRole("button", { name: "Импортировать в пресет…" }));
}

it("does not show an old validation result after JSON changes or import closes", async () => {
  mount(); openImport();
  const textarea = screen.getByRole("textbox", { name: "JSON для импорта" });
  fireEvent.change(textarea, { target: { value: "old" } });
  fireEvent.click(screen.getByRole("button", { name: "Проверить импорт" }));
  const resolve = pending.resolve!;
  fireEvent.change(textarea, { target: { value: "new" } });
  await act(async () => resolve({ name: "Старый", kind: "full", document: createMonoWorkingDocument() }));
  expect(screen.queryByText(/Проверено: Старый/)).not.toBeInTheDocument();
  expect(textarea).toHaveValue("new");

  fireEvent.click(screen.getByRole("button", { name: "Проверить импорт" }));
  const second = pending.resolve!;
  fireEvent.click(screen.getByRole("button", { name: "Назад к действиям" }));
  await act(async () => second({ name: "Поздний", kind: "full", document: createMonoWorkingDocument() }));
  fireEvent.click(screen.getByRole("button", { name: "Импортировать в пресет…" }));
  expect(screen.queryByText(/Проверено: Поздний/)).not.toBeInTheDocument();
});

it("ignores a late File.text result after the user edits the JSON", async () => {
  mount(); openImport();
  let resolveFile!: (value: string) => void;
  const file = new File(["old"], "preset.json", { type: "application/json" });
  Object.defineProperty(file, "text", { value: () => new Promise<string>(resolve => { resolveFile = resolve; }) });
  fireEvent.change(screen.getByLabelText("Файл JSON"), { target: { files: [file] } });
  const textarea = screen.getByRole("textbox", { name: "JSON для импорта" });
  fireEvent.change(textarea, { target: { value: "new" } });
  await act(async () => resolveFile("old"));
  await waitFor(() => expect(textarea).toHaveValue("new"));
});
