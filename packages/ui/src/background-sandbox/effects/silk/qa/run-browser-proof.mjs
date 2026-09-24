// Run from repo root only after ORACLE grants the GPU slot/port:
// node packages/ui/src/background-sandbox/effects/silk/qa/run-browser-proof.mjs <evidence-dir>
// Uses existing workspace dev dependencies; no install, app route or build.
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

const root = process.cwd();
const folder = path.dirname(fileURLToPath(import.meta.url));
const effectRoot = path.resolve(folder, "..");
const oglRoot = path.join(root, "packages/ui/node_modules/ogl/src");
const requireRoot = createRequire(path.join(root, "package.json"));
const requireApp = createRequire(path.join(root, "apps/miniapp/package.json"));
const ts = requireRoot("typescript");
const { chromium } = requireApp("@playwright/test");
const evidence = path.resolve(process.argv[2] || path.join(process.env.TEMP, "novex-silk-b374-proof"));
await fs.mkdir(evidence, { recursive: true });
// This is a test oracle only. Validate immutable source bytes before extracting
// GLSL; never execute the upstream HTML/JavaScript or serve its demo runtime.
const upstreamBytes = await fs.readFile(process.env.SILK_UPSTREAM_FILE || path.join(process.env.TEMP, "novex-silk-b374/silk-cascade.html"));
const upstreamBlob = createHash("sha1").update(`blob ${upstreamBytes.length}\0`).update(upstreamBytes).digest("hex");
if (upstreamBlob !== "70741edbdff44f8d9af20a25d82be8fdb53ce2f5") throw new Error("Unverified baseline source");
const source = upstreamBytes.toString("utf8");
const block = source.slice(source.indexOf("  var fragSrc = ["), source.indexOf("  ].join('\\n');"));
const baselineShader = block.split(/\r?\n/).map((line) => line.match(/^    '(.*)',?$/)?.[1]).filter((line) => line !== undefined).join("\n")
  .replace("precision highp float;", "#version 300 es\nprecision highp float;\nout vec4 fragColor;")
  .replace("gl_FragColor=", "fragColor=");
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost:3143");
    if (url.pathname === "/baseline.glsl") { res.setHeader("Content-Type", "text/plain"); res.end(baselineShader); return; }
    if (url.pathname === "/") {
      res.setHeader("Content-Type", "text/html");
      res.end(`<!doctype html><meta charset="utf-8"><title>BG-2 Silk shader proof</title>
        <style>html,body{margin:0;background:#101114}canvas{display:block;width:100%;height:auto}</style>
        <script type="importmap">{"imports":{"ogl":"/ogl/index.js"}}</script>
        <canvas></canvas><script type="module" src="/probe.mjs"></script>`);
      return;
    }
    const base = url.pathname.startsWith("/ogl/") ? oglRoot : effectRoot;
    const relative = url.pathname === "/probe.mjs" ? "qa/probe.mjs" : url.pathname.replace(/^\/(ogl|silk)\//, "");
    const file = path.resolve(base, relative + (path.extname(relative) ? "" : ".ts"));
    if (!file.startsWith(base + path.sep)) { res.writeHead(403).end(); return; }
    const source = await fs.readFile(file, "utf8");
    res.setHeader("Content-Type", "application/javascript");
    res.end(file.endsWith(".ts") ? ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText : source);
  } catch (error) { res.writeHead(500).end(String(error)); }
});
await new Promise((resolve, reject) => { server.once("error", reject); server.listen(3143, "127.0.0.1", resolve); });
console.log(`SILK_PROBE pid=${process.pid} port=3143 evidence=${evidence}`);
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const consoleErrors = [];
  const driverWarnings = [];
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  page.on("console", (event) => {
    if (!["error", "warning"].includes(event.type())) return;
    const text = event.text();
    // Expected only from this proof's explicit readback. Keep it in evidence;
    // every shader warning, page error and other runtime warning still fails.
    if (event.type() === "warning" && /^\[\.WebGL-0x[0-9a-f]+\]GL Driver Message \(OpenGL, Performance, GL_CLOSE_PATH_NV, High\): GPU stall due to ReadPixels(?: \(this message will no longer repeat\))?$/i.test(text)) driverWarnings.push(text);
    else consoleErrors.push(text);
  });
  await page.goto("http://localhost:3143/");
  await page.waitForFunction(() => Boolean(window.silkProof));
  const report = await page.evaluate(() => window.silkProof.run());
  report.baseline = await page.evaluate(() => window.silkProof.compareUpstream());
  report.screenshots = [];
  for (const id of ["radiant-baseline", "graphite", "champagne"]) {
    await page.evaluate((id) => { window.silkProof.resize(1280, 720); window.silkProof.preset(id); }, id);
    const file = path.join(evidence, `${id}-1280.png`);
    await page.locator("canvas").screenshot({ path: file });
    report.screenshots.push(file);
  }
  for (const width of [320, 390, 430, 480]) {
    await page.setViewportSize({ width, height: 640 });
    await page.evaluate((width) => { window.silkProof.resize(width, 640); window.silkProof.preset("graphite"); }, width);
    const file = path.join(evidence, `graphite-${width}.png`);
    await page.locator("canvas").screenshot({ path: file });
    report.screenshots.push(file);
  }
  report.contextLoss = await page.evaluate(() => window.silkProof.loseContext());
  report.consoleErrors = consoleErrors;
  report.driverWarnings = driverWarnings;
  report.head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  report.diff = execFileSync("git", ["status", "--short"], { cwd: root, encoding: "utf8" }).trim();
  report.testedAt = new Date().toISOString();
  await fs.writeFile(path.join(evidence, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (consoleErrors.length || report.contextLoss.createFailure !== "context-lost" || !report.contextLoss.renderFailed) throw new Error("browser proof contains errors");
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
  console.log("SILK_PROBE closed browser and port 3143");
}
