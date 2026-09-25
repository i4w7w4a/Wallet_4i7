import { Geometry, Mesh, Program, RenderTarget, type OGLRenderingContext } from "ogl";
import type { CreateResult, EffectDiagnostics, GpuFailure, Viewport } from "../../contracts";
import type {
  MaterialFrameTexture, MaterialInit, MaterialPass, MaterialResourcePlan, MaterialTargetGeometry,
} from "../../material-contract";
import { captureConstruction } from "../silk/allocation";
import { advanceVaultPhase, hexToRgb } from "./math";
import { parseVaultGridParams, type VaultGridParams } from "./schema";
import { VAULT_GRID_FRAGMENT, VAULT_GRID_VERTEX } from "./shaders";
import { planVaultGridMaterial, resolveVaultGridTarget } from "./target";

class VaultGridFailure extends Error {
  constructor(readonly code: GpuFailure["code"], message: string) { super(message); }
}

function patternIndex(pattern: VaultGridParams["pattern"]): number {
  return pattern === "tile" ? 0 : pattern === "rib" ? 1 : 2;
}

/** Host owns the context, canvas, clock, compositor and target clipping. */
export function createVaultGridMaterial(
  gl: OGLRenderingContext,
  init: MaterialInit<VaultGridParams, null> & Readonly<{ plan: MaterialResourcePlan }>,
): CreateResult<MaterialPass<VaultGridParams>> {
  const planned = planVaultGridMaterial(init);
  if (!planned.ok) return planned;
  if (planned.value.attachmentBytes !== init.plan.attachmentBytes
    || planned.value.textureBytes !== init.plan.textureBytes
    || planned.value.passesPerFrame !== init.plan.passesPerFrame) {
    return { ok: false, error: { code: "invalid-config", message: "Vault-grid: план ресурсов не соответствует цели." } };
  }
  if (gl.isContextLost()) {
    return { ok: false, error: { code: "context-lost", message: "Графический контекст vault-grid потерян." } };
  }
  if (!gl.renderer.isWebgl2) {
    return { ok: false, error: { code: "webgl2-unavailable", message: "Vault-grid требует WebGL2." } };
  }
  const actualMaxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
  const limits = { ...init.limits, maxTextureSize: Math.min(init.limits.maxTextureSize, actualMaxTextureSize) };
  if (!resolveVaultGridTarget(init.geometry, limits)) {
    return { ok: false, error: { code: "budget-exceeded", message: "Цель vault-grid больше доступной GPU-текстуры." } };
  }

  let params = parseVaultGridParams(init.params)!;
  let seed = init.seed;
  let viewport = init.viewport;
  let currentGeometry = init.geometry;
  let phase = 0;
  let disposed = false;
  let program: Program | undefined;
  let triangle: Geometry | undefined;
  let target: RenderTarget | undefined;
  let output: MaterialFrameTexture | undefined;

  const uniforms = {
    u_dpr: { value: currentGeometry.dpr },
    u_seed: { value: seed % 65536 },
    u_mode: { value: patternIndex(params.pattern) },
    u_cellSize: { value: params.cellSize },
    u_lineWidth: { value: params.lineWidth },
    u_bevel: { value: params.bevel },
    u_depth: { value: params.depth },
    u_roughness: { value: params.roughness },
    u_lightAngle: { value: params.lightAngle },
    u_lightElevation: { value: params.lightElevation },
    u_lightStrength: { value: params.lightStrength },
    u_phase: { value: phase },
    u_baseColor: { value: hexToRgb(params.baseColor) },
    u_metalColor: { value: hexToRgb(params.metalColor) },
  };

  function deleteTarget(owned: RenderTarget): void {
    if (gl.renderer.state.framebuffer === owned.buffer) gl.renderer.bindFramebuffer();
    for (const texture of owned.textures) {
      gl.renderer.state.textureUnits.forEach((id, index, units) => {
        if (id === texture.id) units[index] = -1;
      });
      gl.deleteTexture(texture.texture);
    }
    gl.deleteFramebuffer(owned.buffer);
  }

  function allocateTarget(geometry: MaterialTargetGeometry): RenderTarget {
    const size = resolveVaultGridTarget(geometry, limits);
    if (!size) throw new VaultGridFailure("budget-exceeded", "Vault-grid не помещается в GPU-бюджет.");
    const owned = captureConstruction(gl, () => new RenderTarget(gl, {
      width: size.width, height: size.height, depth: false, stencil: false,
      type: gl.UNSIGNED_BYTE, format: gl.RGBA, internalFormat: (gl as WebGL2RenderingContext).RGBA8,
      minFilter: gl.LINEAR, magFilter: gl.LINEAR,
      wrapS: gl.CLAMP_TO_EDGE, wrapT: gl.CLAMP_TO_EDGE,
    }));
    gl.renderer.bindFramebuffer(owned);
    const complete = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.renderer.bindFramebuffer();
    if (!complete) {
      deleteTarget(owned);
      throw new VaultGridFailure("resource-allocation", "RGBA8 target vault-grid недоступен.");
    }
    return owned;
  }

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    if (target) deleteTarget(target);
    target = undefined;
    output = undefined;
    if (triangle) {
      if (Object.values(triangle.attributes).some((attribute) => attribute.buffer === gl.renderer.state.boundBuffer)) {
        gl.renderer.state.boundBuffer = null;
      }
      if (gl.renderer.currentGeometry?.startsWith(`${triangle.id}_`)) gl.renderer.currentGeometry = null;
      triangle.remove();
      triangle = undefined;
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

  const ensureLive = () => {
    if (disposed) throw new VaultGridFailure("resource-allocation", "Vault-grid уже освобождён.");
    if (gl.isContextLost()) throw new VaultGridFailure("context-lost", "Графический контекст vault-grid потерян.");
  };

  try {
    program = captureConstruction(gl, () => new Program(gl, {
      vertex: VAULT_GRID_VERTEX, fragment: VAULT_GRID_FRAGMENT, uniforms,
      transparent: false, depthTest: false, depthWrite: false, cullFace: false,
    }));
    if (!gl.getProgramParameter(program.program, gl.LINK_STATUS)) {
      throw new VaultGridFailure("shader-error", "Не удалось собрать shader vault-grid.");
    }
    triangle = captureConstruction(gl, () => new Geometry(gl, {
      position: { size: 2, data: new Float32Array([-1, -1, 3, -1, -1, 3]) },
    }));
    target = allocateTarget(currentGeometry);
    output = { texture: target.texture, width: target.width, height: target.height,
      alphaMode: "opaque", colorSpace: "display-srgb" };
    const mesh = new Mesh(gl, { geometry: triangle, program, frustumCulled: false });

    return { ok: true, value: {
      update(next) {
        ensureLive();
        const parsed = parseVaultGridParams(next);
        if (!parsed) throw new VaultGridFailure("invalid-config", "Некорректные параметры vault-grid.");
        params = parsed;
        uniforms.u_mode.value = patternIndex(params.pattern);
        uniforms.u_cellSize.value = params.cellSize;
        uniforms.u_lineWidth.value = params.lineWidth;
        uniforms.u_bevel.value = params.bevel;
        uniforms.u_depth.value = params.depth;
        uniforms.u_roughness.value = params.roughness;
        uniforms.u_lightAngle.value = params.lightAngle;
        uniforms.u_lightElevation.value = params.lightElevation;
        uniforms.u_lightStrength.value = params.lightStrength;
        uniforms.u_baseColor.value = hexToRgb(params.baseColor);
        uniforms.u_metalColor.value = hexToRgb(params.metalColor);
      },
      resize(nextViewport: Viewport, geometry: MaterialTargetGeometry) {
        ensureLive();
        const nextPlan = planVaultGridMaterial({ ...init, params, seed, viewport: nextViewport, geometry });
        if (!nextPlan.ok) throw new VaultGridFailure(nextPlan.error.code, nextPlan.error.message);
        if (!resolveVaultGridTarget(geometry, limits)) {
          throw new VaultGridFailure("budget-exceeded", "Vault-grid не помещается в GPU-бюджет после resize.");
        }
        viewport = nextViewport;
        currentGeometry = geometry;
        uniforms.u_dpr.value = geometry.dpr;
        if (target?.width === geometry.pixelWidth && target.height === geometry.pixelHeight) return;
        // Release first: peak attachment use never doubles during resize.
        if (target) deleteTarget(target);
        target = undefined;
        output = undefined;
        target = allocateTarget(geometry);
        output = { texture: target.texture, width: target.width, height: target.height,
          alphaMode: "opaque", colorSpace: "display-srgb" };
      },
      render(frame, geometry) {
        ensureLive();
        if (!target || !output || geometry.pixelWidth !== target.width || geometry.pixelHeight !== target.height
          || geometry.dpr !== currentGeometry.dpr || geometry.capability !== currentGeometry.capability) {
          throw new VaultGridFailure("invalid-config", "Геометрия vault-grid изменилась без resize.");
        }
        phase = advanceVaultPhase(phase, frame.dt, params.drift);
        uniforms.u_phase.value = phase;
        gl.renderer.disable(gl.SCISSOR_TEST);
        gl.renderer.render({ scene: mesh, target, clear: false, update: false, sort: false, frustumCull: false });
        return output;
      },
      reset(nextSeed) {
        ensureLive();
        if (!Number.isSafeInteger(nextSeed) || nextSeed < 0 || nextSeed > 0xffffffff) {
          throw new VaultGridFailure("invalid-config", "Некорректный seed vault-grid.");
        }
        seed = nextSeed;
        phase = 0;
        uniforms.u_seed.value = seed % 65536;
        uniforms.u_phase.value = phase;
      },
      dispose,
      getDiagnostics(): EffectDiagnostics {
        return {
          targetCount: target ? 1 : 0,
          allocatedBytes: target ? target.width * target.height * 4 : 0,
          passesPerFrame: disposed ? 0 : 1,
          quality: init.plan.quality,
          notes: [
            "Один непрозрачный RGBA8 pass без внешних текстур и float buffers.",
            "Сетка неподвижна; только свет может медленно дрейфовать.",
            `Viewport ${viewport.cssWidth}×${viewport.cssHeight} CSS px; цель ${currentGeometry.width}×${currentGeometry.height} CSS px.`,
          ],
        };
      },
    } };
  } catch (error) {
    dispose();
    return { ok: false, error: {
      code: gl.isContextLost() ? "context-lost" : error instanceof VaultGridFailure ? error.code : "resource-allocation",
      message: error instanceof VaultGridFailure ? error.message : "Не удалось создать vault-grid.",
    } };
  }
}
