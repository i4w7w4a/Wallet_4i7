import { describe, expect, it } from "vitest";
import { createMonoAppearanceEnvelope } from "./mono-preset-envelope";
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
