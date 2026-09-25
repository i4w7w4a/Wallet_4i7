import { describe, expect, it } from "vitest";
import { planMaterialSceneBudget } from "./material-scene-budget";

const MiB = 1024 * 1024;

describe("shared material scene budget", () => {
  it("counts all material attachments, textures, icon masks and the Promo reserve before allocation", () => {
    const result = planMaterialSceneBudget([
      { attachmentBytes: 20 * MiB, textureBytes: 1 * MiB, passesPerFrame: 12, quality: "balanced" },
      { attachmentBytes: 2 * MiB, textureBytes: 0, passesPerFrame: 1, quality: "balanced" },
    ], 256 * 1024);

    expect(result).toEqual({ ok: true, value: {
      materialBytes: 23 * MiB + 256 * 1024,
      promoReserveBytes: 4 * MiB,
      totalBytes: 27 * MiB + 256 * 1024,
      passesPerFrame: 13,
    } });
  });

  it("rejects passes that exceed the shared 32 MiB cap even when each pass fits alone", () => {
    const result = planMaterialSceneBudget([
      { attachmentBytes: 28 * MiB, textureBytes: 0, passesPerFrame: 20, quality: "balanced" },
      { attachmentBytes: 1 * MiB, textureBytes: 0, passesPerFrame: 1, quality: "balanced" },
    ], 0);

    expect(result).toMatchObject({ ok: false, error: { code: "budget-exceeded" } });
  });

  it("rejects nonfinite or fractional resource claims instead of accepting an unknown lease", () => {
    expect(planMaterialSceneBudget([
      { attachmentBytes: NaN, textureBytes: 0, passesPerFrame: 1, quality: "broken" },
    ], 0)).toMatchObject({ ok: false, error: { code: "invalid-config" } });
    expect(planMaterialSceneBudget([], 0.5)).toMatchObject({ ok: false, error: { code: "invalid-config" } });
  });
});
