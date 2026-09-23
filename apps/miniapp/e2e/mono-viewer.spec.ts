import { expect, test, type BrowserContext } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { normalizeMonoPaletteConfig } from "../../../packages/ui/src/mono/mono-palette";
import { encodeMonoSharePayload } from "../src/mono-preview/mono-share-transport";
import type { MonoAppearanceEnvelope } from "../src/mono-preview/mono-preset-envelope";

// An independent public fixture, not a copy of a browser's editor storage.
const appearance: MonoAppearanceEnvelope = {
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

test("full appearance renders every supplied slice in a fresh viewer and survives reload without editor storage", async ({ browser, baseURL }, testInfo) => {
  const full = structuredClone(appearance);
  const style = full.appearance;
  style.typography = {
    version: 1, catalogVersion: 1, primaryFontId: "source-sans-3", secondaryFontId: "manrope",
    roles: {
      body: { family: "primary", size: 17, weight: 400 },
      balance: { family: "secondary", size: 54, weight: 600 },
      button: { family: "primary", size: 13, weight: 500 },
      menu: { family: "primary", size: 12, weight: 500 },
      label: { family: "primary", size: 14, weight: 500 },
      mono: { family: "secondary", size: 12, weight: 400 },
    },
    bodyLineHeight: 1.46, labelTracking: .02,
  };
  style.background = { version: 1, recipe: "aperture", intensity: .37, speed: .73, pointerResponse: .31, character: "precise", calm: true };
  style.balance = { composition: "centered", fractionSize: "small", fractionTone: "secondary" };
  style.chart = { visible: true, variant: "area" };
  style.layout = { chartPosition: "bottom" };
  style.assets = { variant: "tiles", density: "compact", separators: "none" };
  style.logo = { version: 1, variant: "plaque", customColor: true, hue: 49 };
  style.shape = { "quick-actions": 3, "bottom-navigation": 23 };
  const url = `${baseURL}/mono/view#mono=${await encodeMonoSharePayload(JSON.stringify(full))}`;
  await writeFile(testInfo.outputPath("full-appearance-url.txt"), url);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
  await guardEditorStorage(context, false);
  const page = await context.newPage();
  const errors: string[] = [], requests: string[] = [], fontResponses = new Map<string, number>();
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => requests.push(request.url()));
  page.on("response", response => {
    if (/\/fonts\/mono\/.*\.woff2$/.test(response.url())) fontResponses.set(new URL(response.url()).pathname, response.status());
  });

  async function expectRenderedSlices() {
    const scene = page.locator("[data-mono-preview]");
    await expect(scene).toHaveAttribute("data-mono-font-status", "ready");
    await expect(scene).toHaveAttribute("data-mono-typography", "true");
    await expect(scene).toHaveCSS("font-family", /Mono Source Sans 3/);
    await expect(page.locator(".mono-balance__amount")).toHaveCSS("font-family", /Mono Manrope/);
    await expect(page.locator(".mono-balance__heading h1")).toHaveCSS("font-size", "14px");
    await expect(page.locator(".mono-asset-list__name strong").first()).toHaveCSS("font-size", "17px");
    await expect(page.locator(".mono-asset-list__value").first()).toHaveCSS("font-family", /Mono Manrope/);
    expect(await page.evaluate(() => ({
      body: document.fonts.check('400 17px "Mono Source Sans 3"', "Баланс"),
      numeric: document.fonts.check('600 54px "Mono Manrope"', "1 234,56 $"),
    }))).toEqual({ body: true, numeric: true });

    await expect(page.locator(".mono-balance")).toHaveAttribute("data-composition", "centered");
    await expect(page.locator(".mono-balance")).toHaveCSS("text-align", "center");
    await expect(page.locator('.mono-balance [data-number-part="fraction"]')).toHaveText(/^\d{2}$/);
    const numberPaint = await page.locator(".mono-balance").evaluate(element => {
      const integer = getComputedStyle(element.querySelector('[data-number-part="integer"]')!);
      const fraction = getComputedStyle(element.querySelector('[data-number-part="fraction"]')!);
      return { ratio: parseFloat(fraction.fontSize) / parseFloat(integer.fontSize), integer: integer.color, fraction: fraction.color };
    });
    expect(numberPaint.ratio).toBeCloseTo(.42, 2);
    expect(numberPaint.fraction).not.toBe(numberPaint.integer);

    const assets = page.locator(".mono-asset-list");
    await expect(assets).toHaveAttribute("data-variant", "tiles");
    await expect(assets).toHaveAttribute("data-density", "compact");
    await expect(assets).toHaveAttribute("data-separators", "none");
    await expect(assets.locator(".mono-asset-list__items")).toHaveCSS("display", "grid");
    await expect(assets.locator(".mono-asset-list__items")).toHaveCSS("row-gap", "7px");
    await expect(assets.locator(".mono-asset-list__row").first()).toHaveCSS("padding-top", "10px");
    expect(await assets.locator(".mono-asset-list__row").nth(1).evaluate(element => getComputedStyle(element, "::before").content)).toBe("none");

    const chart = page.locator(".mono-chart-view");
    await expect(chart).toHaveAttribute("data-chart-variant", "area");
    await expect(chart.locator('svg > path[fill^="url("]')).toHaveCount(1);
    expect(await page.evaluate(() => document.querySelector(".mono-chart-view")!.getBoundingClientRect().top >=
      document.querySelector(".mono-asset-list")!.getBoundingClientRect().bottom)).toBe(true);

    const background = page.locator('[data-mono-background-recipe="aperture"]');
    await expect(scene).toHaveAttribute("data-mono-atmosphere-source", "adapter");
    await expect(page.locator("[data-mono-atmosphere]")).toHaveCount(0);
    await expect(background).toBeVisible();
    await expect(background).toHaveCSS("background-color", "rgb(231, 226, 217)");
    await expect(background.locator(":scope > div").first()).toHaveCSS("opacity", "0.37");
    await expect(background.locator("svg")).toBeVisible();

    await expect(scene).toHaveAttribute("data-mono-logo-variant", "plaque");
    await expect(scene).toHaveAttribute("data-mono-logo-custom", "true");
    const logoPaint = await scene.evaluate(element => {
      const declared = document.createElement("span");
      declared.style.color = (element as HTMLElement).style.getPropertyValue("--mono-logo-custom-light-primary");
      return { expected: declared.style.color, actual: getComputedStyle(element.querySelector(".mono-logo__icon-primary")!).fill,
        plaque: getComputedStyle(element.querySelector(".mono-app-header__mark")!).backgroundColor };
    });
    expect(logoPaint.actual).toBe(logoPaint.expected);
    expect(logoPaint.plaque).not.toBe("rgba(0, 0, 0, 0)");
    await expect(page.locator(".mono-actions")).toHaveCSS("border-top-left-radius", "3px");
    await expect(page.locator(".mono-nav")).toHaveCSS("border-top-left-radius", "23px");
    await expect(page.locator("canvas")).toHaveCount(1);
    await expect(page.locator("[data-mono-rail], [data-mono-workbench]")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.evaluate(() => (window as unknown as { monoStorageCalls: string[] }).monoStorageCalls)).toEqual([]);
    expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
  }

  try {
    await page.goto(url);
    await expectRenderedSlices();
    await page.screenshot({ path: testInfo.outputPath("full-appearance-first-load.png"), fullPage: true });
    await page.reload();
    await expectRenderedSlices();
    await page.screenshot({ path: testInfo.outputPath("full-appearance-reload.png"), fullPage: true });
    expect(fontResponses.get("/fonts/mono/source-sans-3-variable.woff2")).toBe(200);
    expect(fontResponses.get("/fonts/mono/manrope-variable.woff2")).toBe(200);
    expect(requests.some(request => request.includes("/api/skin-presets"))).toBe(false);
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});
