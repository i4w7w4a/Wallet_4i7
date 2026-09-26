import "@testing-library/jest-dom/vitest";
import { webcrypto } from "node:crypto";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MockWalletRepository } from "@wallet/core";
import { DEFAULT_BACKGROUND_EDGE_FINISH, createTargetBinding, materialCatalogV2, normalizeMonoPaletteConfig } from "@wallet/ui";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { MonoPreview } from "./mono-preview";
import { createMonoPaletteWorkspace } from "./mono-palette-workspace";
import { MONO_PALETTE_PRESETS_KEY, MONO_PALETTE_WORKSPACE_KEY, saveMonoPaletteLibrary, saveMonoPaletteWorkspace } from "./mono-palette-storage";
import { exportMonoPalettePreset, importMonoPalettePreset } from "./mono-preset-codec";
import { createMonoWorkingDocument, MONO_WORKING_PRESETS_KEY, saveMonoWorkingLibrary } from "./mono-working-presets";
import { FIRST_BUTTON_PRESET_NAME } from "./mono-first-button-preset";

const WORKING_KEY = MONO_WORKING_PRESETS_KEY;
const selectTool = (name: string) => fireEvent.click(screen.getByRole("button", { name }));
const inspectorActions = (name: string) => within(screen.getByRole("region", { name }).querySelector("footer")!);
const openEnvironment = () => {
  selectTool("Среда");
  fireEvent.click(screen.getByText("Исходная среда и тема"));
};

beforeEach(() => {
  localStorage.clear();
  history.replaceState(null, "", "/mono");
  vi.stubGlobal("crypto", webcrypto);
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("reduced-motion"), media: query,
    addEventListener() {}, removeEventListener() {},
  }));
});

