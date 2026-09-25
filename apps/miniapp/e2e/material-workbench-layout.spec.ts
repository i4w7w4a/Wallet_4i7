import { expect, test, type Locator } from "@playwright/test";

async function expectOwnHitbox(control: Locator) {
  await control.scrollIntoViewIfNeeded();
  expect(await control.evaluate(element => {
    const box = element.getBoundingClientRect();
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    return hit === element || element.contains(hit);
  })).toBe(true);
}

async function expectActionsInsidePreview(preview: Locator) {
  await expect.poll(() => preview.locator(".mono-actions").evaluate(row => {
    const viewport = row.closest('[aria-label="Реальные кнопки MONO"]');
    if (!viewport) return false;
    const actions = row.getBoundingClientRect(), frame = viewport.getBoundingClientRect();
    return actions.height > 0 && actions.top >= frame.top - 1 && actions.bottom <= frame.bottom + 1;
  })).toBe(true);
}

async function expectCanvasMatchesVisiblePhone(preview: Locator, phoneWidth: number) {
  await expect.poll(() => preview.locator("canvas[data-material-canvas]").evaluate(canvas => {
    const viewport = canvas.closest("[data-material-scrollport]");
    const width = canvas.closest("[data-material-scene]");
    if (!viewport || !width) return null;
    const a = canvas.getBoundingClientRect(), v = viewport.getBoundingClientRect(), w = width.getBoundingClientRect();
    return { canvasWidth: Math.round(a.width), phoneWidth: Math.round(w.width),
      heightMatches: Math.abs(a.height - v.height) <= 1, topMatches: Math.abs(a.top - v.top) <= 1 };
  })).toEqual({ canvasWidth: phoneWidth, phoneWidth, heightMatches: true, topMatches: true });
}

test("button controls scroll in their rail while the real actions stay visible on desktop", async ({ browser }) => {
  test.setTimeout(60_000);
  for (const viewport of [{ width: 1366, height: 600 }, { width: 1440, height: 900 }]) {
    const context = await browser.newContext({ baseURL: String(test.info().project.use.baseURL), viewport,
      deviceScaleFactor: 1, reducedMotion: "reduce" });
    try {
      const page = await context.newPage();
      await page.goto("/design-lab/buttons");
      const preview = page.getByRole("region", { name: "Реальные кнопки MONO" });
      const rail = page.locator('[data-workbench-rail="right"]');
      await expect(preview.locator(".mono-actions__item")).toHaveCount(4);
      await expectActionsInsidePreview(preview);
      expect(await page.evaluate(() => window.scrollY)).toBe(0);
      const previewScroll = await preview.evaluate(element => element.scrollTop);
      await expect(preview.locator("canvas[data-material-canvas]")).toHaveCount(1);
      await expectCanvasMatchesVisiblePhone(preview, 390);
      await preview.evaluate(element => { element.scrollTop = 0; });
      await expectCanvasMatchesVisiblePhone(preview, 390);
      await preview.evaluate(element => { element.scrollTop = Math.min(80, element.scrollHeight - element.clientHeight); });
      expect(await preview.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
      await expectCanvasMatchesVisiblePhone(preview, 390);
      await preview.evaluate((element, top) => { element.scrollTop = top; }, previewScroll);
      await expectActionsInsidePreview(preview);

      await expectOwnHitbox(rail.locator('input[type="text"][aria-label$="HEX"]').first());
      await rail.getByRole("button", { name: "Форма / поверхность" }).click();
      await rail.getByText("Форма и слой", { exact: true }).click();
      await rail.evaluate(element => { element.scrollTop = element.scrollHeight; });
      expect(await rail.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
      const geometry = rail.locator("details").filter({ has: rail.getByText("Форма и слой", { exact: true }) });
      await geometry.locator("label").filter({ hasText: "Толщина рамки" }).locator('input[type="range"]').fill("2");
      expect(await preview.evaluate(element => element.scrollTop)).toBe(previewScroll);
      await expectActionsInsidePreview(preview);
      expect(await page.evaluate(() => window.scrollY)).toBe(0);

      await rail.getByRole("button", { name: "Свет", exact: true }).click();
      await page.mouse.move(1, 1);
      await expect(page.getByRole("tooltip")).toHaveCount(0);
      await expectOwnHitbox(rail.getByRole("spinbutton", { name: "Сложение света — значение" }));
      await expectOwnHitbox(rail.getByRole("button", { name: "Описание «Сложение света»" }));
      expect(await page.evaluate(() => window.scrollY)).toBe(0);

      if (viewport.width === 1440) {
        const left = page.locator('[data-workbench-rail="left"]');
        await left.getByText("Сцена", { exact: true }).click();
        await left.getByRole("button", { name: "480", exact: true }).click();
        const frameWidth = await preview.locator(".mono-preview-frame").evaluate(element => element.getBoundingClientRect().width);
        expect(Math.round(frameWidth)).toBe(480);
        await expectCanvasMatchesVisiblePhone(preview, 480);
        await expectActionsInsidePreview(preview);
      }
    } finally { await context.close(); }
  }
});

test("Atmosphere Physics scroll and its lower slider leave the central scene fixed", async ({ browser }) => {
  const context = await browser.newContext({ baseURL: String(test.info().project.use.baseURL),
    viewport: { width: 1366, height: 600 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
  try {
    const page = await context.newPage();
    await page.goto("/design-lab/atmosphere");
    const scene = page.getByRole("region", { name: "Сцена", exact: true });
    const rail = page.locator('[data-workbench-rail="right"]');
    await expect(scene.locator("[data-material-scene]")).toBeVisible();
    const before = await scene.boundingBox();
    await rail.getByRole("button", { name: "Физика", exact: true }).click();
    const physics = rail.getByRole("region", { name: "Физика · параметры" });
    const slider = physics.getByRole("slider").last();
    await expect(slider).toBeVisible();
    await rail.evaluate(element => { element.scrollTop = element.scrollHeight; });
    expect(await rail.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
    const original = Number(await slider.inputValue());
    const min = Number(await slider.getAttribute("min"));
    const max = Number(await slider.getAttribute("max"));
    const step = Number(await slider.getAttribute("step")) || 1;
    const next = original + step <= max ? original + step : Math.max(min, original - step);
    await slider.fill(String(Number(next.toFixed(6))));
    expect(await scene.boundingBox()).toEqual(before);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  } finally { await context.close(); }
});

test("mobile drawer and More return focus without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/design-lab/buttons");
  const launcher = page.getByRole("button", { name: "Настройки", exact: true });
  await launcher.click();
  const drawer = page.getByRole("dialog", { name: "Настройки" });
  await expect(drawer).toBeVisible();
  await expect(page.getByRole("region", { name: "Сцена", exact: true })).toHaveAttribute("inert", "");
  await page.keyboard.press("Escape");
  await expect(drawer).toHaveCount(0);
  await expect(launcher).toBeFocused();

  const more = page.getByRole("toolbar", { name: "Действия пробы" }).getByRole("button", { name: "Ещё" });
  await more.click();
  const modal = page.getByRole("dialog", { name: "Дополнительно" });
  await expect(modal).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(modal).toHaveCount(0);
  await expect(more).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(391);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});
