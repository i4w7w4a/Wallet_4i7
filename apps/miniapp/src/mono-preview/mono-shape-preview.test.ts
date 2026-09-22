import { describe, expect, it } from "vitest";

import { createMonoShapeDefaults, loadMonoShapeCandidate, loadMonoShapeCandidateFrom } from "./mono-shape-preview";

describe("MONO shape preview candidate", () => {
  it("falls back to built-in defaults when the stored JSON is corrupt", () => {
    const storage = {
      getItem: () => "{broken-json",
      setItem: () => undefined,
    };

    expect(loadMonoShapeCandidate(storage)).toEqual(createMonoShapeDefaults());
  });

  it("rejects an oversized record before using its values", () => {
    const storage = {
      getItem: () => JSON.stringify({
        version: 1,
        skinId: "mono-ledger-v1",
        presets: {
          ledger: { "quick-actions": 20, "bottom-navigation": 16 },
          frost: { "quick-actions": 19, "bottom-navigation": 0 },
          mercury: { "quick-actions": 14, "bottom-navigation": 0 },
        },
        padding: "x".repeat(10_000),
      }),
      setItem: () => undefined,
    };

    expect(loadMonoShapeCandidate(storage)).toEqual(createMonoShapeDefaults());
  });

  it("falls back when acquiring browser storage itself throws", () => {
    expect(loadMonoShapeCandidateFrom(() => {
      throw new DOMException("blocked", "SecurityError");
    })).toEqual(createMonoShapeDefaults());
  });
});
