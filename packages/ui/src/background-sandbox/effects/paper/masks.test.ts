import { describe, expect, it } from "vitest";

import { createPaperMaskCache, prepareHeatmapMask, prepareHeatmapMaskAsync, preparePoissonMask, preparePoissonMaskAsync, resolvePaperMaskSize } from "./masks";

describe("Paper mask preparation", () => {
  it("bounds a background mask while preserving the source aspect ratio", () => {
    expect(resolvePaperMaskSize(1920, 1080, 1920, 1080)).toEqual({ width: 256, height: 144 });
    expect(resolvePaperMaskSize(44, 44, 24, 24)).toEqual({ width: 66, height: 66 });
  });

  it("rejects an oversized source before allocating solver buffers", () => {
    expect(() => preparePoissonMask({ width: 4096, height: 4096, alpha: new Uint8Array(16) })).toThrow(/size/i);
  });

  it("preserves alpha and makes the center of a solid shape deeper than its edge", () => {
    const alpha = new Uint8Array(7 * 7);
    for (let y = 1; y <= 5; y++) for (let x = 1; x <= 5; x++) alpha[y * 7 + x] = 255;
    alpha[1 * 7 + 1] = 128;
    const result = preparePoissonMask({ width: 7, height: 7, alpha });
    const at = (x: number, y: number, channel: number) => result.data[(y * 7 + x) * 4 + channel];
    expect(at(0, 0, 0)).toBe(255);
    expect(at(0, 0, 1)).toBe(0);
    expect(at(1, 1, 1)).toBe(128);
    expect(at(3, 3, 0)).toBeLessThan(at(1, 3, 0)!);
    expect(at(3, 3, 0)).toBeLessThan(255);
    expect(at(3, 3, 3)).toBe(255);
  });

  it("keeps empty and one-pixel shapes finite", () => {
    const empty = preparePoissonMask({ width: 3, height: 3, alpha: new Uint8Array(9) });
    expect([...empty.data].every(Number.isFinite)).toBe(true);
    const thin = new Uint8Array(9);
    thin[4] = 255;
    const result = preparePoissonMask({ width: 3, height: 3, alpha: thin });
    expect(result.data[4 * 4]).toBe(0);
    expect(result.data[4 * 4 + 1]).toBe(255);
  });

  it("uses luminance composited on white for Heatmap instead of alpha alone", () => {
    const rgba = new Uint8Array([
      255, 255, 255, 255,
      0, 0, 0, 255,
      0, 0, 0, 0,
    ]);
    const result = prepareHeatmapMask({ width: 3, height: 1, rgba });
    expect(result.data[0]).toBe(255);
    expect(result.data[4]).toBeLessThan(255);
    expect(result.data[8]).toBe(255);
    expect(result.data[3]).toBe(255);
  });

  it("prepares Poisson and blur masks without holding the event loop until completion", async () => {
    const alpha = new Uint8Array(32 * 32).fill(255);
    let ticked = false;
    setTimeout(() => { ticked = true; }, 0);
    const poisson = await preparePoissonMaskAsync({ width: 32, height: 32, alpha });
    expect(ticked).toBe(true);
    expect(poisson.data).toEqual(preparePoissonMask({ width: 32, height: 32, alpha }).data);

    const rgba = new Uint8Array(32 * 32 * 4);
    ticked = false;
    setTimeout(() => { ticked = true; }, 0);
    const heatmap = await prepareHeatmapMaskAsync({ width: 32, height: 32, rgba });
    expect(ticked).toBe(true);
    expect(heatmap.data).toEqual(prepareHeatmapMask({ width: 32, height: 32, rgba }).data);
  });

  it("caches geometry and asset revision, independently of color edits", async () => {
    const cache = createPaperMaskCache(200);
    let calls = 0;
    const make = async () => {
      calls++;
      return { width: 2, height: 2, data: new Uint8Array(16) };
    };
    const key = "metal:send:v1:66x66";
    expect(await cache.getOrPrepare(key, make)).toBe(await cache.getOrPrepare(key, make));
    expect(calls).toBe(1);
    await cache.getOrPrepare("metal:send:v2:66x66", make);
    expect(calls).toBe(2);
    cache.clear();
    await cache.getOrPrepare(key, make);
    expect(calls).toBe(3);
  });
});
