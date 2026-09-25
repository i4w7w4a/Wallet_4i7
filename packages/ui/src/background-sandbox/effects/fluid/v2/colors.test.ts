import { describe, expect, it } from "vitest";
import { fluidHexToRgb, resolveFluidV2Colors } from "./colors";

describe("Fluid v2 editable six-color palette", () => {
  it("maps each saved swatch to a live dye channel, repeating shorter lists", () => {
    expect(resolveFluidV2Colors(["#FF0000", "#00FF00"], 100, 0)).toEqual([
      [1, 0, 0], [0, 1, 0], [1, 0, 0], [0, 1, 0], [1, 0, 0], [0, 1, 0],
    ]);
  });

  it("rotates existing pigment through the user palette smoothly in simulation time", () => {
    const swatches = ["#000000", "#FFFFFF"];
    expect(resolveFluidV2Colors(swatches, 0, 1)[0]).toEqual([0, 0, 0]);
    expect(resolveFluidV2Colors(swatches, 0.5, 1)[0]).toEqual([0.5, 0.5, 0.5]);
    expect(resolveFluidV2Colors(swatches, 1, 1)[0]).toEqual([1, 1, 1]);
    expect(resolveFluidV2Colors(swatches, 1, 0)[0]).toEqual([0, 0, 0]);
  });

  it("parses normalized background color independently of pigment alpha", () => {
    expect(fluidHexToRgb("#123456")).toEqual([18 / 255, 52 / 255, 86 / 255]);
  });
});
