// Run only with the coordinator's GPU slot and an already running local Vite fixture.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../../../../../../../");
const require = createRequire(resolve(root, "apps/miniapp/package.json"));
const { chromium } = require("@playwright/test");
const evidence = resolve(process.env.FLUID_EVIDENCE_DIR || resolve(here, "evidence"));
await mkdir(evidence, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 }, deviceScaleFactor: 1 });
const errors = [];
const readbackWarnings = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => {
  if (!["error", "warning"].includes(message.type())) return;
  // capture() deliberately synchronizes the GPU for pixel assertions; keep its driver
  // stalls visible in evidence, separate from shader/runtime errors. No readback in adapter.
  if (/GL Driver Message.*GPU stall due to ReadPixels/.test(message.text())) readbackWarnings.push(message.text());
  else errors.push(message.text());
});
const results = {};
try {
  await page.goto("http://127.0.0.1:3143", { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.fluidProbe?.statistics().diagnostics?.targetCount === 9);
  results.initial = await page.evaluate(() => ({ image: window.fluidProbe.capture(), ...window.fluidProbe.statistics() }));
  assert.equal(results.initial.diagnostics.targetCount, 9);
  assert.ok(results.initial.diagnostics.allocatedBytes <= 8 * 1024 * 1024);

  results.behavior = await page.evaluate(() => {
    const p = window.fluidProbe;
    const pointer = (phase, t, delta = [0, 0], down = true) => ({ uv: [0.55, 0.5], inside: true, down, samples: [{ phase, id: 1, uv: [0.55, 0.5], delta, time: t, buttons: down ? 1 : 0 }] });
    const initial = p.reset();
    const seedRepeat = p.reset();
    const before = p.capture();
    p.render(1 / 60, undefined, false);
    const defaultAfterAdapter = p.capture();
    p.reset();
    const stableMade = p.statistics().made;
    const beforePalette = p.capture();
    const afterPalette = p.update({ palette: "copper" });
    const afterUpdateMade = p.statistics().made;
    p.update({ palette: "graphite" });
    p.reset();
    p.render(1 / 60, pointer("down", 1));
    const splat = p.render(1 / 60, pointer("move", 2, [0.02, 0.015]));
    p.render(1 / 60, pointer("up", 3, [0, 0], false));
    const released = p.capture();
    for (let i = 0; i < 45; i++) p.render(1 / 60);
    const afterRelease = p.capture();
    const idle = p.statistics().diagnostics;
    const pauseBefore = p.capture();
    const paused = p.render(0);
    const pauseAfter = p.capture();
    const reentry = p.render(1 / 60, pointer("enter", 4, [100, 100]));
    const invalid = p.render(1 / 60, pointer("move", 5, [Infinity, NaN]));
    return { initial, seedRepeat, before, defaultAfterAdapter, stableMade, afterUpdateMade, beforePalette, afterPalette, splat, released, afterRelease, idle, pauseBefore, pauseAfter, paused, reentry, invalid, error: p.error() };
  });
  const b = results.behavior;
  assert.equal(b.initial.hash, b.seedRepeat.hash, "seeded reset must replay on the same GPU");
  assert.equal(b.before.hash, b.defaultAfterAdapter.hash, "adapter must not draw the default framebuffer");
  assert.deepEqual(b.stableMade, b.afterUpdateMade, "uniform updates must not reallocate");
  assert.notEqual(b.beforePalette.hash, b.afterPalette.hash, "palette must affect existing dye");
  assert.equal(b.splat.passesPerFrame, 30, "one drag splat adds two passes to the 28-pass frame");
  assert.notEqual(b.released.hash, b.afterRelease.hash, "field must continue after release");
  assert.ok(Math.hypot(b.released.center[0] - b.afterRelease.center[0], b.released.center[1] - b.afterRelease.center[1]) > 0.001, "dye must move spatially, not only fade");
  assert.equal(b.idle.passesPerFrame, 28);
  assert.equal(b.paused.passesPerFrame, 0);
  assert.equal(b.pauseBefore.hash, b.pauseAfter.hash);
  assert.equal(b.reentry.passesPerFrame, 28);
  assert.equal(b.invalid.passesPerFrame, 28);
  assert.equal(b.error, 0);

  results.controls = await page.evaluate(() => {
    const p = window.fluidProbe;
    const simulate = (patch) => {
      p.open(147, { force: 2600, radius: 0.2, curl: 22, dissipation: 0.8, palette: "graphite", ...patch });
      for (let i = 0; i < 20; i++) p.render(1 / 60);
      return p.capture();
    };
    return { baseline: simulate({}), force: simulate({ force: 0 }), radius: simulate({ radius: 0.5 }), curl: simulate({ curl: 0 }), dissipation: simulate({ dissipation: 3 }) };
  });
  for (const key of ["force", "radius", "curl", "dissipation"]) assert.notEqual(results.controls[key].hash, results.controls.baseline.hash, `${key} must affect actual pixels`);

  results.benchmarks = [];
  for (const [width, height, dpr] of [[390, 844, 1.5], [1440, 900, 1]]) {
    await page.evaluate(({ width, height, dpr }) => { window.fluidProbe.open(); window.fluidProbe.resize(width, height, dpr); }, { width, height, dpr });
    results.benchmarks.push(await page.evaluate(() => window.fluidProbe.benchmark(60)));
  }
  await page.evaluate(() => { window.fluidProbe.open(); window.fluidProbe.resize(960, 640); for (let i = 0; i < 25; i++) window.fluidProbe.render(1 / 60); });
  await page.screenshot({ path: resolve(evidence, "fluid-desktop.png"), fullPage: true });

  results.sizes = [];
  for (const width of [320, 390, 430, 480]) {
    const size = await page.evaluate((width) => { const p = window.fluidProbe; p.resize(width, 844, 1.5); return { width, ...p.statistics(), error: p.error(), image: p.capture() }; }, width);
    assert.equal(size.diagnostics.targetCount, 9); assert.equal(size.error, 0); assert.ok(size.image.mean > 6);
    results.sizes.push(size);
  }
  await page.screenshot({ path: resolve(evidence, "fluid-portrait.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 700 });
  await page.evaluate(() => window.scrollTo(0, 0));
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 190, y: 620 }] });
  for (const y of [560, 500, 440, 380, 320, 260]) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 190, y }] });
    await page.evaluate(() => new Promise(requestAnimationFrame));
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  results.touch = await page.evaluate(() => ({ scrollY, touchAction: getComputedStyle(document.querySelector("canvas")).touchAction }));
  assert.ok(results.touch.scrollY > 0, "touch on the probe stage must preserve native page scrolling");
  await cdp.detach();
  results.failure = await page.evaluate(() => window.fluidProbe.allocationFailure());
  assert.equal(results.failure.ok, false); assert.equal(results.failure.code, "unsupported-format");
  assert.deepEqual(results.failure.before, results.failure.after, "partial FBO creation must clean up");

  results.lifecycle = await page.evaluate(() => {
    const p = window.fluidProbe; const before = p.statistics().resources;
    for (let i = 0; i < 6; i++) { p.open(); p.render(); p.dispose(); p.dispose(); }
    return { before, after: p.statistics(), error: p.error() };
  });
  assert.deepEqual(results.lifecycle.before, results.lifecycle.after.resources, "repeated mount/dispose must release all owned GPU resources");
  assert.equal(results.lifecycle.after.diagnostics.allocatedBytes, 0);
  assert.equal(results.lifecycle.error, 0);
  await page.evaluate(() => window.fluidProbe.open());
  results.context = await page.evaluate(() => window.fluidProbe.lossRestore());
  assert.equal(results.context.restored, true);
  assert.equal(results.context.diagnostics.targetCount, 9);
  results.errors = errors;
  results.readbackWarnings = readbackWarnings;
  await writeFile(resolve(evidence, "results.json"), JSON.stringify(results, null, 2));
  assert.deepEqual(errors, [], "shader/browser warnings and errors must be investigated");
  console.log(JSON.stringify({ ok: true, evidence, benchmarks: results.benchmarks.map(({ cpuMs, gpuMs, frameIntervalMs, renderer, diagnostics, viewport }) => ({ cpuMs, gpuMs, frameIntervalMs, renderer, diagnostics, viewport })), checks: "inertia, spatial advection, 5 controls, seeded reset, FBO ownership, resize, partial failure, repeated disposal, context restore" }, null, 2));
} finally { await browser.close(); }
