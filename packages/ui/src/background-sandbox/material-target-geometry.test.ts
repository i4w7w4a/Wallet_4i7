import { describe, expect, it } from "vitest";
import { resolveMaterialTargetGeometry, materialScissorRect } from "./material-target-geometry";

describe("live material target geometry", () => {
  it("projects a real DOM target into bottom-left scene coordinates and bounded physical pixels", () => {
    const geometry = resolveMaterialTargetGeometry(
      { left: 40, top: 100, width: 400, height: 800 },
      { left: 60, top: 700, width: 80, height: 100 },
      { cssWidth: 400, cssHeight: 800, pixelWidth: 600, pixelHeight: 1200, dpr: 1.5 },
      "button-fill", { kind: "rounded-rect" }, 12, 0,
    );

    expect(geometry).toEqual({ capability: "button-fill", x: 20, y: 100, width: 80, height: 100,
      pixelWidth: 120, pixelHeight: 150, dpr: 1.5,
      radiusCss: 12, borderWidthCss: 0, mask: { kind: "rounded-rect" } });
  });

  it("skips a target that is wholly outside the scene canvas", () => {
    expect(resolveMaterialTargetGeometry(
      { left: 0, top: 0, width: 100, height: 100 },
      { left: 150, top: 20, width: 20, height: 20 },
      { cssWidth: 100, cssHeight: 100, pixelWidth: 100, pixelHeight: 100, dpr: 1 },
      "button-fill", { kind: "rounded-rect" }, 12, 0,
    )).toBeNull();
  });

  it("rejects zero or nonfinite target dimensions before asking an adapter to plan textures", () => {
    const viewport = { cssWidth: 100, cssHeight: 100, pixelWidth: 100, pixelHeight: 100, dpr: 1 };
    expect(resolveMaterialTargetGeometry(
      { left: 0, top: 0, width: 100, height: 100 },
      { left: 10, top: 10, width: 0, height: 20 }, viewport,
      "button-fill", { kind: "rounded-rect" }, 12, 0,
    )).toBeNull();
    expect(resolveMaterialTargetGeometry(
      { left: 0, top: 0, width: 100, height: 100 },
      { left: NaN, top: 10, width: 20, height: 20 }, viewport,
      "button-fill", { kind: "rounded-rect" }, 12, 0,
    )).toBeNull();
  });

  it("clips a partially visible target to physical canvas pixels for the shared compositor", () => {
    const viewport = { cssWidth: 100, cssHeight: 50, pixelWidth: 200, pixelHeight: 100, dpr: 2 };
    const geometry = { capability: "button-fill" as const, x: -10, y: 5, width: 30, height: 20,
      pixelWidth: 60, pixelHeight: 40, dpr: 2, radiusCss: 12, borderWidthCss: 0,
      mask: { kind: "rounded-rect" as const } };

    expect(materialScissorRect(geometry, viewport)).toEqual({ x: 0, y: 10, width: 40, height: 40 });
  });
});
