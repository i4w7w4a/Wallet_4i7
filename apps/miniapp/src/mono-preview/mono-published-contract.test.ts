import { describe, expect, it } from "vitest";
import { DEFAULT_BACKGROUND_EDGE_FINISH, FLUID_VIEWPORT_RESPONSE_DEFAULTS, materialCatalogV2 } from "@wallet/ui";
import { createMonoAppearanceEnvelope, createMonoAppearanceFromDocument } from "./mono-preset-envelope";
import { createMonoWorkingDocument } from "./mono-working-presets";
import { parsePublishedSlot, parsePublishBody } from "./mono-published-contract";

describe("fixed public MONO slots", () => {
  it.each(["1", "2", "3", "4", "5", "6", "7"])("accepts only the canonical route /p/%s", raw => {
    expect(parsePublishedSlot(raw)).toBe(Number(raw));
  });

  it.each(["0", "8", "01", "+1", "1.0", "1/extra", "x", "", " 1 "])("rejects invalid route segment %j", raw => {
    expect(() => parsePublishedSlot(raw)).toThrow();
  });

  it("accepts an exact revision and normalized envelope without private fields", () => {
    const snapshot = createMonoAppearanceEnvelope();
    const parsed = parsePublishBody({ expectedRevision: 0, snapshot });
    expect(parsed).toEqual({ expectedRevision: 0, snapshot });
    expect(parsed.snapshot).not.toBe(snapshot);
  });

  it("accepts a strict v4 snapshot with nested Fluid viewport response for public slot 2", () => {
    const document = createMonoWorkingDocument();
    const fluid = materialCatalogV2.materials.find(item => item.id === "fluid")!.presets[0]!.recipe;
    document.materials.ledger = { ...document.materials.ledger, background: { version: 2,
      recipe: fluid, edgeFinish: DEFAULT_BACKGROUND_EDGE_FINISH,
      viewportResponse: { ...FLUID_VIEWPORT_RESPONSE_DEFAULTS, enabled: true } } };
    const snapshot = createMonoAppearanceFromDocument(document);
    expect(parsePublishBody({ expectedRevision: 1, snapshot }).snapshot).toEqual(snapshot);
    expect(() => parsePublishBody({ expectedRevision: 1, snapshot: {
      ...snapshot, material: { ...snapshot.material, background: {
        ...snapshot.material.background, viewportResponse: { version: 1, enabled: true, strength: 2 },
      } },
    } })).toThrow();
  });

  it.each([
    { expectedRevision: -1, snapshot: createMonoAppearanceEnvelope() },
    { expectedRevision: 1.2, snapshot: createMonoAppearanceEnvelope() },
    { expectedRevision: Infinity, snapshot: createMonoAppearanceEnvelope() },
    { expectedRevision: Number.MAX_SAFE_INTEGER, snapshot: createMonoAppearanceEnvelope() },
    { expectedRevision: 0, snapshot: { ...createMonoAppearanceEnvelope(), walletSnapshot: { balance: 123 } } },
    { expectedRevision: 0, snapshot: createMonoAppearanceEnvelope(), workspace: {} },
    { expectedRevision: 0, snapshot: null },
  ])("rejects malformed publish payload %#", value => {
    expect(() => parsePublishBody(value)).toThrow();
  });
});
