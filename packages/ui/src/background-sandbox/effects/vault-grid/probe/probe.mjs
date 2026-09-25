// Isolated manual-frame host. No app route, wallet data, RAF, storage, or second context.
import { Renderer, Program, Geometry, Mesh } from "ogl";
import { vaultGridDefinition } from "/src/background-sandbox/effects/vault-grid/definition";

const canvas = document.querySelector("canvas");
const renderer = new Renderer({
  canvas, webgl: 2, dpr: 1, alpha: false, antialias: false,
  depth: false, preserveDrawingBuffer: true,
});
const gl = renderer.gl;
const live = new Map();
for (const kind of ["Shader", "Program", "Buffer", "Texture", "Framebuffer"]) {
  live.set(kind, new Set());
  const create = gl[`create${kind}`].bind(gl);
  const remove = gl[`delete${kind}`].bind(gl);
  gl[`create${kind}`] = (...args) => {
    const value = create(...args);
    if (value) live.get(kind).add(value);
    return value;
  };
  gl[`delete${kind}`] = (value) => {
    live.get(kind).delete(value);
    return remove(value);
  };
}
const counts = () => Object.fromEntries([...live].map(([kind, values]) => [kind, values.size]));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const insist = (condition, message) => { if (!condition) throw new Error(message); };
const vertex = `#version 300 es
in vec2 position; out vec2 uv;
void main(){uv=position*.5+.5;gl_Position=vec4(position,0,1);}`;
const display = new Program(gl, {
  vertex,
  fragment: `#version 300 es
precision highp float; in vec2 uv; uniform sampler2D image; out vec4 color;
void main(){color=texture(image,uv);}`,
  uniforms: { image: { value: null } },
  depthTest: false, depthWrite: false, cullFace: false,
});
const displayGeometry = new Geometry(gl, {
  position: { size: 2, data: new Float32Array([-1, -1, 3, -1, -1, 3]) },
});
const displayQuad = new Mesh(gl, { program: display, geometry: displayGeometry });

const frame = (dt) => ({
  time: 0, dt,
  pointer: { uv: [0.5, 0.5], inside: false, down: false, samples: [] },
});
const geometryFor = (width, height, dpr = 1, capability = "background") => ({
  capability, x: 0, y: 0, width, height,
  pixelWidth: Math.round(width * dpr), pixelHeight: Math.round(height * dpr), dpr,
  radiusCss: capability === "button-fill" ? 12 : 0,
  borderWidthCss: 0, mask: { kind: "rounded-rect" },
});
const viewportFor = (geometry) => ({
  cssWidth: geometry.width, cssHeight: geometry.height,
  pixelWidth: geometry.pixelWidth, pixelHeight: geometry.pixelHeight, dpr: geometry.dpr,
});
const limits = {
  maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
  maxRenderTargetBytes: 28 * 1024 * 1024,
};
let geometry = geometryFor(256, 256);
let viewport = viewportFor(geometry);
let params = { ...vaultGridDefinition.schema.defaults };
let effect = null;
let output = null;
let lastPlan = null;
let lastMaterialState = null;

