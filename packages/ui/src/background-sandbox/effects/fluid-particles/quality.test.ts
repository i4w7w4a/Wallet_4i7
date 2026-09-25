import { describe, expect, it } from "vitest";

describe("fluid particle GPU budget", () => {
  it("keeps desktop rendering bounded while retaining the source density grid", async () => {
    const api = await import("./quality").catch(() => null);
    const plan = api?.planParticleAllocation(
      { pixelWidth: 1920, pixelHeight: 1080 },
      { maxTextureSize: 4096, maxRenderTargetBytes: 28 * 1024 * 1024 },
    );
    expect(plan).toMatchObject({
      profile: "standard", grid: [32, 16, 16], particleCount: 30720,
      output: { width: 960, height: 540 },
    });
    expect(plan!.bytes).toBeLessThanOrEqual(28 * 1024 * 1024);
  });

  it("uses a smaller bounded profile when the material budget shrinks", async () => {
    const api = await import("./quality").catch(() => null);
    const plan = api?.planParticleAllocation(
      { pixelWidth: 1920, pixelHeight: 1080 },
      { maxTextureSize: 640, maxRenderTargetBytes: 8 * 1024 * 1024 },
    );
    expect(plan).toMatchObject({ profile: "compact", grid: [24, 12, 12] });
    expect(plan!.particleCount).toBeLessThan(30720);
    expect(plan!.output.width).toBeLessThanOrEqual(640);
    expect(plan!.bytes).toBeLessThanOrEqual(8 * 1024 * 1024);
  });

  it("refuses an allocation that cannot hold the solver and render passes", async () => {
    const api = await import("./quality").catch(() => null);
    expect(api?.planParticleAllocation(
      { pixelWidth: 390, pixelHeight: 844 },
      { maxTextureSize: 4096, maxRenderTargetBytes: 1024 * 1024 },
    )).toBeNull();
  });
});
