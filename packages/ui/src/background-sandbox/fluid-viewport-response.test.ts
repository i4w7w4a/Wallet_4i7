import { describe, expect, it } from "vitest";
import { FLUID_VIEWPORT_RESPONSE_BOUNDS, FLUID_VIEWPORT_RESPONSE_DEFAULTS,
  parseFluidViewportResponse } from "./fluid-viewport-response";

describe("Fluid viewport response contract", () => {
  it("starts off with the agreed bounded controls and preserves a complete valid value", () => {
    expect(FLUID_VIEWPORT_RESPONSE_DEFAULTS).toEqual({ version: 1, enabled: false,
      strength: 0.35, inertia: 0.45, edgeResponse: 0.35 });
    for (const bounds of Object.values(FLUID_VIEWPORT_RESPONSE_BOUNDS))
      expect(bounds).toEqual({ min: 0, max: 1, step: 0.01 });
    const input = { version: 1, enabled: true, strength: 0.82, inertia: 0.23, edgeResponse: 0 };
    const parsed = parseFluidViewportResponse(input);
    expect(parsed).toEqual(input);
    expect(parsed).not.toBe(input);
    expect(parseFluidViewportResponse(JSON.parse(JSON.stringify(parsed)))).toEqual(input);
  });

  it("rejects incomplete, unknown, out-of-range and off-step values instead of repairing them", () => {
    const good = FLUID_VIEWPORT_RESPONSE_DEFAULTS;
    for (const input of [null, [], {}, { ...good, version: 2 }, { ...good, enabled: 1 },
      { ...good, strength: -0.01 }, { ...good, inertia: 1.01 },
      { ...good, edgeResponse: Infinity }, { ...good, strength: NaN },
      { ...good, strength: 0.355 }, { ...good, shaderSource: "void main(){}" },
      { version: 1, enabled: false, strength: 0.35, inertia: 0.45 }]) {
      expect(parseFluidViewportResponse(input)).toBeNull();
    }
  });

  it("does not read accessor fields or accept inherited, symbol or decorated objects", () => {
    const good = FLUID_VIEWPORT_RESPONSE_DEFAULTS;
    const inherited = Object.create(good);
    const symbol = { ...good, [Symbol("hidden")]: true };
    const accessor = { ...good };
    Object.defineProperty(accessor, "strength", { enumerable: true, get() { throw new Error("must not execute"); } });
    for (const input of [inherited, symbol, accessor]) {
      expect(() => parseFluidViewportResponse(input)).not.toThrow();
      expect(parseFluidViewportResponse(input)).toBeNull();
    }
  });
});
