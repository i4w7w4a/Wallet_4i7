/** Test host only. Not exported by the adapter/registry and never imported by the product. */
import { Mesh, Program, Renderer, Triangle } from "ogl";
import type { Effect, FrameTexture, PointerFrame, PointerSample, Viewport } from "../../../contracts";
import { fluidDefinition, FLUID_DEFAULTS, type FluidParams } from "../index";
import { vertex } from "../shaders";

const canvas = document.querySelector("canvas")!;
const status = document.querySelector("#status")!;
const noPointer: PointerFrame = { uv: [0.5, 0.5], inside: false, down: false, samples: [] };
let renderer = new Renderer({ canvas, webgl: 2, dpr: 1, depth: false, stencil: false, antialias: false, preserveDrawingBuffer: true });
let gl = renderer.gl as typeof renderer.gl & WebGL2RenderingContext;
const live = new Map<string, Set<unknown>>();
const made: Record<string, number> = {};
const deleted: Record<string, number> = {};
for (const [create, remove, kind] of [
  ["createTexture", "deleteTexture", "textures"], ["createFramebuffer", "deleteFramebuffer", "framebuffers"],
  ["createProgram", "deleteProgram", "programs"], ["createShader", "deleteShader", "shaders"],
  ["createBuffer", "deleteBuffer", "buffers"], ["createVertexArray", "deleteVertexArray", "vaos"],
] as const) {
  const objects = new Set<unknown>();
  live.set(kind, objects); made[kind] = 0; deleted[kind] = 0;
  const methods = gl as unknown as Record<string, (...args: unknown[]) => unknown>;
  const allocate = methods[create].bind(gl);
  const release = methods[remove].bind(gl);
  methods[create] = (...args) => { const object = allocate(...args); if (object) { objects.add(object); made[kind]++; } return object; };
  methods[remove] = (...args) => { if (objects.delete(args[0])) deleted[kind]++; return release(...args); };
}
// Renderer caches VAO entry points in its constructor, before instrumentation.
renderer.createVertexArray = gl.createVertexArray.bind(gl);
renderer.deleteVertexArray = gl.deleteVertexArray.bind(gl);

let copyProgram: Program;
let copyGeometry: Triangle;
let copyMesh: Mesh;
function createCompositor() {
  copyGeometry = new Triangle(gl);
  copyProgram = new Program(gl, { vertex, fragment: `#version 300 es
    precision highp float; in vec2 vUv; uniform sampler2D source; out vec4 color;
    void main() { color = texture(source, vUv); }`, uniforms: { source: { value: null } }, depthTest: false, depthWrite: false, cullFace: false });
  copyMesh = new Mesh(gl, { geometry: copyGeometry, program: copyProgram });
}
createCompositor();
let viewport: Viewport = { cssWidth: 390, cssHeight: 844, pixelWidth: 390, pixelHeight: 844, dpr: 1 };
let params: FluidParams = { ...FLUID_DEFAULTS };
let effect: Effect<FluidParams> | null = null;
let output: FrameTexture | null = null;
let time = 0;
let running = false;
let raf = 0;
let previousTime = 0;
let samples: PointerSample[] = [];
let primary: PointerFrame = noPointer;
const resources = () => Object.fromEntries([...live.entries()].map(([key, entries]) => [key, entries.size]));
const statistics = () => ({ diagnostics: effect?.getDiagnostics?.(), resources: resources(), made: { ...made }, deleted: { ...deleted }, uniformCache: gl.renderer.state.uniformLocations.size });

