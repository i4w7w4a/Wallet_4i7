import { describe, expect, it } from "vitest";

import { gemSmokeSchema, heatmapSchema, liquidMetalSchema, pulsingBorderSchema } from "./schema";

describe("Paper material schemas", () => {
  const schemas = [liquidMetalSchema, pulsingBorderSchema, gemSmokeSchema, heatmapSchema];

  it("exposes every saved parameter as one grouped control", () => {
    for (const schema of schemas) {
      const keys = Object.keys(schema.defaults);
      expect(schema.controls.map((control) => control.key).sort()).toEqual(keys.sort());
      expect(schema.controls.every((control) => control.group)).toBe(true);
      expect(schema.parse(schema.defaults).ok).toBe(true);
    }
  });

  it("accepts user colors and alpha without reducing them to preset palette names", () => {
    const border = pulsingBorderSchema.parse({
      ...pulsingBorderSchema.defaults,
      colorBack: "#10203040",
      colors: ["#123456", "#abcdef80", "#aabbcc"],
    });
    expect(border.ok && border.value.colors).toEqual(["#123456", "#abcdef80", "#aabbcc"]);
    const heat = heatmapSchema.parse({
      ...heatmapSchema.defaults,
      colors: ["#ff0000", "#00ff00", "#0000ff", "#ffffffff"],
    });
    expect(heat.ok && heat.value.colors).toHaveLength(4);
  });

  it("rejects unknown fields, nonfinite numbers and oversized palettes", () => {
    expect(liquidMetalSchema.parse({ ...liquidMetalSchema.defaults, shaderCode: "void main(){}" }).ok).toBe(false);
    expect(liquidMetalSchema.parse({ ...liquidMetalSchema.defaults, repetition: Infinity }).ok).toBe(false);
    expect(gemSmokeSchema.parse({ ...gemSmokeSchema.defaults, colors: Array(7).fill("#ffffff") }).ok).toBe(false);
    expect(pulsingBorderSchema.parse({ ...pulsingBorderSchema.defaults, colors: [] }).ok).toBe(false);
  });

  it("preserves valid imported precision and a static phase", () => {
    const parsed = liquidMetalSchema.parse({ ...liquidMetalSchema.defaults, speed: 0, phaseMs: 371.125, contour: 0.34567 });
    expect(parsed.ok && parsed.value).toMatchObject({ speed: 0, phaseMs: 371.125, contour: 0.34567 });
  });
});
