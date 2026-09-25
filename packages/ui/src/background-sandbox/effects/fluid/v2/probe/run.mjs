// Test-only probe. Run only after ORACLE grants one browser/GPU slot and a free port.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../../../../../../../../");
const require = createRequire(resolve(root, "apps/miniapp/package.json"));
const { chromium } = require("@playwright/test");
const url = process.env.FLUID_V2_PROBE_URL;
if (!url) throw new Error("Set FLUID_V2_PROBE_URL to the coordinator-assigned local probe URL");
const evidence = resolve(process.env.FLUID_V2_EVIDENCE_DIR || resolve(here, "evidence"));
await mkdir(evidence, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 }, deviceScaleFactor: 1 });
const errors = [], readbackWarnings = [], expectedContextLossWarnings = [];
let deliberateLoss = false;
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => {
  if (!["error", "warning"].includes(message.type())) return;
  if (/GL Driver Message.*GPU stall due to ReadPixels/.test(message.text())) readbackWarnings.push(message.text());
  else if (deliberateLoss && /CONTEXT_LOST_WEBGL|WebGL context was lost/.test(message.text())) expectedContextLossWarnings.push(message.text());
  else errors.push(message.text());
});
const results = {};
try {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.fluidV2Probe?.stats().diagnostics?.targetCount === 20);
  results.initial = await page.evaluate(() => ({ image: window.fluidV2Probe.capture(), ...window.fluidV2Probe.stats(), error: window.fluidV2Probe.error() }));
  assert.equal(results.initial.diagnostics.targetCount, 20);
  assert.ok(results.initial.diagnostics.allocatedBytes <= 28 * 1024 * 1024);
  assert.equal(results.initial.alphaMode, "opaque");
  assert.equal(results.initial.colorSpace, "display-srgb");
  assert.equal(results.initial.error, 0);

  results.behavior = await page.evaluate(() => {
    const p = window.fluidV2Probe;
    const pointer = (phase, t, delta = [0, 0], down = true) => ({ uv: [0.55, 0.5], inside: true, down, samples: [{ phase, id: 1, uv: [0.55, 0.5], delta, time: t, buttons: down ? 1 : 0 }] });
    const initial = p.reset(), repeated = p.reset();
    const madeBefore = p.stats().made;
    const original = p.capture();
    const recolored = p.update({ colors: ["#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#00FFFF", "#FF00FF"] });
    const madeAfter = p.stats().made;
    p.update({ colors: ["#9AA6B3", "#62738B", "#A7927E"] });
    p.reset();
    p.render(1 / 60, pointer("down", 1));
    const splat = p.render(1 / 60, pointer("move", 2, [0.02, 0.015]));
    p.render(1 / 60, pointer("up", 3, [0, 0], false));
    const released = p.capture();
    for (let i = 0; i < 20; i++) p.render(1 / 60);
    const afterRelease = p.capture();
    const idle = p.stats().diagnostics;
    const beforePause = p.capture(), paused = p.render(0), afterPause = p.capture();
    const entered = p.render(1 / 60, pointer("enter", 4, [100, 100]));
    const invalid = p.render(1 / 60, pointer("move", 5, [Infinity, NaN]));
    p.reset();
    const action = p.action(6), actionFollowup = p.render(0);
    const afterAction = p.capture(), resetAfterAction = p.reset();
    return { initial, repeated, original, recolored, madeBefore, madeAfter, splat, released, afterRelease, idle, beforePause, paused, afterPause, entered, invalid, action, actionFollowup, afterAction, resetAfterAction, error: p.error() };
  });
  const b = results.behavior;
  assert.equal(b.initial.hash, b.repeated.hash, "same-seed reset must replay on this GPU");
  assert.notEqual(b.original.hash, b.recolored.hash, "editing palette recolors existing dye");
  assert.deepEqual(b.madeBefore, b.madeAfter, "uniform update must not allocate");
  assert.equal(b.splat.passesPerFrame, 32, "one drag splat adds three passes");
  assert.notEqual(b.released.hash, b.afterRelease.hash, "field continues after release");
  assert.equal(b.idle.passesPerFrame, 29);
  assert.equal(b.paused.passesPerFrame, 0);
  assert.equal(b.beforePause.hash, b.afterPause.hash);
  assert.equal(b.entered.passesPerFrame, 29);
  assert.equal(b.invalid.passesPerFrame, 29);
  assert.equal(b.action.diagnostics.passesPerFrame, 13); // four action splats + display.
  assert.equal(b.actionFollowup.passesPerFrame, 7); // remaining two + display.
  assert.notEqual(b.action.pixels.hash, b.afterAction.hash);
  assert.equal(b.resetAfterAction.hash, b.initial.hash);
  assert.equal(b.error, 0);

  results.touchGestures = await page.evaluate(() => {
    const p = window.fluidV2Probe;
    const sample = (phase, uv, delta, buttons) => ({ id: 27, phase, uv, delta, time: 1, buttons, pointerType: "touch" });
    const tapBase = p.reset();
    const tapPasses = p.render(0, { uv: [0.66, 0.45], inside: true, down: false, samples: [
      sample("down", [0.66, 0.45], [0, 0], 1), sample("up", [0.66, 0.45], [0, 0], 0),
    ] });
    const tap = p.capture();
    const dragBase = p.reset();
    const dragPasses = p.render(0, { uv: [0.42, 0.5], inside: true, down: false, samples: [
      sample("down", [0.4, 0.5], [0, 0], 1), sample("move", [0.42, 0.5], [0.02, 0], 1), sample("up", [0.42, 0.5], [0, 0], 0),
    ] });
    const drag = p.capture();
    const cancelBase = p.reset();
    const cancelPasses = p.render(0, { uv: [0.5, 0.5], inside: false, down: false, samples: [
      sample("down", [0.5, 0.5], [0, 0], 1), sample("move", [0.5, 0.46], [0, -0.04], 1), sample("cancel", [0.5, 0.46], [0, 0], 0),
    ] });
    const canceled = p.capture();
    const scrollBase = p.reset();
    const scrollPasses = p.render(0, { uv: [0.501, 0.58], inside: true, down: true, samples: [
      sample("down", [0.5, 0.6], [0, 0], 1), sample("move", [0.501, 0.58], [0.001, -0.02], 1),
    ] });
    const scrolling = p.capture();
    p.render(0, { uv: [0.501, 0.58], inside: false, down: false, samples: [sample("cancel", [0.501, 0.58], [0, 0], 0)] });
    return { tapBase, tap, tapPasses, dragBase, drag, dragPasses, cancelBase, canceled, cancelPasses,
      scrollBase, scrolling, scrollPasses, error: p.error() };
  });
  assert.equal(results.touchGestures.tapPasses.passesPerFrame, 4);
  assert.notEqual(results.touchGestures.tap.hash, results.touchGestures.tapBase.hash);
  assert.equal(results.touchGestures.dragPasses.passesPerFrame, 4);
  assert.notEqual(results.touchGestures.drag.hash, results.touchGestures.dragBase.hash);
  assert.equal(results.touchGestures.cancelPasses.passesPerFrame, 0);
  assert.equal(results.touchGestures.canceled.hash, results.touchGestures.cancelBase.hash);
  assert.equal(results.touchGestures.scrollPasses.passesPerFrame, 0);
  assert.equal(results.touchGestures.scrolling.hash, results.touchGestures.scrollBase.hash);
  assert.equal(results.touchGestures.error, 0);

  results.controls = await page.evaluate(() => {
    const p = window.fluidV2Probe;
    const base = { mode: "draw", timeScale: 1, force: 3600, radius: 0.25, curl: 30, velocityDissipation: 0.2, dyeDissipation: 1, pressureRetention: 0.8, shading: true, colors: ["#9AA6B3", "#62738B", "#A7927E"], colorAlpha: 0.9, backgroundColor: "#080A0F", backgroundAlpha: 1, colorCycleRate: 0, bloomEnabled: false, bloomIntensity: 0.8, bloomThreshold: 0.6, sunraysEnabled: false, sunraysWeight: 1, ambientRate: 0.5 };
    const simulate = (patch, steps = 12) => { p.open({ ...base, ...patch }); for (let i = 0; i < steps; i++) p.render(1 / 60); return p.capture(); };
    const baseline = simulate({});
    const values = {
      force: simulate({ force: 0 }), radius: simulate({ radius: 0.5 }), curl: simulate({ curl: 0 }),
      velocityDissipation: simulate({ velocityDissipation: 4 }), dyeDissipation: simulate({ dyeDissipation: 4 }),
      pressureRetention: simulate({ pressureRetention: 0 }), shading: simulate({ shading: false }),
      colorAlpha: simulate({ colorAlpha: 0 }), backgroundColor: simulate({ backgroundColor: "#770000" }),
      backgroundAlpha: simulate({ backgroundAlpha: 0 }), colorCycleRate: simulate({ colorCycleRate: 3 }),
      timeScale: simulate({ timeScale: 0.1 }),
    };
    const lightBase = simulate({ bloomEnabled: true, bloomThreshold: 0.1, sunraysEnabled: true });
    const light = { bloomIntensity: simulate({ bloomEnabled: true, bloomThreshold: 0.1, sunraysEnabled: true, bloomIntensity: 0 }), bloomThreshold: simulate({ bloomEnabled: true, bloomThreshold: 1, sunraysEnabled: true }), sunraysWeight: simulate({ bloomEnabled: true, bloomThreshold: 0.1, sunraysEnabled: true, sunraysWeight: 2 }) };
    const lowAmbient = simulate({ mode: "ambient", ambientRate: 0.05, timeScale: 2 }, 24);
    const highAmbient = simulate({ mode: "ambient", ambientRate: 2, timeScale: 2 }, 24);
    const transparent = simulate({ colorAlpha: 0, backgroundAlpha: 0 }, 0);
    return { baseline, values, lightBase, light, lowAmbient, highAmbient, transparent, colorList: simulate({ colors: ["#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#00FFFF", "#FF00FF"] }) };
  });
  for (const [key, image] of Object.entries(results.controls.values)) assert.notEqual(image.hash, results.controls.baseline.hash, `${key} must change pixels`);
  for (const [key, image] of Object.entries(results.controls.light)) assert.notEqual(image.hash, results.controls.lightBase.hash, `${key} must change lit pixels`);
  assert.notEqual(results.controls.colorList.hash, results.controls.baseline.hash);
  assert.notEqual(results.controls.lowAmbient.hash, results.controls.highAmbient.hash, "ambient rate must add bounded pigment");
  assert.ok(results.controls.transparent.alpha < results.controls.baseline.alpha, "transparent base must lower canvas alpha while dyed pixels remain visible");

  results.benchmarks = [];
  for (const [width, height, dpr, profile] of [[390, 844, 1.5, "balanced"], [960, 640, 1, "detail"]]) {
    await page.evaluate(({ width, height, dpr, profile }) => { const p = window.fluidV2Probe; p.resize(width, height, dpr); p.open(undefined, undefined, profile); }, { width, height, dpr, profile });
    results.benchmarks.push(await page.evaluate(() => window.fluidV2Probe.benchmark(30)));
  }
  await page.evaluate(() => { const p = window.fluidV2Probe; p.resize(390, 844, 1.5); p.preset(1); });
  results.benchmarks.push(await page.evaluate(() => window.fluidV2Probe.benchmark(30)));
  await page.evaluate(() => { const p = window.fluidV2Probe; p.resize(960, 640); for (let i = 0; i < 20; i++) p.render(1 / 60); });
  await page.locator("canvas").screenshot({ path: resolve(evidence, "fluid-v2-wide.png") });
  results.sizes = [];
  for (const width of [320, 390, 430, 480]) {
    const size = await page.evaluate((width) => { const p = window.fluidV2Probe; p.resize(width, 844, 1.5); return { width, ...p.stats(), image: p.capture(), error: p.error() }; }, width);
    assert.equal(size.diagnostics.targetCount, 20); assert.ok(size.diagnostics.allocatedBytes <= 28 * 1024 * 1024); assert.equal(size.error, 0);
    results.sizes.push(size);
  }
  await page.locator("canvas").screenshot({ path: resolve(evidence, "fluid-v2-portrait.png") });

  await page.setViewportSize({ width: 390, height: 700 });
  const touchStart = await page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    canvas.scrollIntoView({ block: "start" });
    const bounds = canvas.getBoundingClientRect();
    return { x: Math.round(bounds.left + bounds.width / 2), y: Math.round(Math.min(bounds.bottom - 20, 620)), scrollY };
  });
  assert.ok(touchStart.y > 360, "canvas must have enough visible room for the touch-scroll probe");
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: touchStart.x, y: touchStart.y }] });
  for (const offset of [60, 120, 180, 240, 300, 360]) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: touchStart.x, y: touchStart.y - offset }] });
    await page.evaluate(() => new Promise(requestAnimationFrame));
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  results.touch = await page.evaluate(() => ({ scrollY, touchAction: getComputedStyle(document.querySelector("canvas")).touchAction }));
  assert.ok(results.touch.scrollY > touchStart.scrollY, "touch on the probe stage must preserve native page scrolling");
  await cdp.detach();

  results.failure = await page.evaluate(() => window.fluidV2Probe.failure());
  assert.equal(results.failure.ok, false); assert.equal(results.failure.code, "unsupported-format");
  assert.deepEqual(results.failure.before, results.failure.after, "partial third-FBO failure must clean up");
  results.lifecycle = await page.evaluate(() => {
    const p = window.fluidV2Probe; const baseline = p.stats().resources;
    for (let i = 0; i < 6; i++) { p.open(); p.render(); p.dispose(); p.dispose(); }
    return { baseline, after: p.stats(), error: p.error() };
  });
  assert.deepEqual(results.lifecycle.baseline, results.lifecycle.after.resources);
  assert.equal(results.lifecycle.after.diagnostics.allocatedBytes, 0);
  assert.equal(results.lifecycle.error, 0);
  deliberateLoss = true;
  results.contextLoss = await page.evaluate(() => window.fluidV2Probe.contextLoss());
  deliberateLoss = false;
  assert.equal(results.contextLoss.available, true);
  assert.equal(results.contextLoss.lostEventObserved, true);
  assert.equal(results.contextLoss.lost, true);
  assert.equal(results.contextLoss.renderCode, "context-lost");
  assert.equal(results.contextLoss.createCode, "context-lost");
  assert.deepEqual(results.contextLoss.after, results.contextLoss.baseline, "lost pass must release owned resources");
  assert.equal(results.contextLoss.restoredEventObserved, true);
  assert.equal(results.contextLoss.restored, true);
  results.errors = errors; results.readbackWarnings = readbackWarnings; results.expectedContextLossWarnings = expectedContextLossWarnings;
  await writeFile(resolve(evidence, "results.json"), JSON.stringify(results, null, 2));
  assert.deepEqual(errors, [], "runtime/shader warnings and errors must be investigated");
  console.log(JSON.stringify({ ok: true, evidence, benchmarks: results.benchmarks.map((item) => ({ cpuMs: item.cpuMs, gpuMs: item.gpuMs, frameIntervalMs: item.frameIntervalMs, renderer: item.renderer, diagnostics: item.diagnostics })) }, null, 2));
} finally { await browser.close(); }
