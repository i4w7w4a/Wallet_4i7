// Read-only inspection against ORACLE's existing preview. Never starts a server.
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const folder = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(folder, "../../../../../../../");
const requireApp = createRequire(path.join(root, "apps/miniapp/package.json"));
const { chromium } = requireApp("@playwright/test");
const evidence = path.resolve(process.argv[2] || path.join(process.env.TEMP || root, "novex-vault-grid-integrated-review"));
await fs.mkdir(evidence, { recursive: true });
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
let browser;
let watchdog;
try {
  browser = await chromium.launch({ headless: true });
  watchdog = setTimeout(() => { void browser?.close().catch(() => {}); }, 90_000);
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (event) => {
    if (event.type() === "error") errors.push(event.text());
  });
  await page.goto("http://127.0.0.1:3142/design-lab/atmosphere", { waitUntil: "domcontentloaded" });
  await page.getByRole("combobox", { name: "Материал" }).selectOption("material:vault-grid:1");
  const stage = page.getByRole("region", { name: "Сцена материала" });
  await page.waitForFunction(() => document.querySelector('section[aria-label="Сцена материала"] canvas') !== null,
    null, { timeout: 15000 });
  const records = {};
  async function capture(name) {
    await page.waitForTimeout(180);
    const bytes = await stage.screenshot({ path: path.join(evidence, `${name}.png`) });
    records[name] = {
      sha256: hash(bytes),
      status: await page.locator('[class*="stageFoot"]').innerText(),
      canvas: await page.evaluate(() => [...document.querySelectorAll('section[aria-label="Сцена материала"] canvas')]
        .map((item) => {
          const rect = item.getBoundingClientRect();
          return { width: item.width, height: item.height, cssWidth: rect.width, cssHeight: rect.height };
        })),
    };
  }
  await capture("vault-default-wide");
  const presets = page.getByRole("combobox", { name: "Начальная проба" });
  for (const id of ["graphite-plates", "brushed-steel-ribs", "warm-etched-alloy"]) {
    await presets.selectOption(id);
    await capture(`vault-${id}-wide`);
  }
  await presets.selectOption("graphite-plates");
  await page.getByRole("button", { name: "Форма / поверхность" }).click();
  const cellSize = page.getByRole("slider", { name: "Шаг ячейки" });
  await cellSize.focus();
  await cellSize.press("End");
  await capture("vault-cell-128-wide");
  await cellSize.press("Home");
  await capture("vault-cell-36-wide");
  const depth = page.getByRole("slider", { name: "Глубина" });
  await depth.focus();
  await depth.press("End");
  await capture("vault-depth-2-wide");
  await page.getByRole("button", { name: "Свет" }).click();
  const strength = page.getByRole("slider", { name: "Сила света" });
  await strength.focus();
  await strength.press("End");
  await capture("vault-light-2-wide");
  await page.getByRole("combobox", { name: "Формат сцены" }).selectOption("mono");
  await capture("vault-mono-390");
  const report = {
    evidence, recordedAt: new Date().toISOString(), records, errors,
    visibleControls: {
      cellSize: await cellSize.inputValue(),
      depth: await depth.inputValue(),
      strength: await strength.inputValue(),
    },
  };
  await fs.writeFile(path.join(evidence, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await context.close();
} finally {
  clearTimeout(watchdog);
  await browser?.close();
  console.log("VAULT_INTEGRATED_REVIEW browser context closed; no server started");
}
