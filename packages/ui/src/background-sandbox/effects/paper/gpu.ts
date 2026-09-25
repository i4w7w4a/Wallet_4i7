import { Geometry, Mesh, Program, RenderTarget, Texture, type OGLRenderingContext } from "ogl";
import type { CreateResult, EffectDiagnostics, GpuFailure } from "../../contracts";
import type {
  MaterialFrameTexture, MaterialInit, MaterialPass, MaterialResourcePlan, MaterialTargetGeometry,
} from "../../material-contract";
import { captureConstruction } from "../silk/allocation";
import { advancePaperClock, toPaperRgba } from "./runtime";
import {
  gemSmokeSchema, heatmapSchema, liquidMetalSchema, pulsingBorderSchema,
  type GemSmokeParams, type HeatmapParams, type LiquidMetalParams, type PaperSizing, type PulsingBorderParams,
} from "./schema";
import {
  PAPER_GEM_SMOKE_FRAGMENT, PAPER_HEATMAP_FRAGMENT, PAPER_LIQUID_METAL_FRAGMENT,
  PAPER_PULSING_BORDER_FRAGMENT, PAPER_VERTEX,
} from "./shaders";
import type { PaperPreparedAssets } from "./prepare";

export type PaperParams = LiquidMetalParams | PulsingBorderParams | GemSmokeParams | HeatmapParams;
export type PaperKind = "liquid-metal" | "pulsing-border" | "gem-smoke" | "heatmap";

class PaperFailure extends Error {
  constructor(readonly code: GpuFailure["code"], message: string) { super(message); }
}

const fragments: Readonly<Record<PaperKind, string>> = {
  "liquid-metal": PAPER_LIQUID_METAL_FRAGMENT,
  "pulsing-border": PAPER_PULSING_BORDER_FRAGMENT,
  "gem-smoke": PAPER_GEM_SMOKE_FRAGMENT,
  "heatmap": PAPER_HEATMAP_FRAGMENT,
};

function valid(kind: PaperKind, params: unknown): boolean {
  return (kind === "liquid-metal" ? liquidMetalSchema
    : kind === "pulsing-border" ? pulsingBorderSchema
      : kind === "gem-smoke" ? gemSmokeSchema : heatmapSchema).parse(params).ok;
}

function colors(values: readonly string[], max: number): number[][] {
  return Array.from({ length: max }, (_, index) => toPaperRgba(values[index] ?? "#00000000"));
}

function uniformValues(kind: PaperKind, params: PaperParams, geometry: MaterialTargetGeometry, hasMask: boolean): Record<string, unknown> {
  const p = params as PaperSizing;
  const common: Record<string, unknown> = {
    u_fit: p.fit === "none" ? 0 : p.fit === "contain" ? 1 : 2,
    u_scale: p.scale, u_rotation: p.rotation, u_originX: p.originX, u_originY: p.originY,
    u_offsetX: p.offsetX, u_offsetY: p.offsetY,
    u_worldWidth: p.worldWidth, u_worldHeight: p.worldHeight,
    u_pixelRatio: geometry.dpr,
    u_resolution: [geometry.pixelWidth, geometry.pixelHeight],
  };
  if (kind === "liquid-metal") {
    const v = params as LiquidMetalParams;
    return { ...common,
      u_colorBack: toPaperRgba(v.colorBack), u_colorTint: toPaperRgba(v.colorTint),
      u_repetition: v.repetition, u_softness: v.softness, u_shiftRed: v.shiftRed,
      u_shiftBlue: v.shiftBlue, u_distortion: v.distortion, u_contour: v.contour,
      u_angle: v.angle, u_shape: shapeIndex(v.shape),
      u_isImage: hasMask && (geometry.mask.kind === "icon" || v.shape === "none"),
    };
  }
  if (kind === "pulsing-border") {
    const v = params as PulsingBorderParams;
    return { ...common,
      u_colorBack: toPaperRgba(v.colorBack), u_colors: colors(v.colors, 5), u_colorsCount: v.colors.length,
      u_roundness: v.roundness, u_thickness: v.thickness,
      u_marginLeft: v.marginLeft, u_marginRight: v.marginRight,
      u_marginTop: v.marginTop, u_marginBottom: v.marginBottom,
      u_aspectRatio: v.aspectRatio === "square" ? 1 : 0,
      u_softness: v.softness, u_intensity: v.intensity, u_bloom: v.bloom,
      u_spots: v.spots, u_spotSize: v.spotSize, u_pulse: v.pulse,
      u_smoke: v.smoke, u_smokeSize: v.smokeSize,
    };
  }
  if (kind === "gem-smoke") {
    const v = params as GemSmokeParams;
    return { ...common,
      u_colorBack: toPaperRgba(v.colorBack), u_colorInner: toPaperRgba(v.colorInner),
      u_colors: colors(v.colors, 6), u_colorsCount: v.colors.length,
      u_innerDistortion: v.innerDistortion, u_outerDistortion: v.outerDistortion,
      u_innerGlow: v.innerGlow, u_outerGlow: v.outerGlow,
      u_offset: v.offset, u_angle: v.angle, u_size: v.size, u_shape: shapeIndex(v.shape),
      u_isImage: hasMask && (geometry.mask.kind === "icon" || v.shape === "none"),
    };
  }
  const v = params as HeatmapParams;
  return { ...common,
    u_colorBack: toPaperRgba(v.colorBack), u_colors: colors(v.colors, 10), u_colorsCount: v.colors.length,
    u_contour: v.contour, u_angle: v.angle, u_noise: v.noise,
    u_innerGlow: v.innerGlow, u_outerGlow: v.outerGlow,
  };
}

