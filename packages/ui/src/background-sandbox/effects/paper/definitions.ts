import type { MaterialDefinition, MaterialInit, MaterialResourcePlan } from "../../material-contract";
import type { CreateResult } from "../../contracts";
import { createPaperPass } from "./gpu";
import { preparePaperMaskAsset, preparePaperNoise, type PaperPreparedAssets } from "./prepare";
import { planPaperPass } from "./runtime";
import {
  liquidMetalSchema, pulsingBorderSchema, type LiquidMetalParams, type PulsingBorderParams,
} from "./schema";

const revision = "43cd68db79fa0b1759f72ffc941b3238e2a3954c";
const assetIds = ["mono.quick.send", "mono.quick.receive", "mono.quick.swap", "mono.quick.buy"] as const;

function plan<P extends object>(init: MaterialInit<P, PaperPreparedAssets>, needsImageSampler: boolean): CreateResult<MaterialResourcePlan> {
  return planPaperPass({
    width: init.geometry.pixelWidth, height: init.geometry.pixelHeight,
    textureBytes: init.prepared.byteLength + (needsImageSampler ? 4 : 0),
    maxTextureSize: init.limits.maxTextureSize,
    maxRenderTargetBytes: init.limits.maxRenderTargetBytes,
  });
}

const metalSource: LiquidMetalParams = {
  ...liquidMetalSchema.defaults, scale: 0.6, speed: 1,
  colorBack: "#aaaaac", colorTint: "#ffffff", distortion: 0.07,
  repetition: 2, shiftRed: 0.3, shiftBlue: 0.3, contour: 0.4,
  softness: 0.1, angle: 70, shape: "diamond",
};

export const liquidMetalDefinition: MaterialDefinition<"liquid-metal", LiquidMetalParams, PaperPreparedAssets> = {
  id: "liquid-metal", abiVersion: 2, effectVersion: 1,
  label: "Liquid Metal",
  description: "Металлические полосы и преломлённый контур Paper на фоне, поверхности или настоящей иконке.",
  capabilities: ["background", "button-fill", "button-icon"],
  schema: liquidMetalSchema,
  presets: [
    { id: "quiet-steel", label: "Спокойная сталь · прозрачный", seed: 0, params: liquidMetalSchema.defaults },
    { id: "source-default", label: "Paper · исходный характер", seed: 0, params: metalSource },
    { id: "dark-stripes", label: "Тёмные полосы", seed: 0, params: {
      ...liquidMetalSchema.defaults, colorBack: "#00000000", colorTint: "#2c5d72",
      softness: 0.8, repetition: 6, shiftRed: 1, shiftBlue: -1,
      distortion: 0.4, shape: "circle", angle: 0, speed: 0.18,
    } },
  ],
  assetIds,
  provenance: {
    id: "paper-liquid-metal-0.0.81",
    sourceUrl: `https://github.com/paper-design/shaders/blob/${revision}/packages/shaders/src/shaders/liquid-metal.ts`,
    revision, license: "Apache-2.0 · Copyright 2026 Paper",
    changes: [
      "GLSL300 and simplex math expanded from pinned source; no React ShaderMount/canvas/RAF.",
      "Poisson RG gradient and source alpha are prepared at bounded target size outside RAF.",
      "Source RGB is clamped to premultiplied alpha for host compositor.",
      "Animated frame milliseconds map to host active seconds with continuous speed edits.",
    ],
  },
  fallback: { color: "#464c54", label: "Liquid Metal недоступен · статическая поверхность" },
  prepare: (request, signal) => preparePaperMaskAsset("metal", request, signal),
  plan: (init) => plan(init, true),
  create: (gl, init) => createPaperPass(gl, init, "liquid-metal"),
};

const borderSource: PulsingBorderParams = {
  ...pulsingBorderSchema.defaults, speed: 1, scale: 0.6,
  colorBack: "#000000", colors: ["#0dc1fd", "#d915ef", "#ff3f2ecc"],
  roundness: 0.25, thickness: 0.1, softness: 0.75,
  intensity: 0.2, bloom: 0.25, spots: 4, spotSize: 0.5,
  pulse: 0.25, smoke: 0.3, smokeSize: 0.6,
};

export const pulsingBorderDefinition: MaterialDefinition<"pulsing-border", PulsingBorderParams, PaperPreparedAssets> = {
  id: "pulsing-border", abiVersion: 2, effectVersion: 1,
  label: "Pulsing Border",
  description: "Цветные световые участки на регулируемой рамке Paper; главное назначение — рамка быстрой кнопки.",
  capabilities: ["background", "button-border"],
  schema: pulsingBorderSchema,
  presets: [
    { id: "quiet-line", label: "Тонкая спокойная линия", seed: 0, params: pulsingBorderSchema.defaults },
    { id: "source-default", label: "Paper · исходный характер", seed: 0, params: borderSource },
    { id: "cool-pulse", label: "Холодный импульс", seed: 0, params: {
      ...pulsingBorderSchema.defaults, colors: ["#81adec", "#719da8", "#8e779e"],
      roundness: 0.28, thickness: 0.06, softness: 0.45,
      pulse: 0.32, smoke: 0.18, smokeSize: 0.4, speed: 0.18,
    } },
  ],
  assetIds: [],
  provenance: {
    id: "paper-pulsing-border-0.0.81",
    sourceUrl: `https://github.com/paper-design/shaders/blob/${revision}/packages/shaders/src/shaders/pulsing-border.ts`,
    revision, license: "Apache-2.0 · Copyright 2026 Paper",
    changes: [
      "Source rounded-box, spot, beat and smoke math retained in one host-owned pass.",
      "Pinned 128² Paper noise decoded locally during prepare, never from a CDN.",
      "Source bloom multiplier of four is retained and disclosed in the inspector.",
      "Output clamped to premultiplied RGBA for shared compositor.",
    ],
  },
  fallback: { color: "#515968", label: "Pulsing Border недоступен · статическая рамка" },
  prepare: (request, signal) => preparePaperNoise(request, signal),
  plan: (init) => plan(init, false),
  create: (gl, init) => createPaperPass(gl, init, "pulsing-border"),
};
