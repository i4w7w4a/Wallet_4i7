import { expect, it } from "vitest";
import * as working from "./mono-working-presets";
import { createDefaultActionArtworkMap } from "./action-artwork/model";

function memory() {
  const values = new Map<string, string>();
  const writes: string[] = [];
  return { values, writes,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { writes.push(key); values.set(key, value); } };
}

function legacy(store: ReturnType<typeof memory>) {
  const first = working.createMonoWorkingDocument();
  first.palette.activeSlotId = 2;
  first.appearance.frost.logo.hue = 241;
  first.optics.ledger.ior = 1.34;
  const artwork = createDefaultActionArtworkMap();
  artwork["quick.send"].packId = "volume-v1";
  first.materials.frost = { background: null, buttons: { version: 3, frameMode: "icons", bindings: [], artwork } };
  const second = working.createMonoWorkingDocument();
  second.palette.activeSlotId = 3;
  second.appearance.mercury.logo.hue = 39;
  const source: working.MonoWorkingLibrary = { version: 2, skinId: "mono-ledger-v1", generation: 7,
    activeId: "owner-first", records: [
      { id: "owner-first", name: "Первый · перелив", revision: 4, document: first },
      { id: "same-name", name: "Первый · перелив", revision: 2, document: second },
    ] };
  working.saveMonoWorkingLibrary(store, source, 0);
  return source;
}

it("exposes a dedicated seven-slot migration without changing the legacy reader", () => {
  expect(working).toHaveProperty("migrateMonoSevenLibrary");
  expect(working).toHaveProperty("MONO_SEVEN_PRESETS_KEY");
  expect(working).toHaveProperty("MONO_SEVEN_BACKUP_KEY");
});

it("migrates the active full document to #1, keeps every old direction and same-name record in a raw-backed archive", () => {
  const store = memory();
  const source = legacy(store);
  const raw = store.getItem(working.MONO_WORKING_PRESETS_KEY)!;
  const next = working.migrateMonoSevenLibrary(store);
  expect(next.slots).toHaveLength(7);
  expect(next.slots.map(item => item.slot)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  expect(next.activeSlot).toBe(1);
  expect(next.slots[0].name).toBe("Первый · перелив");
  expect(next.slots[0].document).toEqual(source.records[0].document);
  expect(next.slots[0].document.materials.frost.buttons).toEqual(source.records[0].document.materials.frost.buttons);
  expect(next.slots[1].document).not.toBe(next.slots[2].document);
  expect(next.archive).toEqual(source.records);
  expect(next.archive[1].document.palette.activeSlotId).toBe(3);
  expect(next.archive.map(item => item.name)).toEqual(["Первый · перелив", "Первый · перелив"]);
  expect(store.getItem(working.MONO_SEVEN_BACKUP_KEY)).toBe(raw);
  expect(store.getItem(working.MONO_WORKING_PRESETS_KEY)).toBe(raw);
  expect(store.writes.slice(-2)).toEqual([working.MONO_SEVEN_BACKUP_KEY, working.MONO_SEVEN_PRESETS_KEY]);
  const before = [...store.writes];
  expect(working.migrateMonoSevenLibrary(store)).toEqual(next);
  expect(store.writes).toEqual(before);
});

it("does not create a new library when the raw backup fails; retries after a partial v3 write", () => {
  const store = memory();
  legacy(store);
  const raw = store.getItem(working.MONO_WORKING_PRESETS_KEY)!;
  const originalSet = store.setItem;
  store.setItem = (key, value) => {
    if (key === working.MONO_SEVEN_BACKUP_KEY) throw Error("quota");
    originalSet(key, value);
  };
  expect(() => working.migrateMonoSevenLibrary(store)).toThrow();
  expect(store.getItem(working.MONO_SEVEN_PRESETS_KEY)).toBeNull();
  expect(store.getItem(working.MONO_WORKING_PRESETS_KEY)).toBe(raw);
  store.setItem = (key, value) => {
    if (key === working.MONO_SEVEN_PRESETS_KEY) throw Error("quota");
    originalSet(key, value);
  };
  expect(() => working.migrateMonoSevenLibrary(store)).toThrow();
  expect(store.getItem(working.MONO_SEVEN_BACKUP_KEY)).toBe(raw);
  expect(store.getItem(working.MONO_SEVEN_PRESETS_KEY)).toBeNull();
  store.setItem = originalSet;
  expect(working.migrateMonoSevenLibrary(store).slots).toHaveLength(7);
});

it("rejects an unknown v3 schema and stale generation without falling back to old data", () => {
  const store = memory();
  legacy(store);
  store.setItem(working.MONO_SEVEN_PRESETS_KEY, JSON.stringify({ version: 99 }));
  expect(() => working.migrateMonoSevenLibrary(store)).toThrow();
  store.values.delete(working.MONO_SEVEN_PRESETS_KEY);
  const current = working.migrateMonoSevenLibrary(store);
  const raw = store.getItem(working.MONO_SEVEN_PRESETS_KEY);
  expect(() => working.saveMonoSevenLibrary(store, { ...current, generation: 2 }, 0)).toThrow();
  expect(store.getItem(working.MONO_SEVEN_PRESETS_KEY)).toBe(raw);
});

it("restores one archived direction into an explicit number while archiving its previous complete document", () => {
  const store = memory();
  legacy(store);
  const original = working.migrateMonoSevenLibrary(store);
  const oldTarget = structuredClone(original.slots[3]);
  const restored = working.restoreMonoArchivedRecord(original, 1, 4, "mercury");
  expect(restored.activeSlot).toBe(4);
  expect(restored.slots[3].document.appearance.mercury.logo.hue).toBe(39);
  expect(restored.slots[3].document.palette.activeSlotId).toBe(3);
  expect(restored.archive).toHaveLength(original.archive.length + 1);
  expect(restored.archive.at(-1)?.document).toEqual(oldTarget.document);
  expect(restored.archive[1]).toEqual(original.archive[1]);
  expect(original.slots[3]).toEqual(oldTarget);
  working.saveMonoSevenLibrary(store, { ...restored, generation: original.generation + 1 }, original.generation);
  expect(working.loadMonoSevenLibrary(store)?.slots[3].document).toEqual(restored.slots[3].document);
});