export { uniformValues as paperUniformValues };

function shapeIndex(shape: LiquidMetalParams["shape"]): number {
  return shape === "none" ? 0 : shape === "circle" ? 1 : shape === "daisy" ? 2 : shape === "diamond" ? 3 : 4;
}

function invalidateTexture(gl: OGLRenderingContext, owned: Texture): void {
  gl.renderer.state.textureUnits.forEach((id, index, units) => { if (id === owned.id) units[index] = -1; });
  gl.deleteTexture(owned.texture);
}

function deleteTarget(gl: OGLRenderingContext, owned: RenderTarget): void {
  if (gl.renderer.state.framebuffer === owned.buffer) gl.renderer.bindFramebuffer();
  for (const texture of owned.textures) invalidateTexture(gl, texture);
  gl.deleteFramebuffer(owned.buffer);
}

export function createPaperPass<P extends PaperParams>(
  gl: OGLRenderingContext,
  init: MaterialInit<P, PaperPreparedAssets> & Readonly<{ plan: MaterialResourcePlan }>,
  kind: PaperKind,
): CreateResult<MaterialPass<P>> {
  let params = init.params;
  if (!valid(kind, params) || !Number.isSafeInteger(init.seed) || init.seed < 0 || init.seed > 0xffffffff) {
    return { ok: false, error: { code: "invalid-config", message: "Invalid Paper material recipe." } };
  }
  if (gl.isContextLost()) return { ok: false, error: { code: "context-lost", message: "Paper WebGL context is lost." } };
  if (!gl.renderer.isWebgl2) return { ok: false, error: { code: "webgl2-unavailable", message: "Paper materials need WebGL2." } };

  let geometryState = init.geometry;
  let maskTexture: Texture | undefined;
  let noiseTexture: Texture | undefined;
  let program: Program | undefined;
  let meshGeometry: Geometry | undefined;
  let target: RenderTarget | undefined;
  let output: MaterialFrameTexture | undefined;
  let disposed = false;
  let seconds = params.phaseMs / 1000;
  let appliedPhaseMs = params.phaseMs;
  const mask = init.prepared.assets.find((asset) => asset.encoding === "paper-gradient" || asset.encoding === "paper-luminance");
  const uniforms: Record<string, { value: unknown }> = {};

  function ensureLive() {
    if (disposed) throw new PaperFailure("resource-allocation", "Paper pass was disposed.");
    if (gl.isContextLost()) throw new PaperFailure("context-lost", "Paper WebGL context is lost.");
  }

  function allocateTarget(width: number, height: number): RenderTarget {
    if (width > gl.getParameter(gl.MAX_TEXTURE_SIZE) || height > gl.getParameter(gl.MAX_TEXTURE_SIZE) ||
        width * height * 4 > init.plan.attachmentBytes || width * height * 4 > init.limits.maxRenderTargetBytes) {
      throw new PaperFailure("budget-exceeded", "Paper target exceeds its planned GPU budget or device texture size.");
    }
    const owned = captureConstruction(gl, () => new RenderTarget(gl, {
      width, height, depth: false, stencil: false,
      type: gl.UNSIGNED_BYTE, format: gl.RGBA, internalFormat: (gl as WebGL2RenderingContext).RGBA8,
      minFilter: gl.LINEAR, magFilter: gl.LINEAR,
      wrapS: gl.CLAMP_TO_EDGE, wrapT: gl.CLAMP_TO_EDGE,
    }));
    gl.renderer.bindFramebuffer(owned);
    const complete = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.renderer.bindFramebuffer();
    if (!complete) {
      deleteTarget(gl, owned);
      throw new PaperFailure("resource-allocation", "Paper RGBA8 framebuffer is incomplete.");
    }
    return owned;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    if (target) deleteTarget(gl, target);
    target = undefined;
    output = undefined;
    if (maskTexture) invalidateTexture(gl, maskTexture);
    if (noiseTexture) invalidateTexture(gl, noiseTexture);
    maskTexture = undefined;
    noiseTexture = undefined;
    if (meshGeometry) {
      if (Object.values(meshGeometry.attributes).some((attribute) => attribute.buffer === gl.renderer.state.boundBuffer)) {
        gl.renderer.state.boundBuffer = null;
      }
      if (gl.renderer.currentGeometry?.startsWith(`${meshGeometry.id}_`)) gl.renderer.currentGeometry = null;
      meshGeometry.remove();
      meshGeometry = undefined;
    }
    if (program) {
      program.uniformLocations?.forEach((location) => gl.renderer.state.uniformLocations.delete(location));
      gl.deleteShader(program.vertexShader);
      gl.deleteShader(program.fragmentShader);
      if (gl.renderer.state.currentProgram === program.id) gl.renderer.state.currentProgram = null;
      program.remove();
      program = undefined;
    }
  }

  try {
    if (init.plan.attachmentBytes !== geometryState.pixelWidth * geometryState.pixelHeight * 4 ||
        init.plan.textureBytes < init.prepared.byteLength ||
        init.plan.attachmentBytes > init.limits.maxRenderTargetBytes) {
      throw new PaperFailure("budget-exceeded", "Paper resource plan is stale or exceeds limits.");
    }
    if (kind !== "pulsing-border") {
      maskTexture = captureConstruction(gl, () => new Texture(gl, {
        image: mask?.rgba ?? new Uint8Array([255, 0, 255, 255]),
        width: mask?.width ?? 1, height: mask?.height ?? 1,
        type: gl.UNSIGNED_BYTE, format: gl.RGBA, internalFormat: (gl as WebGL2RenderingContext).RGBA8,
        minFilter: gl.LINEAR, magFilter: gl.LINEAR, generateMipmaps: false,
        wrapS: gl.CLAMP_TO_EDGE, wrapT: gl.CLAMP_TO_EDGE, flipY: false,
      }));
    }
    if (kind === "pulsing-border") {
      if (!init.prepared.noise) throw new PaperFailure("invalid-config", "Paper Border noise was not prepared.");
      noiseTexture = captureConstruction(gl, () => new Texture(gl, {
        image: init.prepared.noise!.data, width: 128, height: 128,
        type: gl.UNSIGNED_BYTE, format: gl.RGBA, internalFormat: (gl as WebGL2RenderingContext).RGBA8,
        minFilter: gl.LINEAR, magFilter: gl.LINEAR, generateMipmaps: false,
        wrapS: gl.REPEAT, wrapT: gl.REPEAT, flipY: false,
      }));
    }
    const initial = uniformValues(kind, params as unknown as PaperParams, geometryState, Boolean(mask));
    for (const [key, value] of Object.entries(initial)) uniforms[key] = { value };
    uniforms.u_time = { value: seconds };
    uniforms.u_imageAspectRatio = { value: mask ? mask.width / mask.height : geometryState.pixelWidth / geometryState.pixelHeight };
    if (maskTexture) uniforms.u_image = { value: maskTexture };
    if (noiseTexture) uniforms.u_noiseTexture = { value: noiseTexture };
    program = captureConstruction(gl, () => new Program(gl, {
      vertex: PAPER_VERTEX, fragment: fragments[kind], uniforms,
      transparent: false, depthTest: false, depthWrite: false, cullFace: false,
    }));
    if (!gl.getProgramParameter(program.program, gl.LINK_STATUS)) throw new PaperFailure("shader-error", "Paper shader link failed.");
    meshGeometry = captureConstruction(gl, () => new Geometry(gl, {
      a_position: { size: 2, data: new Float32Array([-1, -1, 3, -1, -1, 3]) },
    }));
    target = allocateTarget(geometryState.pixelWidth, geometryState.pixelHeight);
    output = { texture: target.texture, width: target.width, height: target.height,
      alphaMode: "premultiplied", colorSpace: "display-srgb" };
    const mesh = new Mesh(gl, { geometry: meshGeometry, program, frustumCulled: false });

    return { ok: true, value: {
      update(next) {
        ensureLive();
        if (!valid(kind, next)) throw new PaperFailure("invalid-config", "Invalid Paper material parameters.");
        seconds = advancePaperClock(seconds, 0, next.speed, next.phaseMs, appliedPhaseMs);
        appliedPhaseMs = next.phaseMs;
        params = next;
        const values = uniformValues(kind, params as unknown as PaperParams, geometryState, Boolean(mask));
        for (const [key, value] of Object.entries(values)) uniforms[key]!.value = value;
      },
      resize(_viewport, geometry) {
        ensureLive();
        geometryState = geometry;
        if (target?.width !== geometry.pixelWidth || target.height !== geometry.pixelHeight) {
          if (target) deleteTarget(gl, target);
          target = undefined;
          output = undefined;
          target = allocateTarget(geometry.pixelWidth, geometry.pixelHeight);
          output = { texture: target.texture, width: target.width, height: target.height,
            alphaMode: "premultiplied", colorSpace: "display-srgb" };
        }
        const values = uniformValues(kind, params as unknown as PaperParams, geometryState, Boolean(mask));
        for (const [key, value] of Object.entries(values)) uniforms[key]!.value = value;
      },
      render(frame, geometry) {
        ensureLive();
        if (!target || !output || geometry.pixelWidth !== target.width || geometry.pixelHeight !== target.height) {
          throw new PaperFailure("resource-allocation", "Paper target needs resize before render.");
        }
        seconds = advancePaperClock(seconds, frame.dt, params.speed, params.phaseMs, appliedPhaseMs);
        appliedPhaseMs = params.phaseMs;
        uniforms.u_time!.value = seconds;
        gl.renderer.disable(gl.SCISSOR_TEST);
        gl.renderer.render({ scene: mesh, target, clear: false, update: false, sort: false, frustumCull: false });
        return output;
      },
      reset(seed) {
        ensureLive();
        if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw new PaperFailure("invalid-config", "Invalid Paper seed.");
        seconds = params.phaseMs / 1000;
        appliedPhaseMs = params.phaseMs;
      },
      dispose,
      getDiagnostics(): EffectDiagnostics {
        return { targetCount: target ? 1 : 0,
          allocatedBytes: (target ? target.width * target.height * 4 : 0) + init.prepared.byteLength,
          passesPerFrame: disposed ? 0 : 1,
          quality: init.quality,
          notes: ["One host-owned WebGL2 context/RAF; one RGBA8 material pass.",
            "Mask/noise prepared before GPU mount; render changes uniforms only.",
            "Paper seed is recipe metadata; source motion itself is deterministic."],
        };
      },
    } };
  } catch (error) {
    dispose();
    return { ok: false, error: {
      code: gl.isContextLost() ? "context-lost" : error instanceof PaperFailure ? error.code : "resource-allocation",
      message: error instanceof Error ? error.message : "Paper pass creation failed.",
    } };
  }
}
