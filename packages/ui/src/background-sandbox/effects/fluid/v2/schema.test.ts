import { describe, expect, it } from "vitest";
import { FLUID_DEFAULTS, parseFluidParams } from "../schema";
import { FLUID_V2_DEFAULTS, parseFluidV2Params } from "./schema";

describe("Fluid v2 recipe boundary", () => {
  it("preserves the old five-field Fluid v1 recipe without silently migrating it", () => {
    expect(parseFluidParams(FLUID_DEFAULTS)).toEqual(FLUID_DEFAULTS);
    expect(parseFluidV2Params(FLUID_DEFAULTS)).toBeNull();
    expect(parseFluidParams(FLUID_V2_DEFAULTS)).toBeNull();
  });

  it("roundtrips a complete artistic recipe and normalizes only allowlisted colors", () => {
    const input = { ...FLUID_V2_DEFAULTS, mode: "ambient", colors: ["#aabbcc", "#123456", "#fedcba", "#334455", "#667788", "#909090"], backgroundColor: "#0a0b0c", bloomEnabled: true, sunraysEnabled: true };
    const expected = { ...input, colors: ["#AABBCC", "#123456", "#FEDCBA", "#334455", "#667788", "#909090"], backgroundColor: "#0A0B0C" };
    expect(parseFluidV2Params(input)).toEqual(expected);
    expect(parseFluidV2Params(JSON.parse(JSON.stringify(expected)))).toEqual(expected);
    const output = parseFluidV2Params(input)!;
    output.colors[0] = "#000000";
    expect(input.colors[0]).toBe("#aabbcc");
  });

  it("rejects shader, remote asset, quality and partial fields atomically", () => {
    for (const extra of [{ shader: "void main(){}" }, { url: "https://example.org" }, { resolution: 4096 }, { pressureIterations: 1000 }, { pixels: [1, 2] }]) {
      expect(parseFluidV2Params({ ...FLUID_V2_DEFAULTS, ...extra })).toBeNull();
    }
    expect(parseFluidV2Params({ mode: "ambient" })).toBeNull();
    expect(parseFluidV2Params(null)).toBeNull();
    expect(parseFluidV2Params([])).toBeNull();
    expect(parseFluidV2Params(Object.create(FLUID_V2_DEFAULTS))).toBeNull();
  });

  it("rejects invalid modes, color counts/values and nonfinite physics", () => {
    for (const patch of [
      { mode: "hidden-emitter" }, { colors: [] }, { colors: Array(7).fill("#112233") },
      { colors: ["#123"] }, { colors: ["rgb(1,2,3)"] }, { backgroundColor: "url(x)" },
      { timeScale: Infinity }, { force: NaN }, { dyeDissipation: -1 },
      { velocityDissipation: 4.01 }, { pressureRetention: 1.01 },
      { ambientRate: 0 }, { colorAlpha: -0.1 }, { backgroundAlpha: 1.1 },
      { bloomEnabled: "true" }, { sunraysWeight: 5 },
    ]) expect(parseFluidV2Params({ ...FLUID_V2_DEFAULTS, ...patch })).toBeNull();
  });
});
