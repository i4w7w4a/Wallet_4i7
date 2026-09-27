// @vitest-environment node
import { expect, it } from "vitest";
import { DEFAULT_BACKGROUND_EDGE_FINISH, materialCatalogV2 } from "@wallet/ui";
import { createFirstMonoWorkingDocument } from "./mono-first-button-preset";
import { createEmptyMonoMaterials } from "./mono-material-preset";
import { createMonoAppearanceEnvelope, createMonoAppearanceFromDocument,
  normalizeMonoAppearanceEnvelope } from "./mono-preset-envelope";
import { createMonoShareUrl, readMonoShareFragment } from "./mono-share-codec";
import { decodeMonoSharePayload } from "./mono-share-transport";
import { createDefaultActionArtworkMap } from "./action-artwork/model";

const fluid = () => materialCatalogV2.materials.find(item => item.id === "fluid")!.presets[0]!.recipe;
const artwork = () => { const map = createDefaultActionArtworkMap();
  map["quick.buy"] = { ...map["quick.buy"], packId: "contour-v1",
    energy: { enabled: true, intensity: 0.65, durationMs: 800, width: 0.3 } };
  return map; };

it("shares the accepted First iridescence bindings as one selected-direction snapshot", async () => {
  const document = createFirstMonoWorkingDocument();
  document.palette.slots[0].present.config.seed = "private-sender-seed";
  document.materials.frost = { background: { version: 1, recipe: fluid(),
    edgeFinish: DEFAULT_BACKGROUND_EDGE_FINISH }, buttons: null };
  const original = structuredClone(document);
  const envelope = createMonoAppearanceFromDocument(document, "ledger");
  expect(envelope.version).toBe(4);
  expect(envelope.material).toEqual(original.materials.ledger);
  expect(envelope.appearance.preset).toBe("ledger");
  const link = await createMonoShareUrl(envelope, "https://wallet.example");
  expect(link.length).toBeLessThan(16_384);
  expect(await readMonoShareFragment(new URL(link).hash)).toEqual(envelope);
  const payload = JSON.parse(await decodeMonoSharePayload(new URL(link).hash.slice(6)));
  expect(Object.keys(payload).sort()).toEqual(["appearance", "kind", "material", "skinId", "version"]);
  expect(JSON.stringify(payload)).not.toMatch(/private-sender-seed|profile|address|balanceHidden|history|localStorage|frost/);
  expect(document).toEqual(original);
  document.materials.ledger = createEmptyMonoMaterials().ledger;
  expect((await readMonoShareFragment(new URL(link).hash)).material).toEqual(original.materials.ledger);
});

it.each(["group", "separate", "icons"] as const)("roundtrips fluid background, edge finish and %s button frame", async frameMode => {
  const document = createFirstMonoWorkingDocument();
  document.materials.ledger = { background: { version: 1, recipe: fluid(),
    edgeFinish: DEFAULT_BACKGROUND_EDGE_FINISH },
    buttons: { version: 2, frameMode, bindings: document.materials.ledger.buttons!.bindings } };
  const envelope = createMonoAppearanceFromDocument(document, "ledger");
  const link = await createMonoShareUrl(envelope, "https://wallet.example");
  expect(link.length).toBeLessThan(16_384);
  expect((await readMonoShareFragment(new URL(link).hash)).material).toEqual(document.materials.ledger);
});

it("accepts strict old v2 links with an empty material and rejects hybrid payloads", () => {
  const current = createMonoAppearanceEnvelope();
  const legacy = { kind: current.kind, version: 2, skinId: current.skinId, appearance: current.appearance };
  expect(normalizeMonoAppearanceEnvelope(legacy).material).toEqual({ background: null, buttons: null });
  expect(() => normalizeMonoAppearanceEnvelope({ ...legacy, material: current.material })).toThrow();
  expect(() => normalizeMonoAppearanceEnvelope({ ...current, material: undefined })).toThrow();
  expect(() => normalizeMonoAppearanceEnvelope({ ...current, futureField: true })).toThrow();
});

it("shares selected artwork exactly and maps old v3 links to Original", async () => {
  const document = createFirstMonoWorkingDocument();
  document.materials.ledger = { ...document.materials.ledger, buttons: { version: 3, frameMode: "icons",
    bindings: document.materials.ledger.buttons!.bindings, artwork: artwork() } };
  const envelope = createMonoAppearanceFromDocument(document, "ledger");
  expect(envelope.version).toBe(4);
  const link = await createMonoShareUrl(envelope, "https://wallet.example");
  expect((await readMonoShareFragment(new URL(link).hash)).material.buttons).toEqual(document.materials.ledger.buttons);
  const old = { ...envelope, version: 3, material: { ...envelope.material,
    buttons: { version: 2, frameMode: "icons", bindings: envelope.material.buttons!.bindings } } };
  expect(normalizeMonoAppearanceEnvelope(old).material.buttons).toEqual(old.material.buttons);
  expect(() => normalizeMonoAppearanceEnvelope({ ...old, material: envelope.material })).toThrow();
});

it("rejects unknown targets, recipes, numeric corruption and code in material links", () => {
  const document = createFirstMonoWorkingDocument();
  document.materials.ledger = { background: { version: 1, recipe: fluid(),
    edgeFinish: DEFAULT_BACKGROUND_EDGE_FINISH }, buttons: document.materials.ledger.buttons };
  const original = createMonoAppearanceFromDocument(document, "ledger");
  type CorruptCandidate = { material: { buttons: { bindings: Record<string, unknown>[] };
    background: { recipe: Record<string, unknown>; edgeFinish: Record<string, unknown>;
      [key: string]: unknown } } };
  const changed = (edit: (copy: CorruptCandidate) => void) => {
    const copy = structuredClone(original) as unknown as CorruptCandidate;
    edit(copy);
    expect(() => normalizeMonoAppearanceEnvelope(copy)).toThrow();
  };
  changed(copy => { copy.material.buttons.bindings[0].targetId = "profile.address"; });
  changed(copy => { copy.material.background.recipe.effectId = "remote-shader"; });
  changed(copy => { copy.material.background.edgeFinish.softness = 1e9; });
  changed(copy => { copy.material.background.css = "body{display:none}"; });
  changed(copy => { copy.material.background.url = "https://evil.example/shader"; });
});
