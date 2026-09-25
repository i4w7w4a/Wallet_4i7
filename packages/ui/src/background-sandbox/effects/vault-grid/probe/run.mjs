// With ORACLE's isolated GPU slot only:
// node packages/ui/src/background-sandbox/effects/vault-grid/probe/run.mjs [evidence-dir]
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";

const folder = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(folder, "../../../../../../../");
const srcRoot = path.join(root, "packages/ui/src");
const oglRoot = path.join(root, "packages/ui/node_modules/ogl/src");
const requireRoot = createRequire(path.join(root, "package.json"));
const requireApp = createRequire(path.join(root, "apps/miniapp/package.json"));
const ts = requireRoot("typescript");
const { chromium } = requireApp("@playwright/test");
const port = 3146;
const evidence = path.resolve(process.argv[2] || path.join(process.env.TEMP || root, "novex-vault-grid-a6c47c7-proof"));
await fs.mkdir(evidence, { recursive: true });
await fs.rm(path.join(evidence, "failure.json"), { force: true });

const server = http.createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, `http://127.0.0.1:${port}`).pathname;
    if (pathname === "/favicon.ico") { res.writeHead(204).end(); return; }
    if (pathname === "/") {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(`<!doctype html><meta charset="utf-8"><title>Vault Grid isolated proof</title>
<style>html,body{margin:0;background:#0b0f13}canvas{display:block}</style>
<script type="importmap">{"imports":{"ogl":"/ogl/index.js"}}</script>
<canvas></canvas><script type="module" src="/probe.mjs"></script>`);
      return;
    }
    let base; let relative;
    if (pathname === "/probe.mjs") { base = folder; relative = "probe.mjs"; }
    else if (pathname.startsWith("/src/")) { base = srcRoot; relative = pathname.slice(5); }
    else if (pathname.startsWith("/ogl/")) { base = oglRoot; relative = pathname.slice(5); }
    else { res.writeHead(404).end(); return; }
    const file = path.resolve(base, relative + (path.extname(relative) ? "" : ".ts"));
    if (!file.startsWith(base + path.sep)) { res.writeHead(403).end(); return; }
    const source = await fs.readFile(file, "utf8");
    res.setHeader("Content-Type", "application/javascript; charset=utf-8");
    res.end(file.endsWith(".ts")
      ? ts.transpileModule(source, { compilerOptions: {
        module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022,
      } }).outputText
      : source);
  } catch (error) {
    res.writeHead(500).end(String(error));
  }
});

await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(port, "127.0.0.1", resolve);
});
console.log(`VAULT_GRID_PROBE pid=${process.pid} port=${port} evidence=${evidence}`);
let browser;
let watchdog;
try {
  browser = await chromium.launch({ headless: true });
  watchdog = setTimeout(() => { void browser?.close().catch(() => {}); }, 90_000);
  const page = await browser.newPage({ viewport: { width: 700, height: 500 }, deviceScaleFactor: 1 });
  const errors = [];
  const readbackWarnings = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (event) => {
    if (!["error", "warning"].includes(event.type())) return;
    const message = event.text();
    if (/GL Driver Message.*GPU stall due to ReadPixels/.test(message)) readbackWarnings.push(message);
    else errors.push(message);
  });
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => Boolean(window.vaultProof), null, { timeout: 15000 });
  const report = await page.evaluate(() => window.vaultProof.run());
  report.screenshots = [];
  for (const id of ["graphite-plates", "brushed-steel-ribs", "warm-etched-alloy"]) {
    await page.evaluate((preset) => {
      window.vaultProof.resize(640, 400);
      window.vaultProof.preset(preset);
    }, id);
    const file = path.join(evidence, `${id}-640x400.png`);
    await page.locator("canvas").screenshot({ path: file });
    report.screenshots.push(file);
  }
  await page.evaluate(() => window.vaultProof.button());
  const buttonFile = path.join(evidence, "button-fill-120x48.png");
  await page.locator("canvas").screenshot({ path: buttonFile });
  report.screenshots.push(buttonFile);
  report.contextLoss = await page.evaluate(() => window.vaultProof.loss());
  report.errors = errors;
  report.readbackWarnings = readbackWarnings;
  report.sourceHead = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  report.sourceStatus = execFileSync("git", ["status", "--short"], { cwd: root, encoding: "utf8" }).trim();
  report.testedAt = new Date().toISOString();
  report.rendererNote = /SwiftShader|llvmpipe|Software/i.test(report.renderer)
    ? "Software renderer only; no hardware/mobile FPS or visual approval claim."
    : "Renderer string recorded; this isolated desktop test does not prove mobile/hardware FPS.";
  await fs.writeFile(path.join(evidence, "report.json"), JSON.stringify(report, null, 2));
  assert.equal(report.contextLoss.createFailure, "context-lost");
  assert.equal(report.contextLoss.renderFailed, true);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({
    ok: true, evidence, renderer: report.renderer,
    profileDifferences: report.profile.differences,
    controls: report.controls, driftDelta: report.driftDelta,
    pauseDelta: report.pauseDelta, resourceCycles: report.resourceCycles,
    contextLoss: report.contextLoss,
  }, null, 2));
} catch (error) {
  await fs.writeFile(path.join(evidence, "failure.json"), JSON.stringify({
    message: error instanceof Error ? error.message : String(error),
    sourceHead: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
    testedAt: new Date().toISOString(),
  }, null, 2));
  throw error;
} finally {
  clearTimeout(watchdog);
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
  console.log(`VAULT_GRID_PROBE closed browser and port ${port}`);
}
