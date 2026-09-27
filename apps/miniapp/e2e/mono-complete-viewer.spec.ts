import { expect, test, type BrowserContext } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { encodeMonoSharePayload } from "../src/mono-preview/mono-share-transport";

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 });

async function guardEditorStorage(context: BrowserContext) {
  await context.addInitScript(() => {
    const calls: string[] = [];
    Object.assign(window, { monoViewerStorageCalls: calls });
    const get = Storage.prototype.getItem, set = Storage.prototype.setItem;
    Storage.prototype.getItem = function(key) {
      if (key.startsWith("wallet4i7.")) calls.push(`read:${key}`);
      return get.call(this, key);
    };
    Storage.prototype.setItem = function(key, value) {
      if (key.startsWith("wallet4i7.")) calls.push(`write:${key}`);
      return set.call(this, key, value);
    };
  });
}

test("editor copy opens an immutable complete First snapshot in a clean recipient", async ({ page, browser }, testInfo) => {
  await page.goto("/mono");
  await expect(page.getByRole("button", { name: /Пресет оформления: Первый · перелив/ })).toBeEnabled();
  await page.getByRole("button", { name: "Скопировать ссылку" }).click();
  const link = await page.getByRole("textbox", { name: "Ссылка на кошелёк" }).inputValue();
  expect(link).toContain("/mono/view#mono=m1.");
  expect(link.length).toBeLessThan(16_384);
  await page.screenshot({ path: testInfo.outputPath("editor-share-actions-1440.png") });
  const recipient = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await guardEditorStorage(recipient);
  const wallet = await recipient.newPage();
  const errors: string[] = [];
  wallet.on("pageerror", error => errors.push(error.message));
  await wallet.goto(link);
  await expect(wallet.locator("[data-material-scene]")).toHaveAttribute("data-gpu-phase", /running|paused/, { timeout: 30_000 });
  await expect(wallet.locator('[data-material-border-presented="true"]')).toHaveCount(4);
  await expect(wallet.locator(".mono-promo[data-optics='shared-webgl']")).toBeVisible();
  await expect(wallet.locator("canvas")).toHaveCount(1);
  await expect(wallet.locator("[data-mono-rail], [data-mono-workbench]")).toHaveCount(0);
  expect(await wallet.evaluate(() => (window as unknown as { monoViewerStorageCalls: string[] }).monoViewerStorageCalls)).toEqual([]);
  expect(await wallet.evaluate(() => Object.keys(localStorage))).toEqual([]);
  await wallet.screenshot({ path: testInfo.outputPath("first-complete-viewer-390.png") });

  await page.locator('[data-mono-tool="balance"]').click();
  await page.getByRole("checkbox", { name: "Моргание глаза" }).uncheck();
  await page.getByRole("button", { name: "Применить настройку" }).click();
  await wallet.reload();
  await expect(wallet.locator(".mono-balance__privacy")).toHaveAttribute("data-eye-blink", "true");
  expect(errors).toEqual([]);
  await recipient.close();
});

test("full material viewer uses a bounded scrolling texture at all phone widths and frame modes", async ({ browser, baseURL }, testInfo) => {
  const template = JSON.parse(readFileSync(resolve(process.cwd(), "e2e/fixtures/mono-fluid-share-v3.json"), "utf8"));
  for (const frameMode of ["group", "separate", "icons"] as const) {
    const envelope = structuredClone(template);
    envelope.material.buttons.frameMode = frameMode;
    const link = `${baseURL}/mono/view#mono=${await encodeMonoSharePayload(JSON.stringify(envelope))}`;
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const wallet = await context.newPage();
    await wallet.goto(link);
    const surface = wallet.locator("[data-material-scene]");
    await expect(surface).toHaveAttribute("data-gpu-phase", /running|paused/, { timeout: 30_000 });
    await expect(wallet.locator(".mono-actions")).toHaveAttribute("data-frame-mode", frameMode);
    await expect(wallet.locator("canvas")).toHaveCount(1);
    for (const width of [320, 390, 430, 480]) {
      await wallet.setViewportSize({ width, height: 844 });
      const geometry = await wallet.evaluate(() => {
        const frame = document.querySelector<HTMLElement>(".mono-viewer > .mono-preview-frame")!;
        const canvas = document.querySelector<HTMLCanvasElement>("[data-material-canvas]")!;
        return { frame: frame.clientWidth, height: frame.clientHeight, canvas: canvas.clientHeight,
          nav: document.querySelector<HTMLElement>(".mono-nav")!.clientWidth,
          overflow: document.documentElement.scrollWidth > innerWidth };
      });
      expect(geometry).toEqual({ frame: width, height: 844, canvas: 844, nav: width, overflow: false });
    }
    await wallet.locator(".mono-preview-frame").evaluate(element => { element.scrollTop = 300; });
    await expect.poll(() => wallet.locator("[data-material-canvas]").evaluate(canvas => (canvas as HTMLElement).style.top)).toBe("300px");
    if (frameMode === "separate") await wallet.screenshot({ path: testInfo.outputPath("fluid-separate-viewer-480.png") });
    await context.close();
  }
});

test("opening from an unresolved trial asks first; Back restores the accepted editor", async ({ page }) => {
  await page.goto("/mono");
  await expect(page.getByRole("button", { name: /Пресет оформления: Первый · перелив/ })).toBeEnabled();
  await page.locator('[data-mono-tool="balance"]').click();
  await page.getByRole("checkbox", { name: "Моргание глаза" }).uncheck();
  await page.getByRole("button", { name: "Открыть кошелёк" }).click();
  await expect(page.getByRole("dialog", { name: "Неприменённые пробы" })).toBeVisible();
  await page.getByRole("button", { name: "Применить пробы и продолжить" }).click();
  await expect(page).toHaveURL(/\/mono\/view#mono=m1\./);
  await expect(page.locator(".mono-balance__privacy")).toHaveAttribute("data-eye-blink", "false");
  await page.goBack();
  await expect(page.locator("[data-mono-workbench]")).toBeVisible();
  await expect(page.locator(".mono-balance__privacy")).toHaveAttribute("data-eye-blink", "false");
  await page.locator('[data-mono-tool="balance"]').click();
  await expect(page.getByRole("checkbox", { name: "Моргание глаза" })).not.toBeChecked();
});
