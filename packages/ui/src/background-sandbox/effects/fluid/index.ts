import type { Definition } from "../../contracts";
import { createFluidEffect } from "./adapter";
import { FLUID_DEFAULTS, fluidSchema, type FluidParams } from "./schema";

export { FLUID_DEFAULTS, FLUID_BOUNDS, FLUID_PALETTES, fluidSchema, parseFluidParams } from "./schema";
export type { FluidParams, FluidPalette } from "./schema";

export const fluidDefinition: Definition<"fluid", FluidParams> = {
  id: "fluid", abiVersion: 1, configVersion: 1,
  label: "Fluid",
  description: "Рисование жидкостью: след движется и постепенно исчезает. Перезапуск возвращает начальные всплески. Рисуйте с нажатой кнопкой; touch сохраняет прокрутку.",
  schema: fluidSchema,
  presets: [
    { id: "fluid-graphite", label: "Тихий графит", seed: 147, params: FLUID_DEFAULTS },
    { id: "fluid-source-motion", label: "Исходная динамика · адаптация", seed: 147, params: { force: 6000, radius: 0.25, curl: 30, dissipation: 0.2, palette: "lagoon" } },
  ],
  assetIds: [],
  provenance: {
    id: "pavel-fluid-a2d2929-novex-v1",
    sourceUrl: "https://github.com/PavelDoGreat/WebGL-Fluid-Simulation/blob/a2d292931f19d9b3b9f564e23e6c32729d2121c3/script.js",
    revision: "a2d292931f19d9b3b9f564e23e6c32729d2121c3",
    license: "MIT · Copyright (c) 2017 Pavel Dobryakov",
    changes: ["Full velocity/dye/advection/pressure/curl solver on host-owned OGL/WebGL2.", "Bounded drag, six seeded initial splats, curated palette, explicit cleanup and allocation policy.", "No demo GUI/ads/listeners/RAF/assets. Bloom and sunrays omitted; original procedural dithering.", "Reset/resize/Open/A-B restart the field; saved JSON contains parameters only.", "Transient fluid drawing: no continuous dye source. Dye decay is fixed at 0.7/s; the dissipation control affects velocity only.", "Simulation integrates dt capped at 1/30 s without catch-up; below 30 fps it advances slower than the host clock. No idle stop: positive dt still costs 28 passes after the color disappears."],
  },
  fallback: { color: "#050608", label: "Fluid недоступен · статический фон без симуляции" },
  create: createFluidEffect,
};
