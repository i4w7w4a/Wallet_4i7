/** One-context technical probe; mounted only by run.mjs, never exported to product. */
import { Mesh, Program, Renderer, Triangle, Texture, type OGLRenderingContext } from "ogl";
import type { Frame, Viewport } from "../../../contracts";
import type { MaterialDefinition, MaterialPass, MaterialTargetGeometry } from "../../../material-contract";
import { gemSmokeDefinition, heatmapDefinition, liquidMetalDefinition, pulsingBorderDefinition } from "../definitions";
import { clearPaperPreparedAssets, type PaperPreparedAssets } from "../prepare";
import type { PaperKind, PaperParams } from "../gpu";

const canvas = document.querySelector("canvas")!;
const status = document.querySelector("#status")!;
const definitions = {
  "liquid-metal": liquidMetalDefinition,
  "pulsing-border": pulsingBorderDefinition,
  "gem-smoke": gemSmokeDefinition,
  "heatmap": heatmapDefinition,
} as const;
type Target = "fill" | "icon" | "border" | "background";

let renderer = new Renderer({ canvas, webgl: 2, dpr: 1, alpha: true, premultipliedAlpha: false,
  depth: false, stencil: false, antialias: false, preserveDrawingBuffer: true });
let gl = renderer.gl as OGLRenderingContext & WebGL2RenderingContext;
let copyProgram: Program;
let copyMesh: Mesh;
let copyGeometry: Triangle;
let copyTexture: Texture;
let active: MaterialPass<PaperParams> | null = null;
let geometry: MaterialTargetGeometry;
let viewport: Viewport;
let params: PaperParams;
let prepared: PaperPreparedAssets;
let time = 0;
const pointer: Frame["pointer"] = { uv: [0.5, 0.5], inside: false, down: false, samples: [] };

function makeCopy() {
  copyGeometry = new Triangle(gl);
  copyTexture = new Texture(gl, { image: new Uint8Array([0, 0, 0, 0]), width: 1, height: 1,
    minFilter: gl.LINEAR, magFilter: gl.LINEAR, generateMipmaps: false });
  copyProgram = new Program(gl, { vertex: `#version 300 es
    in vec2 position; out vec2 uv; void main() { uv = position * 0.5 + 0.5; gl_Position = vec4(position, 0.0, 1.0); }`,
    fragment: `#version 300 es
    precision highp float; in vec2 uv; uniform sampler2D source; out vec4 fragColor;
    void main() { fragColor = texture(source, uv); }`,
    uniforms: { source: { value: copyTexture } }, transparent: false, depthTest: false, depthWrite: false, cullFace: false });
  copyMesh = new Mesh(gl, { geometry: copyGeometry, program: copyProgram, frustumCulled: false });
  renderer.render({ scene: copyMesh, clear: false, update: false, sort: false, frustumCull: false });
}
makeCopy();

const live = new Map<string, Set<unknown>>();
for (const [create, remove, key] of [
  ["createTexture", "deleteTexture", "textures"], ["createFramebuffer", "deleteFramebuffer", "framebuffers"],
  ["createProgram", "deleteProgram", "programs"], ["createShader", "deleteShader", "shaders"],
  ["createBuffer", "deleteBuffer", "buffers"], ["createVertexArray", "deleteVertexArray", "vaos"],
] as const) {
  const objects = new Set<unknown>();
  live.set(key, objects);
  const methods = gl as unknown as Record<string, (...args: unknown[]) => unknown>;
  const allocate = methods[create].bind(gl);
  const release = methods[remove].bind(gl);
  methods[create] = (...args) => { const object = allocate(...args); if (object) objects.add(object); return object; };
  methods[remove] = (...args) => { objects.delete(args[0]); return release(...args); };
}
renderer.createVertexArray = gl.createVertexArray.bind(gl);
renderer.deleteVertexArray = gl.deleteVertexArray.bind(gl);
const resources = () => Object.fromEntries([...live].map(([key, set]) => [key, set.size]));

