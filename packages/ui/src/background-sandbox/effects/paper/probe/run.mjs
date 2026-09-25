// Run only in ORACLE's assigned Paper GPU slot. Owns and closes port 3147.
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";

const folder = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(folder, "../../../../../../../");
const paperRoot = path.resolve(folder, "..");
const oglRoot = path.join(root, "packages/ui/node_modules/ogl/src");
const evidence = path.join(folder, "evidence");
const requireRoot = createRequire(path.join(root, "package.json"));
const requireApp = createRequire(path.join(root, "apps/miniapp/package.json"));
const ts = requireRoot("typescript");
const { chromium } = requireApp("@playwright/test");
await fs.mkdir(evidence, { recursive: true });

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, "http://127.0.0.1:3147");
    if (url.pathname === "/") {
      response.setHeader("Content-Type", "text/html; charset=utf-8");
      response.end(`<!doctype html><html lang="ru"><meta charset="utf-8"><title>Paper technical proof</title>
        <style>body{margin:0;padding:20px;background:#11151b;color:#dce3eb;font:14px system-ui}
        canvas{display:block;max-width:100%;touch-action:auto;border:1px solid #394350}
        pre{white-space:pre-wrap;max-width:780px}</style>
        <h1>Paper · один WebGL2 context</h1><canvas></canvas><pre id="status">Подготовка…</pre>
        <script type="importmap">{"imports":{"ogl":"/ogl/index.js"}}</script>
        <script type="module" src="/packages/ui/src/background-sandbox/effects/paper/probe/fixture.ts"></script></html>`);
      return;
    }
    const ogl = url.pathname.startsWith("/ogl/");
    const base = ogl ? oglRoot : root;
    const relative = ogl ? url.pathname.slice(5) : url.pathname.slice(1);
    const file = path.resolve(base, relative + (path.extname(relative) ? "" : ogl ? ".js" : ".ts"));
    if (!file.startsWith(base + path.sep) || (!ogl && !file.startsWith(paperRoot + path.sep) &&
        !file.startsWith(path.join(root, "packages/ui/src/background-sandbox") + path.sep))) {
      response.writeHead(403).end(); return;
    }
    const source = await fs.readFile(file, "utf8");
    response.setHeader("Content-Type", "application/javascript; charset=utf-8");
    response.end(file.endsWith(".ts") ? ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    }).outputText : source);
  } catch (error) { response.writeHead(500).end(String(error)); }
});

let browser;
const consoleErrors = [];
const readbackWarnings = [];
try {
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(3147, "127.0.0.1", resolve); });
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1000, height: 850 }, deviceScaleFactor: 1 });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  page.on("console", (message) => {
    if (!["error", "warning"].includes(message.type())) return;
    const value = message.text();
    if (/GL Driver Message.*GPU stall due to ReadPixels/.test(value)) readbackWarnings.push(value);
    else consoleErrors.push(value);
  });
  await page.goto("http://127.0.0.1:3147/", { waitUntil: "load" });
  await page.waitForFunction(() => Boolean(window.paperProbe), { timeout: 10000 });
  const report = {
    head: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
    renderer: await page.evaluate(() => window.paperProbe.renderer()),
    tests: [],
  };
  const cases = process.argv.includes("--context-only") ? [] : [
    ["liquid-metal", "fill", "quiet-steel"],
    ["liquid-metal", "icon", "quiet-steel"],
    ["pulsing-border", "border", "quiet-line"],
    ["gem-smoke", "fill", "quiet-smoke"],
    ["heatmap", "fill", "quiet-heat"],
  ];
  for (const [kind, target, preset] of cases) {
    const opened = await page.evaluate(async ([id, slot, chosen]) => window.paperProbe.open(id, slot, chosen), [kind, target, preset]);
    assert.ok(opened.capture.visible > 0, `${kind}/${target} must produce visible pixels`);
    assert.equal(opened.capture.premulViolations, 0, `${kind}/${target} must be premultiplied`);
    assert.equal(opened.capture.error, 0, `${kind}/${target} GL error`);
    assert.ok(opened.preparedBytes <= 4 * 1024 * 1024, `${kind}/${target} CPU budget`);
    for (const [width, height] of opened.maskDimensions) {
      assert.ok(width <= 256 && height <= 256, `${kind}/${target} bounded mask`);
    }
    if (opened.noiseDimensions) assert.deepEqual(opened.noiseDimensions, [128, 128]);
    const screenshot = `${kind}-${target}.png`;
    await page.locator("canvas").screenshot({ path: path.join(evidence, screenshot) });
    const behavior = await page.evaluate((id) => {
      const p = window.paperProbe;
      const before = p.capture();
      const paused = p.render(0);
      const moving = p.render(4);
      const resourcesBefore = p.resources();
      const changed = id === "liquid-metal" ? p.update({ repetition: 4 }) :
        id === "pulsing-border" ? p.update({ colors: ["#ff6600"] }) :
          id === "gem-smoke" ? p.update({ colors: ["#f53366", "#00ccff"] }) :
            p.update({ colors: ["#ff5500", "#fffeca"] });
      const resourcesAfter = p.resources();
      const smaller = p.resize(0.5);
      const restoredSize = p.resize(2);
      const diagnostics = p.diagnostics();
      const afterDispose = p.close();
      return { before, paused, moving, changed, resourcesBefore, resourcesAfter,
        smaller, restoredSize, diagnostics, afterDispose, error: p.error() };
    }, kind);
    assert.equal(behavior.before.hash, behavior.paused.hash, `${kind} must freeze at dt=0`);
    assert.notEqual(behavior.before.hash, behavior.moving.hash, `${kind} must move at active time`);
    assert.notEqual(behavior.moving.hash, behavior.changed.hash, `${kind} control must alter pixels`);
    assert.deepEqual(behavior.resourcesBefore, behavior.resourcesAfter, `${kind} update must avoid allocation`);
    assert.equal(behavior.smaller.premulViolations, 0);
    assert.equal(behavior.restoredSize.premulViolations, 0);
    assert.equal(behavior.error, 0);
    assert.deepEqual(behavior.afterDispose, Object.fromEntries(Object.keys(behavior.afterDispose).map((key) => [key, 0])),
      `${kind} must release all adapter resources`);
    report.tests.push({ kind, target, screenshot, opened, behavior });
  }
  report.context = await page.evaluate(() => window.paperProbe.lossRestore());
  if (report.context.supported) {
    assert.equal(report.context.lostFailure, "context-lost");
    assert.equal(report.context.restored, true);
  }
  report.finalResources = await page.evaluate(() => window.paperProbe.finish());
  report.consoleErrors = consoleErrors;
  report.readbackWarnings = readbackWarnings;
  report.testedAt = new Date().toISOString();
  await fs.writeFile(path.join(evidence, "report.json"), JSON.stringify(report, null, 2));
  assert.deepEqual(consoleErrors, [], "browser shader/runtime errors must be investigated");
  console.log(JSON.stringify({ ok: true, renderer: report.renderer, scenarios: report.tests.map((entry) =>
    ({ kind: entry.kind, target: entry.target, visible: entry.opened.capture.visible,
      meanAlpha: entry.opened.capture.meanAlpha, diagnostic: entry.behavior.diagnostics })),
    context: report.context, evidence }, null, 2));
} finally {
  await browser?.close();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  console.log("Paper probe closed browser and port 3147");
}
