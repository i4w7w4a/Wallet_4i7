import { describe, expect, it } from "vitest";
import {
  createMonoTypographyDefaults, normalizeMonoTypography, validateMonoTypography,
  monoTypographyStyle,
} from "./mono-typography";

describe("MONO typography boundary", () => {
  it("rejects unknown versions and executable font names as a whole", () => {
    const good = createMonoTypographyDefaults();
    expect(validateMonoTypography(good)).toBe(true);
    expect(validateMonoTypography({ ...good, version: 2 })).toBe(false);
    expect(validateMonoTypography({ ...good, primaryFontId: 'url(https://font.invalid)' })).toBe(false);
    expect(validateMonoTypography({ ...good, css: 'color:red' })).toBe(false);
    expect(normalizeMonoTypography({ ...good, version: 2 })).toEqual(good);
  });

  it("keeps Golos on text while a verified tabular family owns financial numbers", () => {
    const frost = createMonoTypographyDefaults("frost");
    expect(frost.primaryFontId).toBe("golos-text");
    expect(frost.secondaryFontId).toBe("ibm-plex-sans");
    expect(frost.roles.balance.family).toBe("secondary");
    const bad = { ...frost, roles: { ...frost.roles, balance: { family: "primary", size: 52, weight: 600 } } };
    expect(validateMonoTypography(bad)).toBe(false);
    expect(normalizeMonoTypography(bad).roles.balance.family).toBe("secondary");
  });

  it("uses real static weights and safe finite sizes without mutating the input", () => {
    const config = createMonoTypographyDefaults("frost");
    const source = { ...config, bodyLineHeight: Number.NaN, roles: { ...config.roles,
      body: { family: "primary", weight: 530, size: 300 },
      mono: { family: "secondary", weight: 900, size: -12 },
    } };
    const normalized = normalizeMonoTypography(source);
    expect(normalized.roles.body).toEqual({ family: "primary", weight: 500, size: 18 });
    expect(normalized.roles.mono).toEqual({ family: "secondary", weight: 700, size: 11 });
    expect(normalized.bodyLineHeight).toBe(1.46);
    expect(source.roles.body.size).toBe(300);
  });

  it("rejects a font pair with uncovered currency signs and repairs it to a local companion", () => {
    const source = { ...createMonoTypographyDefaults("mercury"), secondaryFontId: "source-sans-3" };
    expect(validateMonoTypography(source)).toBe(false);
    expect(normalizeMonoTypography(source).secondaryFontId).toBe("ibm-plex-mono");
  });

  it("maps the numeric role to both the public and legacy CSS contracts", () => {
    const style = monoTypographyStyle(createMonoTypographyDefaults("frost"));
    expect(style["--mono-font-numeric"]).toContain('"Mono Plex Sans"');
    expect(style["--mono-type-balance-size"]).toBe("52px");
    expect(style["--mono-font-weight-balance"]).toBe(600);
  });
});