function start(nextParams = params, nextGeometry = geometry) {
  effect?.dispose();
  geometry = nextGeometry;
  viewport = viewportFor(geometry);
  params = { ...nextParams };
  const init = { params, seed: 7, viewport, geometry, quality: "balanced", limits, prepared: null };
  const planned = vaultGridDefinition.plan(init);
  insist(planned.ok, `plan: ${JSON.stringify(planned)}`);
  lastPlan = planned.value;
  const created = vaultGridDefinition.create(gl, { ...init, plan: lastPlan });
  insist(created.ok, `create: ${JSON.stringify(created)}`);
  effect = created.value;
  insist(effect.getDiagnostics().allocatedBytes === lastPlan.attachmentBytes, "plan/real bytes differ");
  return effect;
}
function draw(dt = 0) {
  insist(effect, "pass is not mounted");
  renderer.dpr = geometry.dpr;
  renderer.setSize(geometry.width, geometry.height);
  output = effect.render(frame(dt), geometry);
  insist(gl.getParameter(gl.FRAMEBUFFER_BINDING) !== null, "material drew to default framebuffer");
  const program = gl.getParameter(gl.CURRENT_PROGRAM);
  lastMaterialState = {
    shaderLinked: Boolean(program && gl.getProgramParameter(program, gl.LINK_STATUS)),
    framebufferComplete: gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE,
  };
  insist(lastMaterialState.shaderLinked && lastMaterialState.framebufferComplete,
    "shader link or material FBO is incomplete");
  insist(output.alphaMode === "opaque" && output.colorSpace === "display-srgb", "wrong output contract");
  display.uniforms.image.value = output.texture;
  renderer.render({ scene: displayQuad, clear: false });
  insist(gl.getError() === gl.NO_ERROR, "WebGL error after material and display pass");
  return output;
}
function pixels() {
  const buffer = new Uint8Array(geometry.pixelWidth * geometry.pixelHeight * 4);
  gl.readPixels(0, 0, geometry.pixelWidth, geometry.pixelHeight, gl.RGBA, gl.UNSIGNED_BYTE, buffer);
  return buffer;
}
function difference(a, b) {
  insist(a.length === b.length, "pixel dimensions differ");
  let total = 0;
  for (let i = 0; i < a.length; i += 1) total += Math.abs(a[i] - b[i]);
  return total / a.length;
}
function hash(bytes) {
  let value = 2166136261;
  for (let i = 0; i < bytes.length; i += 1) value = Math.imul(value ^ bytes[i], 16777619);
  return (value >>> 0).toString(16).padStart(8, "0");
}
function luma(bytes, x, y) {
  const at = (y * geometry.pixelWidth + x) * 4;
  return Math.round(bytes[at] * 0.2126 + bytes[at + 1] * 0.7152 + bytes[at + 2] * 0.0722);
}
function setParams(next) {
  const parsed = vaultGridDefinition.schema.parse(next);
  insist(parsed.ok, `params: ${JSON.stringify(parsed)}`);
  params = parsed.value;
  effect.update(params);
  effect.reset(7);
  draw();
}
function setPreset(id) {
  const preset = vaultGridDefinition.presets.find((item) => item.id === id);
  insist(preset, `unknown preset ${id}`);
  setParams(preset.params);
}

