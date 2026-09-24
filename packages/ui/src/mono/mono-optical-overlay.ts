import { Mesh, Program, RenderTarget, Texture, Triangle, type OGLRenderingContext } from "ogl";
import type { BackgroundOverlay } from "../background-sandbox/overlay";
import type { MonoOpticalHost } from "./mono-optical-host";
import { MONO_OPTICAL_FRAGMENT, MONO_OPTICAL_VERTEX, applyMonoOpticalSettings,
  makeMonoNeutralRelief, makeMonoOpticalUniforms } from "./mono-optical-kernel";

/** Approved Promo relief rendered into a borrowed host context. No canvas/RAF/listeners. */
export function createMonoOpticalOverlay(host: MonoOpticalHost): BackgroundOverlay {
  return {
    markPresented: host.markPresented,
    subscribeInvalidation: host.subscribeInvalidation,
    create(gl: OGLRenderingContext, limits) {
      let source: Texture | null = null;
      let geometry: Triangle | null = null;
      let program: Program | null = null;
      let target: RenderTarget | null = null;
      let disposed = false;
      const releaseTarget = () => {
        if (!target) return;
        gl.deleteFramebuffer(target.buffer);
        for (const texture of target.textures) gl.deleteTexture(texture.texture);
        target = null;
      };
      const dispose = () => {
        if (disposed) return;
        disposed = true; host.markPresented(false); releaseTarget();
        if (program) {
          program.uniformLocations?.forEach(location => gl.renderer.state.uniformLocations.delete(location));
          gl.deleteShader(program.vertexShader); gl.deleteShader(program.fragmentShader); program.remove();
        }
        geometry?.remove();
        if (source) gl.deleteTexture(source.texture);
      };
      try {
        source = new Texture(gl, { image: makeMonoNeutralRelief(), width: 512, height: 256,
          type: gl.UNSIGNED_BYTE, format: gl.RGBA, internalFormat: gl.RGBA,
          minFilter: gl.LINEAR, magFilter: gl.LINEAR, wrapS: gl.CLAMP_TO_EDGE, wrapT: gl.CLAMP_TO_EDGE,
          generateMipmaps: false, flipY: false });
        const uniforms = makeMonoOpticalUniforms(source);
        geometry = new Triangle(gl);
        program = new Program(gl, { vertex: MONO_OPTICAL_VERTEX, fragment: MONO_OPTICAL_FRAGMENT,
          uniforms, depthTest: false, depthWrite: false, cullFace: false });
        if (!gl.getProgramParameter(program.program, gl.LINK_STATUS)) throw new Error("Promo shader недоступен.");
        const mesh = new Mesh(gl, { geometry, program, frustumCulled: false });
        const pointer = new Float32Array([0, 0]);
        return {
          render(frame, viewport, root) {
            if (disposed) throw new Error("Promo уже освобождён.");
            const region = host.getRegion();
            if (!region?.element.isConnected) { releaseTarget(); return null; }
            const element = region.element;
            const box = element.getBoundingClientRect(), surface = root.getBoundingClientRect();
            if (box.width <= 0 || box.height <= 0 || surface.width <= 0 || surface.height <= 0) return null;
            // Use layout dimensions for raster size; transformed rectangles only locate pixels.
            const width = Math.max(1, Math.round(element.clientWidth * viewport.dpr));
            const height = Math.max(1, Math.round(element.clientHeight * viewport.dpr));
            if (width > limits.maxTextureSize || height > limits.maxTextureSize ||
                width * height * 4 + 512 * 256 * 4 > Math.min(limits.maxRenderTargetBytes, 4 * 1024 * 1024)) {
              throw new Error("Promo превышает лимит общего GPU-host.");
            }
            if (!target || target.width !== width || target.height !== height) {
              releaseTarget();
              target = new RenderTarget(gl, { width, height, depth: false, stencil: false,
                type: gl.UNSIGNED_BYTE, format: gl.RGBA, internalFormat: gl.RGBA8,
                minFilter: gl.LINEAR, magFilter: gl.LINEAR });
              gl.renderer.bindFramebuffer({ buffer: target.buffer });
              if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
                throw new Error("Promo framebuffer недоступен.");
              }
            }
            const sx = root.clientWidth / surface.width, sy = root.clientHeight / surface.height;
            const x = (box.left - surface.left) * sx, top = (box.top - surface.top) * sy;
            const w = box.width * sx, h = box.height * sy;
            const bottom = root.clientHeight - top - h;
            const px = frame.pointer.uv[0] * viewport.cssWidth, py = frame.pointer.uv[1] * viewport.cssHeight;
            const inside = frame.pointer.inside && px >= x && px <= x + w && py >= bottom && py <= bottom + h;
            const aim = inside ? [(px - x) / w * 2 - 1, (py - bottom) / h * 2 - 1] : [0, 0];
            const ease = 1 - Math.exp(-frame.dt * 9);
            for (let i = 0; i < 2; i++) {
              pointer[i] += (aim[i]! - pointer[i]!) * ease;
              if (Math.abs(aim[i]! - pointer[i]!) <= 0.001) pointer[i] = aim[i]!;
            }
            applyMonoOpticalSettings(uniforms, region.settings);
            uniforms.uTime!.value = frame.time;
            (uniforms.uResolution!.value as Float32Array).set([width, height]);
            (uniforms.uPointer!.value as Float32Array).set(pointer);
            gl.renderer.disable(gl.SCISSOR_TEST);
            gl.renderer.render({ scene: mesh, target, clear: true, update: false, sort: false, frustumCull: false });
            const radius = Math.min(w / 2, h / 2, parseFloat(getComputedStyle(element).borderTopLeftRadius) || 0);
            return { texture: target.texture, width, height, rect: [x, bottom, w, h], radius };
          },
          dispose,
        };
      } catch (error) { dispose(); throw error; }
    },
  };
}
