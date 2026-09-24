import { describe, expect, it } from "vitest";
import { FLUID_DEFAULTS, parseFluidParams } from "./schema";

describe("Fluid params boundary", () => {
  it("roundtrips a full independent recipe without field state", () => {
    const input = { force: 3200, radius: 0.3, curl: 24, dissipation: 1.1, palette: "copper" };
    expect(parseFluidParams(JSON.parse(JSON.stringify(input)))).toEqual(input);
    const parsed = parseFluidParams(input)!;
    parsed.force = 100;
    expect(input.force).toBe(3200);
    expect(parseFluidParams(FLUID_DEFAULTS)).toEqual(FLUID_DEFAULTS);
  });

  it("rejects extra executable, runtime quality, pixel, and partial fields atomically", () => {
    for (const extra of [{ shader: "void main(){}" }, { url: "https://example.org" }, { pixels: [1, 2] }, { pressureIterations: 1000 }, { seed: 1 }]) {
      expect(parseFluidParams({ ...FLUID_DEFAULTS, ...extra })).toBeNull();
    }
    expect(parseFluidParams({ force: 3000 })).toBeNull();
    expect(parseFluidParams(null)).toBeNull();
    expect(parseFluidParams([])).toBeNull();
    expect(parseFluidParams(Object.create(FLUID_DEFAULTS))).toBeNull();
  });

  it("rejects nonfinite, mistyped, out of bounds and unknown palette values", () => {
    for (const patch of [{ force: NaN }, { radius: Infinity }, { force: "3000" }, { force: -1 }, { force: 6001 }, { radius: 0 }, { radius: 1 }, { curl: 41 }, { dissipation: 0 }, { palette: "rainbow" }]) {
      expect(parseFluidParams({ ...FLUID_DEFAULTS, ...patch })).toBeNull();
    }
  });
});
