/** Standalone test host only. Never imported by the product or effect registry. */
import { Mesh, Program, Renderer, Triangle } from "ogl";
import type { PointerFrame, PointerSample, Viewport } from "../../../../contracts";
import type { MaterialFrameTexture, MaterialInit, MaterialPass, MaterialTargetGeometry } from "../../../../material-contract";
import { fluidV2Definition, type FluidV2Params } from "../index";
import { FLUID_V2_DEFAULTS } from "../schema";
import { vertex } from "../shaders";

const canvas = document.querySelector("canvas")!;
const status = document.querySelector("#status")!;
const noPointer: PointerFrame = { uv: [0.5, 0.5], inside: false, down: false, samples: [] };
const renderer = new Renderer({ canvas, webgl: 2, dpr: 1, alpha: true, depth: false, stencil: false, antialias: false, preserveDrawingBuffer: true, autoClear: false });
const gl = renderer.gl as typeof renderer.gl & WebGL2RenderingContext;

const live = new Map<string, Set<unknown>>();
const made: Record<string, number> = {};
const deleted: Record<string, number> = {};
for (const [create, remove, kind] of [
  ["createTexture", "deleteTexture", "textures"], ["createFramebuffer", "deleteFramebuffer", "framebuffers"],
  ["createProgram", "deleteProgram", "programs"], ["createShader", "deleteShader", "shaders"],
  ["createBuffer", "deleteBuffer", "buffers"], ["createVertexArray", "deleteVertexArray", "vaos"],
] as const) {
  const objects = new Set<unknown>(); live.set(kind, objects); made[kind] = 0; deleted[kind] = 0;
  const methods = gl as unknown as Record<string, (...args: unknown[]) => unknown>;
  const allocate = methods[create].bind(gl);
  const release = methods[remove].bind(gl);
  methods[create] = (...args) => { const item = allocate(...args); if (item) { objects.add(item); made[kind]++; } return item; };
  methods[remove] = (...args) => { if (objects.delete(args[0])) deleted[kind]++; return release(...args); };
}
renderer.createVertexArray = gl.createVertexArray.bind(gl);
renderer.deleteVertexArray = gl.deleteVertexArray.bind(gl);
const resources = () => Object.fromEntries([...live.entries()].map(([key, items]) => [key, items.size]));

const compositorGeometry = new Triangle(gl);
const compositorProgram = new Program(gl, { vertex, fragment: `#version 300 es
precision highp float; in vec2 vUv; uniform sampler2D source; out vec4 color;
void main() { color = texture(source, vUv); }`, uniforms: { source: { value: null } }, depthTest: false, depthWrite: false, cullFace: false });
const compositorMesh = new Mesh(gl, { geometry: compositorGeometry, program: compositorProgram });

let viewport: Viewport = { cssWidth: 390, cssHeight: 844, pixelWidth: 390, pixelHeight: 844, dpr: 1 };
let geometry: MaterialTargetGeometry = { capability: "background", x: 0, y: 0, width: 390, height: 844, pixelWidth: 390, pixelHeight: 844, dpr: 1, radiusCss: 0, borderWidthCss: 0, mask: { kind: "rounded-rect" } };
let params: FluidV2Params = { ...FLUID_V2_DEFAULTS, colors: [...FLUID_V2_DEFAULTS.colors] };
let seed = 147;
let quality: MaterialInit<FluidV2Params, null>["quality"] = "balanced";
let effect: MaterialPass<FluidV2Params> | null = null;
let output: MaterialFrameTexture | null = null;
let time = 0;
let running = false;
let raf = 0;
let previousTime = 0;
let samples: PointerSample[] = [];
let primary: PointerFrame = noPointer;

