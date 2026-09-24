import { Geometry, Mesh, Program, Renderer, type Texture } from "ogl";
import { EffectSession } from "./host-session";
import { resolveViewport } from "./host-input";
import type { GpuLimits, Viewport } from "./contracts";
import type { SurfaceBackendFactory, SurfaceInput } from "./surface-lifecycle";

const VERTEX = `#version 300 es
in vec2 position;
out vec2 vUv;
void main(){vUv=position*0.5+0.5;gl_Position=vec4(position,0.0,1.0);}`;
// Adapters return display-ready color. Do not apply gamma/tone mapping twice.
const FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D uSource;
in vec2 vUv;
out vec4 fragColor;
void main(){fragColor=texture(uSource,vUv);}`;

/** One canvas/context and one scheduler for the entire selected sandbox scene. */
export const createGpuBackend: SurfaceBackendFactory = (root, initial, onStatus, onRestore) => {
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.dataset.backgroundCanvas = "true";
  Object.assign(canvas.style, { position: "absolute", inset: "0", display: "block", pointerEvents: "none" });
  root.prepend(canvas);
  const context = canvas.getContext("webgl2", { alpha: false, antialias: false, depth: false });
  if (!context) { canvas.remove(); throw new Error("WebGL2 недоступен · статический фон."); }
  let session: EffectSession | null = null;
  let program: Program | null = null;
  let geometry: Geometry | null = null;
  let disposed = false;
  let lost = false;
  let input = initial;
  let viewport: Viewport;
  let renderer: Renderer;

  const releasePresentation = () => {
    if (program) {
      program.uniformLocations?.forEach(location => renderer.gl.renderer.state.uniformLocations.delete(location));
      context.deleteShader(program.vertexShader); context.deleteShader(program.fragmentShader);
      program.remove(); program = null;
    }
    geometry?.remove(); geometry = null;
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    try { session?.dispose(); } finally {
      canvas.removeEventListener("webglcontextlost", contextLost);
      canvas.removeEventListener("webglcontextrestored", contextRestored);
      releasePresentation();
      canvas.remove();
      if (!context.isContextLost()) context.getExtension("WEBGL_lose_context")?.loseContext();
    }
  };
  function contextLost(event: Event) {
    event.preventDefault(); lost = true;
    session?.dispose(); releasePresentation();
    onStatus({ phase: "lost", message: "GPU-контекст потерян · статический фон. После восстановления поле начнётся заново.", effectId: input.recipe.effectId });
  }
  function contextRestored() { if (!disposed) onRestore(); }

  try {
    renderer = new Renderer({ canvas, webgl: 2, alpha: false, antialias: false, depth: false, dpr: 1 });
    if (!renderer.isWebgl2) throw new Error("Для материала нужен WebGL2.");
    const gl = renderer.gl;
    const limits: GpuLimits = { maxTextureSize: Math.min(4096, gl.getParameter(gl.MAX_TEXTURE_SIZE) as number,
      gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) as number), maxRenderTargetBytes: 32 * 1024 * 1024 };
    const size = resolveViewport(root.clientWidth, root.clientHeight, window.devicePixelRatio, limits.maxTextureSize);
    if (!size) throw new Error("Область материала пока не имеет размера.");
    viewport = size;
    renderer.dpr = viewport.dpr;
    renderer.setSize(viewport.cssWidth, viewport.cssHeight);
    gl.clearColor(0, 0, 0, 1);
    const uniforms = { uSource: { value: null as Texture | null } };
    program = new Program(gl, { vertex: VERTEX, fragment: FRAGMENT, uniforms,
      depthTest: false, depthWrite: false, cullFace: false });
    if (!gl.getProgramParameter(program.program, gl.LINK_STATUS)) throw new Error("Не удалось собрать общий compositor.");
    geometry = new Geometry(gl, { position: { size: 2, data: new Float32Array([-1, -1, 3, -1, -1, 3]) } });
    const mesh = new Mesh(gl, { geometry, program, frustumCulled: false });
    session = new EffectSession({
      requestFrame: callback => requestAnimationFrame(callback),
      cancelFrame: id => cancelAnimationFrame(id),
      present(frame) {
        renderer.disable(gl.SCISSOR_TEST);
        uniforms.uSource.value = frame.texture;
        renderer.render({ scene: mesh, clear: true, update: false, sort: false, frustumCull: false });
      },
      onStatus: status => {
        if (!disposed) onStatus(status.diagnostics ? { ...status, diagnostics: { ...status.diagnostics,
          notes: [...status.diagnostics.notes, `${viewport.pixelWidth}×${viewport.pixelHeight} · DPR ${viewport.dpr.toFixed(2)}`] } } : status);
      },
    }, viewport);
    session.setPaused(initial.paused);
    void session.select(Promise.resolve(initial.material.prepare(gl, limits)), initial.recipe);
    canvas.addEventListener("webglcontextlost", contextLost);
    canvas.addEventListener("webglcontextrestored", contextRestored);

    return {
      update(next: SurfaceInput) {
        if (disposed || lost || !session) return;
        session.setPaused(next.paused);
        if (next.material !== input.material || next.recipe.effectId !== input.recipe.effectId) {
          void session.select(Promise.resolve(next.material.prepare(gl, limits)), next.recipe);
        } else {
          if (next.recipe !== input.recipe) session.update(next.recipe);
          if (next.restartKey !== input.restartKey || next.recipe.seed !== input.recipe.seed) {
            if (session.status.phase === "fallback") void session.select(Promise.resolve(next.material.prepare(gl, limits)), next.recipe);
            else session.restart();
          }
        }
        input = next;
      },
      setActive: active => { if (!lost) session?.setActive(active); },
      resize() {
        if (disposed || lost || !session) return;
        const next = resolveViewport(root.clientWidth, root.clientHeight, window.devicePixelRatio, limits.maxTextureSize);
        if (!next || (next.pixelWidth === viewport.pixelWidth && next.pixelHeight === viewport.pixelHeight &&
            next.cssWidth === viewport.cssWidth && next.cssHeight === viewport.cssHeight)) return;
        viewport = next;
        renderer.dpr = next.dpr; renderer.setSize(next.cssWidth, next.cssHeight);
        session.resize(next);
      },
      pointer: sample => { if (!lost) session?.pointer(sample); },
      dispose,
    };
  } catch (error) { dispose(); throw error; }
};