function sceneGeometry(target: Target): MaterialTargetGeometry {
  const box = target === "icon" ? [21, 21] : target === "background" ? [256, 144] : [88, 79];
  const dpr = target === "background" ? 1 : 1.5;
  return {
    capability: target === "icon" ? "button-icon" : target === "border" ? "button-border" :
      target === "background" ? "background" : "button-fill",
    x: 0, y: 0, width: box[0]!, height: box[1]!,
    pixelWidth: Math.round(box[0]! * dpr), pixelHeight: Math.round(box[1]! * dpr), dpr,
    radiusCss: target === "icon" || target === "background" ? 0 : 12,
    borderWidthCss: target === "border" ? 2 : 0,
    mask: target === "icon" ? { kind: "icon", assetId: "mono.quick.send" } : { kind: "rounded-rect" },
  };
}

function selectDefinition(id: PaperKind): MaterialDefinition<PaperKind, PaperParams, PaperPreparedAssets> {
  return definitions[id] as unknown as MaterialDefinition<PaperKind, PaperParams, PaperPreparedAssets>;
}

async function open(id: PaperKind, target: Target, preset = "quiet-steel") {
  close();
  const definition = selectDefinition(id);
  const chosen = definition.presets.find((entry) => entry.id === preset) ?? definition.presets[0]!;
  params = structuredClone(chosen.params);
  geometry = sceneGeometry(target);
  viewport = { cssWidth: geometry.width, cssHeight: geometry.height,
    pixelWidth: geometry.pixelWidth, pixelHeight: geometry.pixelHeight, dpr: geometry.dpr };
  renderer.setSize(geometry.pixelWidth, geometry.pixelHeight);
  canvas.style.width = `${geometry.width * 3}px`;
  canvas.style.height = `${geometry.height * 3}px`;
  const request = { params, seed: 0, geometry, quality: "balanced" as const, maxCpuBytes: 4 * 1024 * 1024 };
  const prep = definition.prepare ? await definition.prepare(request, new AbortController().signal) : { ok: true as const, value: { cacheKey: "none", byteLength: 0, assets: [] } };
  if (!prep.ok) throw new Error(`prepare ${id}: ${JSON.stringify(prep.error)}`);
  prepared = prep.value;
  const init = { params, seed: 0, geometry, viewport, quality: "balanced" as const,
    prepared, limits: { maxTextureSize: 4096, maxRenderTargetBytes: 8 * 1024 * 1024 } };
  const plan = definition.plan(init);
  if (!plan.ok) throw new Error(`plan ${id}: ${JSON.stringify(plan.error)}`);
  const created = definition.create(gl, { ...init, plan: plan.value });
  if (!created.ok) throw new Error(`create ${id}: ${JSON.stringify(created.error)}`);
  active = created.value;
  time = 0;
  const capture = render(0);
  status.textContent = JSON.stringify({ id, target, plan: plan.value, capture, resources: resources() }, null, 2);
  return { capture, plan: plan.value, preparedBytes: prepared.byteLength,
    maskDimensions: prepared.assets.map((asset) => [asset.width, asset.height]),
    noiseDimensions: prepared.noise ? [prepared.noise.width, prepared.noise.height] : null,
    resources: resources() };
}

function render(dt = 0) {
  if (!active) throw new Error("No Paper pass");
  time += dt;
  const output = active.render({ time, dt, pointer }, geometry);
  copyProgram.uniforms.source.value = output.texture;
  renderer.render({ scene: copyMesh, clear: false, update: false, sort: false, frustumCull: false });
  return capture();
}

function capture() {
  gl.renderer.bindFramebuffer();
  const pixels = new Uint8Array(canvas.width * canvas.height * 4);
  gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  let hash = 2166136261;
  let visible = 0;
  let alphaSum = 0;
  let premulViolations = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    for (let c = 0; c < 4; c++) hash = Math.imul(hash ^ pixels[i + c]!, 16777619) >>> 0;
    const alpha = pixels[i + 3]!;
    alphaSum += alpha;
    if (alpha > 12) visible++;
    if (pixels[i]! > alpha + 1 || pixels[i + 1]! > alpha + 1 || pixels[i + 2]! > alpha + 1) premulViolations++;
  }
  const center = Math.floor(canvas.height / 2) * canvas.width + Math.floor(canvas.width / 2);
  return { width: canvas.width, height: canvas.height, hash: hash >>> 0,
    visible, meanAlpha: alphaSum / (canvas.width * canvas.height), premulViolations,
    center: [...pixels.slice(center * 4, center * 4 + 4)], error: gl.getError() };
}