it("opens the named starter on clean storage and offers it without replacing an existing selection", async () => {
  const snapshot = await new MockWalletRepository().getSnapshot();
  const first = render(<MonoPreview snapshot={snapshot} />);
  await waitFor(() => expect(screen.getByRole("button", { name: `Пресет оформления: ${FIRST_BUTTON_PRESET_NAME}` })).toBeEnabled());
  expect(localStorage.getItem(WORKING_KEY)).toBeNull();
  expect(document.querySelectorAll('.mono-actions__item[data-material-target]')).toHaveLength(4);
  first.unmount();

  const existing = { version: 2 as const, skinId: "mono-ledger-v1" as const, generation: 1,
    activeId: "mine", records: [{ id: "mine", name: "Мой", revision: 1, document: createMonoWorkingDocument() }] };
  saveMonoWorkingLibrary(localStorage, existing, 0);
  const saved = localStorage.getItem(WORKING_KEY);
  render(<MonoPreview snapshot={snapshot} />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Пресет оформления: Мой" })).toBeEnabled());
  expect(localStorage.getItem(WORKING_KEY)).toBe(saved);
  fireEvent.click(screen.getByRole("button", { name: "Пресет оформления: Мой" }));
  expect(screen.getByRole("button", { name: `Открыть ${FIRST_BUTTON_PRESET_NAME}` })).toBeInTheDocument();
});

it("opens the exact working record and direction named by a product Apply link", async () => {
  const first = createMonoWorkingDocument();
  const second = createMonoWorkingDocument();
  const library = { version: 2 as const, skinId: "mono-ledger-v1" as const, generation: 1,
    activeId: "first", records: [
      { id: "first", name: "Первый", revision: 1, document: first },
      { id: "second", name: "Второй", revision: 2, document: second },
    ] };
  saveMonoWorkingLibrary(localStorage, library, 0);
  history.replaceState(null, "", "/mono?working=second&direction=frost");
  const snapshot = await new MockWalletRepository().getSnapshot();
  render(<MonoPreview snapshot={snapshot} />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Пресет оформления: Второй" })).toBeVisible());
  expect(document.querySelector(".mono-page")?.getAttribute("data-mono-preset")).toBe("frost");
  expect(JSON.parse(localStorage.getItem(WORKING_KEY)!).activeId).toBe("second");
});

it("reports a live unsaved MONO draft to a material Apply request from another tab", async () => {
  class LocalChannel {
    static peers = new Set<LocalChannel>();
    onmessage: ((event: MessageEvent) => void) | null = null;
    constructor(readonly name: string) { LocalChannel.peers.add(this); }
    postMessage(data: unknown) {
      for (const peer of LocalChannel.peers) if (peer !== this && peer.name === this.name)
        queueMicrotask(() => peer.onmessage?.({ data } as MessageEvent));
    }
    close() { LocalChannel.peers.delete(this); }
  }
  vi.stubGlobal("BroadcastChannel", LocalChannel);
  saveMonoWorkingLibrary(localStorage, { version: 2, skinId: "mono-ledger-v1", generation: 1,
    activeId: "mine", records: [{ id: "mine", name: "Мой", revision: 1,
      document: createMonoWorkingDocument() }] }, 0);
  const snapshot = await new MockWalletRepository().getSnapshot();
  render(<MonoPreview snapshot={snapshot} />);
  const enable = screen.getByRole("button", { name: "Включить палитру" });
  await waitFor(() => expect(enable).toBeEnabled());
  fireEvent.click(enable);
  const otherTab = new LocalChannel(MONO_WORKING_PRESETS_KEY);
  const answers: unknown[] = [];
  otherTab.onmessage = event => answers.push(event.data);
  otherTab.postMessage({ kind: "material-apply-check", requestId: "probe", targetId: "mine" });
  await waitFor(() => expect(answers).toContainEqual({ kind: "material-apply-status",
    requestId: "probe", targetId: "mine", dirty: true }));
  otherTab.close();
});

it("does not report a clean stale MONO reader as an unsaved draft", async () => {
  class LocalChannel {
    static peers = new Set<LocalChannel>();
    onmessage: ((event: MessageEvent) => void) | null = null;
    constructor(readonly name: string) { LocalChannel.peers.add(this); }
    postMessage(data: unknown) {
      for (const peer of LocalChannel.peers) if (peer !== this && peer.name === this.name)
        queueMicrotask(() => peer.onmessage?.({ data } as MessageEvent));
    }
    close() { LocalChannel.peers.delete(this); }
  }
  vi.stubGlobal("BroadcastChannel", LocalChannel);
  saveMonoWorkingLibrary(localStorage, { version: 2, skinId: "mono-ledger-v1", generation: 1,
    activeId: "mine", records: [{ id: "mine", name: "Мой", revision: 1,
      document: createMonoWorkingDocument() }] }, 0);
  const snapshot = await new MockWalletRepository().getSnapshot();
  render(<MonoPreview snapshot={snapshot} />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Пресет оформления: Мой" })).toBeEnabled());
  const previous = localStorage.getItem(WORKING_KEY)!;
  const next = JSON.parse(previous) as { generation: number };
  next.generation += 1;
  const value = JSON.stringify(next);
  localStorage.setItem(WORKING_KEY, value);
  fireEvent(window, new StorageEvent("storage", { key: WORKING_KEY, oldValue: previous, newValue: value }));
  await waitFor(() => expect(screen.getByText(/Изменён в другой вкладке/)).toBeVisible());
  const otherTab = new LocalChannel(WORKING_KEY);
  const answers: unknown[] = [];
  otherTab.onmessage = event => answers.push(event.data);
  otherTab.postMessage({ kind: "material-apply-check", requestId: "clean-probe", targetId: "mine" });
  await waitFor(() => expect(answers).toContainEqual({ kind: "material-apply-status",
    requestId: "clean-probe", targetId: "mine", dirty: false }));
  otherTab.close();
});

it("mounts one shared material scene for applied quick action bindings", async () => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  const working = createMonoWorkingDocument();
  const border = materialCatalogV2.materials.find(item => item.id === "pulsing-border")!.presets[0]!.recipe;
  const binding = createTargetBinding("quick.send", "border", border, materialCatalogV2);
  if (!binding.ok) throw new Error("Installed border fixture is invalid");
  working.materials.ledger = { ...working.materials.ledger,
    buttons: { version: 1, bindings: [binding.value] } };
  saveMonoWorkingLibrary(localStorage, { version: 2, skinId: "mono-ledger-v1", generation: 1,
    activeId: "mine", records: [{ id: "mine", name: "Мой", revision: 1, document: working }] }, 0);
  const snapshot = await new MockWalletRepository().getSnapshot();
  render(<MonoPreview snapshot={snapshot} />);
  await waitFor(() => expect(document.querySelectorAll("[data-material-scene]")).toHaveLength(1));
  expect(document.querySelectorAll('[data-material-target="quick.send"]')).toHaveLength(1);
  expect(document.querySelectorAll('[data-material-scrollport]')).toHaveLength(1);
});

it("removes an applied material background and reveals the preserved MONO background", async () => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  const working = createMonoWorkingDocument();
  working.background = "tide";
  const fluid = materialCatalogV2.materials.find(item => item.id === "fluid")!.presets[0]!.recipe;
  working.materials.ledger = { ...working.materials.ledger,
    background: { version: 1, recipe: fluid, edgeFinish: DEFAULT_BACKGROUND_EDGE_FINISH } };
  saveMonoWorkingLibrary(localStorage, { version: 2, skinId: "mono-ledger-v1", generation: 1,
    activeId: "mine", records: [{ id: "mine", name: "Мой", revision: 1, document: working }] }, 0);
  const snapshot = await new MockWalletRepository().getSnapshot();
  render(<MonoPreview snapshot={snapshot} />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Пресет оформления: Мой" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Скрыть баланс" }));
  fireEvent.click(screen.getByRole("button", { name: "За неделю" }));
  expect(screen.getByRole("button", { name: "Показать баланс" })).toBeVisible();
  expect(screen.getByRole("button", { name: "За неделю" })).toHaveAttribute("aria-pressed", "true");
  selectTool("Среда");
  fireEvent.click(screen.getByRole("button", { name: "Снять материал фона" }));
  await waitFor(() => expect(JSON.parse(localStorage.getItem(WORKING_KEY)!).records[0].document.materials.ledger.background)
    .toBeNull());
  expect(JSON.parse(localStorage.getItem(WORKING_KEY)!).records[0].document.background).toBe("tide");
  expect(screen.getByRole("button", { name: "Показать баланс" })).toBeVisible();
  expect(screen.getByRole("button", { name: "За неделю" })).toHaveAttribute("aria-pressed", "true");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("saves a real working preset on the first direct color edit and restores it after reload", async () => {
  const snapshot = await new MockWalletRepository().getSnapshot();
  const first = render(<MonoPreview snapshot={snapshot} />);
  const enable = screen.getByRole("button", { name: "Включить палитру" });
  await waitFor(() => expect(enable).toBeEnabled());

  fireEvent.click(enable);
  await waitFor(() => {
    const raw = localStorage.getItem(WORKING_KEY);
    expect(raw).not.toBeNull();
    const library = JSON.parse(raw!) as {
      activeId: string;
      records: Array<{ id: string; document: { palette: { slots: Array<{ present: { paletteEnabled: boolean } }> } } }>;
    };
    expect(library.records).toHaveLength(1);
    expect(library.activeId).toBe(library.records[0].id);
    expect(library.records[0].document.palette.slots[0].present.paletteEnabled).toBe(true);
  });

  first.unmount();
  render(<MonoPreview snapshot={snapshot} />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Вернуть исходный материал" })).toBeVisible());
});

it("migrates all legacy palette slots and accepted shape, optics and background without rewriting their keys", async () => {
  const workspace = createMonoPaletteWorkspace();
  workspace.activeSlotId = 2;
  for (const [index, hue] of [41, 112, 203].entries()) {
    workspace.slots[index].present.paletteEnabled = true;
    workspace.slots[index].present.config.themes.dark.recipe.anchorHue = hue;
  }
  workspace.slots[1].present.mode = "light";
  saveMonoPaletteWorkspace(localStorage, workspace);
  localStorage.setItem("wallet4i7.mono.shape-preview.v1", JSON.stringify({ version: 1, skinId: "mono-ledger-v1",
    presets: { ledger: { "quick-actions": 12, "bottom-navigation": 0 },
      frost: { "quick-actions": 21, "bottom-navigation": 7 },
      mercury: { "quick-actions": 14, "bottom-navigation": 0 } } }));
  localStorage.setItem("wallet4i7.mono.optical-preview.v1", JSON.stringify({ version: 1,
    presets: { frost: { ior: -0.57 } } }));
  localStorage.setItem("wallet4i7.mono.environment-preview.v1", JSON.stringify({ version: 1,
    theme: "light", background: "tide" }));
  const legacy = new Map([MONO_PALETTE_WORKSPACE_KEY, "wallet4i7.mono.shape-preview.v1",
    "wallet4i7.mono.optical-preview.v1", "wallet4i7.mono.environment-preview.v1"]
    .map(key => [key, localStorage.getItem(key)]));

  const snapshot = await new MockWalletRepository().getSnapshot();
  const first = render(<MonoPreview snapshot={snapshot} />);
  let activeId = "";
  await waitFor(() => {
    const raw = localStorage.getItem(WORKING_KEY);
    expect(raw).not.toBeNull();
    const library = JSON.parse(raw!) as {
      activeId: string;
      records: Array<{ document: {
        palette: { activeSlotId: number; slots: Array<{ present: { config: { themes: { dark: { recipe: { anchorHue: number } } } } } }> };
        shapes: { frost: Record<string, number> };
        optics: { frost: { ior: number } };
        background: string;
      } }>;
    };
    activeId = library.activeId;
    const document = library.records[0].document;
    expect(document.palette.activeSlotId).toBe(2);
    expect(document.palette.slots.map(slot => slot.present.config.themes.dark.recipe.anchorHue)).toEqual([41, 112, 203]);
    expect(document.shapes.frost["quick-actions"]).toBe(21);
    expect(document.optics.frost.ior).toBe(-0.57);
    expect(document.background).toBe("tide");
  });
  for (const [key, value] of legacy) expect(localStorage.getItem(key)).toBe(value);

  first.unmount();
  render(<MonoPreview snapshot={snapshot} />);
  await waitFor(() => expect(JSON.parse(localStorage.getItem(WORKING_KEY)!).activeId).toBe(activeId));
});

it("migrates a standalone legacy light environment into the active working slot", async () => {
  const key = "wallet4i7.mono.environment-preview.v1";
  const raw = JSON.stringify({ version: 1, theme: "light", background: "tide" });
  localStorage.setItem(key, raw);
  render(<MonoPreview snapshot={await new MockWalletRepository().getSnapshot()} />);
  await waitFor(() => expect(document.querySelector("[data-mono-preview]")).toHaveAttribute("data-mono-theme", "light"));
  const library = JSON.parse(localStorage.getItem(WORKING_KEY)!) as { records: Array<{ document: {
    palette: { slots: Array<{ present: { mode: string } }> }; background: string } }> };
  expect(library.records[0].document.palette.slots[0].present.mode).toBe("light");
  expect(library.records[0].document.background).toBe("tide");
  expect(localStorage.getItem(key)).toBe(raw);
});

it("opens a named palette-only legacy record as an explicitly marked full working copy", async () => {
  const config = normalizeMonoPaletteConfig({ seed: "legacy-stone" });
  config.themes.dark.recipe.anchorHue = 77;
  const preset = await importMonoPalettePreset(await exportMonoPalettePreset(config));
  saveMonoPaletteLibrary(localStorage, [{ id: "local-17", name: "Камень", revision: 3, preset }]);
  const original = localStorage.getItem(MONO_PALETTE_PRESETS_KEY);

  render(<MonoPreview snapshot={await new MockWalletRepository().getSnapshot()} />);
  await waitFor(() => {
    const raw = localStorage.getItem(WORKING_KEY);
    expect(raw).not.toBeNull();
    const library = JSON.parse(raw!) as { records: Array<{
      name: string;
      source?: { kind: string; id: string; contentHash: string };
      document: { palette: { slots: Array<{ present: { config: { themes: { dark: { recipe: { anchorHue: number } } } } } }> };
        shapes: { ledger: Record<string, number> }; optics: { ledger: { ior: number } }; background: string };
    }> };
    const migrated = library.records.find(record => record.name === "Камень");
    expect(migrated?.source).toEqual({ kind: "legacy-palette", id: "local-17", contentHash: preset.contentHash });
    expect(migrated?.document.palette.slots[0].present.config.themes.dark.recipe.anchorHue).toBe(77);
    expect(migrated?.document.shapes.ledger["quick-actions"]).toBe(12);
    expect(migrated?.document.optics.ledger.ior).toBe(1.34);
    expect(migrated?.document.background).toBe("iris");
  });
  expect(localStorage.getItem(MONO_PALETTE_PRESETS_KEY)).toBe(original);
});

it("keeps A and its named copy B independent through switching and reload", async () => {
  const snapshot = await new MockWalletRepository().getSnapshot();
  const first = render(<MonoPreview snapshot={snapshot} />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Включить палитру" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Включить палитру" }));
  await waitFor(() => expect(screen.getByText("Сохранено в этом браузере")).toBeVisible());

  fireEvent.click(screen.getByRole("button", { name: "Действия с пресетом" }));
  fireEvent.click(screen.getByRole("button", { name: "Создать копию" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Название пресета" }), { target: { value: "Вариант B" } });
  fireEvent.click(screen.getByRole("button", { name: "Сохранить копию" }));
  await waitFor(() => expect(screen.getByRole("button", { name: /Пресет оформления: Вариант B/ })).toBeVisible());

  fireEvent.change(screen.getByRole("slider", { name: "Тон" }), { target: { value: "160" } });
  await waitFor(() => expect(screen.getByText("Сохранено в этом браузере")).toBeVisible());
  fireEvent.click(screen.getByRole("button", { name: /Пресет оформления: Вариант B/ }));
  fireEvent.click(screen.getByRole("button", { name: "Выбрать Мой пресет" }));
  expect(screen.getByRole("slider", { name: "Тон" })).toHaveValue("250");
  fireEvent.click(screen.getByRole("button", { name: /Пресет оформления: Мой пресет/ }));
  fireEvent.click(screen.getByRole("button", { name: "Выбрать Вариант B" }));
  expect(screen.getByRole("slider", { name: "Тон" })).toHaveValue("160");

  first.unmount();
  render(<MonoPreview snapshot={snapshot} />);
  await waitFor(() => {
    expect(screen.getByRole("button", { name: /Пресет оформления: Вариант B/ })).toBeVisible();
    expect(screen.getByRole("slider", { name: "Тон" })).toHaveValue("160");
  });
});

it("finishes a pending color slider gesture for A before switching to B", async () => {
  render(<MonoPreview snapshot={await new MockWalletRepository().getSnapshot()} />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Включить палитру" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Включить палитру" }));
  await waitFor(() => expect(screen.getByText("Сохранено в этом браузере")).toBeVisible());
  fireEvent.click(screen.getByRole("button", { name: "Действия с пресетом" }));
  fireEvent.click(screen.getByRole("button", { name: "Создать копию" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Название пресета" }), { target: { value: "B" } });
  fireEvent.click(screen.getByRole("button", { name: "Сохранить копию" }));
  fireEvent.click(screen.getByRole("button", { name: /Пресет оформления: B/ }));
  fireEvent.click(screen.getByRole("button", { name: "Выбрать Мой пресет" }));

  const hue = screen.getByRole("slider", { name: "Тон" });
  fireEvent.pointerDown(hue);
  fireEvent.change(hue, { target: { value: "110" } });
  fireEvent.click(screen.getByRole("button", { name: /Пресет оформления: Мой пресет/ }));
  fireEvent.click(screen.getByRole("button", { name: "Выбрать B" }));

  await waitFor(() => {
    const library = JSON.parse(localStorage.getItem(WORKING_KEY)!) as { records: Array<{
      name: string; document: { palette: { slots: Array<{ present: { config: { themes: { dark: { recipe: { anchorHue: number } } } } } }> } } }>; };
    expect(library.records.find(record => record.name === "Мой пресет")?.document.palette.slots[0]
      .present.config.themes.dark.recipe.anchorHue).toBe(110);
    expect(library.records.find(record => record.name === "B")?.document.palette.slots[0]
      .present.config.themes.dark.recipe.anchorHue).toBe(250);
  });
  expect(screen.getByRole("slider", { name: "Тон" })).toHaveValue("250");
});

it("finishes a pending slider gesture before copying the active preset", async () => {
  render(<MonoPreview snapshot={await new MockWalletRepository().getSnapshot()} />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Включить палитру" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Включить палитру" }));
  await waitFor(() => expect(screen.getByText("Сохранено в этом браузере")).toBeVisible());
  const hue = screen.getByRole("slider", { name: "Тон" });
  fireEvent.pointerDown(hue);
  fireEvent.change(hue, { target: { value: "110" } });
  fireEvent.click(screen.getByRole("button", { name: "Действия с пресетом" }));
  fireEvent.click(screen.getByRole("button", { name: "Создать копию" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Название пресета" }), { target: { value: "B" } });
  fireEvent.click(screen.getByRole("button", { name: "Сохранить копию" }));
  const stored = JSON.parse(localStorage.getItem(WORKING_KEY)!) as { records: Array<{
    name: string; document: { palette: { slots: Array<{ present: { config: { themes: { dark: { recipe: { anchorHue: number } } } } } }> } } }> };
  expect(stored.records.map(record => [record.name,
    record.document.palette.slots[0].present.config.themes.dark.recipe.anchorHue])).toEqual([
      ["Мой пресет", 110], ["B", 110],
    ]);
});

it("keeps shape trials separate from the saved B preset until Apply and lets Cancel restore it", async () => {
  const snapshot = await new MockWalletRepository().getSnapshot();
  const first = render(<MonoPreview snapshot={snapshot} />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Включить палитру" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Включить палитру" }));
  await waitFor(() => expect(screen.getByText("Сохранено в этом браузере")).toBeVisible());
  fireEvent.click(screen.getByRole("button", { name: "Действия с пресетом" }));
  fireEvent.click(screen.getByRole("button", { name: "Создать копию" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Название пресета" }), { target: { value: "B" } });
  fireEvent.click(screen.getByRole("button", { name: "Сохранить копию" }));

  selectTool("Форма и кнопки");
  const shape = screen.getByRole("group", { name: "Настройка формы" });
  const radius = within(shape).getByRole("slider", { name: "Радиус формы" });
  fireEvent.change(radius, { target: { value: "20" } });
  expect(radius).toHaveValue("20");
  fireEvent.click(inspectorActions("Форма и кнопки").getByRole("button", { name: "Отменить пробу формы" }));
  expect(radius).toHaveValue("12");

  fireEvent.change(radius, { target: { value: "22" } });
  fireEvent.click(inspectorActions("Форма и кнопки").getByRole("button", { name: "Применить форму" }));
  await waitFor(() => {
    const library = JSON.parse(localStorage.getItem(WORKING_KEY)!) as { records: Array<{
      name: string; document: { shapes: { ledger: Record<string, number> } } }> };
    expect(library.records.find(record => record.name === "B")?.document.shapes.ledger["quick-actions"]).toBe(22);
  });
  fireEvent.click(screen.getByRole("button", { name: /Пресет оформления: B/ }));
  fireEvent.click(screen.getByRole("button", { name: "Выбрать Мой пресет" }));
  expect(radius).toHaveValue("12");
  fireEvent.click(screen.getByRole("button", { name: /Пресет оформления: Мой пресет/ }));
  fireEvent.click(screen.getByRole("button", { name: "Выбрать B" }));
  expect(radius).toHaveValue("22");

  first.unmount();
  render(<MonoPreview snapshot={snapshot} />);
  selectTool("Форма и кнопки");
  await waitFor(() => expect(screen.getByRole("slider", { name: "Радиус формы" })).toHaveValue("22"));
});

it("keeps optical trial out of the working preset until Apply and restores accepted optics on Cancel", async () => {
  const snapshot = await new MockWalletRepository().getSnapshot();
  const first = render(<MonoPreview snapshot={snapshot} />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Действия с пресетом" })).toBeEnabled());
  selectTool("Оптика");
  await waitFor(() => expect(screen.getByRole("slider", { name: "Преломление" })).toHaveValue("1.34"));
  const glass = within(screen.getByRole("group", { name: "Настройка стекла" }));
  const ior = glass.getByRole("slider", { name: "Преломление" });
  fireEvent.change(ior, { target: { value: "0.75" } });
  expect(ior).toHaveValue("0.75");
  expect(localStorage.getItem(WORKING_KEY)).toBeNull();
  fireEvent.click(inspectorActions("Оптика").getByRole("button", { name: "Отменить пробу оптики" }));
  expect(ior).toHaveValue("1.34");

  fireEvent.change(ior, { target: { value: "0.75" } });
  fireEvent.click(inspectorActions("Оптика").getByRole("button", { name: "Применить оптику" }));
  await waitFor(() => {
    const library = JSON.parse(localStorage.getItem(WORKING_KEY)!) as { records: Array<{
      document: { optics: { ledger: { ior: number } } } }> };
    expect(library.records[0].document.optics.ledger.ior).toBe(0.75);
  });
  first.unmount();
  render(<MonoPreview snapshot={snapshot} />);
  selectTool("Оптика");
  await waitFor(() => expect(screen.getByRole("slider", { name: "Преломление" })).toHaveValue("0.75"));
});

it("saves an applied background selection in the active working preset", async () => {
  const snapshot = await new MockWalletRepository().getSnapshot();
  const first = render(<MonoPreview snapshot={snapshot} />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Включить палитру" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Включить палитру" }));
  await waitFor(() => expect(screen.getByText("Сохранено в этом браузере")).toBeVisible());
  openEnvironment();
  const accepted = localStorage.getItem(WORKING_KEY);
  fireEvent.click(within(screen.getByRole("group", { name: "Фон" })).getByRole("button", { name: "Волна" }));
  expect(localStorage.getItem(WORKING_KEY)).toBe(accepted);
  fireEvent.click(inspectorActions("Среда").getByRole("button", { name: "Применить настройку" }));
  await waitFor(() => {
    const library = JSON.parse(localStorage.getItem(WORKING_KEY)!) as { records: Array<{
      document: { background: string } }> };
    expect(library.records[0].document.background).toBe("tide");
  });
  first.unmount();
  render(<MonoPreview snapshot={snapshot} />);
  openEnvironment();
  await waitFor(() => expect(within(screen.getByRole("group", { name: "Фон" })).getByRole("button", { name: "Волна" }))
    .toHaveAttribute("aria-pressed", "true"));
});

it("keeps a failed local edit live, offers export and retries without claiming it was saved", async () => {
  render(<MonoPreview snapshot={await new MockWalletRepository().getSnapshot()} />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Включить палитру" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Включить палитру" }));
  await waitFor(() => expect(screen.getByText("Сохранено в этом браузере")).toBeVisible());
  const originalSetItem = Storage.prototype.setItem;
  const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
    if (key === WORKING_KEY) throw new Error("quota");
    return originalSetItem.call(this, key, value);
  });

  fireEvent.change(screen.getByRole("slider", { name: "Тон" }), { target: { value: "160" } });
  await waitFor(() => expect(screen.getByText(/Не удалось сохранить/)).toBeVisible());
  expect(screen.getByRole("slider", { name: "Тон" })).toHaveValue("160");
  const before = JSON.parse(localStorage.getItem(WORKING_KEY)!) as { records: Array<{
    document: { palette: { slots: Array<{ present: { config: { themes: { dark: { recipe: { anchorHue: number } } } } } }> } } }> };
  expect(before.records[0].document.palette.slots[0].present.config.themes.dark.recipe.anchorHue).toBe(250);

  fireEvent.click(screen.getByRole("button", { name: "Действия с пресетом" }));
  fireEvent.click(screen.getByRole("button", { name: "Экспортировать" }));
  expect(screen.getByRole("button", { name: "Скопировать JSON" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Скачать JSON" })).toBeVisible();
  const exported = JSON.parse((screen.getByRole("textbox", { name: "JSON рабочего пресета" }) as HTMLTextAreaElement).value) as typeof before["records"][number];
  expect(exported.document.palette.slots[0].present.config.themes.dark.recipe.anchorHue).toBe(160);
  write.mockRestore();
  fireEvent.click(screen.getByRole("button", { name: "Повторить сохранение" }));
  await waitFor(() => expect(screen.getByText("Сохранено в этом браузере")).toBeVisible());
  const after = JSON.parse(localStorage.getItem(WORKING_KEY)!) as typeof before;
  expect(after.records[0].document.palette.slots[0].present.config.themes.dark.recipe.anchorHue).toBe(160);
});

it("warns about a newer other-tab revision without overwriting it", async () => {
  render(<MonoPreview snapshot={await new MockWalletRepository().getSnapshot()} />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Включить палитру" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Включить палитру" }));
  await waitFor(() => expect(screen.getByText("Сохранено в этом браузере")).toBeVisible());
  const otherTab = JSON.parse(localStorage.getItem(WORKING_KEY)!) as {
    generation: number; records: Array<{ name: string; document: { palette: { slots: Array<{ present: {
      config: { themes: { dark: { recipe: { anchorHue: number } } } } } }> } } }> };
  otherTab.generation += 1;
  otherTab.records[0].name = "Из другой вкладки";
  localStorage.setItem(WORKING_KEY, JSON.stringify(otherTab));

  fireEvent.change(screen.getByRole("slider", { name: "Тон" }), { target: { value: "160" } });
  await waitFor(() => expect(screen.getByText(/Изменён в другой вкладке/)).toBeVisible());
  const stored = JSON.parse(localStorage.getItem(WORKING_KEY)!) as typeof otherTab;
  expect(stored.records[0].name).toBe("Из другой вкладки");
  expect(stored.records[0].document.palette.slots[0].present.config.themes.dark.recipe.anchorHue).toBe(250);
  expect(screen.getByRole("slider", { name: "Тон" })).toHaveValue("160");
});

it("does not treat an unreadable legacy palette library as an empty library", async () => {
  const raw = JSON.stringify({ version: 1, presets: [{ schemaVersion: 99, name: "Старый цвет" }] });
  localStorage.setItem(MONO_PALETTE_PRESETS_KEY, raw);
  render(<MonoPreview snapshot={await new MockWalletRepository().getSnapshot()} />);

  await waitFor(() => expect(screen.getByText(/Старую библиотеку палитр нельзя перенести/)).toBeVisible());
  expect(localStorage.getItem(MONO_PALETTE_PRESETS_KEY)).toBe(raw);
  expect(localStorage.getItem(WORKING_KEY)).toBeNull();
});

it("collapses and expands exact settings without hiding the tool or changing the saved preset", async () => {
  render(<MonoPreview snapshot={await new MockWalletRepository().getSnapshot()} />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Включить палитру" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Включить палитру" }));
  await waitFor(() => expect(screen.getByText("Сохранено в этом браузере")).toBeVisible());
  const saved = localStorage.getItem(WORKING_KEY);
  const summary = screen.getByText("Точная настройка цвета");
  const section = summary.closest("details")!;
  expect(section).not.toHaveAttribute("open");
  expect(screen.getByRole("button", { name: "Цвет" })).toHaveAttribute("aria-pressed", "true");
  for (const name of ["Форма и кнопки", "Среда", "Оптика"])
    expect(screen.getByRole("button", { name })).toHaveAttribute("aria-pressed", "false");
  expect(screen.getByRole("button", { name: "Скрыть панели" })).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByRole("region", { name: "Color Lab" })).toBeVisible();

  fireEvent.click(screen.getByRole("button", { name: "Точная настройка" }));
  fireEvent.click(summary);
  expect(section).toHaveAttribute("open");
  const role = screen.getByRole("combobox", { name: "Смысловая роль" });
  expect(role).toBeVisible();
  expect(screen.getByRole("region", { name: "Color Lab" })).toBeVisible();
  expect(localStorage.getItem(WORKING_KEY)).toBe(saved);
  fireEvent.click(summary);
  expect(section).not.toHaveAttribute("open");
  expect(role).not.toBeVisible();
  expect(screen.getByRole("region", { name: "Color Lab" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Скрыть панели" })).toHaveAttribute("aria-expanded", "true");
  expect(localStorage.getItem(WORKING_KEY)).toBe(saved);
});

it("renames a working preset without changing its stable ID or color", async () => {
  render(<MonoPreview snapshot={await new MockWalletRepository().getSnapshot()} />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Включить палитру" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Включить палитру" }));
  await waitFor(() => expect(screen.getByText("Сохранено в этом браузере")).toBeVisible());
  const before = JSON.parse(localStorage.getItem(WORKING_KEY)!) as { activeId: string; records: Array<{ id: string }> };

  fireEvent.click(screen.getByRole("button", { name: "Действия с пресетом" }));
  fireEvent.click(screen.getByRole("button", { name: "Переименовать" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Название пресета" }), { target: { value: "Тихий графит" } });
  fireEvent.click(screen.getByRole("button", { name: "Сохранить название" }));

  const after = JSON.parse(localStorage.getItem(WORKING_KEY)!) as { activeId: string; records: Array<{
    id: string; name: string; document: { palette: { slots: Array<{ present: { paletteEnabled: boolean } }> } } }> };
  expect(after.activeId).toBe(before.activeId);
  expect(after.records[0].id).toBe(before.records[0].id);
  expect(after.records[0].name).toBe("Тихий графит");
  expect(after.records[0].document.palette.slots[0].present.paletteEnabled).toBe(true);
  expect(screen.getByRole("button", { name: "Пресет оформления: Тихий графит" })).toBeVisible();
});

it("creates a named working preset from the built-in MONO defaults", async () => {
  render(<MonoPreview snapshot={await new MockWalletRepository().getSnapshot()} />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Включить палитру" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: `Пресет оформления: ${FIRST_BUTTON_PRESET_NAME}` }));
  fireEvent.click(screen.getByRole("button", { name: "Создать пресет" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Название пресета" }), { target: { value: "Чистый" } });
  fireEvent.click(screen.getByRole("button", { name: "Сохранить пресет" }));

  await waitFor(() => expect(screen.getByRole("button", { name: "Пресет оформления: Чистый" })).toBeVisible());
  const stored = JSON.parse(localStorage.getItem(WORKING_KEY)!) as { records: Array<{
    name: string; document: { palette: { slots: Array<{ present: { paletteEnabled?: boolean } }> };
      shapes: { ledger: Record<string, number> }; optics: { ledger: { ior: number } }; background: string } }> };
  expect(stored.records).toHaveLength(1);
  expect(stored.records[0].name).toBe("Чистый");
  expect(stored.records[0].document.palette.slots[0].present.paletteEnabled).not.toBe(true);
  expect(stored.records[0].document.shapes.ledger["quick-actions"]).toBe(12);
  expect(stored.records[0].document.optics.ledger.ior).toBe(1.34);
  expect(stored.records[0].document.background).toBe("iris");
});

it("does not silently discard an unaccepted shape trial when switching presets", async () => {
  render(<MonoPreview snapshot={await new MockWalletRepository().getSnapshot()} />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Включить палитру" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Включить палитру" }));
  await waitFor(() => expect(screen.getByText("Сохранено в этом браузере")).toBeVisible());
  fireEvent.click(screen.getByRole("button", { name: "Действия с пресетом" }));
  fireEvent.click(screen.getByRole("button", { name: "Создать копию" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Название пресета" }), { target: { value: "B" } });
  fireEvent.click(screen.getByRole("button", { name: "Сохранить копию" }));
  selectTool("Форма и кнопки");
  const radius = screen.getByRole("slider", { name: "Радиус формы" });
  fireEvent.change(radius, { target: { value: "20" } });

  fireEvent.click(screen.getByRole("button", { name: /Пресет оформления: B/ }));
  fireEvent.click(screen.getByRole("button", { name: "Выбрать Мой пресет" }));
  expect(screen.getByRole("button", { name: /Пресет оформления: B/ })).toBeVisible();
  expect(radius).toHaveValue("20");
  const guard = screen.getByRole("dialog", { name: "Неприменённые пробы" });
  expect(guard).toBeVisible();
  fireEvent.click(within(guard).getByRole("button", { name: "Назад" }));
  expect(radius).toHaveValue("20");
  fireEvent.click(inspectorActions("Форма и кнопки").getByRole("button", { name: "Отменить пробу формы" }));
  expect(screen.getByText("Сохранено в этом браузере")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Выбрать Мой пресет" }));
  expect(screen.getByRole("button", { name: /Пресет оформления: Мой пресет/ })).toBeVisible();
});

it("previews a full JSON import and creates a separate copy only after confirmation", async () => {
  render(<MonoPreview snapshot={await new MockWalletRepository().getSnapshot()} />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Включить палитру" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Включить палитру" }));
  await waitFor(() => expect(screen.getByText("Сохранено в этом браузере")).toBeVisible());
  const before = JSON.parse(localStorage.getItem(WORKING_KEY)!) as { activeId: string; records: Array<{ id: string }> };
  fireEvent.click(screen.getByRole("button", { name: "Действия с пресетом" }));
  fireEvent.click(screen.getByRole("button", { name: "Экспортировать" }));
  const exported = (screen.getByRole("textbox", { name: "JSON рабочего пресета" }) as HTMLTextAreaElement).value;
  fireEvent.click(screen.getByRole("button", { name: "Закрыть экспорт" }));
  fireEvent.click(screen.getByRole("button", { name: "Импортировать" }));
  fireEvent.change(screen.getByRole("textbox", { name: "JSON для импорта" }), { target: { value: exported } });
  fireEvent.click(screen.getByRole("button", { name: "Проверить импорт" }));
  await waitFor(() => expect(screen.getByText(/Будет создана отдельная копия полного рабочего пресета/)).toBeVisible());
  expect(JSON.parse(localStorage.getItem(WORKING_KEY)!).records).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Создать копию из импорта" }));
  const after = JSON.parse(localStorage.getItem(WORKING_KEY)!) as typeof before;
  expect(after.records).toHaveLength(2);
  expect(after.activeId).not.toBe(before.activeId);
  expect(after.records[0].id).toBe(before.records[0].id);
});

it("rejects invalid JSON import without touching the active preset", async () => {
  render(<MonoPreview snapshot={await new MockWalletRepository().getSnapshot()} />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Включить палитру" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Включить палитру" }));
  await waitFor(() => expect(screen.getByText("Сохранено в этом браузере")).toBeVisible());
  const before = localStorage.getItem(WORKING_KEY);
  fireEvent.click(screen.getByRole("button", { name: "Действия с пресетом" }));
  fireEvent.click(screen.getByRole("button", { name: "Импортировать" }));
  fireEvent.change(screen.getByRole("textbox", { name: "JSON для импорта" }), { target: { value: '{"version":99,"document":{}}' } });
  fireEvent.click(screen.getByRole("button", { name: "Проверить импорт" }));
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/неизвестн|несовместим/i));
  expect(localStorage.getItem(WORKING_KEY)).toBe(before);
  expect(screen.queryByRole("button", { name: "Создать копию из импорта" })).not.toBeInTheDocument();
});

it("imports a 3104 palette JSON as palette-only with an explicit defaults warning", async () => {
  const config = normalizeMonoPaletteConfig({ seed: "from-3104" });
  config.themes.dark.recipe.anchorHue = 95;
  const oldJson = await exportMonoPalettePreset(config);
  render(<MonoPreview snapshot={await new MockWalletRepository().getSnapshot()} />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Включить палитру" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Действия с пресетом" }));
  fireEvent.click(screen.getByRole("button", { name: "Импортировать" }));
  fireEvent.change(screen.getByRole("textbox", { name: "JSON для импорта" }), { target: { value: oldJson } });
  fireEvent.click(screen.getByRole("button", { name: "Проверить импорт" }));
  await waitFor(() => expect(screen.getByText(/Форма, оптика и фон — исходные MONO defaults/)).toBeVisible());
  expect(localStorage.getItem(WORKING_KEY)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Создать копию из импорта" }));
  const library = JSON.parse(localStorage.getItem(WORKING_KEY)!) as { records: Array<{ document: {
    palette: { slots: Array<{ present: { config: { themes: { dark: { recipe: { anchorHue: number } } } } } }> };
    shapes: { ledger: Record<string, number> }; optics: { ledger: { ior: number } }; background: string } }> };
  expect(library.records).toHaveLength(1);
  expect(library.records[0].document.palette.slots[0].present.config.themes.dark.recipe.anchorHue).toBe(95);
  expect(library.records[0].document.shapes.ledger["quick-actions"]).toBe(12);
  expect(library.records[0].document.optics.ledger.ior).toBe(1.34);
  expect(library.records[0].document.background).toBe("iris");
});

it("rejects unknown fields in a full import before it can write secrets or partial defaults", async () => {
  render(<MonoPreview snapshot={await new MockWalletRepository().getSnapshot()} />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Включить палитру" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Действия с пресетом" }));
  fireEvent.click(screen.getByRole("button", { name: "Экспортировать" }));
  const candidate = JSON.parse((screen.getByRole("textbox", { name: "JSON рабочего пресета" }) as HTMLTextAreaElement).value);
  candidate.document.optics.ledger.shaderSource = "secret";
  fireEvent.click(screen.getByRole("button", { name: "Закрыть экспорт" }));
  fireEvent.click(screen.getByRole("button", { name: "Импортировать" }));
  fireEvent.change(screen.getByRole("textbox", { name: "JSON для импорта" }), { target: { value: JSON.stringify(candidate) } });
  fireEvent.click(screen.getByRole("button", { name: "Проверить импорт" }));
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/поврежден|неподдерживаем/i));
  expect(localStorage.getItem(WORKING_KEY)).toBeNull();
});

