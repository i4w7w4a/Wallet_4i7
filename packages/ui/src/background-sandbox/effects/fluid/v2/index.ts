import type { MaterialDefinition } from "../../../material-contract";
import { createFluidV2Pass } from "./adapter";
import { planFluidV2Allocation } from "./quality";
import { FLUID_V2_DEFAULTS, fluidV2Schema, parseFluidV2Params, type FluidV2Params } from "./schema";

export { FLUID_V2_DEFAULTS, FLUID_V2_BOUNDS, fluidV2Schema, parseFluidV2Params } from "./schema";
export type { FluidV2Params } from "./schema";

type Planned = ReturnType<MaterialDefinition<"fluid", FluidV2Params, null>["plan"]>;
const failure = (code: "invalid-config" | "budget-exceeded", message: string): Planned => ({ ok: false, error: { code, message } });
const validSeed = (seed: number) => Number.isInteger(seed) && seed >= 0 && seed <= 0xffffffff;

export const fluidV2Definition: MaterialDefinition<"fluid", FluidV2Params, null> = {
  id: "fluid", abiVersion: 2, effectVersion: 2,
  label: "Pavel Fluid · расширенный",
  description: "Рисование жидкостью или живой фон с ограниченной воспроизводимой подпиткой. Цвета, течение, свечение и лучи настраиваются раздельно; Restart начинает поле заново.",
  capabilities: ["background"],
  schema: fluidV2Schema,
  isControlDisabled(params, key) {
    if (key === "bloomIntensity" || key === "bloomThreshold") return !params.bloomEnabled;
    if (key === "sunraysWeight") return !params.sunraysEnabled;
    if (key === "ambientRate") return params.mode !== "ambient";
    if (key === "colorCycleRate") return params.colors.length < 2;
    return false;
  },
  actions: [{ kind: "seeded-splats", label: "Добавить всплески", minCount: 1, maxCount: 6 }],
  presets: [
    { id: "fluid-v2-quiet-draw", label: "Сдержанное рисование", seed: 147, params: FLUID_V2_DEFAULTS },
    { id: "fluid-v2-source-motion", label: "Близко к исходному движению", seed: 147, params: { ...FLUID_V2_DEFAULTS, force: 6000, radius: 0.25, curl: 30, velocityDissipation: 0.2, dyeDissipation: 1, pressureRetention: 0.8, shading: true, colors: ["#FF4F5A", "#FFE377", "#70E68A", "#55B9FF", "#B28CFF", "#FF91CF"], backgroundColor: "#000000", backgroundAlpha: 1, colorCycleRate: 10, bloomEnabled: true, sunraysEnabled: true } },
    { id: "fluid-v2-living-graphite", label: "Живой графит", seed: 147, params: { ...FLUID_V2_DEFAULTS, mode: "ambient", timeScale: 0.35, ambientRate: 0.5, velocityDissipation: 0.15, dyeDissipation: 0.45, curl: 18, force: 2600, colors: ["#768493", "#4F6074", "#A1947F", "#667982", "#8F897E", "#45516A"], colorCycleRate: 0.08 } },
  ],
  assetIds: [],
  provenance: {
    id: "pavel-fluid-a2d2929-novex-v2",
    sourceUrl: "https://github.com/PavelDoGreat/WebGL-Fluid-Simulation/blob/a2d292931f19d9b3b9f564e23e6c32729d2121c3/script.js",
    revision: "a2d292931f19d9b3b9f564e23e6c32729d2121c3",
    license: "MIT · Copyright (c) 2017 Pavel Dobryakov",
    changes: ["Pavel velocity/dye/advection/curl/pressure solver kept on host-owned OGL/WebGL2.", "V2 six-pigment transported dye, freely edited colors and alpha; V1 remains available separately.", "Bounded seeded ambient emitter is an explicit mode, not a hidden side effect.", "Bloom and sunrays are owned, bounded passes without external dithering image.", "Resolution, pressure iterations and all FBO budgets are runtime quality, never persisted params."],
  },
  fallback: { color: "#080A0F", label: "Fluid v2 недоступен · статический фон" },
  plan(init): Planned {
    if (!parseFluidV2Params(init.params) || !validSeed(init.seed)) return failure("invalid-config", "Недопустимый Fluid v2 recipe или seed.");
    const geometry = init.geometry;
    const viewport = init.viewport;
    if (geometry.capability !== "background" || geometry.mask.kind !== "rounded-rect" ||
        ![geometry.x, geometry.y, geometry.width, geometry.height, geometry.pixelWidth, geometry.pixelHeight, geometry.dpr,
          viewport.cssWidth, viewport.cssHeight, viewport.pixelWidth, viewport.pixelHeight, viewport.dpr].every((n) => Number.isFinite(n)) ||
        geometry.width <= 0 || geometry.height <= 0 || geometry.pixelWidth <= 0 || geometry.pixelHeight <= 0 || geometry.dpr <= 0 ||
        viewport.cssWidth <= 0 || viewport.cssHeight <= 0 || viewport.pixelWidth <= 0 || viewport.pixelHeight <= 0 || viewport.dpr <= 0) return failure("invalid-config", "Fluid v2 требует положительную фоновую геометрию и viewport.");
    const allocation = planFluidV2Allocation(geometry.pixelWidth, geometry.pixelHeight, init.limits.maxTextureSize, init.limits.maxRenderTargetBytes, init.quality);
    if (!allocation) return failure("budget-exceeded", "Fluid v2 не помещается в выделенный GPU-бюджет.");
    return { ok: true, value: {
      attachmentBytes: allocation.bytes, textureBytes: 0,
      passesPerFrame: 29 + 12 + (init.params.bloomEnabled ? 6 : 0) + (init.params.sunraysEnabled ? 4 : 0),
      quality: `${init.quality} scale=${allocation.scale}; velocity ${allocation.simulation.width}×${allocation.simulation.height}; dye ${allocation.dye.width}×${allocation.dye.height}; output ${allocation.output.width}×${allocation.output.height}`,
    } };
  },
  create: createFluidV2Pass,
};
