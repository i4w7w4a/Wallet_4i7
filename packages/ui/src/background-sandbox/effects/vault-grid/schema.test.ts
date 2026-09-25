import { describe, expect, it } from "vitest";
import {
  parseVaultGridParams,
  VAULT_GRID_PRESETS,
  vaultGridSchema,
} from "./schema";

const valid = {
  pattern: "tile",
  cellSize: 64,
  lineWidth: 4,
  bevel: 6,
  depth: 1.2,
  roughness: 0.38,
  lightAngle: -35,
  lightElevation: 42,
  lightStrength: 1.1,
  baseColor: "#182027",
  metalColor: "#8B9399",
  drift: 0,
};

describe("vault-grid parameter parsing", () => {
  it("accepts a complete recipe and canonicalizes editable hex colors", () => {
    expect(parseVaultGridParams(valid)).toEqual({
      ...valid,
      metalColor: "#8b9399",
    });
  });

  it("rejects missing, extra, and nonfinite fields without partial application", () => {
    expect(parseVaultGridParams({ ...valid, depth: Number.NaN })).toBeNull();
    expect(parseVaultGridParams({ ...valid, cellSize: 35 })).toBeNull();
    expect(parseVaultGridParams({ ...valid, lineWidth: 11 })).toBeNull();
    expect(parseVaultGridParams({ ...valid, depth: 0 })).toBeNull();
    expect(parseVaultGridParams({ ...valid, lightStrength: 0 })).toBeNull();
    expect(parseVaultGridParams({ ...valid, pattern: "checkerboard" })).toBeNull();
    expect(parseVaultGridParams({ ...valid, extra: "shader code" })).toBeNull();
    const missing: Record<string, unknown> = { ...valid };
    delete missing.roughness;
    expect(parseVaultGridParams(missing)).toBeNull();
  });

  it("rejects executable objects and non-hex colors", () => {
    const withGetter = Object.defineProperty({ ...valid }, "depth", {
      enumerable: true,
      get() { throw new Error("must not execute"); },
    });
    expect(parseVaultGridParams(withGetter)).toBeNull();
    expect(parseVaultGridParams({ ...valid, metalColor: "url(https://example.com/a)" })).toBeNull();
    expect(parseVaultGridParams(Object.assign(Object.create({ inherited: true }), valid))).toBeNull();
  });

  it("ships a genuinely different geometry for each material preset", () => {
    const patterns = VAULT_GRID_PRESETS.map(({ params }) => {
      expect(parseVaultGridParams(params)).not.toBeNull();
      return params.pattern;
    });
    expect(patterns).toEqual(["tile", "rib", "engraved"]);
  });

  it("exposes every working material parameter through grouped typed controls", () => {
    expect(vaultGridSchema.controls.map((control) => control.key).sort()).toEqual(Object.keys(valid).sort());
    expect(vaultGridSchema.controls.every((control) => Boolean(control.group))).toBe(true);
    expect(vaultGridSchema.controls.find((control) => control.key === "pattern")?.kind).toBe("select");
    expect(vaultGridSchema.controls.find((control) => control.key === "metalColor")?.kind).toBe("color");
    expect(vaultGridSchema.controls.find((control) => control.key === "drift")?.group).toBe("motion");
    expect(vaultGridSchema.parse(valid)).toEqual({ ok: true, value: { ...valid, metalColor: "#8b9399" } });
  });
});
