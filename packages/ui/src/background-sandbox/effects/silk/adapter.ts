import { Geometry, Mesh, Program, RenderTarget, type OGLRenderingContext } from "ogl";
import type { CreateResult, Effect, EffectDiagnostics, EffectInit, FrameTexture, GpuFailure, Viewport } from "../../contracts";
import { captureConstruction } from "./allocation";
import { advanceSilkMotion, createSilkMotion } from "./motion";
import { parseSilkParams, type SilkParams } from "./schema";
import { SILK_FRAGMENT, SILK_VERTEX } from "./shaders";
import { resolveSilkTarget } from "./target";

class SilkFailure extends Error {
  constructor(readonly code: GpuFailure["code"], message: string) { super(message); }
}

export function createSilkEffect(gl: OGLRenderingContext, init: EffectInit<SilkParams>): CreateResult<Effect<SilkParams>> {
  let params = parseSilkParams(init.params);
  if (!params || !Number.isSafeInteger(init.seed) || init.seed < 0 || init.seed > 0xffffffff) {
    return { ok: false, error: { code: "invalid-config", message: "Некорректные параметры или seed Silk." } };
  }
  if (gl.isContextLost()) return { ok: false, error: { code: "context-lost", message: "Графический контекст потерян." } };
  if (!gl.renderer.isWebgl2) return { ok: false, error: { code: "webgl2-unavailable", message: "Для Silk нужен WebGL2." } };
  const limits = { ...init.limits, maxTextureSize: Math.min(init.limits.maxTextureSize, gl.getParameter(gl.MAX_TEXTURE_SIZE) as number) };
  let motion = createSilkMotion(init.seed);
  let program: Program | undefined;
  let geometry: Geometry | undefined;
  let target: RenderTarget | undefined;
  let output: FrameTexture | undefined;
  let disposed = false;

  const uniforms = {
    u_res: { value: [init.viewport.pixelWidth, init.viewport.pixelHeight] },
    u_phase: { value: motion.phase },
    u_elapsed: { value: motion.elapsed },
    u_sheenIntensity: { value: params.sheenIntensity },
    u_foldScale: { value: params.foldScale },
    u_lightWidth: { value: params.lightWidth },
    u_palette: { value: paletteIndex(params.palette) },
    u_pointerLight: { value: [motion.pointerX, motion.pointerY, motion.pointerWeight] },
  };

  function deleteTarget(owned: RenderTarget) {
    if (gl.renderer.state.framebuffer === owned.buffer) gl.renderer.bindFramebuffer();
    for (const texture of owned.textures) {
      gl.renderer.state.textureUnits.forEach((id, index, units) => { if (id === texture.id) units[index] = -1; });
      gl.deleteTexture(texture.texture);
    }
    gl.deleteFramebuffer(owned.buffer);
  }

  function allocateTarget(viewport: Viewport) {
    const size = resolveSilkTarget(viewport, limits);
    if (!size) throw new SilkFailure("budget-exceeded", "Размер Silk превышает выделенный GPU-бюджет.");
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
      throw new SilkFailure("resource-allocation", "Не удалось выделить RGBA8 target Silk.");
    }
    return owned;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    if (target) deleteTarget(target);
    target = undefined;
    output = undefined;
    if (geometry) {
      if (Object.values(geometry.attributes).some((attribute) => attribute.buffer === gl.renderer.state.boundBuffer)) {
        gl.renderer.state.boundBuffer = null;
      }
      if (gl.renderer.currentGeometry?.startsWith(`${geometry.id}_`)) gl.renderer.currentGeometry = null;
      geometry.remove();
      geometry = undefined;
    }
    if (program) {
      // OGL 1.0.11 Program.remove() deletes the program only, not shaders or
      // its cached uniform locations. Remove only entries owned by this pass.
      program.uniformLocations?.forEach((location) => gl.renderer.state.uniformLocations.delete(location));
      gl.deleteShader(program.vertexShader);
      gl.deleteShader(program.fragmentShader);
      if (gl.renderer.state.currentProgram === program.id) gl.renderer.state.currentProgram = null;
      program.remove();
      program = undefined;
    }
  }

  try {
    // Reject impossible budgets before constructing shaders or buffers.
    if (!resolveSilkTarget(init.viewport, limits)) throw new SilkFailure("budget-exceeded", "Размер Silk превышает выделенный GPU-бюджет.");
    program = captureConstruction(gl, () => new Program(gl, {
      vertex: SILK_VERTEX, fragment: SILK_FRAGMENT, uniforms,
      transparent: false, depthTest: false, depthWrite: false, cullFace: false,
    }));
    if (!gl.getProgramParameter(program.program, gl.LINK_STATUS)) {
      throw new SilkFailure("shader-error", "Не удалось собрать shader Silk.");
    }
    geometry = captureConstruction(gl, () => new Geometry(gl, {
      position: { size: 2, data: new Float32Array([-1, -1, 3, -1, -1, 3]) },
    }));
    target = allocateTarget(init.viewport);
    output = { texture: target.texture, width: target.width, height: target.height };
    const mesh = new Mesh(gl, { geometry, program, frustumCulled: false });

    const ensureLive = () => {
      if (disposed) throw new SilkFailure("resource-allocation", "Silk уже освобождён.");
      if (gl.isContextLost()) throw new SilkFailure("context-lost", "Графический контекст потерян.");
    };

    return { ok: true, value: {
      resize(viewport) {
        ensureLive();
        if (target?.width === viewport.pixelWidth && target.height === viewport.pixelHeight) return;
        if (!resolveSilkTarget(viewport, limits)) throw new SilkFailure("budget-exceeded", "Размер Silk превышает выделенный GPU-бюджет.");
        // Release before reallocating: peak memory never doubles during resize.
        // The host must discard its borrowed FrameTexture on every resize.
        if (target) deleteTarget(target);
        target = undefined;
        output = undefined;
        target = allocateTarget(viewport);
        uniforms.u_res.value = [target.width, target.height];
        output = { texture: target.texture, width: target.width, height: target.height };
      },
      update(next) {
        ensureLive();
        const parsed = parseSilkParams(next);
        if (!parsed) throw new SilkFailure("invalid-config", "Некорректные параметры Silk.");
        params = parsed;
        uniforms.u_sheenIntensity.value = parsed.sheenIntensity;
        uniforms.u_foldScale.value = parsed.foldScale;
        uniforms.u_lightWidth.value = parsed.lightWidth;
        uniforms.u_palette.value = paletteIndex(parsed.palette);
      },
      render(frame) {
        ensureLive();
        if (!target || !output || !params) throw new SilkFailure("resource-allocation", "Silk target недоступен.");
        motion = advanceSilkMotion(motion, frame.dt, params.flowSpeed, frame.pointer.inside ? frame.pointer.uv : null);
        uniforms.u_phase.value = motion.phase;
        uniforms.u_elapsed.value = motion.elapsed;
        uniforms.u_pointerLight.value = [motion.pointerX, motion.pointerY, motion.pointerWeight];
        // Every draw is explicitly bound to our FBO. No default-framebuffer pass.
        // A preceding compositor region may leave scissor enabled. Use OGL's
        // state cache to restore full-target coverage before the material pass.
        gl.renderer.disable(gl.SCISSOR_TEST);
        gl.renderer.render({ scene: mesh, target, clear: false, update: false, sort: false, frustumCull: false });
        return output;
      },
      reset(seed) {
        ensureLive();
        if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw new SilkFailure("invalid-config", "Некорректный seed Silk.");
        motion = createSilkMotion(seed);
      },
      dispose,
      getDiagnostics(): EffectDiagnostics {
        return {
          targetCount: target ? 1 : 0,
          allocatedBytes: target ? target.width * target.height * 4 : 0,
          passesPerFrame: disposed ? 0 : 1,
          quality: "RGBA8 · host resolution · 3 layers",
          notes: ["Один fullscreen pass; без float targets и внешних текстур.", "Resize сохраняет фазу; Restart/Open/A-B сбрасывают её через reset(seed)."],
        };
      },
    } };
  } catch (error) {
    dispose();
    return { ok: false, error: {
      code: gl.isContextLost() ? "context-lost" : error instanceof SilkFailure ? error.code : "resource-allocation",
      message: error instanceof Error ? error.message : "Не удалось создать Silk.",
    } };
  }
}

function paletteIndex(palette: SilkParams["palette"]): number {
  return palette === "radiant" ? 0 : palette === "graphite" ? 1 : 2;
}