function compose() {
  if (!output) return;
  copyProgram.uniforms.source.value = output.texture;
  renderer.render({ scene: copyMesh, clear: false, frustumCull: false, sort: false });
}
function render(dt = 1 / 60, pointer: PointerFrame = noPointer, present = true) {
  if (!effect) throw new Error("No active Fluid instance");
  time += dt;
  output = effect.render({ time, dt, pointer });
  if (present) compose();
  return effect.getDiagnostics?.();
}
function open(seed = 147, nextParams = FLUID_DEFAULTS) {
  effect?.dispose(); effect = null;
  params = { ...nextParams }; time = 0;
  renderer.setSize(viewport.pixelWidth, viewport.pixelHeight);
  canvas.style.width = `${viewport.cssWidth}px`; canvas.style.height = `${viewport.cssHeight}px`;
  const result = fluidDefinition.create(gl, { params, seed, viewport, limits: { maxTextureSize: 4096, maxRenderTargetBytes: 8 * 1024 * 1024 } });
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  effect = result.value; render(0);
  status.textContent = JSON.stringify(statistics(), null, 2);
  return statistics();
}
function capture() {
  renderer.bindFramebuffer();
  const pixels = new Uint8Array(canvas.width * canvas.height * 4);
  gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  let hash = 2166136261;
  let brightness = 0;
  for (let i = 0; i < pixels.length; i++) { hash = Math.imul(hash ^ pixels[i], 16777619); if (i % 4 !== 3) brightness += pixels[i]; }
  let mass = 0; let xMoment = 0; let yMoment = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    const weight = Math.max(0, (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3 - 5.5);
    mass += weight; xMoment += weight * ((i / 4) % canvas.width) / canvas.width; yMoment += weight * Math.floor(i / 4 / canvas.width) / canvas.height;
  }
  return { hash: hash >>> 0, mean: brightness / (canvas.width * canvas.height * 3), center: [xMoment / mass, yMoment / mass] };
}
function stop() { running = false; cancelAnimationFrame(raf); previousTime = 0; }
function tick(now: number) {
  if (!running) return;
  render(previousTime ? Math.min((now - previousTime) / 1000, 1 / 30) : 0, { ...primary, samples });
  samples = []; previousTime = now;
  raf = requestAnimationFrame(tick);
}
function play() { if (running) return; running = true; previousTime = 0; raf = requestAnimationFrame(tick); }

const nextFrame = () => new Promise<number>((resolve) => requestAnimationFrame(resolve));
async function benchmark(frames = 60) {
  stop();
  const ext = gl.getExtension("EXT_disjoint_timer_query_webgl2") as { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number } | null;
  const cpu: number[] = [];
  const intervals: number[] = [];
  const queries: WebGLQuery[] = [];
  let last = 0;
  for (let i = 0; i < frames + 10; i++) {
    const stamp = await nextFrame();
    if (i >= 10 && last) intervals.push(stamp - last);
    last = stamp;
    const query = i >= 10 && ext ? gl.createQuery() : null;
    if (query && ext) gl.beginQuery(ext.TIME_ELAPSED_EXT, query);
    const start = performance.now(); render(1 / 60, noPointer, false);
    const elapsed = performance.now() - start;
    if (query && ext) { gl.endQuery(ext.TIME_ELAPSED_EXT); queries.push(query); }
    if (i >= 10) cpu.push(elapsed);
    compose(); gl.flush();
  }
  for (let tries = 0; tries < 60 && queries.some((query) => !gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)); tries++) await nextFrame();
  const disjoint = ext ? Boolean(gl.getParameter(ext.GPU_DISJOINT_EXT)) : true;
  const gpu = !disjoint ? queries.filter((query) => gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)).map((query) => (gl.getQueryParameter(query, gl.QUERY_RESULT) as number) / 1e6) : [];
  queries.forEach((query) => gl.deleteQuery(query));
  const summary = (values: number[]) => { const sorted = [...values].sort((a, b) => a - b); return { n: values.length, p50: sorted[Math.floor(sorted.length * 0.5)] ?? null, p95: sorted[Math.floor(sorted.length * 0.95)] ?? null, max: sorted.at(-1) ?? null }; };
  const debug = gl.getExtension("WEBGL_debug_renderer_info");
  return { cpuMs: summary(cpu), gpuMs: summary(gpu), frameIntervalMs: summary(intervals), disjoint, renderer: gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER), viewport, ...statistics() };
}

async function lossRestore() {
  stop();
  const ext = gl.getExtension("WEBGL_lose_context");
  if (!ext) return { supported: false };
  return await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("context restore timeout")), 5000);
    canvas.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      const result = fluidDefinition.create(gl, { params, seed: 147, viewport, limits: { maxTextureSize: 4096, maxRenderTargetBytes: 8 * 1024 * 1024 } });
      effect?.dispose(); effect = null;
      copyGeometry.remove(); gl.deleteShader(copyProgram.vertexShader); gl.deleteShader(copyProgram.fragmentShader); copyProgram.remove();
      live.forEach((entries) => entries.clear());
      if (result.ok || result.error.code !== "context-lost") { clearTimeout(timeout); reject(new Error("loss not reported")); }
      setTimeout(() => ext.restoreContext(), 50);
    }, { once: true });
    canvas.addEventListener("webglcontextrestored", () => {
      clearTimeout(timeout);
      renderer = new Renderer({ canvas, webgl: 2, dpr: 1, depth: false, stencil: false, antialias: false, preserveDrawingBuffer: true });
      gl = renderer.gl as typeof gl;
      createCompositor();
      try { open(); resolve({ supported: true, restored: true, capture: capture(), ...statistics() }); } catch (error) { reject(error); }
    }, { once: true });
    ext.loseContext();
  });
}

