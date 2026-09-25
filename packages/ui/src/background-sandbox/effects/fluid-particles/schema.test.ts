import { describe, expect, it } from "vitest";
import { PARTICLE_DEFAULTS, particleSchema } from "./schema";

describe("fluid particle artistic schema", () => {
  it("accepts a very slow flow with freely chosen particle and background colors", () => {
    const parsed = particleSchema.parse({ ...PARTICLE_DEFAULTS,
      timeScale: 0.005, particleColor: "#aBc123", backgroundColor: "#102030" });
    expect(parsed).toMatchObject({ ok: true, value: { timeScale: 0.005,
      particleColor: "#ABC123", backgroundColor: "#102030" } });
  });

  it("rejects out-of-range physics and unrecognized fields", () => {
    expect(particleSchema.parse({ ...PARTICLE_DEFAULTS, flipRatio: 1 }).ok).toBe(false);
    expect(particleSchema.parse({ ...PARTICLE_DEFAULTS, initialFill: 1 }).ok).toBe(false);
    expect(particleSchema.parse({ ...PARTICLE_DEFAULTS, shader: "remote" }).ok).toBe(false);
  });

  it("rejects malformed colors and nonplain objects", () => {
    expect(particleSchema.parse({ ...PARTICLE_DEFAULTS, particleColor: "red" }).ok).toBe(false);
    expect(particleSchema.parse(Object.assign(Object.create({ inherited: true }), PARTICLE_DEFAULTS)).ok).toBe(false);
  });

  it("keeps AO and shadow strength independently adjustable", () => {
    expect(particleSchema.parse({ ...PARTICLE_DEFAULTS, aoStrength: 0.2, shadowStrength: 0.8 }))
      .toMatchObject({ ok: true, value: { aoStrength: 0.2, shadowStrength: 0.8 } });
    expect(particleSchema.parse({ ...PARTICLE_DEFAULTS, aoStrength: 1.1 }).ok).toBe(false);
  });
});
