import { expect, test } from "@playwright/test";
import { openMonoRail } from "./mono-test-helpers";

test.use({ hasTouch: false, isMobile: false, viewport: { width: 390, height: 844 } });

test("подпись действия не выделяется мышью, а баланс остаётся копируемым", async ({ page }) => {
  await page.goto("/mono");

  const actionLabel = page.locator(".mono-actions__item").filter({ hasText: "Обмен" }).locator("span").last();
  await actionLabel.scrollIntoViewIfNeeded();
  const actionBox = await actionLabel.boundingBox();
  expect(actionBox).not.toBeNull();
  await page.mouse.move(actionBox!.x + 1, actionBox!.y + actionBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(actionBox!.x + actionBox!.width - 1, actionBox!.y + actionBox!.height / 2, { steps: 8 });
  await page.mouse.up();
  expect(await page.evaluate(() => window.getSelection()?.toString() ?? "")).toBe("");
  await openMonoRail(page, "quick");

  const controls = [
    ".mono-actions__item",
    ".mono-periods span",
    ".mono-nav__item",
    ".mono-labbar__variants button",
    ".mono-viewport-options button",
    ".mono-workbench__launcher",
  ];
  for (const selector of controls) {
    await expect(page.locator(selector).first()).toHaveCSS("user-select", "none");
  }
  await expect(page.locator(".mono-hero__amount span").first()).not.toHaveCSS("user-select", "none");
});
