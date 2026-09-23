import { MONO_GLASS_DEFAULTS } from "@wallet/ui";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createMonoPaletteWorkspace } from "./mono-palette-workspace";
import { createMonoShapeDefaults } from "./mono-shape-preview";
import { createLegacyPaletteWorkingRecords, loadMonoWorkingLibrary, previewMonoWorkingImport, exportMonoWorkingPreset, saveMonoWorkingLibrary } from "./mono-working-presets";
import { exportMonoPalettePreset, importMonoPalettePreset } from "./mono-preset-codec";

const legacyKey = "wallet4i7.mono.working-presets.v1";
const currentKey = "wallet4i7.mono.working-presets.v2";
const logoKey = "wallet4i7.mono.logo-preview.v1";
const logo = { version: 1, variant: "plaque", customColor: true, hue: 157 } as const;

function legacyFixture() {
  const palette = createMonoPaletteWorkspace();
  palette.activeSlotId = 2;
  palette.slots[1].present.mode = "light";
  palette.slots[1].present.config.seed = "unfinished-draft-seed";
  palette.slots[0].past = [structuredClone(palette.slots[0].baseline)];
  palette.slots[2].future = [structuredClone(palette.slots[2].baseline)];
  const document = { palette, shapes: createMonoShapeDefaults(), optics: structuredClone(MONO_GLASS_DEFAULTS), background: "tide" };
  return { version: 1, skinId: "mono-ledger-v1", generation: 8, activeId: "kept",
    records: [{ id: "kept", name: "Мой вид", revision: 4, document },
      { id: "other", name: "Другой вид", revision: 2, document: { ...structuredClone(document), background: "strata" } }] };
}

function memoryStorage(entries: [string, string][]) {
  const values = new Map(entries);
  return { values, getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); } };
}

describe("full working preset migration", () => {
  it("adds appearance only to a copy, retaining all legacy slots, history and accepted settings", () => {
    const before = legacyFixture(), raw = JSON.stringify(before);
    const storage = memoryStorage([[legacyKey, raw], [logoKey, JSON.stringify(logo)]]);
    const result = loadMonoWorkingLibrary(storage)!;
    expect(result.records[0].document).toMatchObject({ version: 2, ...before.records[0].document });
    expect(result.records[0].document).toHaveProperty("appearance.frost.logo", logo);
    expect(result.records[0].document).toHaveProperty("appearance.frost.background", null);
    expect(result.records[0].document).toHaveProperty("appearance.frost.typography", null);
    expect(result.records[0].document).toHaveProperty("appearance.frost.balance", { composition: "ledger", fractionSize: "large", fractionTone: "primary" });
    expect(result.records[1].document.background).toBe("strata");
    expect(result.records.map(item => [item.id, item.name, item.revision])).toEqual([["kept", "Мой вид", 4], ["other", "Другой вид", 2]]);
    expect(storage.values.size).toBe(2);
    expect(storage.getItem(legacyKey)).toBe(raw);
  });

  it("writes migrated data to v2 without rewriting v1 or logo, then reads v2 independently", () => {
    const raw = JSON.stringify(legacyFixture());
    const storage = memoryStorage([[legacyKey, raw], [logoKey, JSON.stringify(logo)]]);
    const migrated = loadMonoWorkingLibrary(storage)!;
    saveMonoWorkingLibrary(storage, { ...migrated, generation: 9 }, 8);
    expect(storage.getItem(legacyKey)).toBe(raw);
    expect(storage.getItem(logoKey)).toBe(JSON.stringify(logo));
    expect(storage.getItem(currentKey)).not.toBeNull();
    storage.setItem(legacyKey, "{broken old copy");
    storage.setItem(logoKey, "{broken old logo");
    expect(loadMonoWorkingLibrary(storage)?.records[0].document).toEqual(migrated.records[0].document);
  });

  it("preserves the formerly global logo for every legacy record and makes their v2 copies independent", () => {
    const storage = memoryStorage([[legacyKey, JSON.stringify(legacyFixture())], [logoKey, JSON.stringify(logo)]]);
    const migrated = loadMonoWorkingLibrary(storage)!;
    for (const item of migrated.records) for (const preset of ["ledger", "frost", "mercury"] as const)
      expect(item.document.appearance[preset].logo).toEqual(logo);
    migrated.records[0].document.appearance.ledger.logo.hue = 41;
    saveMonoWorkingLibrary(storage, { ...migrated, generation: 9 }, 8);
    const reloaded = loadMonoWorkingLibrary(storage)!;
    expect(reloaded.records[0].document.appearance.ledger.logo.hue).toBe(41);
    expect(reloaded.records[0].document.appearance.frost.logo.hue).toBe(157);
    expect(reloaded.records[1].document.appearance.ledger.logo.hue).toBe(157);
    expect(storage.getItem(logoKey)).toBe(JSON.stringify(logo));
  });

  it("also carries the global logo and original balance treatment into older palette library records", async () => {
    const sha = async (bytes: Uint8Array) => new Uint8Array(createHash("sha256").update(bytes).digest());
    const config = legacyFixture().records[0].document.palette.slots[0].present.config;
    const preset = await importMonoPalettePreset(await exportMonoPalettePreset(config, sha), sha);
    const records = createLegacyPaletteWorkingRecords([{ id: "archive", name: "Архив", revision: 1, preset }], logo);
    expect(records[0].document.appearance.mercury.logo).toEqual(logo);
    expect(records[0].document.appearance.mercury.balance).toEqual({ composition: "ledger", fractionSize: "large", fractionTone: "primary" });
  });

  it("refuses to overwrite a corrupt or unknown v2 even when a valid v1 exists", () => {
    for (const invalid of ["{broken", JSON.stringify({ version: 99 })]) {
      const storage = memoryStorage([[legacyKey, JSON.stringify(legacyFixture())], [currentKey, invalid]]);
      expect(() => loadMonoWorkingLibrary(storage)).toThrow();
      expect(storage.getItem(currentKey)).toBe(invalid);
    }
  });

  it("roundtrips the full editor document and accepts v1 exports without discarding drafts", async () => {
    const legacy = legacyFixture().records[0];
    const imported = await previewMonoWorkingImport(JSON.stringify({ kind: "mono-working-preset", version: 1,
      skinId: "mono-ledger-v1", name: legacy.name, document: legacy.document }));
    expect(imported.document).toMatchObject({ version: 2, ...legacy.document });
    const restored = await previewMonoWorkingImport(exportMonoWorkingPreset(imported.name, imported.document));
    expect(restored.document).toEqual(imported.document);
  });

  it("retains generation conflicts across the v1 to v2 boundary", () => {
    const storage = memoryStorage([[legacyKey, JSON.stringify(legacyFixture())]]);
    const migrated = loadMonoWorkingLibrary(storage)!;
    saveMonoWorkingLibrary(storage, { ...migrated, generation: 9 }, 8);
    expect(() => saveMonoWorkingLibrary(storage, { ...migrated, generation: 9 }, 8)).toThrow(/другой вкладке/);
    expect(loadMonoWorkingLibrary(storage)?.generation).toBe(9);
  });
});
