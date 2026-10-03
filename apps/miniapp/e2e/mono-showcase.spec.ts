import { expect, test } from "@playwright/test";

const presets = [
  "1 Графит",
  "2 Живая среда",
  "3 Светлый",
  "4 Терминал",
  "5 Минимал",
  "6 Мягкое стекло",
  "7 Фирменный",
];

test("showcase offers seven direct, read-only preset links", async ({ page }, testInfo) => {
  await page.goto("/showcase");

  await expect(page.getByRole("heading", { name: "Семь состояний Novex" })).toBeVisible();
  await expect(page.getByText("Интерактивный дизайн-прототип · демонстрационные данные")).toBeVisible();

  const links = page.locator("main a[href^='/p/']");
  await expect(links).toHaveCount(7);
  for (let index = 0; index < presets.length; index++) {
    await expect(links.nth(index)).toHaveAttribute("href", `/p/${index + 1}`);
    await expect(links.nth(index)).toContainText(presets[index]);
  }

  for (const slot of [1, 2, 3, 4, 5, 6, 7]) {
    const screenshot = page.locator(`main a[href='/p/${slot}'] img`);
    await expect(screenshot).toHaveAttribute("src", `/showcase/slot-${slot}-mobile.jpg`);
    await expect.poll(() => screenshot.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  }

  await expect(page.locator("main button, main input, main form, main canvas, main iframe")).toHaveCount(0);
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: testInfo.outputPath(`showcase-${width}.png`), fullPage: true });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const twoColumnTops = await links.evaluateAll((cards) => cards.slice(0, 2).map((card) => card.getBoundingClientRect().top));
  expect(twoColumnTops[0]).toBe(twoColumnTops[1]);
  await page.setViewportSize({ width: 320, height: 844 });
  const narrowTops = await links.evaluateAll((cards) => cards.slice(0, 2).map((card) => card.getBoundingClientRect().top));
  expect(narrowTops[1]).toBeGreaterThan(narrowTops[0]);
});