function stats() { return { diagnostics: effect?.getDiagnostics?.(), resources: resources(), made: { ...made }, deleted: { ...deleted }, uniformCache: gl.renderer.state.uniformLocations.size, alphaMode: output?.alphaMode, colorSpace: output?.colorSpace }; }
function compose() {
  if (!output) return;
  compositorProgram.uniforms.source.value = output.texture;
  renderer.render({ scene: compositorMesh, clear: true, frustumCull: false, sort: false });
}
function render(dt = 1 / 60, pointer: PointerFrame = noPointer, present = true) {
  if (!effect) throw new Error("No active Fluid v2 pass");
  time += dt;
  output = effect.render({ time, dt, pointer }, geometry);
  if (present) compose();
  return effect.getDiagnostics?.();
}
function open(nextParams: FluidV2Params = params, nextSeed = seed, nextQuality = quality) {
  effect?.dispose(); effect = null;
  params = { ...nextParams, colors: [...nextParams.colors] }; seed = nextSeed; quality = nextQuality; time = 0;
  renderer.setSize(viewport.pixelWidth, viewport.pixelHeight);
  canvas.style.width = `${viewport.cssWidth}px`; canvas.style.height = `${viewport.cssHeight}px`;
  const init: MaterialInit<FluidV2Params, null> = { params, seed, viewport, geometry, quality, limits: { maxTextureSize: 4096, maxRenderTargetBytes: 28 * 1024 * 1024 }, prepared: null };
  const plan = fluidV2Definition.plan(init);
  if (!plan.ok) throw new Error(JSON.stringify(plan.error));
  const mounted = fluidV2Definition.create(gl, { ...init, plan: plan.value });
  if (!mounted.ok) throw new Error(JSON.stringify(mounted.error));
  effect = mounted.value;
  render(0);
  status.textContent = JSON.stringify(stats(), null, 2);
  return stats();
}
function capture() {
  renderer.bindFramebuffer();
  const pixels = new Uint8Array(canvas.width * canvas.height * 4);
  gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  let hash = 2166136261, mass = 0, xMoment = 0, yMoment = 0, brightness = 0, alpha = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    for (let j = 0; j < 4; j++) hash = Math.imul(hash ^ pixels[i + j], 16777619);
    const value = Math.max(0, (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3 - 5.5);
    mass += value; xMoment += value * ((i / 4) % canvas.width) / canvas.width;
    yMoment += value * Math.floor(i / 4 / canvas.width) / canvas.height;
    brightness += pixels[i] + pixels[i + 1] + pixels[i + 2]; alpha += pixels[i + 3];
  }
  return { hash: hash >>> 0, mean: brightness / (canvas.width * canvas.height * 3), alpha: alpha / (canvas.width * canvas.height), center: mass ? [xMoment / mass, yMoment / mass] : null };
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
async function benchmark(frames = 30) {
  stop();
  const ext = gl.getExtension("EXT_disjoint_timer_query_webgl2") as { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number } | null;
  const cpu: number[] = [], intervals: number[] = [], queries: WebGLQuery[] = [];
  let last = 0;
  for (let i = 0; i < frames + 8; i++) {
    const stamp = await nextFrame();
    if (i >= 8 && last) intervals.push(stamp - last);
    last = stamp;
    const query = i >= 8 && ext ? gl.createQuery() : null;
    if (query && ext) gl.beginQuery(ext.TIME_ELAPSED_EXT, query);
    const start = performance.now(); render(1 / 60, noPointer, false);
    if (i >= 8) cpu.push(performance.now() - start);
    if (query && ext) { gl.endQuery(ext.TIME_ELAPSED_EXT); queries.push(query); }
    compose(); gl.flush();
  }
  for (let tries = 0; tries < 60 && queries.some((query) => !gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)); tries++) await nextFrame();
  const disjoint = ext ? Boolean(gl.getParameter(ext.GPU_DISJOINT_EXT)) : true;
  const gpu = !disjoint ? queries.filter((query) => gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)).map((query) => (gl.getQueryParameter(query, gl.QUERY_RESULT) as number) / 1e6) : [];
  queries.forEach((query) => gl.deleteQuery(query));
  const summary = (values: number[]) => { const sorted = [...values].sort((a, b) => a - b); return { n: values.length, p50: sorted[Math.floor(sorted.length * 0.5)] ?? null, p95: sorted[Math.floor(sorted.length * 0.95)] ?? null }; };
  const debug = gl.getExtension("WEBGL_debug_renderer_info");
  return { cpuMs: summary(cpu), gpuMs: summary(gpu), frameIntervalMs: summary(intervals), disjoint, renderer: gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER), viewport, ...stats() };
}