function update(patch: Partial<PaperParams>) {
  if (!active) throw new Error("No Paper pass");
  params = { ...params, ...patch } as PaperParams;
  active.update(params);
  return render(0);
}

function resize(scale: number) {
  if (!active) throw new Error("No Paper pass");
  geometry = { ...geometry, width: geometry.width * scale, height: geometry.height * scale,
    pixelWidth: Math.max(1, Math.floor(geometry.pixelWidth * scale)),
    pixelHeight: Math.max(1, Math.floor(geometry.pixelHeight * scale)) };
  viewport = { cssWidth: geometry.width, cssHeight: geometry.height,
    pixelWidth: geometry.pixelWidth, pixelHeight: geometry.pixelHeight, dpr: geometry.dpr };
  renderer.setSize(geometry.pixelWidth, geometry.pixelHeight);
  active.resize(viewport, geometry);
  return render(0);
}

function close() {
  active?.dispose();
  active = null;
  return resources();
}

async function lossRestore() {
  close();
  const ext = gl.getExtension("WEBGL_lose_context");
  if (!ext) return { supported: false };
  const eventWithTimeout = (name: "webglcontextlost" | "webglcontextrestored") =>
    new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`${name} timeout`)), 5000);
      canvas.addEventListener(name, (event) => {
        if (name === "webglcontextlost") event.preventDefault();
        clearTimeout(timeout); resolve();
      }, { once: true });
    });
  const lost = eventWithTimeout("webglcontextlost");
  status.textContent = "Context: loss requested";
  ext.loseContext();
  await lost;
  status.textContent = "Context: lost";
  const definition = selectDefinition("liquid-metal");
  const failed = definition.create(gl, { params: liquidMetalDefinition.schema.defaults, seed: 0,
    geometry: sceneGeometry("fill"), viewport: { cssWidth: 88, cssHeight: 79, pixelWidth: 132, pixelHeight: 119, dpr: 1.5 },
    quality: "balanced", prepared: { cacheKey: "none", byteLength: 0, assets: [] },
    limits: { maxTextureSize: 4096, maxRenderTargetBytes: 8 * 1024 * 1024 },
    plan: { attachmentBytes: 132 * 119 * 4, textureBytes: 4, passesPerFrame: 1, quality: "probe" } });
  const restored = eventWithTimeout("webglcontextrestored");
  status.textContent = "Context: restore requested";
  await new Promise((resolve) => setTimeout(resolve, 50));
  ext.restoreContext();
  await restored;
  status.textContent = "Context: restored";
  renderer = new Renderer({ canvas, webgl: 2, dpr: 1, alpha: true, premultipliedAlpha: false,
    depth: false, stencil: false, antialias: false, preserveDrawingBuffer: true });
  gl = renderer.gl as OGLRenderingContext & WebGL2RenderingContext;
  renderer.createVertexArray = gl.createVertexArray.bind(gl);
  renderer.deleteVertexArray = gl.deleteVertexArray.bind(gl);
  makeCopy();
  live.forEach((entries) => entries.clear());
  const post = await open("liquid-metal", "fill", "quiet-steel");
  close();
  return { supported: true, lostFailure: failed.ok ? "unexpected-success" : failed.error.code,
    restored: !gl.isContextLost(), postRestore: post.capture };
}

const debug = gl.getExtension("WEBGL_debug_renderer_info");
export const paperProbe = {
  open, render, capture, update, resize, close, lossRestore, resources,
  diagnostics: () => active?.getDiagnostics?.(),
  renderer: () => gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER),
  error: () => gl.getError(),
  finish: () => { close(); clearPaperPreparedAssets(); return resources(); },
};
declare global { interface Window { paperProbe: typeof paperProbe } }
window.paperProbe = paperProbe;
status.textContent = "Paper probe ready";
