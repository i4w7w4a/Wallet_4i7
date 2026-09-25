// One targeted physical progression proof. Run only in a newly allocated GPU slot.
// Fixed upstream-speed artistic preset, seed, palette and camera throughout.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../../../../../../../");
const require = createRequire(resolve(root, "apps/miniapp/package.json"));
const { chromium } = require("@playwright/test");
const output = resolve(process.env.PARTICLE_PROGRESSION_DIR || resolve(here, "progression-evidence"));
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1100, height: 850 }, deviceScaleFactor: 1 });
const errors = [];
page.on("pageerror", error => errors.push(error.message));
page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
const results = {
  method: "Source-speed preset, seed 147, fixed colors/front camera, detail runtime profile (same as the initial GPU probe). Every solver call receives dt=1/60 s; the adapter caps dt to 1/60 s and multiplies by timeScale=1. Integrated time is solver calls/60 and is distinct from measured wall time. No recolor, resize, pointer input, quality or artistic parameter changes occur between samples.",
  samples: [],
};
try {
  await page.goto(process.env.PARTICLE_PROBE_URL || "http://127.0.0.1:3145", { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.particleProbe?.statistics().diagnostics?.targetCount === 18);
  await page.evaluate(() => window.particleProbe.openSourceReference());
  const startedAt = performance.now();
  const initial = await page.evaluate(() => ({ position: window.particleProbe.positionSummary(),
    image: window.particleProbe.capture(), stats: window.particleProbe.statistics() }));
  results.preset = initial.stats.params;
  results.renderer = initial.stats.renderer;
  assert.equal(results.preset.timeScale, 1);
  assert.equal(results.preset.camera, "front");
  results.samples.push({ steps: 0, integratedSeconds: 0, wallElapsedMs: performance.now() - startedAt,
    position: initial.position, image: initial.image, glError: initial.stats.error });
  await page.locator("canvas").screenshot({ path: resolve(output, "particles-source-initial.png") });

  let completedSteps = 0;
  for (const cumulativeSteps of [15, 30, 60, 120]) {
    const additional = cumulativeSteps - completedSteps;
    const sample = await page.evaluate((steps) => {
      const probe = window.particleProbe;
      for (let index = 0; index < steps; index++) probe.render(1 / 60, undefined, false);
      probe.render(0); // present without adding physical time
      return { position: probe.positionSummary(), image: probe.capture(), stats: probe.statistics() };
    }, additional);
    completedSteps = cumulativeSteps;
    results.samples.push({ steps: cumulativeSteps, integratedSeconds: cumulativeSteps / 60,
      wallElapsedMs: performance.now() - startedAt, position: sample.position,
      image: sample.image, glError: sample.stats.error });
    if (cumulativeSteps >= 30
      && sample.position.mean[1] < initial.position.mean[1] - 0.2
      && sample.position.span[0] > initial.position.span[0] + 0.3) break;
  }
  await page.locator("canvas").screenshot({ path: resolve(output, "particles-source-progressed.png") });
  results.errors = errors;
  await writeFile(resolve(output, "progression.json"), JSON.stringify(results, null, 2));
  const final = results.samples.at(-1);
  const start = results.samples[0];
  assert.equal(final.glError, 0);
  assert.deepEqual(errors, []);
  assert.ok(final.position.mean[1] < start.position.mean[1] - 0.2, "gravity must move particle centers downward");
  assert.ok(final.position.span[0] > start.position.span[0] + 0.3,
    "dam must spread horizontally; inspect progression.json if it does not");
  console.log(JSON.stringify({ ok: true, output, renderer: results.renderer,
    physicalTimeSeconds: final.integratedSeconds, wallElapsedMs: final.wallElapsedMs,
    initial: start.position, final: final.position }, null, 2));
} finally { await browser.close(); }
