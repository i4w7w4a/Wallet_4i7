import { describe, expect, it } from "vitest";
import { createMonoTypographyDefaults } from "./mono-typography";
import { loadMonoTypography } from "./mono-font-loader";

describe("local font readiness", () => {
  it("requires every selected real weight before returning an applicable config", async () => {
    const requested: string[] = [];
    const config = createMonoTypographyDefaults("frost");
    const result = await loadMonoTypography(config, { load: async font => { requested.push(font); return [{} as FontFace]; } });
    expect(result).toEqual(config);
    expect(requested).toContain('600 16px "Mono Plex Sans"');
    expect(requested).toContain('500 16px "Mono Golos Text"');
    expect(requested.some(font => /Onest|Manrope|Source/.test(font))).toBe(false);
  });

  it("rejects a silently missing face instead of applying fallback as the selected font", async () => {
    await expect(loadMonoTypography(createMonoTypographyDefaults(), { load: async () => [] })).rejects.toThrow();
  });

  it("rejects an invalid input before any loading and propagates actual font failures", async () => {
    await expect(loadMonoTypography({ ...createMonoTypographyDefaults(), primaryFontId: "https://invalid" }, { load: async () => { throw new Error("should not load"); } })).rejects.toThrow("Недопустимый");
    await expect(loadMonoTypography(createMonoTypographyDefaults(), { load: async () => { throw new Error("offline"); } })).rejects.toThrow("offline");
  });
});
