import { MONO_PALETTE_GROUPS, MONO_PALETTE_ROLES, MONO_PALETTE_ROLE_SCHEMA, normalizeMonoPaletteConfig, resolveMonoPalette, validateMonoPaletteApply, type MonoPaletteConfigV1 } from "@wallet/ui";
import { createMonoPaletteWorkspace, type MonoPaletteEditorSnapshot, type MonoPaletteSlot, type MonoPaletteWorkspace } from "./mono-palette-workspace";
import { importMonoPalettePreset, type MonoPalettePresetV1, type MonoSha256, webCryptoMonoSha256 } from "./mono-preset-codec";

export const MONO_PALETTE_WORKSPACE_KEY = "wallet4i7.mono.palette-workspace.v1";
export const MONO_PALETTE_ACTIVE_KEY = "wallet4i7.mono.palette-active.v1";
export const MONO_PALETTE_PRESETS_KEY = "wallet4i7.mono.palette-presets.v1";

type StoragePort = Pick<Storage, "getItem" | "setItem">;
export type MonoPaletteActiveV1 = { version: 1; skinId: "mono-ledger-v1"; config: MonoPaletteConfigV1 };

function runtimeConfig(input: MonoPaletteConfigV1): MonoPaletteConfigV1 {
  const config = normalizeMonoPaletteConfig(input);
  for (const mode of ["dark", "light"] as const) {
    const theme = config.themes[mode], resolved = resolveMonoPalette(theme);
    for (const role of MONO_PALETTE_ROLES) {
      const group = MONO_PALETTE_ROLE_SCHEMA[role].group;
      const state = theme.roles[role];
      if ((theme.groupLocks[group] || state.locked) && group !== "system") {
        state.mode = "manual";
        state.value = { ...resolved.roles[role] };
      }
      state.locked = false;
      state.lockedValue = null;
    }
    for (const group of Object.keys(MONO_PALETTE_GROUPS) as Array<keyof typeof MONO_PALETTE_GROUPS>) theme.groupLocks[group] = false;
  }
  config.linkedThemes = false;
  return config;
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function read(storage: StoragePort, key: string): unknown {
  try {
    const text = storage.getItem(key);
    return text === null ? null : JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function snapshot(value: unknown): MonoPaletteEditorSnapshot {
  const source = record(value);
  if (!source || (source.mode !== "dark" && source.mode !== "light")) throw new Error("Invalid palette editor snapshot");
  return { mode: source.mode, config: normalizeMonoPaletteConfig(source.config), ...(source.paletteEnabled === true ? { paletteEnabled: true } : source.paletteEnabled === false ? { paletteEnabled: false } : {}) };
}

function slot(value: unknown): MonoPaletteSlot {
  const source = record(value);
  if (!source || !Array.isArray(source.past) || !Array.isArray(source.future)) throw new Error("Invalid palette slot");
  return {
    baseline: snapshot(source.baseline), present: snapshot(source.present),
    past: source.past.slice(-50).map(snapshot), future: source.future.slice(-50).map(snapshot), transaction: null,
  };
}

export function readMonoPaletteWorkspace(storage: StoragePort): MonoPaletteWorkspace | null {
  try {
    const source = record(read(storage, MONO_PALETTE_WORKSPACE_KEY));
    if (!source || source.version !== 1 || !Array.isArray(source.slots) || source.slots.length !== 3 ||
      (source.activeSlotId !== 1 && source.activeSlotId !== 2 && source.activeSlotId !== 3)) throw new Error("Invalid workspace version or shape");
    return { version: 1, activeSlotId: source.activeSlotId,
      slots: [slot(source.slots[0]), slot(source.slots[1]), slot(source.slots[2])],
      compare: null };
  } catch {
    return null;
  }
}

export function loadMonoPaletteWorkspace(storage: StoragePort): MonoPaletteWorkspace {
  return readMonoPaletteWorkspace(storage) ?? createMonoPaletteWorkspace();
}

export function saveMonoPaletteWorkspace(storage: StoragePort, workspace: MonoPaletteWorkspace): void {
  if (workspace.version !== 1) throw new Error("Unsupported palette workspace version");
  const serialized = structuredClone(workspace);
  serialized.compare = null;
  for (const slot of serialized.slots) {
    if (slot.transaction && JSON.stringify(slot.transaction.before) !== JSON.stringify(slot.present)) {
      slot.past = [...slot.past, slot.transaction.before].slice(-50);
      slot.future = [];
    }
    slot.transaction = null;
  }
  storage.setItem(MONO_PALETTE_WORKSPACE_KEY, JSON.stringify(serialized));
}

export function loadMonoPaletteActive(storage: StoragePort): MonoPaletteActiveV1 | null {
  try {
    const source = record(read(storage, MONO_PALETTE_ACTIVE_KEY));
    if (!source || source.version !== 1 || source.skinId !== "mono-ledger-v1") return null;
    const config = normalizeMonoPaletteConfig(source.config);
    if (Object.values(config.themes).some(theme => !validateMonoPaletteApply(theme).valid)) return null;
    return { version: 1, skinId: "mono-ledger-v1", config: runtimeConfig(config) };
  } catch {
    return null;
  }
}

export function applyMonoPaletteActive(storage: StoragePort, config: MonoPaletteConfigV1): MonoPaletteActiveV1 {
  const normalized = normalizeMonoPaletteConfig(config);
  const issues = Object.values(normalized.themes).flatMap(theme => validateMonoPaletteApply(theme).issues);
  if (issues.length) throw new Error(`Invalid palette Apply: ${issues.map(issue => issue.message).join("; ")}`);
  const active: MonoPaletteActiveV1 = { version: 1, skinId: "mono-ledger-v1", config: runtimeConfig(normalized) };
  storage.setItem(MONO_PALETTE_ACTIVE_KEY, JSON.stringify(active));
  return active;
}

export function loadMonoPalettePresets(storage: StoragePort): MonoPalettePresetV1[] {
  const source = record(read(storage, MONO_PALETTE_PRESETS_KEY));
  if (source?.version !== 1 || !Array.isArray(source.presets)) return [];
  const presets = source.presets as unknown[];
  if (!presets.every(value => {
    const entry = record(value);
    if (!entry || entry.schemaVersion !== 1 || entry.configVersion !== 1 || entry.engineVersion !== 1 ||
      entry.catalogVersion !== 1 || entry.skinId !== "mono-ledger-v1" || typeof entry.contentHash !== "string" ||
      !/^sha256-[0-9a-f]{64}$/.test(entry.contentHash) || !record(entry.resolved)) return false;
    try { normalizeMonoPaletteConfig(entry.config); return true; } catch { return false; }
  })) return [];
  return presets as MonoPalettePresetV1[];
}

export async function loadVerifiedMonoPalettePresets(storage: StoragePort, sha256: MonoSha256 = webCryptoMonoSha256): Promise<MonoPalettePresetV1[]> {
  const presets = loadMonoPalettePresets(storage);
  try {
    return await Promise.all(presets.map(preset => importMonoPalettePreset(JSON.stringify(preset), sha256)));
  } catch {
    return [];
  }
}

export function saveMonoPalettePresets(storage: StoragePort, presets: MonoPalettePresetV1[]): void {
  storage.setItem(MONO_PALETTE_PRESETS_KEY, JSON.stringify({ version: 1, presets }));
}

export type MonoPaletteLibraryEntry = { id: string; name: string; revision: number; preset: MonoPalettePresetV1 };

export async function loadMonoPaletteLibrary(storage: StoragePort): Promise<MonoPaletteLibraryEntry[]> {
  const presets = await loadVerifiedMonoPalettePresets(storage);
  const source = record(read(storage, MONO_PALETTE_PRESETS_KEY));
  const metadata = Array.isArray(source?.metadata) ? source.metadata : [];
  return presets.map((preset, index) => {
    const meta = record(metadata[index]);
    return { id: typeof meta?.id === "string" ? meta.id.slice(0, 100) : `local-${index + 1}`,
      name: typeof meta?.name === "string" && meta.name.trim() ? meta.name.trim().slice(0, 80) : `Пресет ${index + 1}`,
      revision: typeof meta?.revision === "number" && Number.isSafeInteger(meta.revision) && meta.revision > 0 ? meta.revision : 1, preset };
  });
}

export function saveMonoPaletteLibrary(storage: StoragePort, entries: MonoPaletteLibraryEntry[]): void {
  storage.setItem(MONO_PALETTE_PRESETS_KEY, JSON.stringify({ version: 1,
    presets: entries.map(entry => entry.preset),
    metadata: entries.map(({id, name, revision}) => ({id, name: name.trim().slice(0, 80), revision})),
  }));
}