export const probe = {
  open, render, capture, statistics, benchmark, lossRestore, play, stop,
  update(patch: Partial<FluidParams>) { params = { ...params, ...patch }; effect!.update(params); render(0); return capture(); },
  reset(seed = 147) { effect!.reset(seed); time = 0; render(0); return capture(); },
  resize(width: number, height: number, dpr = 1) {
    viewport = { cssWidth: width, cssHeight: height, pixelWidth: Math.round(width * dpr), pixelHeight: Math.round(height * dpr), dpr };
    renderer.setSize(viewport.pixelWidth, viewport.pixelHeight); canvas.style.width = `${width}px`; canvas.style.height = `${height}px`;
    effect!.resize(viewport); render(0); return statistics();
  },
  dispose() { stop(); effect?.dispose(); return statistics(); },
  allocationFailure() {
    effect?.dispose(); effect = null;
    const before = resources();
    const original = gl.checkFramebufferStatus.bind(gl);
    let checks = 0;
    gl.checkFramebufferStatus = (target) => ++checks === 3 ? gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT : original(target);
    let result;
    try { result = fluidDefinition.create(gl, { params, seed: 147, viewport, limits: { maxTextureSize: 4096, maxRenderTargetBytes: 8 * 1024 * 1024 } }); }
    finally { gl.checkFramebufferStatus = original; }
    if (result.ok) result.value.dispose();
    return { ok: result.ok, code: result.ok ? null : result.error.code, before, after: resources() };
  },
  error() { return gl.getError(); },
};
declare global { interface Window { fluidProbe: typeof probe } }
window.fluidProbe = probe;

document.querySelector("#play")!.addEventListener("click", () => { if (running) stop(); else play(); });
document.querySelector("#reset")!.addEventListener("click", () => probe.reset());
const controls = document.querySelector("#controls")!;
for (const control of fluidDefinition.schema.controls) {
  const label = document.createElement("label"); label.textContent = control.label;
  const input = document.createElement(control.kind === "select" ? "select" : "input");
  if (input instanceof HTMLInputElement && control.kind === "range") { input.type = "range"; input.min = String(control.min); input.max = String(control.max); input.step = String(control.step); }
  if (input instanceof HTMLSelectElement && control.kind === "select") for (const option of control.options) { const element = document.createElement("option"); element.value = option.value; element.textContent = option.label; input.append(element); }
  input.value = String(params[control.key]);
  input.addEventListener("input", () => { probe.update({ [control.key]: control.kind === "range" ? Number(input.value) : input.value }); });
  label.append(input); controls.append(label);
}
let previousUV: readonly [number, number] | null = null;
for (const phase of ["enter", "down", "move", "up", "leave", "cancel"] as const) {
  canvas.addEventListener(`pointer${phase}`, (raw) => {
    const event = raw as PointerEvent;
    // Fixture policy: no touch capture or scroll prevention; scroll remains native.
    if (event.pointerType === "touch") return;
    const bounds = canvas.getBoundingClientRect();
    const uv: readonly [number, number] = [(event.clientX - bounds.left) / bounds.width, 1 - (event.clientY - bounds.top) / bounds.height];
    const delta: readonly [number, number] = phase === "move" && previousUV ? [uv[0] - previousUV[0], uv[1] - previousUV[1]] : [0, 0];
    samples.push({ id: event.pointerId, phase, uv, delta, time: time + 0.000001 * samples.length, buttons: event.buttons });
    if (samples.length > 64) samples = samples.slice(-64);
    const inside = phase !== "leave" && phase !== "cancel";
    primary = { uv, inside, down: inside && (event.buttons & 1) !== 0, samples: [] };
    previousUV = inside ? uv : null;
  }, { passive: true });
}
document.addEventListener("visibilitychange", () => { if (document.hidden) stop(); });
try { open(); } catch (error) { status.textContent = String(error); throw error; }
