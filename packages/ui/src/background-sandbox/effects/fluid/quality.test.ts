import { describe, expect, it } from "vitest";
import { planFluidAllocation } from "./quality";

describe("Fluid allocation policy", () => {
  // Catches a forgotten ping-pong target or accidentally viewport-sized simulation.
  it("accounts for every attachment while bounding a large portrait viewport", () => {
    const plan = planFluidAllocation(1170, 2532, 8192, 8 * 1024 * 1024);
    expect(plan).not.toBeNull();
    expect(plan!.simulation).toEqual({ width: 118, height: 256 });
    expect(plan!.dye).toEqual({ width: 237, height: 512 });
    expect(plan!.output.width * plan!.output.height).toBeLessThanOrEqual(1024 * 1024);
    // 2 RG16F velocity + 4 R16F scalar + 2 RGBA16F dye + RGBA8 display.
    expect(plan!.bytes).toBe(16 * 118 * 256 + 16 * 237 * 512 + 4 * plan!.output.width * plan!.output.height);
    expect(plan!.bytes).toBeLessThanOrEqual(8 * 1024 * 1024);
  });

  it("reduces allocation to the host budget without removing the pressure solver", () => {
    const plan = planFluidAllocation(4000, 2000, 1024, 512 * 1024);
    expect(plan).not.toBeNull();
    expect(plan!.bytes).toBeLessThanOrEqual(512 * 1024);
    expect(plan!.pressureIterations).toBe(20);
    expect(plan!.simulationPasses).toBe(27);
    expect(plan!.output.width / plan!.output.height).toBeCloseTo(2, 1);
  });

  it("rejects invalid dimensions and budgets before allocating GPU memory", () => {
    for (const args of [[0, 10, 4096, 1e6], [NaN, 10, 4096, 1e6], [10, Infinity, 4096, 1e6], [10, 10, 0, 1e6], [10, 10, 4096, 16]]) {
      expect(planFluidAllocation(...args as [number, number, number, number])).toBeNull();
    }
  });

  it("respects texture caps even for extreme aspect ratios", () => {
    const plan = planFluidAllocation(100000, 10, 256, 1024 * 1024)!;
    for (const size of [plan.simulation, plan.dye, plan.output]) {
      expect(size.width).toBeLessThanOrEqual(256);
      expect(size.height).toBeGreaterThanOrEqual(1);
    }
    expect(plan.bytes).toBeLessThanOrEqual(1024 * 1024);
  });
});
