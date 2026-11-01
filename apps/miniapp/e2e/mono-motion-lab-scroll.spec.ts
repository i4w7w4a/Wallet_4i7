import { expect, test, type Locator, type Page } from "@playwright/test";

test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false });

async function pointerClick(page: Page, target: Locator) {
  const rect = await target.boundingBox();
  expect(rect).not.toBeNull();
  const point = { x: rect!.x + rect!.width / 2, y: rect!.y + rect!.height / 2 };
  const hit = await target.evaluate((node, point) => {
    const top = document.elementFromPoint(point.x, point.y);
    return top === node || node.contains(top);
  }, point);
  expect(hit, "visible control must receive the actual pointer").toBe(true);
  await page.mouse.click(point.x, point.y);
}

for (const width of [320, 390]) test(`the ${width}px embedded wallet keeps receive routes reachable while scrolling`, async ({ page }) => {
  await page.goto("/design-lab/motion");
  const stage = page.getByRole("region", { name: "Примерка кошелька" });
  await page.getByRole("group", { name: "Ширина сцены" }).getByRole("button", { name: String(width) }).click();
  await page.getByRole("button", { name: "Применить к примерке кошелька" }).click();
  await stage.scrollIntoViewIfNeeded();
  const frame = stage.locator(".mono-preview-frame");
  let box = await frame.boundingBox();
  expect(box).not.toBeNull();
  // Outer page scroll and the inner wallet scroll are distinct owners.
  await page.mouse.move(70, 450);
  await page.mouse.wheel(0, box!.y - 80);
  await expect.poll(async () => (await frame.boundingBox())!.y).toBeGreaterThanOrEqual(0);
  box = await frame.boundingBox();
  expect(box!.y + box!.height).toBeLessThanOrEqual(900);

  const card = stage.locator("[data-r1-wallet-kind='custodial']");
  await pointerClick(page, card);
  const workspace = stage.locator("[data-mono-product-accounts-workspace]");
  await expect(workspace).toBeVisible();
  await pointerClick(page, workspace.locator("[data-product-account-quick-action='receive']"));
  const option = workspace.getByRole("button", { name: /Подготовить получение USDC.*Ethereum.*Внешнее получение/ });
  await expect(option).toBeAttached();

  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.wheel(0, 350);
  await expect.poll(() => frame.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
  const nav = stage.getByRole("navigation", { name: "Разделы кошелька" });
  const [navBox, targetBox] = await Promise.all([nav.boundingBox(), option.boundingBox()]);
  expect(navBox!.x).toBeCloseTo(box!.x, 0);
  expect(navBox!.y + navBox!.height).toBeCloseTo(box!.y + box!.height, 0);
  expect(targetBox!.y + targetBox!.height).toBeLessThanOrEqual(navBox!.y);
  await pointerClick(page, option);

  const dialog = stage.getByRole("dialog", { name: "Получить" });
  await expect(dialog).toBeVisible();
  const dialogBox = await dialog.boundingBox();
  expect(dialogBox!.y).toBeCloseTo(box!.y, 0);
  expect(dialogBox!.height).toBeCloseTo(box!.height, 0);
  const previousScroll = await frame.evaluate(el => el.scrollTop);
  await pointerClick(page, dialog.getByRole("button", { name: "Назад к выбору маршрута" }));
  await expect(workspace).toBeVisible();
  await expect(workspace.locator("[data-product-account-quick-action='receive']")).toBeFocused();
  await expect.poll(() => frame.evaluate(el => el.scrollTop)).toBe(previousScroll);
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.wheel(0, -3000);
  await expect.poll(() => frame.evaluate(el => el.scrollTop)).toBe(0);
  await pointerClick(page, stage.getByRole("button", { name: "Назад к кошелькам" }));
  await expect(card).toBeVisible();
  await expect(card).toBeFocused();
});
