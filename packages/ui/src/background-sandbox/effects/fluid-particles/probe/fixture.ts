/** Isolated visual and budget probe. Never imported by the product registry. */
import { Geometry, Mesh, Program, Renderer, type OGLRenderingContext } from "ogl";
import type { Frame, PointerFrame, Viewport } from "../../../contracts";
import type { MaterialPass, MaterialQualityProfile, MaterialTargetGeometry } from "../../../material-contract";
import { particleDefinition } from "../index";
import { summarizeParticlePositions } from "../progression";
import { PARTICLE_DEFAULTS, type ParticleParams } from "../schema";

const canvas = document.querySelector("canvas")!;
const status = document.querySelector("#status")!;
const renderer = new Renderer({ canvas, webgl: 2, dpr: 1, depth: false, stencil: false,
  antialias: false, preserveDrawingBuffer: true });
const gl = renderer.gl as OGLRenderingContext & WebGL2RenderingContext;
const live = new Map<string, Set<unknown>>();
for (const [create, remove, kind] of [
  ["createTexture", "deleteTexture", "textures"], ["createFramebuffer", "deleteFramebuffer", "framebuffers"],
  ["createRenderbuffer", "deleteRenderbuffer", "renderbuffers"], ["createProgram", "deleteProgram", "programs"],
  ["createShader", "deleteShader", "shaders"], ["createBuffer", "deleteBuffer", "buffers"],
  ["createVertexArray", "deleteVertexArray", "vaos"],
] as const) {
  const objects = new Set<unknown>();
  live.set(kind, objects);
  const methods = gl as unknown as Record<string, (...args: unknown[]) => unknown>;
  const allocate = methods[create].bind(gl);
  const release = methods[remove].bind(gl);
  methods[create] = (...args) => { const value = allocate(...args); if (value) objects.add(value); return value; };
  methods[remove] = (...args) => { objects.delete(args[0]); return release(...args); };
}
const resources = () => Object.fromEntries([...live.entries()].map(([kind, objects]) => [kind, objects.size]));
const copy = new Program(gl, { vertex: `#version 300 es
  in vec2 position; out vec2 uv; void main(){ uv=position*0.5+0.5; gl_Position=vec4(position,0.,1.); }`,
fragment: `#version 300 es
  precision highp float; in vec2 uv; uniform sampler2D source; out vec4 color;
  void main(){ color=texture(source,uv); }`,
uniforms: { source: { value: null as unknown } }, depthTest: false, depthWrite: false, cullFace: false });
const quad = new Geometry(gl, { position: { size: 2, data: new Float32Array([-1, -1, 3, -1, -1, 3]) } });
const mesh = new Mesh(gl, { geometry: quad, program: copy });
const noPointer: PointerFrame = { uv: [0.5, 0.5], inside: false, down: false, samples: [] };
const limits = { maxTextureSize: Math.min(4096, gl.getParameter(gl.MAX_TEXTURE_SIZE) as number),
  maxRenderTargetBytes: 28 * 1024 * 1024 };
let viewport: Viewport = { cssWidth: 960, cssHeight: 640, pixelWidth: 960, pixelHeight: 640, dpr: 1 };
let params: ParticleParams = { ...PARTICLE_DEFAULTS };
let runtimeQuality: MaterialQualityProfile = "detail";
let pass: MaterialPass<ParticleParams> | null = null;
let time = 0;
let running = false;
let raf = 0;
let previousTime = 0;

