// Run only inside the coordinator's GPU slot, with one local Vite fixture already running.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../../../../../../../");
const require = createRequire(resolve(root, "apps/miniapp/package.json"));
const { chromium } = require("@playwright/test");
const output = resolve(process.env.PARTICLE_EVIDENCE_DIR || resolve(here, "evidence"));
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1500, height: 1200 }, deviceScaleFactor: 1 });
const errors = [];
page.on("pageerror", error => errors.push(error.message));
page.on("console", message => {
  if (message.type() === "error") errors.push(message.text());
});
const results = {};
try {
  await page.goto(process.env.PARTICLE_PROBE_URL || "http://127.0.0.1:3145", { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.particleProbe?.statistics().diagnostics?.targetCount === 18);
  results.initial = await page.evaluate(() => ({ ...window.particleProbe.statistics(), image: window.particleProbe.capture() }));
  assert.equal(results.initial.error, 0);
  assert.ok(results.initial.image.coloredPixels > 0, "spherical particles should be visible");
  results.behavior = await page.evaluate(() => {
    const p = window.particleProbe;
    const first = p.reset();
    const replay = p.reset();
    const recolor = p.update({ particleColor: "#ED7440" });
    p.update({ particleColor: "#408CFF" });
    const paused = p.render(0);
    const flowing = p.render(1 / 60);
    const afterStep = p.capture();
    return { first, replay, recolor, paused, flowing, afterStep, stats: p.statistics() };
  });
  assert.equal(results.behavior.first.hash, results.behavior.replay.hash, "seed replay must be stable on one GPU");
  assert.notEqual(results.behavior.first.hash, results.behavior.recolor.hash, "color must change actual pixels");
  assert.equal(results.behavior.paused.passesPerFrame, 5);
  assert.equal(results.behavior.flowing.passesPerFrame, 74);
  assert.equal(results.behavior.stats.error, 0);
  results.sizes = [];
  for (const [width, height] of [[320, 568], [390, 844], [960, 640], [1440, 900]]) {
    const result = await page.evaluate(({ width, height }) => {
      const p = window.particleProbe;
      p.resize(width, height);
      p.render(1 / 60);
      return { ...p.statistics(), image: p.capture() };
    }, { width, height });
    assert.equal(result.error, 0);
    assert.ok(result.diagnostics.allocatedBytes <= 28 * 1024 * 1024);
    assert.ok(result.image.coloredPixels > 0);
    results.sizes.push(result);
    if (width === 390) await page.screenshot({ path: resolve(output, "particles-portrait.png"), fullPage: true });
    if (width === 960) await page.screenshot({ path: resolve(output, "particles-wide.png"), fullPage: true });
  }
  if (process.env.PARTICLE_QUICK !== "1") results.benchmark = await page.evaluate(() => window.particleProbe.benchmark(30));
  results.lifecycle = await page.evaluate(() => {
    const p = window.particleProbe;
    const before = p.statistics().resources;
    const released = p.dispose().resources;
    const repeatDispose = p.dispose().resources;
    p.open();
    const reopened = p.statistics().resources;
    p.dispose(); p.open();
    return { before, released, repeatDispose, reopened, secondReopen: p.statistics().resources };
  });
  assert.deepEqual(results.lifecycle.released, results.lifecycle.repeatDispose, "dispose must be idempotent");
  assert.deepEqual(results.lifecycle.before, results.lifecycle.reopened, "one reopen must not leak GPU resources");
  assert.deepEqual(results.lifecycle.before, results.lifecycle.secondReopen, "repeated reopen must not accumulate GPU resources");
  results.context = await page.evaluate(() => window.particleProbe.lossRestore());
  assert.equal(results.context.supported, true);
  assert.equal(results.context.restored, true);
  assert.equal(results.context.failureCode, "context-lost");
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForFunction(() => window.particleProbe?.statistics().diagnostics?.targetCount === 18);
  results.context.reloaded = await page.evaluate(() => window.particleProbe.statistics());
  assert.equal(results.context.reloaded.error, 0);
  results.errors = errors;
  await writeFile(resolve(output, "results.json"), JSON.stringify(results, null, 2));
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ ok: true, output, budget: results.sizes.map(({ diagnostics }) => diagnostics.allocatedBytes),
    renderer: results.initial.renderer, benchmark: results.benchmark?.cpuSubmissionMs,
    interval: results.benchmark?.frameIntervalMs, lifecycle: results.lifecycle, context: results.context }, null, 2));
} finally { await browser.close(); }
