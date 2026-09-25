import { describe, expect, it } from "vitest";

import { disabledPaperControls } from "./control-state";
import { gemSmokeSchema, heatmapSchema, liquidMetalSchema, pulsingBorderSchema } from "./schema";

describe("Paper dependent controls", () => {
  it("disables the smoke size when Border smoke is zero", () => {
    expect(disabledPaperControls("pulsing-border", pulsingBorderSchema.defaults)).toContain("smokeSize");
    expect(disabledPaperControls("pulsing-border", { ...pulsingBorderSchema.defaults, smoke: 0.5 })).not.toContain("smokeSize");
  });

  it("marks the source documented Gem and Heatmap glow dependencies", () => {
    expect(disabledPaperControls("gem-smoke", { ...gemSmokeSchema.defaults, outerGlow: 0 })).toContain("outerDistortion");
    expect(disabledPaperControls("heatmap", { ...heatmapSchema.defaults, innerGlow: 0, outerGlow: 0 })).toContain("angle");
  });

  it("disables procedural shape selection while a real action icon is the mask", () => {
    expect(disabledPaperControls("liquid-metal", liquidMetalSchema.defaults, "button-icon")).toContain("shape");
    expect(disabledPaperControls("liquid-metal", liquidMetalSchema.defaults, "button-fill")).not.toContain("shape");
  });
});
