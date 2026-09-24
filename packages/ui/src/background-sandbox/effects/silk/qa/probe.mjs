// Test-only host. Never imported by the runtime/registry. One borrowed context,
// manual frame stepping, no RAF, no storage, and no application shell changes.
import { Renderer, Program, Geometry, Mesh, RenderTarget } from "ogl";
import { silkDefinition } from "/silk/definition";

const canvas = document.querySelector("canvas");
const renderer = new Renderer({ canvas, webgl: 2, dpr: 1, alpha: false, antialias: false, depth: false, preserveDrawingBuffer: true });
const gl = renderer.gl;
const live = new Map();
let fault = null;
const kinds = ["Shader", "Program", "Buffer", "Texture", "Framebuffer"];
for (const kind of kinds) {
  live.set(kind, new Set());
  const create = gl[`create${kind}`].bind(gl);
  const remove = gl[`delete${kind}`].bind(gl);
  gl[`create${kind}`] = (...args) => {
    if (fault?.kind === kind && --fault.remaining === 0) return null;
    const handle = create(...args);
    if (handle) live.get(kind).add(handle);
    return handle;
  };
  gl[`delete${kind}`] = (handle) => { live.get(kind).delete(handle); return remove(handle); };
}
live.set("VertexArray", new Set());
const createVAO = renderer.createVertexArray;
const deleteVAO = renderer.deleteVertexArray;
renderer.createVertexArray = (...args) => { const value = createVAO(...args); live.get("VertexArray").add(value); return value; };
renderer.deleteVertexArray = (value) => { live.get("VertexArray").delete(value); return deleteVAO(value); };

const vertex = `#version 300 es
in vec2 position; out vec2 uv;
void main(){uv=position*.5+.5;gl_Position=vec4(position,0,1);}`;
const display = new Program(gl, { vertex, fragment: `#version 300 es
precision highp float; in vec2 uv; uniform sampler2D image; out vec4 color;
void main(){color=texture(image,uv);}`, uniforms: { image: { value: null } }, depthTest: false, depthWrite: false, cullFace: false });
const geometry = new Geometry(gl, { position: { size: 2, data: new Float32Array([-1, -1, 3, -1, -1, 3]) } });
const quad = new Mesh(gl, { program: display, geometry });
const readTarget = new RenderTarget(gl, { width: 1, height: 1, depth: false });
// Used only as a known host-owned neighbor during failure/cleanup tests.
const neighborTexture = readTarget.texture.texture;
const counts = () => Object.fromEntries([...live].map(([kind, handles]) => [kind, handles.size]));
let effect = null;
let output = null;
let viewport = size(640, 400);
const limits = { maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE), maxRenderTargetBytes: 32 * 1024 * 1024 };
let params = { ...silkDefinition.schema.defaults };

function size(width, height) { return { cssWidth: width, cssHeight: height, pixelWidth: width, pixelHeight: height, dpr: 1 }; }
function insist(condition, message) { if (!condition) throw new Error(message); }
function mount(next = params, seed = 0) {
  effect?.dispose();
  effect = null;
  const result = silkDefinition.create(gl, { params: next, seed, viewport, limits });
  insist(result.ok, JSON.stringify(result));
  effect = result.value;
  params = { ...next };
}
function draw(dt = 0, uv = [0.5, 0.5], inside = false) {
  renderer.setSize(viewport.cssWidth, viewport.cssHeight);
  output = effect.render({ time: 0, dt, pointer: { uv, inside, down: false, samples: [] } });
  insist(gl.getParameter(gl.FRAMEBUFFER_BINDING) !== null, "effect drew to default framebuffer");
  display.uniforms.image.value = output.texture;
  renderer.render({ scene: quad, clear: false });
  insist(gl.getError() === gl.NO_ERROR, "WebGL error after material/compositor");
  return output;
}
function pixels() {
  const result = new Uint8Array(viewport.pixelWidth * viewport.pixelHeight * 4);
  gl.readPixels(0, 0, viewport.pixelWidth, viewport.pixelHeight, gl.RGBA, gl.UNSIGNED_BYTE, result);
  return result;
}
function difference(a, b) { let sum = 0; for (let i = 0; i < a.length; i += 1) sum += Math.abs(a[i] - b[i]); return sum / a.length; }
function preset(id) {
  const value = silkDefinition.presets.find((item) => item.id === id);
  effect.update(value.params); params = { ...value.params }; effect.reset(value.seed); draw();
  return { params, diagnostics: effect.getDiagnostics() };
}

