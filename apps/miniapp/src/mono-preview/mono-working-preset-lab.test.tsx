import "@testing-library/jest-dom/vitest";
import { webcrypto } from "node:crypto";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MockWalletRepository } from "@wallet/core";
import { DEFAULT_BACKGROUND_EDGE_FINISH, createTargetBinding, materialCatalogV2, normalizeMonoPaletteConfig } from "@wallet/ui";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MonoPreview } from "./mono-preview";
import { exportMonoPalettePreset } from "./mono-preset-codec";
import { MONO_PALETTE_PRESETS_KEY } from "./mono-palette-storage";
import { createMonoWorkingDocument, exportMonoWorkingPreset, loadMonoSevenLibrary,
  MONO_SEVEN_BACKUP_KEY, MONO_SEVEN_PRESETS_KEY, MONO_WORKING_PRESETS_KEY,
  saveMonoWorkingLibrary, type MonoSevenLibrary } from "./mono-working-presets";

beforeEach(() => {
  localStorage.clear(); history.replaceState(null, "", "/mono");
  vi.stubGlobal("crypto", webcrypto);
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduced-motion"), media: query,
    addEventListener() {}, removeEventListener() {} }));
});
afterEach(() => { cleanup(); LocalChannel.peers.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const stored = () => loadMonoSevenLibrary(localStorage)!;
const tool = (name: string) => fireEvent.click(within(screen.getByRole("toolbar", { name: "Инструменты оформления" })).getByRole("button", { name }));
const inspectorActions = (name: string) => within(screen.getByRole("region", { name }).querySelector("footer")!);
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
async function mount() {
  const view = render(<MonoPreview snapshot={await new MockWalletRepository().getSnapshot()} />);
  await waitFor(() => expect(screen.getByRole("button", { name: /^Пресет 1:/ })).toBeEnabled());
  return view;
}
function copyIntoSecond() {
  fireEvent.click(screen.getByRole("button", { name: "Действия с пресетом" }));
  fireEvent.click(screen.getByRole("button", { name: "Копировать в другой пресет…" }));
  fireEvent.change(screen.getByLabelText("Пресет для копии"), { target: { value: "2" } });
  fireEvent.click(screen.getByRole("button", { name: "Заменить выбранный пресет" }));
}

it("starts with exactly seven presets and keeps the built-in First material as a clean-install starter", async () => {
  await mount();
  expect(screen.getAllByRole("button", { name: /^Пресет [1-7]:/ })).toHaveLength(7);
  expect(stored().slots).toHaveLength(7);
  expect(stored().archive).toHaveLength(0);
  expect(localStorage.getItem(MONO_WORKING_PRESETS_KEY)).toBeNull();
  expect(stored().slots[0].document.materials.ledger.buttons?.bindings).toHaveLength(4);
  expect(document.querySelectorAll('.mono-actions__item[data-material-target]')).toHaveLength(4);
});

it("migrates the selected legacy direction, its full document and every same-name record into the archive", async () => {
  const first = createMonoWorkingDocument(); first.palette.activeSlotId = 2;
  first.appearance.frost.logo.hue = 47;
  const border = materialCatalogV2.materials.find(item => item.id === "pulsing-border")!.presets[0]!.recipe;
  const binding = createTargetBinding("quick.send", "border", border, materialCatalogV2);
  if (!binding.ok) throw Error("Fixture invalid");
  first.materials.frost = { ...first.materials.frost, buttons: { version: 1, bindings: [binding.value] } };
  const other = createMonoWorkingDocument(); other.palette.activeSlotId = 3;
  saveMonoWorkingLibrary(localStorage, { version: 2, skinId: "mono-ledger-v1", generation: 1,
    activeId: "first", records: [{ id: "first", name: "Первый · перелив", revision: 3, document: first },
      { id: "other", name: "Первый · перелив", revision: 1, document: other }] }, 0);
  const raw = localStorage.getItem(MONO_WORKING_PRESETS_KEY);
  await mount();
  expect(screen.getByRole("button", { name: "Пресет 1: Первый · перелив" })).toBeEnabled();
  expect(document.querySelector(".mono-page")).toHaveAttribute("data-mono-preset", "frost");
  expect(stored().slots[0].document).toEqual(first);
  expect(stored().archive.map(record => record.name)).toEqual(["Первый · перелив", "Первый · перелив"]);
  expect(stored().archive[1].document.palette.activeSlotId).toBe(3);
  expect(localStorage.getItem(MONO_SEVEN_BACKUP_KEY)).toBe(raw);
  expect(localStorage.getItem(MONO_WORKING_PRESETS_KEY)).toBe(raw);
});

it("exports an archived full record and restores its chosen direction into an explicit preset", async () => {
  const former = createMonoWorkingDocument();
  former.palette.activeSlotId = 2;
  former.appearance.frost.logo.hue = 43;
  former.appearance.mercury.logo.hue = 76;
  saveMonoWorkingLibrary(localStorage, { version: 2, skinId: "mono-ledger-v1", generation: 1,
    activeId: "owner", records: [{ id: "owner", name: "Первый · перелив", revision: 2, document: former }] }, 0);
  await mount();
  const beforeThird = structuredClone(stored().slots[2].document);
  fireEvent.click(screen.getByRole("button", { name: "Действия с пресетом" }));
  fireEvent.click(screen.getByRole("button", { name: "Архив рабочих пресетов · 1" }));
  fireEvent.click(screen.getByRole("button", { name: "Архив 1: Первый · перелив" }));
  fireEvent.click(screen.getByRole("button", { name: "Показать полный архивный JSON" }));
  const exported = JSON.parse((screen.getByRole("textbox", { name: "Архивный JSON" }) as HTMLTextAreaElement).value);
  expect(exported.document).toEqual(former);
  fireEvent.change(screen.getByLabelText("Направление из старой записи"), { target: { value: "mercury" } });
  fireEvent.change(screen.getByLabelText("Восстановить в пресет"), { target: { value: "3" } });
  fireEvent.click(screen.getByRole("button", { name: "Восстановить выбранное направление" }));
  expect(stored().activeSlot).toBe(3);
  expect(stored().slots[2].document.palette.activeSlotId).toBe(3);
  expect(stored().slots[2].document.appearance.mercury.logo.hue).toBe(76);
  expect(stored().slots[2].document.appearance.frost.logo.hue).toBe(43);
  expect(stored().archive[0].document).toEqual(former);
  expect(stored().archive.at(-1)?.document).toEqual(beforeThird);
});

it("migrates standalone shape, optics and environment candidates without erasing their old keys", async () => {
  const shapeKey = "wallet4i7.mono.shape-preview.v1";
  const opticsKey = "wallet4i7.mono.optical-preview.v1";
  const environmentKey = "wallet4i7.mono.environment-preview.v1";
  const old = {
    [shapeKey]: JSON.stringify({ version: 1, skinId: "mono-ledger-v1", presets: {
      ledger: { "quick-actions": 20, "bottom-navigation": 8 } } }),
    [opticsKey]: JSON.stringify({ version: 1, presets: { ledger: { ior: 0.75 } } }),
    [environmentKey]: JSON.stringify({ version: 1, theme: "light", background: "tide" }),
  };
  for (const [key, value] of Object.entries(old)) localStorage.setItem(key, value);
  await mount();
  expect(stored().slots[0].document.shapes.ledger["quick-actions"]).toBe(20);
  expect(stored().slots[0].document.shapes.ledger["bottom-navigation"]).toBe(8);
  expect(stored().slots[0].document.optics.ledger.ior).toBe(0.75);
  expect(stored().slots[0].document.background).toBe("tide");
  expect(stored().slots[0].document.palette.slots[0].present.mode).toBe("light");
  for (const [key, value] of Object.entries(old)) expect(localStorage.getItem(key)).toBe(value);
});

it("reports an unsaved selected-preset trial to another MONO material Apply tab", async () => {
  vi.stubGlobal("BroadcastChannel", LocalChannel);
  await mount();
  tool("Форма и кнопки");
  fireEvent.change(screen.getByRole("slider", { name: "Радиус формы" }), { target: { value: "20" } });
  expect(stored().slots[0].document.shapes.ledger["quick-actions"]).toBe(12);
  const otherTab = new LocalChannel(MONO_SEVEN_PRESETS_KEY);
  const answers: unknown[] = [];
  otherTab.onmessage = event => answers.push(event.data);
  otherTab.postMessage({ kind: "material-apply-check", requestId: "dirty-probe",
    targetId: stored().slots[0].id });
  await waitFor(() => expect(answers).toContainEqual({ kind: "material-apply-status",
    requestId: "dirty-probe", targetId: stored().slots[0].id, dirty: true }));
  otherTab.close();
});

it("does not mistake a clean stale preset reader for an unsaved trial", async () => {
  vi.stubGlobal("BroadcastChannel", LocalChannel);
  await mount();
  const before = localStorage.getItem(MONO_SEVEN_PRESETS_KEY)!;
  const next = JSON.parse(before) as MonoSevenLibrary;
  next.generation += 1;
  const raw = JSON.stringify(next);
  localStorage.setItem(MONO_SEVEN_PRESETS_KEY, raw);
  fireEvent(window, new StorageEvent("storage", { key: MONO_SEVEN_PRESETS_KEY,
    oldValue: before, newValue: raw }));
  await waitFor(() => expect(screen.getByText(/Изменён в другой вкладке/)).toBeVisible());
  const otherTab = new LocalChannel(MONO_SEVEN_PRESETS_KEY);
  const answers: unknown[] = [];
  otherTab.onmessage = event => answers.push(event.data);
  otherTab.postMessage({ kind: "material-apply-check", requestId: "clean-probe",
    targetId: stored().slots[0].id });
  await waitFor(() => expect(answers).toContainEqual({ kind: "material-apply-status",
    requestId: "clean-probe", targetId: stored().slots[0].id, dirty: false }));
  otherTab.close();
});

it("saves direct color only in the active preset, then restores it after switch and reload", async () => {
  const first = await mount();
  fireEvent.click(screen.getByRole("button", { name: "Включить палитру" }));
  fireEvent.change(screen.getByRole("slider", { name: "Тон" }), { target: { value: "160" } });
  await waitFor(() => expect(stored().slots[0].document.palette.slots[0].present.config.themes.dark.recipe.anchorHue).toBe(160));
  fireEvent.click(screen.getByRole("button", { name: "Пресет 2: Пресет 2" }));
  expect(screen.getByRole("slider", { name: "Тон" })).toHaveValue("250");
  expect(stored().slots[1].document.palette.slots[0].present.paletteEnabled).not.toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Пресет 1: Пресет 1" }));
  expect(screen.getByRole("slider", { name: "Тон" })).toHaveValue("160");
  first.unmount();
  await mount();
  expect(screen.getByRole("slider", { name: "Тон" })).toHaveValue("160");
  expect(stored().slots).toHaveLength(7);
});

it("finishes a color gesture before copying to a chosen preset and archives its previous snapshot", async () => {
  await mount();
  fireEvent.click(screen.getByRole("button", { name: "Включить палитру" }));
  const hue = screen.getByRole("slider", { name: "Тон" });
  fireEvent.pointerDown(hue); fireEvent.change(hue, { target: { value: "110" } });
  const previousSecond = structuredClone(stored().slots[1].document);
  copyIntoSecond();
  await waitFor(() => expect(stored().activeSlot).toBe(2));
  expect(stored().slots[0].document.palette.slots[0].present.config.themes.dark.recipe.anchorHue).toBe(110);
  expect(stored().slots[1].document.palette.slots[0].present.config.themes.dark.recipe.anchorHue).toBe(110);
  expect(stored().archive.at(-1)?.document).toEqual(previousSecond);
  fireEvent.change(screen.getByRole("slider", { name: "Тон" }), { target: { value: "180" } });
  await waitFor(() => expect(stored().slots[1].document.palette.slots[0].present.config.themes.dark.recipe.anchorHue).toBe(180));
  expect(stored().slots[0].document.palette.slots[0].present.config.themes.dark.recipe.anchorHue).toBe(110);
});

it("keeps a shape trial local until Apply, lets Cancel restore it, and isolates the other preset", async () => {
  await mount();
  tool("Форма и кнопки");
  const radius = within(screen.getByRole("group", { name: "Настройка формы" })).getByRole("slider", { name: "Радиус формы" });
  fireEvent.change(radius, { target: { value: "20" } });
  expect(stored().slots[0].document.shapes.ledger["quick-actions"]).toBe(12);
  fireEvent.click(inspectorActions("Форма и кнопки").getByRole("button", { name: "Отменить пробу формы" }));
  expect(radius).toHaveValue("12");
  fireEvent.change(radius, { target: { value: "22" } });
  fireEvent.click(inspectorActions("Форма и кнопки").getByRole("button", { name: "Применить форму" }));
  expect(stored().slots[0].document.shapes.ledger["quick-actions"]).toBe(22);
  fireEvent.click(screen.getByRole("button", { name: "Пресет 2: Пресет 2" }));
  expect(screen.getByRole("slider", { name: "Радиус формы" })).toHaveValue("12");
  expect(stored().slots[1].document.shapes.ledger["quick-actions"]).toBe(12);
});

it("keeps the approved positive IOR through optical Cancel, Apply and reload", async () => {
  const first = await mount();
  tool("Оптика");
  const ior = within(screen.getByRole("group", { name: "Настройка стекла" })).getByRole("slider", { name: "Преломление" });
  expect(ior).toHaveValue("1.34");
  fireEvent.change(ior, { target: { value: "0.75" } });
  expect(stored().slots[0].document.optics.ledger.ior).toBe(1.34);
  fireEvent.click(inspectorActions("Оптика").getByRole("button", { name: "Отменить пробу оптики" }));
  expect(ior).toHaveValue("1.34");
  fireEvent.change(ior, { target: { value: "0.75" } });
  fireEvent.click(inspectorActions("Оптика").getByRole("button", { name: "Применить оптику" }));
  expect(stored().slots[0].document.optics.ledger.ior).toBe(0.75);
  first.unmount(); await mount(); tool("Оптика");
  expect(screen.getByRole("slider", { name: "Преломление" })).toHaveValue("0.75");
});

it("applies the background only on command and restores it after reload", async () => {
  const first = await mount();
  tool("Среда"); fireEvent.click(screen.getByText("Исходная среда и тема"));
  const previous = localStorage.getItem(MONO_SEVEN_PRESETS_KEY);
  fireEvent.click(within(screen.getByRole("group", { name: "Фон" })).getByRole("button", { name: "Волна" }));
  expect(localStorage.getItem(MONO_SEVEN_PRESETS_KEY)).toBe(previous);
  fireEvent.click(inspectorActions("Среда").getByRole("button", { name: "Применить настройку" }));
  expect(stored().slots[0].document.background).toBe("tide");
  first.unmount(); await mount(); tool("Среда"); fireEvent.click(screen.getByText("Исходная среда и тема"));
  expect(within(screen.getByRole("group", { name: "Фон" })).getByRole("button", { name: "Волна" }))
    .toHaveAttribute("aria-pressed", "true");
});

it("removes an applied material background and reveals the preserved MONO background", async () => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  const document = createMonoWorkingDocument();
  document.background = "tide";
  const fluid = materialCatalogV2.materials.find(item => item.id === "fluid")!.presets[0]!.recipe;
  document.materials.ledger = { ...document.materials.ledger, background: { version: 1, recipe: fluid,
    edgeFinish: DEFAULT_BACKGROUND_EDGE_FINISH } };
  saveMonoWorkingLibrary(localStorage, { version: 2, skinId: "mono-ledger-v1", generation: 1,
    activeId: "mine", records: [{ id: "mine", name: "Мой", revision: 1, document }] }, 0);
  await mount();
  fireEvent.click(screen.getByRole("button", { name: "Скрыть баланс" }));
  fireEvent.click(screen.getByRole("button", { name: "За неделю" }));
  expect(screen.getByRole("button", { name: "Показать баланс" })).toBeVisible();
  expect(screen.getByRole("button", { name: "За неделю" })).toHaveAttribute("aria-pressed", "true");
  tool("Среда");
  fireEvent.click(screen.getByRole("button", { name: "Снять материал фона" }));
  await waitFor(() => expect(stored().slots[0].document.materials.ledger.background).toBeNull());
  expect(stored().slots[0].document.background).toBe("tide");
  expect(screen.getByText(/Материал фона снят · прежний фон MONO сохранён/)).toBeVisible();
  expect(screen.getByRole("button", { name: "Показать баланс" })).toBeVisible();
  expect(screen.getByRole("button", { name: "За неделю" })).toHaveAttribute("aria-pressed", "true");
});

it("keeps a failed color edit live, allows export and retries the same preset", async () => {
  await mount();
  fireEvent.click(screen.getByRole("button", { name: "Включить палитру" }));
  await waitFor(() => expect(screen.getByText("Сохранено в этом браузере")).toBeVisible());
  const nativeSet = Storage.prototype.setItem;
  const block = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function(this: Storage, key, value) {
    if (key === MONO_SEVEN_PRESETS_KEY) throw Error("quota");
    return nativeSet.call(this, key, value);
  });
  fireEvent.change(screen.getByRole("slider", { name: "Тон" }), { target: { value: "160" } });
  await waitFor(() => expect(screen.getByText(/Не удалось сохранить/)).toBeVisible());
  expect(screen.getByRole("slider", { name: "Тон" })).toHaveValue("160");
  expect(stored().slots[0].document.palette.slots[0].present.config.themes.dark.recipe.anchorHue).toBe(250);
  fireEvent.click(screen.getByRole("button", { name: "Действия с пресетом" }));
  fireEvent.click(screen.getByRole("button", { name: "Экспортировать пресет 1" }));
  const exported = JSON.parse((screen.getByRole("textbox", { name: "JSON рабочего пресета" }) as HTMLTextAreaElement).value);
  expect(exported.document.palette.slots[0].present.config.themes.dark.recipe.anchorHue).toBe(160);
  block.mockRestore();
  fireEvent.click(screen.getByRole("button", { name: "Повторить сохранение" }));
  expect(stored().slots[0].document.palette.slots[0].present.config.themes.dark.recipe.anchorHue).toBe(160);
});

