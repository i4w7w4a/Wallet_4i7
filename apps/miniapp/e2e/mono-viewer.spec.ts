import { expect, test, type BrowserContext } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { normalizeMonoPaletteConfig } from "../../../packages/ui/src/mono/mono-palette";
import { encodeMonoSharePayload } from "../src/mono-preview/mono-share-transport";

// An independent public fixture, not a copy of a browser's editor storage.
const appearance = {
  kind: "mono-appearance", version: 1, skinId: "mono-ledger-v1",
  appearance: {
    preset: "ledger", palette: { enabled: true, config: normalizeMonoPaletteConfig({ seed: "mono-share" }) },
    shape: { "quick-actions": 5, "bottom-navigation": 7 },
    optics: { ior: 1.34, edgeThickness: .165, edgeDarkening: .5, highlightStrength: .54, reflectionStrength: .59,
      causticStrength: .63, fieldEnabled: true, fieldFadeMode: 1, fieldStart: .34, fieldSoftness: .99, fieldCurve: 2.69,
      fieldStrength: 1.92, flowEnabled: true, flowMode: 5, flowSpeed: .29, flowStrength: .44, flowScale: 4.47, pointerStrength: .23 },
    environment: { theme: "light", background: "strata" },
    logo: { version: 1, variant: "plaque", customColor: true, hue: 157 },
    balance: { composition: "ledger", fractionSize: "large", fractionTone: "primary" },
    chart: { visible: true, variant: "line" }, layout: { chartPosition: "top" },
    assets: { variant: "ledger", density: "comfortable", separators: "subtle" }, typography: null, background: null,
  },
};

async function guardEditorStorage(context: BrowserContext, seed: boolean) {
  await context.addInitScript(seed => {
    const key = "wallet4i7.mono.working-presets.v2";
    if (seed) localStorage.setItem(key, "private-editor-draft");
    const calls: string[] = [];
    Object.assign(window, { monoStorageCalls: calls });
    const get = Storage.prototype.getItem, set = Storage.prototype.setItem;
    Storage.prototype.getItem = function(key) {
      if (key.startsWith("wallet4i7.")) calls.push(`read:${key}`);
      return get.call(this, key);
    };
    Storage.prototype.setItem = function(key, value) {
      if (key.startsWith("wallet4i7.")) calls.push(`write:${key}`);
      return set.call(this, key, value);
    };
  }, seed);
}

test("a fresh phone opens the same supplied scene without rails or editor storage", async ({ browser, baseURL }, testInfo) => {
  const token = await encodeMonoSharePayload(JSON.stringify(appearance));
  const url = `${baseURL}/mono/view#mono=${token}`;
  await writeFile(testInfo.outputPath("viewer-url.txt"), url);
  testInfo.annotations.push({ type: "share-url-characters", description: String(url.length) });
  expect(url.length).toBeLessThan(4096);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
  await guardEditorStorage(context, false);
  const page = await context.newPage();
  const errors: string[] = [], requests: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => requests.push(request.url()));
  await page.goto(url);
  const scene = page.locator("[data-mono-preview]");
  await expect(scene).toHaveAttribute("data-mono-theme", "light");
  await expect(scene).toHaveAttribute("data-mono-background", "strata");
  await expect(scene).toHaveAttribute("data-mono-logo-variant", "plaque");
  await expect(scene).toHaveAttribute("data-palette-enabled", "true");
  await expect(page.locator("[data-mono-rail], [data-mono-workbench]")).toHaveCount(0);
  await expect(page.locator("canvas")).toHaveCount(1);
  for (const width of [320, 390, 430, 480]) {
    await page.setViewportSize({ width, height: 844 });
    const geometry = await page.evaluate(() => ({
      width: document.querySelector<HTMLElement>("[data-mono-preview]")!.clientWidth,
      nav: document.querySelector<HTMLElement>(".mono-nav")!.clientWidth,
      overflow: document.documentElement.scrollWidth > innerWidth,
    }));
    expect(geometry).toEqual({ width, nav: width, overflow: false });
  }
  await page.getByRole("button", { name: "Скрыть баланс" }).click();
  await expect(page.getByRole("button", { name: "Показать баланс" })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { monoStorageCalls: string[] }).monoStorageCalls)).toEqual([]);
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
  expect(requests.some(url => url.includes("/api/skin-presets"))).toBe(false);
  expect(errors).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("viewer-480.png"), fullPage: true });
  await context.close();
});

test("viewer leaves a different local editor preset intact, including after an invalid link", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await guardEditorStorage(context, true);
  const page = await context.newPage();
  await page.goto(`${baseURL}/mono/view#mono=${await encodeMonoSharePayload(JSON.stringify(appearance))}`);
  await expect(page.locator("[data-mono-preview]")).toBeVisible();
  await page.goto(`${baseURL}/mono/view#mono=m2.unknown`);
  await expect(page.locator("[data-mono-viewer]").getByRole("alert")).toContainText("версия ссылки");
  await expect(page.locator("[data-mono-preview]")).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { monoStorageCalls: string[] }).monoStorageCalls)).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem("wallet4i7.mono.working-presets.v2"))).toBe("private-editor-draft");
  await context.close();
});
