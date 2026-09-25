import { describe, expect, it } from "vitest";
import { planFluidV2Allocation } from "./quality";

describe("Fluid v2 runtime quality policy", () => {
  it("counts both six-pigment dye banks, pressure, display, bloom and sunrays before allocation", () => {
    const plan = planFluidV2Allocation(585, 1266, 8192, 28 * 1024 * 1024, "balanced")!;
    expect(plan.simulation).toEqual({ width: 118, height: 256 });
    expect(plan.dye).toEqual({ width: 237, height: 512 });
    expect(plan.pressureIterations).toBe(20);
    expect(plan.targetCount).toBe(20);
    expect(plan.bloom).toHaveLength(6);
    const simPixels = plan.simulation.width * plan.simulation.height;
    const dyePixels = plan.dye.width * plan.dye.height;
    const displayPixels = plan.output.width * plan.output.height;
    const bloomPixels = plan.bloom.reduce((sum, size) => sum + size.width * size.height, 0);
    const rayPixels = plan.sunrays.width * plan.sunrays.height;
    expect(plan.bytes).toBe(16 * simPixels + 32 * dyePixels + 4 * displayPixels + 8 * bloomPixels + 6 * rayPixels);
    expect(plan.bytes).toBeLessThan(28 * 1024 * 1024);
  });

  it("downshifts detail profile to the host memory limit, keeping all physics passes", () => {
    const large = planFluidV2Allocation(1440, 900, 4096, 28 * 1024 * 1024, "detail")!;
    const tight = planFluidV2Allocation(1440, 900, 4096, 4 * 1024 * 1024, "detail")!;
    expect(tight.bytes).toBeLessThanOrEqual(4 * 1024 * 1024);
    expect(tight.dye.width).toBeLessThan(large.dye.width);
    expect(tight.pressureIterations).toBe(20);
    expect(tight.targetCount).toBe(20);
    expect(tight.output.width / tight.output.height).toBeCloseTo(1.6, 1);
  });

  it("caps each target and refuses impossible budget or invalid dimensions", () => {
    const plan = planFluidV2Allocation(100000, 10, 256, 2 * 1024 * 1024, "economy")!;
    for (const size of [plan.simulation, plan.dye, plan.output, ...plan.bloom, plan.sunrays]) {
      expect(size.width).toBeLessThanOrEqual(256);
      expect(size.height).toBeGreaterThanOrEqual(1);
    }
    expect(planFluidV2Allocation(390, 844, 4096, 32, "balanced")).toBeNull();
    expect(planFluidV2Allocation(0, 844, 4096, 8e6, "balanced")).toBeNull();
    expect(planFluidV2Allocation(390, Infinity, 4096, 8e6, "balanced")).toBeNull();
    expect(planFluidV2Allocation(390, 844, NaN, 8e6, "balanced")).toBeNull();
  });
});