it("does not write or increment working revision for a visual A/B compare", async () => {
  render(<MonoPreview snapshot={await new MockWalletRepository().getSnapshot()} />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Включить палитру" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Включить палитру" }));
  await waitFor(() => expect(screen.getByText("Сохранено в этом браузере")).toBeVisible());
  const before = localStorage.getItem(WORKING_KEY);
  fireEvent.click(screen.getByRole("button", { name: "Сравнить A/B" }));
  await new Promise(resolve => setTimeout(resolve, 300));
  expect(localStorage.getItem(WORKING_KEY)).toBe(before);
  expect(screen.getByText("Сохранено в этом браузере")).toBeVisible();
});

it("keeps an unreadable legacy library recoverable instead of masking it after Apply or Create", async () => {
  const raw = JSON.stringify({ version: 1, presets: [{ schemaVersion: 99, name: "Невосстановленный" }] });
  localStorage.setItem(MONO_PALETTE_PRESETS_KEY, raw);
  render(<MonoPreview snapshot={await new MockWalletRepository().getSnapshot()} />);
  await waitFor(() => expect(screen.getByText(/Старую библиотеку палитр нельзя перенести/)).toBeVisible());
  selectTool("Форма и кнопки");
  const shape = within(screen.getByRole("group", { name: "Настройка формы" }));
  fireEvent.change(shape.getByRole("slider", { name: "Радиус формы" }), { target: { value: "20" } });
  fireEvent.click(inspectorActions("Форма и кнопки").getByRole("button", { name: "Применить форму" }));
  fireEvent.click(screen.getByRole("button", { name: /Пресет оформления: Исходный образец/ }));
  fireEvent.click(screen.getByRole("button", { name: "Создать пресет" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Название пресета" }), { target: { value: "Новый" } });
  fireEvent.click(screen.getByRole("button", { name: "Сохранить пресет" }));
  expect(localStorage.getItem(WORKING_KEY)).toBeNull();
  expect(localStorage.getItem(MONO_PALETTE_PRESETS_KEY)).toBe(raw);
  expect(screen.getByText(/Старую библиотеку палитр нельзя перенести/)).toBeVisible();
});

it("refuses to save a library that its own loader would reject on reload", () => {
  const document = createMonoWorkingDocument();
  const records = Array.from({ length: 65 }, (_, index) => ({
    id: `record-${index}`, name: `Пресет ${index}`, revision: 1, document,
  }));
  expect(() => saveMonoWorkingLibrary(localStorage, {
    version: 1, skinId: "mono-ledger-v1", generation: 1, activeId: records[0].id, records,
  }, 0)).toThrow(/слишком|предел|лимит/i);
  expect(localStorage.getItem(WORKING_KEY)).toBeNull();
});

it("keeps old palette and server libraries out of the main editor until explicitly requested", async () => {
  const fetcher = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("server unavailable"));
  render(<MonoPreview snapshot={await new MockWalletRepository().getSnapshot()} />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Включить палитру" })).toBeEnabled());
  expect(screen.queryByRole("button", { name: "Сохранить вариант" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Варианты" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Дополнительные действия" })).not.toBeInTheDocument();
  expect(fetcher).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Действия с пресетом" }));
  fireEvent.click(screen.getByRole("button", { name: "Архив палитр и сервер" }));
  await waitFor(() => expect(screen.getByRole("region", { name: "Локальные варианты" })).toBeVisible());
  await waitFor(() => expect(fetcher).toHaveBeenCalled());
});

it("does not silently replace an unknown legacy shape schema during migration", async () => {
  const key = "wallet4i7.mono.shape-preview.v1";
  const original = JSON.stringify({ version: 99, skinId: "mono-ledger-v1", presets: { ledger: { "quick-actions": 23 } } });
  localStorage.setItem(key, original);
  render(<MonoPreview snapshot={await new MockWalletRepository().getSnapshot()} />);
  await waitFor(() => expect(screen.getByText(/Старые настройки.*нельзя перенести/)).toBeVisible());
  expect(localStorage.getItem(WORKING_KEY)).toBeNull();
  expect(localStorage.getItem(key)).toBe(original);
});

it("holds an unknown field in the new working schema for recovery instead of erasing it", async () => {
  const document = createMonoWorkingDocument() as unknown as Record<string, unknown>;
  document.customCss = "do-not-apply";
  const raw = JSON.stringify({ version: 2, skinId: "mono-ledger-v1", generation: 1,
    activeId: "other-version", records: [{ id: "other-version", name: "Будущее", revision: 1, document }] });
  localStorage.setItem(WORKING_KEY, raw);
  render(<MonoPreview snapshot={await new MockWalletRepository().getSnapshot()} />);
  await waitFor(() => expect(screen.getByText(/Рабочую библиотеку нельзя прочитать/)).toBeVisible());
  expect(localStorage.getItem(WORKING_KEY)).toBe(raw);
});

it("does not create a preset before local migration has finished", async () => {
  render(<MonoPreview snapshot={await new MockWalletRepository().getSnapshot()} />);
  expect(screen.getByRole("button", { name: "Действия с пресетом" })).toBeDisabled();
  expect(screen.getByRole("button", { name: /Пресет оформления: Исходный образец/ })).toBeDisabled();
  expect(localStorage.getItem(WORKING_KEY)).toBeNull();
  await waitFor(() => expect(screen.getByRole("button", { name: "Действия с пресетом" })).toBeEnabled());
});
