// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";
import { createMonoAppearanceEnvelope, normalizeMonoAppearanceEnvelope } from "./mono-preset-envelope";
import { createMonoShareUrl, readMonoShareFragment } from "./mono-share-codec";
import { decodeMonoSharePayload } from "./mono-share-transport";
import { createMonoWorkingDocument, exportMonoWorkingPreset, loadMonoWorkingLibrary,
  MONO_WORKING_PRESETS_KEY, previewMonoWorkingImport } from "./mono-working-presets";

const fixture = (name: string) => readFileSync(resolve(process.cwd(), "src/mono-preview/fixtures", name), "utf8");
const defaults = { eye: { blinkEnabled: true }, navigation: {
  indicator: "original", glowPercent: 0, softnessPx: 0, shimmerEnabled: false, periodSeconds: 6,
} };

it("reads the captured f979 library without writing it or losing selected data and materials", () => {
  const raw = fixture("f979-library-v2.json");
  const values = new Map([[MONO_WORKING_PRESETS_KEY, raw]]);
  const store = { getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, text: string) => values.set(key, text) };
  const library = loadMonoWorkingLibrary(store)!;
  expect(library.activeId).toBe("f979-selected");
  expect(library.records[0].revision).toBe(4);
  expect(library.records[0].document.version).toBe(5);
  expect(library.records[0].document.appearance.ledger).toMatchObject(defaults);
  expect(library.records[0].document.appearance.ledger.balance.composition).toBe("centered");
  expect(library.records[0].document.materials.ledger.buttons?.bindings).toHaveLength(4);
  expect(values.get(MONO_WORKING_PRESETS_KEY)).toBe(raw);
});

it("imports captured f979 full JSON, then roundtrips new fields in version 5", async () => {
  const imported = await previewMonoWorkingImport(fixture("f979-working-v3.json"));
  expect(imported.document.version).toBe(5);
  expect(imported.document.appearance.frost).toMatchObject(defaults);
  expect(imported.document.appearance.frost.logo.hue).toBe(47);
  expect(imported.document.materials.ledger.buttons?.bindings).toHaveLength(4);
  imported.document.appearance.ledger.eye.blinkEnabled = false;
  imported.document.appearance.ledger.navigation = {
    indicator: "line", glowPercent: 35, softnessPx: 8, shimmerEnabled: true, periodSeconds: 7,
  };
  const exported = exportMonoWorkingPreset("Новый", imported.document);
  expect(JSON.parse(exported).version).toBe(5);
  expect((await previewMonoWorkingImport(exported)).document).toEqual(imported.document);
});

it("reads a real f979 share link and emits strict version 4 links with selected material only", async () => {
  const oldLink = fixture("f979-share-v1.txt").trim();
  const old = await readMonoShareFragment(new URL(oldLink).hash);
  expect(old.version).toBe(4);
  expect(old.material).toEqual({ background: null, buttons: null });
  expect(old.appearance).toMatchObject(defaults);
  expect(old.appearance.balance.composition).toBe("compact");
  expect(old.appearance.environment).toEqual({ theme: "light", background: "strata" });

  const fresh = createMonoAppearanceEnvelope();
  fresh.appearance.eye.blinkEnabled = false;
  fresh.appearance.navigation.indicator = "dot";
  const link = await createMonoShareUrl(fresh, "https://wallet.example");
  expect((await readMonoShareFragment(new URL(link).hash)).appearance).toEqual(fresh.appearance);
  const payload = JSON.parse(await decodeMonoSharePayload(new URL(link).hash.slice("#mono=".length)));
  expect(payload.version).toBe(4);
  expect(Object.keys(payload).sort()).toEqual(["appearance", "kind", "material", "skinId", "version"]);
  expect(Object.keys(payload.appearance).sort()).toEqual([
    "assets", "background", "balance", "chart", "environment", "eye", "layout", "logo",
    "navigation", "optics", "palette", "preset", "shape", "typography",
  ]);
  expect(JSON.stringify(payload)).not.toMatch(/profile|address|balanceHidden|forms|walletData/);
});

it("rejects hybrid legacy/new shapes, wrapper mismatches and unknown fields without defaulting them", async () => {
  const old = JSON.parse(fixture("f979-share-v1.json"));
  expect(() => normalizeMonoAppearanceEnvelope({ ...old, appearance: {
    ...old.appearance, eye: { blinkEnabled: false },
  } })).toThrow();
  expect(() => normalizeMonoAppearanceEnvelope({ ...old, appearance: {
    ...old.appearance, futureField: true,
  } })).toThrow();
  const oldExport = JSON.parse(fixture("f979-working-v3.json"));
  await expect(previewMonoWorkingImport(JSON.stringify({ ...oldExport, version: 4 }))).rejects.toThrow();
  await expect(previewMonoWorkingImport(JSON.stringify({ ...oldExport,
    document: { ...oldExport.document, version: 4 } }))).rejects.toThrow();
  const current = createMonoWorkingDocument();
  expect(current.version).toBe(5);
  expect(current.appearance.ledger).toMatchObject(defaults);
});
