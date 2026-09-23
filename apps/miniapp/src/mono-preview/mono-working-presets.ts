import { MONO_GLASS_DEFAULTS, normalizeMonoGlassSettings, type MonoGlassSettings } from "@wallet/ui";

import { createMonoPaletteWorkspace, type MonoPaletteWorkspace } from "./mono-palette-workspace";
import { MONO_PALETTE_WORKSPACE_KEY, readMonoPaletteWorkspace, saveMonoPaletteWorkspace, type MonoPaletteLibraryEntry } from "./mono-palette-storage";
import { importMonoPalettePreset } from "./mono-preset-codec";
import { createMonoShapeDefaults, normalizeMonoShapeMap, type MonoShapeMap, type MonoShapePreset } from "./mono-shape-preview";
import { createMonoExtendedAppearance, normalizeMonoExtendedAppearance, type MonoExtendedAppearance } from "./mono-preset-envelope";
import { loadMonoLogoPreview, type MonoLogoPreview } from "./mono-logo-preview";

export const MONO_WORKING_PRESETS_KEY = "wallet4i7.mono.working-presets.v2";
export const MONO_WORKING_PRESETS_LEGACY_KEY = "wallet4i7.mono.working-presets.v1";
const MAX_STORE_LENGTH = 2_000_000;
const MAX_RECORDS = 64;
const MAX_IMPORT_BYTES = 2_000_000;

export type MonoBackground = "iris" | "tide" | "strata";
export type MonoOpticsMap = Record<MonoShapePreset, MonoGlassSettings>;
export type MonoWorkingDocument = {
  version: 2;
  palette: MonoPaletteWorkspace;
  shapes: MonoShapeMap;
  optics: MonoOpticsMap;
  background: MonoBackground;
  appearance: Record<MonoShapePreset, MonoExtendedAppearance>;
};
export type MonoWorkingRecord = {
  id: string;
  name: string;
  revision: number;
  document: MonoWorkingDocument;
  source?: { kind: "legacy-palette"; id: string; contentHash: string };
};
export type MonoWorkingLibrary = {
  version: 1 | 2;
  skinId: "mono-ledger-v1";
  generation: number;
  activeId: string;
  records: MonoWorkingRecord[];
};
export type MonoWorkingImport = {
  name: string;
  document: MonoWorkingDocument;
  kind: "full" | "palette-only";
};

type StoragePort = Pick<Storage, "getItem" | "setItem">;

export class MonoWorkingStoreError extends Error {
  constructor(message: string, readonly kind: "invalid" | "conflict") {
    super(message);
  }
}

export function createMonoWorkingDocument(legacyLogo?: MonoLogoPreview): MonoWorkingDocument {
  return {
    version: 2,
    palette: createMonoPaletteWorkspace(),
    shapes: createMonoShapeDefaults(),
    optics: {
      ledger: { ...MONO_GLASS_DEFAULTS.ledger },
      frost: { ...MONO_GLASS_DEFAULTS.frost },
      mercury: { ...MONO_GLASS_DEFAULTS.mercury },
    },
    background: "iris",
    appearance: {
      ledger: createMonoExtendedAppearance("ledger", legacyLogo, legacyLogo !== undefined),
      frost: createMonoExtendedAppearance("frost", legacyLogo, legacyLogo !== undefined),
      mercury: createMonoExtendedAppearance("mercury", legacyLogo, legacyLogo !== undefined),
    },
  };
}

export function createRecoveredMonoWorkingLibrary(document: MonoWorkingDocument): MonoWorkingLibrary {
  const id = "recovered-mono-preview";
  return { version: 2, skinId: "mono-ledger-v1", generation: 1, activeId: id,
    records: [{ id, name: "Восстановленный вариант", revision: 1, document }] };
}