start(); draw();
window.vaultProof = {
  presetIds: vaultGridDefinition.presets.map((item) => item.id),
  preset(id) { setPreset(id); return { hash: hash(pixels()), diagnostics: effect.getDiagnostics() }; },
  button() {
    start(vaultGridDefinition.schema.defaults, geometryFor(120, 48, 1.5, "button-fill"));
    draw();
    return { output: [output.width, output.height], diagnostics: effect.getDiagnostics() };
  },
  resize(width, height, dpr = 1) {
    const next = geometryFor(width, height, dpr);
    const old = output?.texture?.texture;
    const dimensionsChanged = next.pixelWidth !== geometry.pixelWidth || next.pixelHeight !== geometry.pixelHeight;
    effect.resize(viewportFor(next), next);
    geometry = next;
    viewport = viewportFor(next);
    draw();
    if (dimensionsChanged) insist(!old || !gl.isTexture(old), "resize retained old target texture");
    else insist(output.texture.texture === old, "same-size resize reallocated target");
    return { output: [output.width, output.height], diagnostics: effect.getDiagnostics() };
  },
  run() {
    const report = {
      profile: {}, presetImages: {}, controls: {}, sizes: [],
      resourceCycles: 0, renderer: "", plan: null, button: null,
      pauseDelta: null, driftDelta: null, errors: [],
    };
    const debug = gl.getExtension("WEBGL_debug_renderer_info");
    report.renderer = debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    report.canvasCount = document.querySelectorAll("canvas").length;
    insist(report.canvasCount === 1, "probe created extra canvas");
    report.plan = lastPlan;
    report.materialState = lastMaterialState;
    insist(lastPlan.passesPerFrame === 1 && lastPlan.textureBytes === 0, "wrong one-pass plan");

    // Isolate geometry from palette: all three variants use identical colors and light.
    const shared = {
      ...vaultGridDefinition.schema.defaults,
      cellSize: 48, lineWidth: 4, bevel: 4, depth: 1.2,
      baseColor: "#17212a", metalColor: "#b5bbc2", drift: 0,
    };
    const images = {};
    for (const pattern of ["tile", "rib", "engraved"]) {
      setParams({ ...shared, pattern });
      images[pattern] = pixels();
      report.profile[pattern] = {
        hash: hash(images[pattern]),
        horizontalLuma: [0, 1, 2, 3, 4, 6, 8, 12, 20].map((x) => luma(images[pattern], x, 24)),
      };
    }
    report.profile.differences = {
      tileRib: difference(images.tile, images.rib),
      tileEngraved: difference(images.tile, images.engraved),
      ribEngraved: difference(images.rib, images.engraved),
    };
    for (const delta of Object.values(report.profile.differences)) {
      insist(delta > 1, `geometry modes too similar: ${delta}`);
    }
    insist(report.profile.tile.horizontalLuma[0] < report.profile.tile.horizontalLuma.at(-1),
      "tile bevel is not raised");
    insist(report.profile.rib.horizontalLuma[0] > report.profile.rib.horizontalLuma.at(-1),
      "rib is not raised");

    for (const preset of vaultGridDefinition.presets) {
      setPreset(preset.id);
      report.presetImages[preset.id] = { hash: hash(pixels()), diagnostics: effect.getDiagnostics() };
    }
    const firstTexture = output.texture;
    const beforeControls = counts();
    const controls = [
      ["pattern", "tile", "rib"], ["cellSize", 36, 128], ["lineWidth", 1, 10],
      ["bevel", 0.5, 12], ["depth", 0.1, 2], ["roughness", 0.08, 1],
      ["lightAngle", -160, 20], ["lightElevation", 15, 80],
      ["lightStrength", 0.2, 2], ["baseColor", "#101820", "#803030"],
      ["metalColor", "#808080", "#e1c080"],
    ];
    for (const [key, low, high] of controls) {
      setParams({ ...shared, [key]: low }); const a = pixels();
      setParams({ ...shared, [key]: high }); const b = pixels();
      const delta = difference(a, b);
      insist(delta > 0.05, `inert control ${key}: ${delta}`);
      report.controls[key] = delta;
      insist(output.texture === firstTexture, `control ${key} reallocated target`);
    }
    insist(same(counts(), beforeControls), "uniform update changed GPU resource count");
    setParams({ ...shared, drift: 0 });
    const still = pixels();
    for (let i = 0; i < 60; i += 1) draw(0.05);
    report.pauseDelta = difference(still, pixels());
    insist(report.pauseDelta === 0, "zero drift is not static");
    setParams({ ...shared, drift: 0.05 });
    const moving = pixels();
    for (let i = 0; i < 60; i += 1) draw(0.05);
    report.driftDelta = difference(moving, pixels());
    insist(report.driftDelta > 0, "light drift has no visible effect");
    const paused = pixels();
    for (let i = 0; i < 3; i += 1) draw(0);
    insist(difference(paused, pixels()) === 0, "dt=0 changed material");

    const cleanBefore = output.texture.texture;
    effect.dispose(); effect.dispose(); effect = null;
    insist(!gl.isTexture(cleanBefore), "dispose retained target texture");
    const clean = counts();
    const uniformLocations = renderer.state.uniformLocations.size;
    for (let i = 0; i < 5; i += 1) {
      start(shared); draw(0); effect.dispose(); effect = null;
      insist(same(counts(), clean), `resource leak after cycle ${i}`);
      insist(renderer.state.uniformLocations.size === uniformLocations, "uniform cache leak");
      report.resourceCycles += 1;
    }
    start(shared); draw(0);
    for (const [width, height, dpr] of [[320, 640, 1.5], [390, 844, 1.5], [430, 640, 1.5], [480, 640, 1.5]]) {
      const next = geometryFor(width, height, dpr);
      const old = output.texture.texture;
      effect.resize(viewportFor(next), next);
      geometry = next; viewport = viewportFor(next); draw();
      insist(output.width === next.pixelWidth && output.height === next.pixelHeight, "resize dimensions wrong");
      insist(!gl.isTexture(old), "resize retained old texture");
      report.sizes.push({ width, height, dpr, diagnostics: effect.getDiagnostics() });
    }
    const buttonGeometry = geometryFor(120, 48, 1.5, "button-fill");
    start(shared, buttonGeometry); draw();
    report.button = { output: [output.width, output.height], diagnostics: effect.getDiagnostics(), hash: hash(pixels()) };
    insist(report.button.diagnostics.allocatedBytes === 51_840, "button-local plan wrong");
    start(vaultGridDefinition.schema.defaults, geometryFor(640, 400)); draw();
    report.finalDiagnostics = effect.getDiagnostics();
    return report;
  },
  loss() {
    const extension = gl.getExtension("WEBGL_lose_context");
    insist(extension, "WEBGL_lose_context unavailable");
    return new Promise((resolve) => {
      canvas.addEventListener("webglcontextlost", (event) => {
        event.preventDefault();
        const init = { params, seed: 7, viewport, geometry, quality: "balanced", limits, prepared: null };
        const plan = vaultGridDefinition.plan(init);
        const result = vaultGridDefinition.create(gl, { ...init, plan: plan.value });
        let renderFailed = false;
        try { effect.render(frame(0), geometry); } catch { renderFailed = true; }
        effect.dispose(); effect = null;
        resolve({ createFailure: result.ok ? null : result.error.code, renderFailed });
      }, { once: true });
      extension.loseContext();
    });
  },
};