mount(); draw();
window.silkProof = {
  presets: silkDefinition.presets.map(({ id }) => id),
  preset,
  resize(width, height) { viewport = size(width, height); effect.resize(viewport); draw(); return effect.getDiagnostics(); },
  run() {
    const report = { controlDifferences: {}, viewportBudgets: [], gestures: {}, allocationFailures: [], cycleCount: 0 };
    // A compositor may finish its preceding frame with a region scissor active.
    // A full material target must be complete regardless of that incoming state.
    const unclipped = pixels();
    renderer.enable(gl.SCISSOR_TEST); renderer.setScissor(0, 0);
    mount();
    output = effect.render({ time: 0, dt: 0, pointer: { uv: [.5, .5], inside: false, down: false, samples: [] } });
    renderer.disable(gl.SCISSOR_TEST);
    display.uniforms.image.value = output.texture; renderer.render({ scene: quad, clear: false });
    report.incomingScissorDelta = difference(unclipped, pixels());
    insist(report.incomingScissorDelta < .02, `incoming host scissor clipped material: ${report.incomingScissorDelta}`);
    const baseline = silkDefinition.presets.find(({ id }) => id === "radiant-baseline").params;
    const initial = counts();
    const firstTexture = output.texture;
    for (const [key, low, high] of [["sheenIntensity", .3, 2], ["foldScale", .6, 1.8], ["lightWidth", .5, 2], ["palette", "radiant", "graphite"]]) {
      effect.update({ ...baseline, [key]: low }); effect.reset(0); draw(); const before = pixels();
      effect.update({ ...baseline, [key]: high }); effect.reset(0); draw(); const after = pixels();
      const delta = difference(before, after);
      insist(delta > .4, `inert control ${key}: ${delta}`);
      report.controlDifferences[key] = delta;
      insist(output.texture === firstTexture, "update remounted/reallocated effect");
    }
    effect.update({ ...baseline, flowSpeed: .1 }); effect.reset(0);
    for (let i = 0; i < 60; i += 1) draw(1 / 60);
    const slow = pixels();
    effect.update({ ...baseline, flowSpeed: 1.5 }); effect.reset(0);
    for (let i = 0; i < 60; i += 1) draw(1 / 60);
    report.controlDifferences.flowSpeed = difference(slow, pixels());
    insist(report.controlDifferences.flowSpeed > .4, "inert flow control");
    insist(JSON.stringify(counts()) === JSON.stringify(initial), "update changed resource count");

    effect.update(baseline); effect.reset(0); draw();
    const restarted = pixels();
    draw(1 / 60, [1, 0], true); draw(1 / 60, [0, 1], true); draw(1 / 60, [0, 1], false);
    const beforeResume = pixels(); draw(0, [.1, .95], true);
    insist(difference(beforeResume, pixels()) === 0, "re-entry with dt=0 snapped");
    report.gestures.zeroDtReentryDelta = difference(beforeResume, pixels());
    for (const fps of [30, 144]) {
      effect.reset(0);
      for (const [uv, inside] of [[[.9, .1], true], [[.9, .1], false], [[.1, .95], true]]) {
        for (let i = 0; i < fps; i += 1) draw(1 / fps, uv, inside);
      }
      report.gestures[fps] = pixels();
    }
    report.gestures.fpsDelta = difference(report.gestures[30], report.gestures[144]);
    delete report.gestures[30]; delete report.gestures[144];
    insist(report.gestures.fpsDelta < .02, "frame-rate dependent light");
    effect.reset(0); draw(); insist(difference(restarted, pixels()) === 0, "reset(seed) did not restore phase");

    const beforeResize = output.texture.texture;
    for (const width of [320, 390, 430, 480, 1280]) {
      viewport = size(width, width === 1280 ? 720 : 640);
      effect.resize(viewport); draw();
      report.viewportBudgets.push({ width, height: viewport.pixelHeight, ...effect.getDiagnostics() });
      insist(output.width === width && output.height === viewport.pixelHeight, "wrong physical output dimensions");
    }
    insist(!gl.isTexture(beforeResize), "resize retained old texture");
    viewport = size(640, 400); effect.resize(viewport); draw();
    insist(difference(restarted, pixels()) === 0, "resize changed phase");
    effect.dispose(); effect.dispose(); effect = null;
    insist(gl.isTexture(neighborTexture), "effect cleanup deleted host texture");
    const clean = counts();
    const cleanUniforms = renderer.state.uniformLocations.size;
    for (let i = 0; i < 20; i += 1) {
      mount(); draw(1 / 60); effect.dispose(); effect = null;
      insist(JSON.stringify(counts()) === JSON.stringify(clean), `GPU leak after cycle ${i}`);
      insist(renderer.state.uniformLocations.size === cleanUniforms, `uniform cache leak after cycle ${i}`);
      report.cycleCount += 1;
    }
    for (const [kind, ordinal] of [["Shader", 1], ["Shader", 2], ["Program", 1], ["Buffer", 1], ["Framebuffer", 1], ["Texture", 1]]) {
      fault = { kind, remaining: ordinal };
      const result = silkDefinition.create(gl, { params: baseline, seed: 0, viewport, limits });
      fault = null;
      insist(!result.ok, `allocation failure accepted: ${kind}`);
      insist(JSON.stringify(counts()) === JSON.stringify(clean), `partial ${kind} leaked`);
      insist(gl.isTexture(neighborTexture), "failure removed host neighbor");
      report.allocationFailures.push(`${kind}:${ordinal}`);
      mount(baseline); draw(); effect.dispose(); effect = null;
      insist(JSON.stringify(counts()) === JSON.stringify(clean), `repeat create leaked after ${kind}`);
    }
    mount(); draw();
    report.resourcesAfterMount = counts();
    report.canvasCount = document.querySelectorAll("canvas").length;
    report.adapterRaf = "none; this probe uses manual frame stepping";
    const debug = gl.getExtension("WEBGL_debug_renderer_info");
    report.renderer = debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    const times = [];
    const fencePixel = new Uint8Array(4);
    for (let i = 0; i < 24; i += 1) {
      const begin = performance.now(); draw(1 / 60);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, fencePixel);
      if (i >= 4) times.push(performance.now() - begin);
    }
    times.sort((a, b) => a - b);
    report.frameTiming = { viewport: "640x400", method: "material + compositor + 1px readback fence wall time, 4 warmup + 20 frames; software renderer, not a device FPS claim", medianMs: times[10], p95Ms: times[18] };
    report.diagnostics = effect.getDiagnostics();
    return report;
  },
  async compareUpstream() {
    const baseline = silkDefinition.presets.find(({ id }) => id === "radiant-baseline").params;
    effect.update(baseline); effect.reset(0); draw();
    const ours = pixels();
    effect.dispose(); effect = null;
    const source = await (await fetch("/baseline.glsl")).text();
    const sourceProgram = new Program(gl, {
      vertex: `#version 300 es\nin vec2 position; void main(){gl_Position=vec4(position,0,1);}`,
      fragment: source,
      uniforms: { u_time: { value: 0 }, u_res: { value: [viewport.pixelWidth, viewport.pixelHeight] },
        u_flowSpeed: { value: .4 }, u_sheenIntensity: { value: 1 }, u_mouse: { value: [-1, -1] } },
      depthTest: false, depthWrite: false, cullFace: false,
    });
    const sourceGeometry = new Geometry(gl, { position: { size: 2, data: new Float32Array([-1, -1, 3, -1, -1, 3]) } });
    const sourceTarget = new RenderTarget(gl, { width: viewport.pixelWidth, height: viewport.pixelHeight, depth: false });
    renderer.render({ scene: new Mesh(gl, { program: sourceProgram, geometry: sourceGeometry }), target: sourceTarget, clear: false });
    display.uniforms.image.value = sourceTarget.texture;
    renderer.render({ scene: quad, clear: false });
    const delta = difference(ours, pixels());
    sourceGeometry.remove();
    sourceProgram.uniformLocations.forEach((location) => renderer.state.uniformLocations.delete(location));
    gl.deleteShader(sourceProgram.vertexShader); gl.deleteShader(sourceProgram.fragmentShader); sourceProgram.remove();
    gl.deleteTexture(sourceTarget.texture.texture); gl.deleteFramebuffer(sourceTarget.buffer);
    insist(delta < .02, `upstream baseline drift: ${delta}`);
    mount(); draw();
    return { blob: "70741edbdff44f8d9af20a25d82be8fdb53ce2f5", time: 0, pointer: "absent", meanByteDelta: delta };
  },
  loseContext() {
    const extension = gl.getExtension("WEBGL_lose_context");
    insist(extension, "context loss extension missing");
    return new Promise((resolve) => {
      canvas.addEventListener("webglcontextlost", (event) => {
        event.preventDefault();
        const result = silkDefinition.create(gl, { params, seed: 0, viewport, limits });
        let renderFailed = false;
        try { draw(); } catch { renderFailed = true; }
        effect.dispose(); effect = null;
        resolve({ createFailure: result.ok ? null : result.error.code, renderFailed });
      }, { once: true });
      extension.loseContext();
    });
  },
};
