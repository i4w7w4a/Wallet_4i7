import { describe, expect, it } from "vitest";
import { FLUID_DEFAULTS, parseFluidParams } from "../schema";
import { FLUID_V2_BOUNDS, FLUID_V2_DEFAULTS, fluidV2Schema, parseFluidV2Params } from "./schema";

describe("Fluid v2 recipe boundary", () => {
  it("keeps the built-in palette stable when a consumer attempts to mutate it", () => {
    const original = [...FLUID_V2_DEFAULTS.colors];
    expect(() => { (FLUID_V2_DEFAULTS.colors as string[])[0] = "#000000"; }).toThrow();
    expect(FLUID_V2_DEFAULTS.colors).toEqual(original);
  });
  it("exposes every artistic field in grouped controls from the same bounds used by parsing", () => {
    expect(fluidV2Schema.controls).toHaveLength(20);
    expect(new Set(fluidV2Schema.controls.map((control) => control.key)).size).toBe(20);
    for (const control of fluidV2Schema.controls) {
      expect(control.group).toBeTruthy();
      if (control.kind === "range") expect(control).toMatchObject(FLUID_V2_BOUNDS[control.key as keyof typeof FLUID_V2_BOUNDS]);
    }
    expect(fluidV2Schema.controls.find((control) => control.key === "colors")).toMatchObject({ kind: "color-list", minItems: 1, maxItems: 6, group: "color" });
    expect(fluidV2Schema.parse(FLUID_V2_DEFAULTS)).toEqual({ ok: true, value: FLUID_V2_DEFAULTS });
  });
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
    expect(output.colors).not.toBe(input.colors);
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

  it("rejects sparse, decorated and accessor color arrays before they reach GPU uniforms", () => {
    const sparse = ["#112233", , "#445566"];
    const decorated = ["#112233"] as string[] & { extra?: string };
    decorated.extra = "#000000";
    const accessor = ["#112233"];
    Object.defineProperty(accessor, "0", { get() { throw new Error("must not execute"); } });
    for (const colors of [sparse, decorated, accessor]) {
      expect(() => parseFluidV2Params({ ...FLUID_V2_DEFAULTS, colors })).not.toThrow();
      expect(parseFluidV2Params({ ...FLUID_V2_DEFAULTS, colors })).toBeNull();
    }
  });

  it("rejects symbol and accessor parameter fields rather than reading executable properties", () => {
    const value: Record<string | symbol, unknown> = { ...FLUID_V2_DEFAULTS };
    value[Symbol("hidden")] = 1;
    expect(parseFluidV2Params(value)).toBeNull();
    const getter: Record<string, unknown> = { ...FLUID_V2_DEFAULTS };
    Object.defineProperty(getter, "mode", { enumerable: true, get() { throw new Error("must not execute"); } });
    expect(() => parseFluidV2Params(getter)).not.toThrow();
    expect(parseFluidV2Params(getter)).toBeNull();
  });
});