it("detects another tab's generation without overwriting its copy", async () => {
  await mount();
  const previous = localStorage.getItem(MONO_SEVEN_PRESETS_KEY)!;
  const concurrent = JSON.parse(previous) as MonoSevenLibrary;
  concurrent.generation += 1;
  concurrent.slots[0].name = "Из другой вкладки";
  const raw = JSON.stringify(concurrent);
  localStorage.setItem(MONO_SEVEN_PRESETS_KEY, raw);
  fireEvent(window, new StorageEvent("storage", { key: MONO_SEVEN_PRESETS_KEY, oldValue: previous, newValue: raw }));
  await waitFor(() => expect(screen.getByText(/Изменён в другой вкладке/)).toBeVisible());
  fireEvent.click(screen.getByRole("button", { name: "Включить палитру" }));
  expect(localStorage.getItem(MONO_SEVEN_PRESETS_KEY)).toBe(raw);
});

it("renames the selected preset without changing its stable slot ID or other designs", async () => {
  await mount();
  const before = structuredClone(stored());
  fireEvent.click(screen.getByRole("button", { name: "Действия с пресетом" }));
  fireEvent.click(screen.getByRole("button", { name: "Переименовать пресет 1" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Новое имя" }), { target: { value: "Тихий графит" } });
  fireEvent.click(screen.getByRole("button", { name: "Сохранить название" }));
  expect(stored().slots[0].id).toBe(before.slots[0].id);
  expect(stored().slots[0].name).toBe("Тихий графит");
  expect(stored().slots[0].document).toEqual(before.slots[0].document);
  expect(stored().slots[1]).toEqual(before.slots[1]);
  expect(screen.getByRole("button", { name: "Пресет 1: Тихий графит" })).toBeVisible();
});

it("imports a full JSON only after preview and explicit target, archiving the displaced preset", async () => {
  await mount();
  const changed = createMonoWorkingDocument(); changed.appearance.ledger.logo.hue = 77;
  const exported = exportMonoWorkingPreset("Из файла", changed);
  const previousSecond = structuredClone(stored().slots[1].document);
  fireEvent.click(screen.getByRole("button", { name: "Действия с пресетом" }));
  fireEvent.click(screen.getByRole("button", { name: "Импортировать в пресет…" }));
  fireEvent.change(screen.getByRole("textbox", { name: "JSON для импорта" }), { target: { value: exported } });
  fireEvent.click(screen.getByRole("button", { name: "Проверить импорт" }));
  await waitFor(() => expect(screen.getByText(/Проверено: Из файла/)).toBeVisible());
  expect(stored().slots[1].document).toEqual(previousSecond);
  fireEvent.change(screen.getByLabelText("Пресет для импорта"), { target: { value: "2" } });
  fireEvent.click(screen.getByRole("button", { name: "Импортировать в выбранный пресет" }));
  expect(stored().slots).toHaveLength(7);
  expect(stored().activeSlot).toBe(2);
  expect(stored().slots[1].document.appearance.ledger.logo.hue).toBe(77);
  expect(stored().archive.at(-1)?.document).toEqual(previousSecond);
});

it("imports an older palette-only JSON into a chosen preset without altering the source", async () => {
  await mount();
  const palette = normalizeMonoPaletteConfig();
  palette.themes.dark.recipe.anchorHue = 119;
  const source = await exportMonoPalettePreset(palette);
  const beforeFirst = structuredClone(stored().slots[0].document);
  fireEvent.click(screen.getByRole("button", { name: "Действия с пресетом" }));
  fireEvent.click(screen.getByRole("button", { name: "Импортировать в пресет…" }));
  fireEvent.change(screen.getByRole("textbox", { name: "JSON для импорта" }), { target: { value: source } });
  fireEvent.click(screen.getByRole("button", { name: "Проверить импорт" }));
  await waitFor(() => expect(screen.getByText(/Проверено: Импорт палитры/)).toBeVisible());
  fireEvent.change(screen.getByLabelText("Пресет для импорта"), { target: { value: "4" } });
  fireEvent.click(screen.getByRole("button", { name: "Импортировать в выбранный пресет" }));
  expect(stored().activeSlot).toBe(4);
  expect(stored().slots[3].document.palette.slots[0].present.config.themes.dark.recipe.anchorHue).toBe(119);
  expect(stored().slots[3].document.palette.slots[0].present.paletteEnabled).toBe(true);
  expect(stored().slots[0].document).toEqual(beforeFirst);
});

it("rejects malformed and unknown-field imports without changing seven accepted presets", async () => {
  await mount();
  const before = localStorage.getItem(MONO_SEVEN_PRESETS_KEY);
  fireEvent.click(screen.getByRole("button", { name: "Действия с пресетом" }));
  fireEvent.click(screen.getByRole("button", { name: "Импортировать в пресет…" }));
  const input = screen.getByRole("textbox", { name: "JSON для импорта" });
  for (const candidate of ["{broken", JSON.stringify({ ...JSON.parse(exportMonoWorkingPreset("X", createMonoWorkingDocument())), script: "alert(1)" })]) {
    fireEvent.change(input, { target: { value: candidate } });
    fireEvent.click(screen.getByRole("button", { name: "Проверить импорт" }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeVisible());
    expect(localStorage.getItem(MONO_SEVEN_PRESETS_KEY)).toBe(before);
  }
});

it("keeps a damaged old palette library and unknown v3 schema recoverable instead of silently replacing them", async () => {
  localStorage.setItem(MONO_PALETTE_PRESETS_KEY, "{broken");
  const first = render(<MonoPreview snapshot={await new MockWalletRepository().getSnapshot()} />);
  await waitFor(() => expect(screen.getByText(/Старую библиотеку палитр нельзя перенести/)).toBeVisible());
  expect(localStorage.getItem(MONO_SEVEN_PRESETS_KEY)).toBeNull();
  expect(localStorage.getItem(MONO_PALETTE_PRESETS_KEY)).toBe("{broken");
  first.unmount();
  cleanup(); localStorage.clear();
  const invalid = JSON.stringify({ version: 99, data: "keep" });
  localStorage.setItem(MONO_SEVEN_PRESETS_KEY, invalid);
  render(<MonoPreview snapshot={await new MockWalletRepository().getSnapshot()} />);
  await waitFor(() => expect(screen.getByText(/Рабочую библиотеку нельзя прочитать/)).toBeVisible());
  expect(localStorage.getItem(MONO_SEVEN_PRESETS_KEY)).toBe(invalid);
});

it("A/B comparison changes no accepted preset or archive", async () => {
  await mount();
  const before = localStorage.getItem(MONO_SEVEN_PRESETS_KEY);
  fireEvent.click(screen.getByRole("button", { name: "Сравнить A/B" }));
  expect(localStorage.getItem(MONO_SEVEN_PRESETS_KEY)).toBe(before);
  expect(stored().archive).toHaveLength(0);
});
