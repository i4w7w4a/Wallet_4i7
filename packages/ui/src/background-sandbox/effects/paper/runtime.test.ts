import { describe, expect, it } from "vitest";

import { advancePaperClock, planPaperPass, toPaperRgba } from "./runtime";

describe("Paper pass contract", () => {
  it("decodes editable RGB and RGBA colors for shader uniforms", () => {
    expect(toPaperRgba("#204060")).toEqual([32 / 255, 64 / 255, 96 / 255, 1]);
    expect(toPaperRgba("#00000080")).toEqual([0, 0, 0, 128 / 255]);
  });

  it("advances by active dt, so a speed slider change does not jump phase", () => {
    const first = advancePaperClock(1, 0.5, 0.25, 0, 0);
    expect(first).toBe(1.125);
    expect(advancePaperClock(first, 0, 1.5, 0, 0)).toBe(first);
    expect(advancePaperClock(first, 0.5, 1.5, 0, 0)).toBe(1.875);
    expect(advancePaperClock(first, 0, 0.25, 1000, 0)).toBe(2.125);
  });

  it("accounts for one RGBA8 output and its owned texture before GPU allocation", () => {
    const plan = planPaperPass({ width: 64, height: 48, textureBytes: 64 * 48 * 4 + 4,
      maxTextureSize: 512, maxRenderTargetBytes: 100000 });
    expect(plan).toMatchObject({ ok: true, value: {
      attachmentBytes: 64 * 48 * 4, textureBytes: 64 * 48 * 4 + 4, passesPerFrame: 1,
    } });
    expect(planPaperPass({ width: 600, height: 48, textureBytes: 4,
      maxTextureSize: 512, maxRenderTargetBytes: 100000 }).ok).toBe(false);
  });
});
