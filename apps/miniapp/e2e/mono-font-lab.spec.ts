import { expect, test } from "@playwright/test";

// This isolated route is deliberately absent from production builds.
test.skip(!process.env.MONO_FONT_LAB_BASE_URL, "Run against the dedicated development Font Lab server.");

test("loads only active local faces, fits all five sets at real mobile widths", async ({ page }) => {
  const fonts: string[] = [];
  page.on("request", request => { if (/\.woff2(?:$|\?)/.test(request.url())) fonts.push(request.url()); });
  await page.goto("/design-lab/type");
  await expect(page.getByText("Набор готов", { exact: true })).toBeVisible();
  expect(fonts.every(url => url.startsWith(process.env.MONO_FONT_LAB_BASE_URL!))).toBe(true);
  expect(fonts.some(url => /golos|onest|manrope|source-sans/.test(url))).toBe(false);
  await page.getByRole("button", { name: "Проверить длинную сумму" }).click();
  const scene = page.getByRole("region", { name: "Живой образец кошелька" });
  for (const family of ["ibm-plex-sans", "golos-text", "onest", "manrope", "source-sans-3"]) {
    await page.getByRole("combobox", { name: "Шрифтовой набор" }).selectOption(family);
    await expect(page.getByText("Набор готов", { exact: true })).toBeVisible();
    for (const width of [320, 390, 430, 480]) {
      await page.getByRole("button", { name: String(width), exact: true }).click();
      const bounds = await scene.evaluate(element => {
        const rect = element.getBoundingClientRect();
        const amount = element.querySelector(".mono-font-balance")!;
        const range = document.createRange(); range.selectNodeContents(amount);
        const text = range.getBoundingClientRect();
        return { width: rect.width, scroll: element.scrollWidth, client: element.clientWidth, left: text.left - rect.left,
          right: rect.right - text.right, transform: getComputedStyle(element).transform };
      });
      expect(bounds.width).toBe(width);
      expect(bounds.scroll).toBe(bounds.client);
      expect(bounds.left).toBeGreaterThanOrEqual(0);
      expect(bounds.right).toBeGreaterThanOrEqual(0);
      expect(bounds.transform).toBe("none");
    }
    // The actual financial column and Hero must share the same numeric family.
    expect(await scene.locator(".mono-font-asset-value").first().evaluate(el => getComputedStyle(el).fontFamily))
      .toBe(await scene.locator(".mono-font-balance").evaluate(el => getComputedStyle(el).fontFamily));
  }
  await page.getByRole("button", { name: "320", exact: true }).click();
  await page.screenshot({ path: "test-results/mono-font-lab/desktop-source-manrope-320.png", fullPage: true });
});

test("a font network failure keeps the last ready specimen and can recover", async ({ page }) => {
  await page.goto("/design-lab/type");
  await expect(page.getByText("Набор готов", { exact: true })).toBeVisible();
  const scene = page.getByRole("region", { name: "Живой образец кошелька" });
  const before = await scene.getAttribute("style");
  await page.route("**/onest-variable.woff2", route => route.abort());
  await page.getByRole("combobox", { name: "Шрифтовой набор" }).selectOption("onest");
  await expect(page.getByText("Шрифт не загрузился. Оставлен предыдущий набор.")).toBeVisible();
  expect(await scene.getAttribute("style")).toBe(before);
  await page.getByRole("combobox", { name: "Шрифтовой набор" }).selectOption("source-sans-3");
  await expect(page.getByText("Набор готов", { exact: true })).toBeVisible();
  await expect(scene).toHaveCSS("font-family", /Mono Source Sans 3/);
});

test("mobile controls retain hit areas and tooltips escape clipping at both viewport edges", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 760 });
  await page.goto("/design-lab/type");
  await expect(page.getByText("Набор готов", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "480", exact: true }).click();
  const scene = page.getByRole("region", { name: "Живой образец кошелька" });
  expect(await scene.evaluate(el => el.getBoundingClientRect().width)).toBeLessThanOrEqual(320);
  for (const control of await page.locator('.mono-lab-control-icon-button, .mono-lab-control-slider-inputs input').all()) {
    if (!await control.isVisible()) continue;
    const rect = await control.boundingBox();
    expect(rect!.height).toBeGreaterThanOrEqual(44);
    expect(rect!.width).toBeGreaterThanOrEqual(44);
  }
  // Exercise the reusable kit as it will appear in a narrow, scrolling dock.
  await page.addStyleTag({ content: '.mono-font-stage-toolbar { position:fixed; top:0; left:0; right:0; z-index:50; height:44px; overflow:hidden; } .mono-font-stage-toolbar .mono-font-tool-row { position:absolute; left:0; top:0; right:0; justify-content:space-between; }' });
  for (const label of ["Сравнить с исходным", "Светлая поверхность"]) {
    const button = page.getByRole("button", { name: label });
    await button.focus();
    const tooltip = page.getByRole("tooltip");
    await expect(tooltip).toBeVisible();
    const box = await tooltip.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(8);
    expect(box!.x + box!.width).toBeLessThanOrEqual(312);
    expect(await tooltip.evaluate(el => el.parentElement === document.body)).toBe(true);
    await button.press("Escape");
    await expect(tooltip).toHaveCount(0);
  }
});
