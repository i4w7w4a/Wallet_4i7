import { describe, expect, it } from "vitest";
import { isGoldLiquidTunerLocation, normalizeGoldLiquidSettings, planGoldLiquidSize,
  serializeGoldLiquidSettings } from "./mono-gold-liquid-settings";

describe("Gold liquid settings consumer contract", () => {
  it("exports the provisional soft-water defaults without losing normalization or clean zero", () => {
    const defaults = JSON.parse(serializeGoldLiquidSettings(normalizeGoldLiquidSettings({})));
    expect(defaults.params).toMatchObject({ ior: -0.65, dispersion: 0.012, highlightStrength: 0.24 });
    const normalized = normalizeGoldLiquidSettings(defaults.params);
    expect(normalized).toEqual(defaults.params);
    expect(JSON.parse(serializeGoldLiquidSettings({ ...normalized, dispersion: 0 })).params.dispersion).toBe(0);
  });
  it("preserves clean zero optics and signed refraction through export", () => {
    const settings = normalizeGoldLiquidSettings({ ior: -0.83, cornerRadius: 0, dispersion: 0,
      edgeDarkening: 0, highlightStrength: 0, fieldStrength: 0, flowSpeed: 0, flowStrength: 0,
      fieldEnabled: false, fieldFadeMode: 0, arbitraryCss: "red" });
    const exported = JSON.parse(serializeGoldLiquidSettings(settings));
    expect(exported).toMatchObject({ version: 1, kind: "gold-liquid-local", params: {
      ior: -0.83, cornerRadius: 0, dispersion: 0, edgeDarkening: 0, highlightStrength: 0,
      fieldStrength: 0, flowSpeed: 0, flowStrength: 0, fieldEnabled: false, fieldFadeMode: 0,
    } });
    expect(exported.params).not.toHaveProperty("arbitraryCss");
    expect(JSON.parse(serializeGoldLiquidSettings({ ...settings, ior: 0 })).params.ior).toBe(0);
  });

  it("normalizes invalid values before they can reach GPU uniforms", () => {
    const settings = normalizeGoldLiquidSettings({ ior: -100, cornerRadius: 5, pixelRatio: 9,
      dispersion: NaN, flowSpeed: Infinity, fieldFadeMode: 3, fieldEnabled: "true" });
    expect(settings).toMatchObject({ ior: -3.05, cornerRadius: 0.18, pixelRatio: 1.5, fieldFadeMode: 1 });
    expect(Number.isFinite(settings.dispersion)).toBe(true);
    expect(Number.isFinite(settings.flowSpeed)).toBe(true);
    expect(typeof settings.fieldEnabled).toBe("boolean");
    expect(normalizeGoldLiquidSettings(null).ior).toBeLessThan(0);
  });

  it.each([[390, 844, 4], [480, 2000, 3], [8000, 8000, 8], [320, 50000, 2]])(
    "bounds %s × %s at device DPR %s without growing its GPU budget", (width, height, dpr) => {
      const size = planGoldLiquidSize(width, height, dpr, 3, 4096)!;
      expect(size).not.toBeNull();
      expect(size.width * size.height).toBeLessThanOrEqual(786432);
      expect(Math.max(size.width, size.height)).toBeLessThanOrEqual(2048);
      expect(size.dpr).toBeLessThanOrEqual(1.5);
      expect(size.width).toBeGreaterThan(0);
      expect(size.height).toBeGreaterThan(0);
    });
  it("uses the actual device ratio and hardware cap, and rejects zero geometry", () => {
    expect(planGoldLiquidSize(390, 844, 1, 1.5, 4096)).toMatchObject({ width: 390, height: 844, dpr: 1 });
    const hardwareSize = planGoldLiquidSize(2000, 1000, 2, 1.5, 512)!;
    expect(Math.max(hardwareSize.width, hardwareSize.height)).toBeLessThanOrEqual(512);
    expect(planGoldLiquidSize(0, 844, 2, 1.5, 4096)).toBeNull();
    expect(planGoldLiquidSize(NaN, 844, 2, 1.5, 4096)).toBeNull();
  });

  it.each([
    ["localhost", "?goldLiquidTuner=1", true], ["127.0.0.1", "?goldLiquidTuner=1", true],
    ["[::1]", "?goldLiquidTuner=1", true], ["localhost", "", false],
    ["localhost", "?goldLiquidTuner=0", false], ["wallet.153.76.194.160.nip.io", "?goldLiquidTuner=1", false],
    ["localhost.example.com", "?goldLiquidTuner=1", false], ["127.0.0.2", "?goldLiquidTuner=1", false],
  ])("requires explicit query and exact loopback hostname %s %s", (hostname, search, allowed) => {
    expect(isGoldLiquidTunerLocation({ hostname, search })).toBe(allowed);
  });
});