function geometry(): MaterialTargetGeometry {
  return { capability: "background", x: 0, y: 0, width: viewport.cssWidth, height: viewport.cssHeight,
    pixelWidth: viewport.pixelWidth, pixelHeight: viewport.pixelHeight, dpr: viewport.dpr,
    radiusCss: 0, borderWidthCss: 0, mask: { kind: "rounded-rect" } };
}
function statistics() {
  const debug = gl.getExtension("WEBGL_debug_renderer_info");
  return { diagnostics: pass?.getDiagnostics?.(), error: gl.getError(), viewport, params,
    resources: resources(), userAgent: navigator.userAgent,
    renderer: gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER) as string };
}
function present() {
  renderer.render({ scene: mesh, clear: true, update: false, sort: false, frustumCull: false });
}
function render(dt = 1 / 60, pointer: PointerFrame = noPointer, compose = true) {
  if (!pass) throw new Error("Particle effect is not open");
  time += dt;
  const frame: Frame = { time, dt, pointer };
  const output = pass.render(frame, geometry());
  copy.uniforms.source.value = output.texture;
  if (compose) present();
  status.textContent = JSON.stringify(statistics(), null, 2);
  return pass.getDiagnostics?.();
}
function open(seed = 147, nextParams = PARTICLE_DEFAULTS, quality: MaterialQualityProfile = "detail") {
  pass?.dispose(); pass = null;
  params = { ...nextParams };
  runtimeQuality = quality;
  time = 0;
  renderer.setSize(viewport.pixelWidth, viewport.pixelHeight);
  canvas.style.width = `${viewport.cssWidth}px`;
  canvas.style.height = `${viewport.cssHeight}px`;
  const init = { params, seed, viewport, geometry: geometry(), quality,
    limits, prepared: null };
  const plan = particleDefinition.plan(init);
  if (!plan.ok) throw new Error(JSON.stringify(plan.error));
  const created = particleDefinition.create(gl, { ...init, plan: plan.value });
  if (!created.ok) throw new Error(JSON.stringify(created.error));
  pass = created.value;
  render(0);
  return statistics();
}
function resize(width: number, height: number, dpr = 1) {
  viewport = { cssWidth: width, cssHeight: height, pixelWidth: Math.round(width * dpr),
    pixelHeight: Math.round(height * dpr), dpr };
  renderer.setSize(viewport.pixelWidth, viewport.pixelHeight);
  canvas.style.width = `${width}px`; canvas.style.height = `${height}px`;
  pass?.resize(viewport, geometry());
  render(0);
  return statistics();
}
function capture() {
  renderer.bindFramebuffer();
  const pixels = new Uint8Array(canvas.width * canvas.height * 4);
  gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  let hash = 2166136261;
  let count = 0, x0 = canvas.width, y0 = canvas.height, x1 = 0, y1 = 0;
  for (let i = 0; i < pixels.length; i++) {
    hash = Math.imul(hash ^ pixels[i], 16777619);
    if (i % 4 !== 3) continue;
    const base = i - 3;
    if (pixels[base + 2] - pixels[base] < 35) continue;
    const pixel = Math.floor(i / 4);
    const x = pixel % canvas.width;
    const y = Math.floor(pixel / canvas.width);
    count++; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  return { hash: hash >>> 0, coloredPixels: count,
    bounds: count ? { x0, y0, x1, y1 } : null, width: canvas.width, height: canvas.height };
}
function positionSummary() {
  if (!pass) throw new Error("Particle effect is not open");
  // Test-only readback from this local adapter instance. No production method,
  // public registry exposure or per-frame readback is added to the effect.
  const privateTargets = (pass as unknown as { targets?: { position: { texture: WebGLTexture; width: number; height: number } } }).targets;
  const position = privateTargets?.position;
  if (!position) throw new Error("Position texture unavailable to isolated probe");
  const fbo = gl.createFramebuffer();
  if (!fbo) throw new Error("Probe framebuffer allocation failed");
  try {
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, position.texture, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error("Probe position FBO incomplete");
    const pixels = new Float32Array(position.width * position.height * 4);
    gl.readPixels(0, 0, position.width, position.height, gl.RGBA, gl.FLOAT, pixels);
    const error = gl.getError();
    if (error !== gl.NO_ERROR) throw new Error(`Probe position readPixels failed: ${error}`);
    return summarizeParticlePositions(pixels);
  } finally {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.renderer.state.framebuffer = null;
    gl.deleteFramebuffer(fbo);
  }
}
function stop() { running = false; cancelAnimationFrame(raf); previousTime = 0; }
function tick(now: number) {
  if (!running) return;
  render(previousTime ? Math.min((now - previousTime) / 1000, 1 / 30) : 0);
  previousTime = now;
  raf = requestAnimationFrame(tick);
}
function play() { if (running) return; running = true; previousTime = 0; raf = requestAnimationFrame(tick); }
const probe = {
  open, render, resize, capture, statistics, positionSummary, play, stop,
  openSourceReference() {
    const source = particleDefinition.presets.find(preset => preset.id === "particles-source");
    if (!source) throw new Error("Source-speed preset is missing");
    return open(source.seed, source.params, "detail");
  },
  update(patch: Partial<ParticleParams>) { params = { ...params, ...patch }; pass!.update(params); render(0); return capture(); },
  reset(seed = 147) { pass!.reset(seed); time = 0; render(0); return capture(); },
  dispose() { stop(); pass?.dispose(); pass = null; return statistics(); },
  async lossRestore() {
    stop();
    const extension = gl.getExtension("WEBGL_lose_context");
    if (!extension) return { supported: false };
    return await new Promise<{ supported: boolean; restored: boolean; failureCode: string | null }>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("context restoration timed out")), 5000);
      let failureCode: string | null = null;
      canvas.addEventListener("webglcontextlost", event => {
        event.preventDefault();
        const init = { params, seed: 147, viewport, geometry: geometry(), quality: runtimeQuality,
          limits, prepared: null };
        const plan = particleDefinition.plan(init);
        const failed = plan.ok ? particleDefinition.create(gl, { ...init, plan: plan.value }) : plan;
        failureCode = failed.ok ? null : failed.error.code;
        if (failed.ok) failed.value.dispose();
        pass?.dispose(); pass = null;
        setTimeout(() => extension.restoreContext(), 50);
      }, { once: true });
      canvas.addEventListener("webglcontextrestored", () => {
        clearTimeout(timeout);
        resolve({ supported: true, restored: true, failureCode });
      }, { once: true });
      extension.loseContext();
    });
  },
  async benchmark(frames = 30) {
    stop();
    const cpu: number[] = [];
    const interval: number[] = [];
    let previous = 0;
    for (let i = 0; i < frames + 5; i++) {
      const now = await new Promise<number>(resolve => requestAnimationFrame(resolve));
      if (i >= 5 && previous) interval.push(now - previous);
      previous = now;
      const start = performance.now(); render(1 / 60, noPointer, false);
      if (i >= 5) cpu.push(performance.now() - start);
      present(); gl.flush();
    }
    const summary = (values: number[]) => {
      const sorted = [...values].sort((a, b) => a - b);
      return { p50: sorted[Math.floor(sorted.length * 0.5)] ?? null,
        p95: sorted[Math.floor(sorted.length * 0.95)] ?? null };
    };
    return { cpuSubmissionMs: summary(cpu), frameIntervalMs: summary(interval), ...statistics() };
  },
};
declare global { interface Window { particleProbe: typeof probe } }
window.particleProbe = probe;
document.querySelector("#play")!.addEventListener("click", () => { if (running) stop(); else play(); });
document.querySelector("#restart")!.addEventListener("click", () => probe.reset());
document.addEventListener("visibilitychange", () => { if (document.hidden) stop(); });
try { open(); } catch (error) { status.textContent = String(error); throw error; }
