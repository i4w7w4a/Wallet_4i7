import type { MaterialDefinition } from "../../material-contract";
import { createParticleEffect } from "./adapter";
import { planParticleAllocation } from "./quality";
import { PARTICLE_DEFAULTS, parseParticleParams, particleSchema, type ParticleParams } from "./schema";

export const particleDefinition: MaterialDefinition<"fluid-particles", ParticleParams> = {
  id: "fluid-particles", abiVersion: 2, effectVersion: 1,
  label: "Fluid Particles", description: "Объёмная PIC/FLIP жидкость: сферы, ambient occlusion и тени. Медленный поток может естественно успокоиться; Перезапуск возвращает стартовый объём.",
  capabilities: ["background"], schema: particleSchema,
  presets: [
    { id: "particles-calm", label: "Тихое растекание", seed: 147, params: PARTICLE_DEFAULTS },
    { id: "particles-source", label: "Исходная скорость · адаптация", seed: 147,
      params: { ...PARTICLE_DEFAULTS, timeScale: 1, camera: "front", backgroundColor: "#FFFFFF" } },
    { id: "particles-still", label: "Почти неподвижно", seed: 203,
      params: { ...PARTICLE_DEFAULTS, timeScale: 0.01, particleColor: "#C9B79D", backgroundColor: "#11151C", gravity: 28, camera: "high" } },
  ],
  assetIds: [],
  provenance: { id: "dli-fluid-ac3ee55", sourceUrl: "https://github.com/dli/fluid/tree/ac3ee551ee33caaf4c0aa38da21e2be5562fd5ab",
    revision: "ac3ee551ee33caaf4c0aa38da21e2be5562fd5ab", license: "MIT · Copyright (c) 2016 David Li",
    changes: ["3D PIC/FLIP and spherical AO/shadow ported to host-owned WebGL2; 50 pressure iterations and RK2 retained.",
      "Seeded dam replaces Math.random; source effective 80-triangle sphere retained.",
      "Bounded grid/particle/internal resolution profiles, RGBA16F G-buffer and explicit cleanup replace unbounded fullscreen float targets.",
      "Editable particle/background colors, gravity, FLIP ratio, slow time, size, fill, pointer force and fixed camera presets; no orbit/scroll capture."],
  },
  fallback: { color: "#F5FAFF", label: "Fluid Particles недоступен · статический фон" },
  plan(init) {
    if (init.geometry.capability !== "background" || !parseParticleParams(init.params)
      || !Number.isInteger(init.seed) || init.seed < 0 || init.seed > 0xffffffff) {
      return { ok: false, error: { code: "invalid-config", message: "Fluid Particles требует валидную фоновую сцену и seed." } };
    }
    const allocation = planParticleAllocation(init.viewport, init.limits, init.quality);
    if (!allocation) return { ok: false, error: { code: "budget-exceeded", message: "PIC/FLIP и сферический rendering не помещаются в лимит GPU." } };
    return { ok: true, value: {
      attachmentBytes: allocation.attachmentBytes, textureBytes: allocation.textureBytes,
      passesPerFrame: 74,
      quality: `${allocation.profile} ${allocation.output.width}×${allocation.output.height}; ${allocation.particleCount} spheres; grid ${allocation.grid.join("×")}`,
    } };
  },
  create: createParticleEffect,
};
