import { Mesh, Program, RenderTarget, Texture, Triangle, type OGLRenderingContext } from "ogl";
import type { BackgroundOverlay, OverlayFrame } from "../background-sandbox/overlay";
import type { MonoOpticalHost, MonoOpticalRegion } from "./mono-optical-host";
import { MONO_OPTICAL_FRAGMENT, MONO_OPTICAL_VERTEX, applyMonoOpticalSettings,
  makeMonoNeutralRelief, makeMonoOpticalUniforms } from "./mono-optical-kernel";

const RELIEF_BYTES = 512 * 256 * 4;
const OPTICAL_BYTES = 4 * 1024 * 1024;
type RegionTarget = { target: RenderTarget; pointer: Float32Array };

/** Promo and panel lenses borrow one context/clock. Only region-sized FBOs are owned here. */
export function createMonoOpticalOverlay(host: MonoOpticalHost): BackgroundOverlay {
  const rendered = new Set<MonoOpticalRegion>();
  return {
    markPresented(presented) {
      for (const region of host.getRegions()) host.markRegionPresented(region, presented && rendered.has(region));
    },
    subscribeInvalidation: host.subscribeInvalidation,
    create(gl: OGLRenderingContext, limits) {
      let source: Texture | null = null;
      let geometry: Triangle | null = null;
      let program: Program | null = null;
      const targets = new Map<MonoOpticalRegion, RegionTarget>();
      let unsubscribe: (() => void) | undefined;
      let disposed = false;
      const deleteTexture = (texture: Texture) => {
        gl.renderer.state.textureUnits.forEach((id, index, units) => { if (id === texture.id) units[index] = -1; });
        gl.deleteTexture(texture.texture);
      };
      const releaseTarget = (region: MonoOpticalRegion) => {
        const owned = targets.get(region);
        if (!owned) return;
        // Do not leave the renderer cache bound to a deleted framebuffer.
        if (gl.renderer.state.framebuffer === owned.target.buffer) gl.renderer.bindFramebuffer();
        gl.deleteFramebuffer(owned.target.buffer);
        owned.target.textures.forEach(deleteTexture);
        targets.delete(region); rendered.delete(region);
        host.markRegionPresented(region, false);
      };
      const prune = () => {
        const regions = host.getRegions();
        for (const region of targets.keys()) if (!regions.includes(region) || !region.element.isConnected) releaseTarget(region);
      };
      const dispose = () => {
        if (disposed) return;
        disposed = true; unsubscribe?.();
        host.markPresented(false); rendered.clear();
        for (const region of targets.keys()) releaseTarget(region);
        if (program) {
          program.uniformLocations?.forEach(location => gl.renderer.state.uniformLocations.delete(location));
          gl.deleteShader(program.vertexShader); gl.deleteShader(program.fragmentShader);
          if (gl.renderer.state.currentProgram === program.id) gl.renderer.state.currentProgram = null;
          program.remove();
        }
        if (geometry) {
          if (Object.values(geometry.attributes).some(attribute => attribute.buffer === gl.renderer.state.boundBuffer))
            gl.renderer.state.boundBuffer = null;
          if (gl.renderer.currentGeometry?.startsWith(geometry.id + "_")) gl.renderer.currentGeometry = null;
          geometry.remove();
        }
        if (source) deleteTexture(source);
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
        if (!gl.getProgramParameter(program.program, gl.LINK_STATUS)) throw new Error("Оптический shader недоступен.");
        const mesh = new Mesh(gl, { geometry, program, frustumCulled: false });
        // Release removed leases even when the host clock is paused/inactive.
        unsubscribe = host.subscribeInvalidation(prune);
        return {
          render(frame, viewport, root, background) {
            if (disposed) throw new Error("Оптика уже освобождена.");
            prune(); rendered.clear();
            const surface = root.getBoundingClientRect();
            if (surface.width <= 0 || surface.height <= 0) return [];
            let bytes = RELIEF_BYTES;
            const budget = Math.min(limits.maxRenderTargetBytes, OPTICAL_BYTES);
            const planned = [...host.getRegions()]
              .sort((left, right) => Number(left.source === "background") - Number(right.source === "background"))
              .flatMap(region => {
              const element = region.element;
              if (!element.isConnected || (region.source === "background" && !background)) return [];
              const box = element.getBoundingClientRect();
              if (box.width <= 0 || box.height <= 0 || box.right <= surface.left || box.left >= surface.right ||
                  box.bottom <= surface.top || box.top >= surface.bottom) return [];
              const style = getComputedStyle(element);
              if (style.visibility === "hidden" || style.display === "none") return [];
              const parsedOpacity = Number.parseFloat(style.opacity);
              const opacity = Number.isFinite(parsedOpacity) ? Math.min(1, Math.max(0, parsedOpacity)) : 1;
              if (opacity === 0) return [];
              // Layout metrics size the texture; transformed DOMRect locates it.
              const rasterWidth = Math.max(1, Math.round(element.clientWidth * viewport.dpr));
              const rasterHeight = Math.max(1, Math.round(element.clientHeight * viewport.dpr));
              const scale = Math.min(1, limits.maxTextureSize / rasterWidth, limits.maxTextureSize / rasterHeight,
                Math.sqrt(Math.max(0, budget - bytes) / (rasterWidth * rasterHeight * 4)));
              // An oversized panel falls back without taking down Promo/background.
              if (scale < 0.5) return [];
              const width = Math.max(1, Math.floor(rasterWidth * scale)), height = Math.max(1, Math.floor(rasterHeight * scale));
              bytes += width * height * 4;
              const sx = viewport.cssWidth / surface.width, sy = viewport.cssHeight / surface.height;
              const x = (box.left - surface.left) * sx, top = (box.top - surface.top) * sy;
              const w = box.width * sx, h = box.height * sy, bottom = viewport.cssHeight - top - h;
              const radius = Math.min(w / 2, h / 2,
                (parseFloat(style.borderTopLeftRadius) || 0) * w / (element.offsetWidth || box.width));
              return [{ region, width, height, x, bottom, w, h, radius, opacity }];
            });
            // Free obsolete/size-changed allocations before allocating any replacement.
            for (const [region, owned] of targets) {
              const plan = planned.find(candidate => candidate.region === region);
              if (!plan || owned.target.width !== plan.width || owned.target.height !== plan.height) releaseTarget(region);
            }
            const output: OverlayFrame[] = [];
            for (const plan of planned) {
              const { region, width, height, x, bottom, w, h, radius, opacity } = plan;
              let owned = targets.get(region);
              if (!owned) {
                const target = new RenderTarget(gl, { width, height, depth: false, stencil: false,
                  type: gl.UNSIGNED_BYTE, format: gl.RGBA, internalFormat: gl.RGBA8,
                  minFilter: gl.LINEAR, magFilter: gl.LINEAR });
                owned = { target, pointer: new Float32Array(2) }; targets.set(region, owned);
                gl.renderer.bindFramebuffer({ buffer: target.buffer });
                if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE)
                  throw new Error("Оптический framebuffer недоступен.");
              }
              const px = frame.pointer.uv[0] * viewport.cssWidth, py = frame.pointer.uv[1] * viewport.cssHeight;
              const inside = frame.pointer.inside && px >= x && px <= x + w && py >= bottom && py <= bottom + h;
              const aim = inside ? [(px - x) / w * 2 - 1, (py - bottom) / h * 2 - 1] : [0, 0];
              const ease = 1 - Math.exp(-frame.dt * 9);
              for (let i = 0; i < 2; i++) {
                owned.pointer[i] += (aim[i]! - owned.pointer[i]!) * ease;
                if (Math.abs(aim[i]! - owned.pointer[i]!) <= 0.001) owned.pointer[i] = aim[i]!;
              }
              const live = region.source === "background";
              applyMonoOpticalSettings(uniforms, region.settings);
              uniforms.uSource!.value = live ? background!.texture : source!;
              uniforms.uBackgroundSource!.value = live ? 1 : 0;
              (uniforms.uSourceRegion!.value as Float32Array).set([x / viewport.cssWidth, bottom / viewport.cssHeight,
                w / viewport.cssWidth, h / viewport.cssHeight]);
              (uniforms.uSourceBase!.value as Float32Array).set(background?.baseColor ?? [0, 0, 0]);
              (uniforms.uSourceEdgeFinish!.value as Float32Array).set(background?.edgeFinish ?? [0, 0, 0]);
              uniforms.uTime!.value = frame.time;
              (uniforms.uResolution!.value as Float32Array).set([width, height]);
              (uniforms.uPointer!.value as Float32Array).set(owned.pointer);
              gl.renderer.disable(gl.SCISSOR_TEST);
              gl.renderer.render({ scene: mesh, target: owned.target, clear: true, update: false, sort: false, frustumCull: false });
              rendered.add(region);
              output.push({ texture: owned.target.texture, width, height, rect: [x, bottom, w, h], radius,
                // Promo keeps its existing composition; only new panels follow opacity.
                opacity: live ? opacity : 1 });
            }
            // The borrowed pass texture is valid for this render only.
            uniforms.uSource!.value = source!;
            return output;
          },
          dispose,
        };
      } catch (error) { dispose(); throw error; }
    },
  };
}