export const probe = {
  open, render, capture, stats, play, stop, benchmark,
  preset(index: number) {
    const preset = fluidV2Definition.presets[index];
    if (!preset) throw new Error("Unknown Fluid v2 preset");
    return open(preset.params, preset.seed, quality);
  },
  update(patch: Partial<FluidV2Params>) { params = { ...params, ...patch }; effect!.update(params); render(0); return capture(); },
  action(count: 1 | 2 | 3 | 4 | 5 | 6) { effect!.invokeAction?.({ kind: "seeded-splats", count }); render(0); return { pixels: capture(), diagnostics: effect!.getDiagnostics?.() }; },
  reset(nextSeed = seed) { effect!.reset(nextSeed); seed = nextSeed; time = 0; render(0); return capture(); },
  resize(width: number, height: number, dpr = 1) {
    viewport = { cssWidth: width, cssHeight: height, pixelWidth: Math.round(width * dpr), pixelHeight: Math.round(height * dpr), dpr };
    geometry = { ...geometry, width, height, pixelWidth: viewport.pixelWidth, pixelHeight: viewport.pixelHeight, dpr };
    return open(params, seed, quality); // Host re-plans/re-leases on pixel growth.
  },
  dispose() { stop(); effect?.dispose(); return stats(); },
  failure() {
    effect?.dispose(); effect = null;
    const before = resources(); const original = gl.checkFramebufferStatus.bind(gl); let checks = 0;
    gl.checkFramebufferStatus = (target) => ++checks === 3 ? gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT : original(target);
    let mounted;
    try {
      const init: MaterialInit<FluidV2Params, null> = { params, seed, viewport, geometry, quality, limits: { maxTextureSize: 4096, maxRenderTargetBytes: 28 * 1024 * 1024 }, prepared: null };
      const plan = fluidV2Definition.plan(init);
      if (!plan.ok) throw new Error(JSON.stringify(plan.error));
      mounted = fluidV2Definition.create(gl, { ...init, plan: plan.value });
    } finally { gl.checkFramebufferStatus = original; }
    if (mounted.ok) mounted.value.dispose();
    return { ok: mounted.ok, code: mounted.ok ? null : mounted.error.code, before, after: resources() };
  },
  error() { return gl.getError(); },
};
declare global { interface Window { fluidV2Probe: typeof probe } }
window.fluidV2Probe = probe;

document.querySelector("#play")!.addEventListener("click", () => { if (running) stop(); else play(); });
document.querySelector("#reset")!.addEventListener("click", () => probe.reset());
document.querySelector("#splats")!.addEventListener("click", () => probe.action(6));
const controls = document.querySelector("#controls")!;
for (const control of fluidV2Definition.schema.controls) {
  const label = document.createElement("label"); label.textContent = control.label;
  const input = document.createElement(control.kind === "select" ? "select" : "input");
  if (input instanceof HTMLInputElement) {
    if (control.kind === "range") { input.type = "range"; input.min = String(control.min); input.max = String(control.max); input.step = String(control.step); }
    if (control.kind === "toggle") input.type = "checkbox";
    if (control.kind === "color") input.type = "color";
    if (control.kind === "color-list") input.size = 36;
  }
  if (input instanceof HTMLSelectElement && control.kind === "select") for (const option of control.options) { const node = document.createElement("option"); node.value = option.value; node.textContent = option.label; input.append(node); }
  const value = params[control.key];
  if (input instanceof HTMLInputElement && input.type === "checkbox") input.checked = Boolean(value);
  else input.value = Array.isArray(value) ? value.join(",") : String(value);
  input.addEventListener("input", () => {
    const next = control.kind === "range" ? Number(input.value) : control.kind === "toggle" && input instanceof HTMLInputElement ? input.checked : control.kind === "color-list" ? input.value.split(",").map((s) => s.trim()) : input.value;
    const candidate = { ...params, [control.key]: next };
    const parsed = fluidV2Definition.schema.parse(candidate);
    if (parsed.ok) probe.update({ [control.key]: next });
  });
  label.append(input); controls.append(label);
}
let previousUV: readonly [number, number] | null = null;
for (const phase of ["enter", "down", "move", "up", "leave", "cancel"] as const) {
  canvas.addEventListener(`pointer${phase}`, (raw) => {
    const event = raw as PointerEvent;
    if (event.pointerType === "touch") return; // Passive and scroll-preserving fixture path.
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
