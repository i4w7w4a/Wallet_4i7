import { expect, test, type Locator, type Page } from "@playwright/test";

test("desktop ограничивает живую сцену и overlays шириной приложения", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto("/");

  await expectSceneRect(page.locator(".wallet-theme-root"), 272, 480);
  await expectSceneRect(page.locator(".wallet-dashboard"), 272, 480);
  await expectSceneRect(page.locator("[data-wallet-visual-layer]"), 272, 480);
  await expectSceneRect(page.locator("canvas[data-web-threads]"), 272, 480);
  await expectSingleLineMobileType(page.locator(".balance-hero__amount"), 60);
  await expectSingleLineMobileType(page.locator(".liquid-promo h2"), 60);
  expect(await pointBelongsToDashboard(page, 40, 200)).toBe(false);
  expect(await page.locator("body").evaluate((node) => getComputedStyle(node).backgroundColor)).toBe(
    "rgb(0, 0, 0)",
  );

  await page.getByRole("button", { name: "Получить", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Получить" })).toBeVisible();
  await expectSceneRect(page.locator(".bottom-sheet"), 272, 480);
  expect(await pointBelongsToDashboard(page, 40, 200)).toBe(false);
  await page.getByRole("button", { name: "Закрыть", exact: true }).click();

  await page.getByRole("button", { name: "Студия темы" }).click();
  await expect(page.getByRole("dialog", { name: "Студия темы" })).toBeVisible();
  await expectSceneRect(page.locator(".wallet-dashboard__theme-overlay"), 272, 480);
  expect(await pointBelongsToDashboard(page, 40, 200)).toBe(false);
});

test("mobile сохраняет полноэкранную ширину сцены", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expectSceneRect(page.locator(".wallet-theme-root"), 0, 390);
  await expectSceneRect(page.locator(".wallet-dashboard"), 0, 390);
  await expectSceneRect(page.locator("[data-wallet-visual-layer]"), 0, 390);
  await expectSceneRect(page.locator("canvas[data-web-threads]"), 0, 390);
  await expectSingleLineMobileType(page.locator(".liquid-promo h2"), 60);
});

async function expectSceneRect(locator: Locator, x: number, width: number) {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box?.x).toBeCloseTo(x, 0);
  expect(box?.width).toBeCloseTo(width, 0);
}

async function expectSingleLineMobileType(locator: Locator, maxHeight: number) {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box?.height).toBeLessThanOrEqual(maxHeight);
}

async function pointBelongsToDashboard(page: Page, x: number, y: number) {
  return page.evaluate(
    ({ pointX, pointY }) =>
      document.elementFromPoint(pointX, pointY)?.closest(".wallet-dashboard") !== null,
    { pointX: x, pointY: y },
  );
}
