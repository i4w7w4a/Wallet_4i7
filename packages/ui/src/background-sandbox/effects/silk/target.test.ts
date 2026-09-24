import { describe, expect, it } from "vitest";
import { resolveSilkTarget } from "./target";

const viewport = { cssWidth: 390, cssHeight: 800, pixelWidth: 585, pixelHeight: 1200, dpr: 1.5 };
const limits = { maxTextureSize: 4096, maxRenderTargetBytes: 16 * 1024 * 1024 };

describe("Silk target budget", () => {
  it("accounts for exactly one RGBA8 physical-size target, independent of CSS dimensions", () => {
    expect(resolveSilkTarget(viewport, limits)).toEqual({ width: 585, height: 1200, bytes: 2808000 });
  });
  it("accepts the exact budget and rejects one byte less before allocation", () => {
    expect(resolveSilkTarget(viewport, { ...limits, maxRenderTargetBytes: 2808000 })).not.toBeNull();
    expect(resolveSilkTarget(viewport, { ...limits, maxRenderTargetBytes: 2807999 })).toBeNull();
  });
  it("rejects noninteger, unbounded or impossible extents without silently lowering quality", () => {
    for (const pixelWidth of [0, -1, NaN, Infinity, 100.5, 4097]) {
      expect(resolveSilkTarget({ ...viewport, pixelWidth }, limits)).toBeNull();
    }
    expect(resolveSilkTarget({ ...viewport, pixelHeight: 4097 }, limits)).toBeNull();
    expect(resolveSilkTarget(viewport, { ...limits, maxRenderTargetBytes: NaN })).toBeNull();
  });
});