export function createLegacyPaletteWorkingRecords(entries: MonoPaletteLibraryEntry[]): MonoWorkingRecord[] {
  return entries.map((entry, index) => {
    const document = createMonoWorkingDocument();
    document.palette = createMonoPaletteWorkspace(entry.preset.config);
    for (const slot of document.palette.slots) slot.present.paletteEnabled = true;
    return {
      id: `legacy-palette-${index + 1}-${entry.preset.contentHash.slice(-12)}`,
      name: entry.name,
      revision: 1,
      document,
      source: { kind: "legacy-palette", id: entry.id, contentHash: entry.preset.contentHash },
    };
  });
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

function exactKeys(value: unknown, keys: string[], label: string): asserts value is Record<string, unknown> {
  const object = record(value);
  if (!object || Object.keys(object).length !== keys.length || keys.some(key => !(key in object)))
    throw new MonoWorkingStoreError(`${label}: неизвестные или отсутствующие поля.`, "invalid");
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const object = record(value);
  if (object) return `{${Object.keys(object).sort().map(key => `${JSON.stringify(key)}:${canonical(object[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

function normalizePalette(value: unknown): MonoPaletteWorkspace {
  const raw = JSON.stringify(value);
  const storage = { getItem: (key: string) => key === MONO_PALETTE_WORKSPACE_KEY ? raw : null,
    setItem: () => {} };
  const palette = readMonoPaletteWorkspace(storage);
  if (!palette) throw new MonoWorkingStoreError("Рабочая палитра повреждена или несовместима.", "invalid");
  if (canonical(value) !== canonical(palette))
    throw new MonoWorkingStoreError("Рабочая палитра содержит неподдерживаемые значения.", "invalid");
  return palette;
}

function settledPalette(value: MonoPaletteWorkspace): MonoPaletteWorkspace {
  let raw = "";
  saveMonoPaletteWorkspace({ getItem: () => null, setItem: (_key, text) => { raw = text; } }, value);
  const palette = readMonoPaletteWorkspace({ getItem: key => key === MONO_PALETTE_WORKSPACE_KEY ? raw : null,
    setItem: () => {} });
  if (!palette) throw new MonoWorkingStoreError("Рабочая палитра повреждена.", "invalid");
  return palette;
}

export function normalizeMonoWorkingDocument(value: unknown, legacyLogo?: MonoLogoPreview): MonoWorkingDocument {
  const input = record(value);
  if (!input || !record(input.optics)) throw new MonoWorkingStoreError("Рабочий пресет повреждён.", "invalid");
  const legacy = input.version === undefined;
  if (!legacy && input.version !== 2) throw new MonoWorkingStoreError("Версия рабочего документа неизвестна.", "invalid");
  exactKeys(input, ["palette", "shapes", "optics", "background", ...(legacy ? [] : ["version", "appearance"])], "Рабочий пресет");
  exactKeys(input.shapes, ["ledger", "frost", "mercury"], "Форма");
  exactKeys(input.optics, ["ledger", "frost", "mercury"], "Оптика");
  const optics = input.optics as Record<string, unknown>;
  if (input.background !== "iris" && input.background !== "tide" && input.background !== "strata")
    throw new MonoWorkingStoreError("Фон рабочего пресета неизвестен.", "invalid");
  let appearance: MonoWorkingDocument["appearance"];
  if (legacy) {
    appearance = { ledger: createMonoExtendedAppearance("ledger", legacyLogo, true),
      frost: createMonoExtendedAppearance("frost", legacyLogo, true), mercury: createMonoExtendedAppearance("mercury", legacyLogo, true) };
  } else {
    exactKeys(input.appearance, ["ledger", "frost", "mercury"], "Оформление");
    try { appearance = { ledger: normalizeMonoExtendedAppearance(input.appearance.ledger),
      frost: normalizeMonoExtendedAppearance(input.appearance.frost), mercury: normalizeMonoExtendedAppearance(input.appearance.mercury) }; }
    catch { throw new MonoWorkingStoreError("Оформление рабочего пресета повреждено.", "invalid"); }
  }
  const result: MonoWorkingDocument = {
    version: 2,
    palette: normalizePalette(input.palette),
    shapes: normalizeMonoShapeMap(input.shapes),
    optics: {
      ledger: normalizeMonoGlassSettings("ledger", optics.ledger as Partial<MonoGlassSettings>),
      frost: normalizeMonoGlassSettings("frost", optics.frost as Partial<MonoGlassSettings>),
      mercury: normalizeMonoGlassSettings("mercury", optics.mercury as Partial<MonoGlassSettings>),
    },
    background: input.background as MonoBackground,
    appearance,
  };
  if (canonical(input.shapes) !== canonical(result.shapes) || canonical(input.optics) !== canonical(result.optics))
    throw new MonoWorkingStoreError("Форма или оптика рабочего пресета повреждена.", "invalid");
  return result;
}

export function exportMonoWorkingPreset(name: string, document: MonoWorkingDocument): string {
  const normalized = normalizeMonoWorkingDocument({ ...document, palette: settledPalette(document.palette) });
  return JSON.stringify({ kind: "mono-working-preset", version: 2, skinId: "mono-ledger-v1",
    name: name.trim().slice(0, 80) || "Пресет оформления", document: normalized });
}

export async function previewMonoWorkingImport(text: string): Promise<MonoWorkingImport> {
  if (new TextEncoder().encode(text).length > MAX_IMPORT_BYTES)
    throw new MonoWorkingStoreError("Импорт слишком велик.", "invalid");
  let value: unknown;
  try { value = JSON.parse(text) as unknown; }
  catch { throw new MonoWorkingStoreError("JSON импорта повреждён.", "invalid"); }
  const input = record(value);
  if (!input) throw new MonoWorkingStoreError("Формат импорта неизвестен.", "invalid");
  if (input.kind === "mono-working-preset") {
    exactKeys(input, ["kind", "version", "skinId", "name", "document"], "Импорт");
    if ((input.version !== 1 && input.version !== 2) || input.skinId !== "mono-ledger-v1")
      throw new MonoWorkingStoreError("Версия рабочего пресета неизвестна или несовместима.", "invalid");
    if (typeof input.name !== "string" || !input.name.trim() || input.name.length > 80)
      throw new MonoWorkingStoreError("Название рабочего пресета повреждено.", "invalid");
    exactKeys(input.document, ["palette", "shapes", "optics", "background", ...(input.version === 2 ? ["version", "appearance"] : [])], "Рабочий пресет");
    const document = normalizeMonoWorkingDocument(input.document);
    const comparison = input.version === 1 ? { palette: document.palette, shapes: document.shapes, optics: document.optics, background: document.background } : document;
    if (canonical(input.document) !== canonical(comparison))
      throw new MonoWorkingStoreError("В рабочем пресете есть неподдерживаемые или изменённые значения.", "invalid");
    return { name: input.name.trim(), document, kind: "full" };
  }
  if (input.schemaVersion === 1 || input.schemaVersion === 2) {
    const imported = await importMonoPalettePreset(text);
    const document = createMonoWorkingDocument();
    document.palette = createMonoPaletteWorkspace(imported.config);
    for (const slot of document.palette.slots) slot.present.paletteEnabled = true;
    return { name: "Импорт палитры", document, kind: "palette-only" };
  }
  throw new MonoWorkingStoreError("Формат или версия импорта неизвестны.", "invalid");
}

export function loadMonoWorkingLibrary(storage: Pick<Storage, "getItem">): MonoWorkingLibrary | null {
  const currentRaw = storage.getItem(MONO_WORKING_PRESETS_KEY);
  const raw = currentRaw ?? storage.getItem(MONO_WORKING_PRESETS_LEGACY_KEY);
  if (raw === null) return null;
  if (raw.length > MAX_STORE_LENGTH) throw new MonoWorkingStoreError("Рабочая библиотека слишком велика.", "invalid");
  let value: unknown;
  try { value = JSON.parse(raw) as unknown; }
  catch { throw new MonoWorkingStoreError("Рабочая библиотека повреждена.", "invalid"); }
  const source = record(value);
  if (source?.version !== (currentRaw === null ? 1 : 2) || source.skinId !== "mono-ledger-v1" ||
    !Number.isSafeInteger(source.generation) || Number(source.generation) < 1 ||
    typeof source.activeId !== "string" || !Array.isArray(source.records) ||
    source.records.length < 1 || source.records.length > MAX_RECORDS)
    throw new MonoWorkingStoreError("Версия рабочей библиотеки неизвестна.", "invalid");
  exactKeys(source, ["version", "skinId", "generation", "activeId", "records"], "Рабочая библиотека");
  // The v1 logo was global, so it affected every record, not just the active one.
  const legacyLogo = currentRaw === null ? loadMonoLogoPreview(storage) : undefined;
  const ids = new Set<string>();
  const records = source.records.map(value => {
    const item = record(value);
    if (!item || typeof item.id !== "string" || !item.id || item.id.length > 100 || ids.has(item.id) ||
      typeof item.name !== "string" || !item.name.trim() || item.name.length > 80 ||
      !Number.isSafeInteger(item.revision) || Number(item.revision) < 1)
      throw new MonoWorkingStoreError("Запись рабочего пресета повреждена.", "invalid");
    exactKeys(item, ["id", "name", "revision", "document", ...(item.source === undefined ? [] : ["source"])],
      "Запись рабочего пресета");
    ids.add(item.id);
    const origin = record(item.source);
    if (item.source !== undefined) exactKeys(origin, ["kind", "id", "contentHash"], "Источник палитры");
    const sourceMetadata = origin?.kind === "legacy-palette" && typeof origin.id === "string" &&
      typeof origin.contentHash === "string"
      ? { source: { kind: "legacy-palette" as const, id: origin.id, contentHash: origin.contentHash } }
      : {};
    if (currentRaw !== null && record(item.document)?.version !== 2)
      throw new MonoWorkingStoreError("Версия рабочего документа неизвестна.", "invalid");
    return { id: item.id, name: item.name, revision: Number(item.revision),
      document: normalizeMonoWorkingDocument(item.document, legacyLogo), ...sourceMetadata };
  });
  if (!ids.has(source.activeId)) throw new MonoWorkingStoreError("Активный рабочий пресет не найден.", "invalid");
  return { version: 2, skinId: "mono-ledger-v1", generation: Number(source.generation), activeId: source.activeId, records };
}

export function saveMonoWorkingLibrary(storage: StoragePort, library: MonoWorkingLibrary, expectedGeneration: number): void {
  const current = loadMonoWorkingLibrary(storage);
  if ((current?.generation ?? 0) !== expectedGeneration)
    throw new MonoWorkingStoreError("Рабочий пресет изменён в другой вкладке.", "conflict");
  const prepared = { ...library, version: 2, records: library.records.map(item => ({ ...item,
    document: { ...item.document, palette: settledPalette(item.document.palette) } })) };
  const serialized = JSON.stringify(prepared);
  if (serialized.length > MAX_STORE_LENGTH || library.records.length > MAX_RECORDS)
    throw new MonoWorkingStoreError("Рабочая библиотека слишком велика для сохранения.", "invalid");
  loadMonoWorkingLibrary({ getItem: key => key === MONO_WORKING_PRESETS_KEY ? serialized : null });
  storage.setItem(MONO_WORKING_PRESETS_KEY, serialized);
}
