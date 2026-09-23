import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/design-lab/scene");
  await expect(page.getByRole("heading", { name: "Сцена счёта", exact: true })).toBeVisible();
});

test("hydrates the chart without replacing server markup", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.reload();
  await page.getByRole("button", { name: "Скрыть баланс", exact: true }).click();
  expect(errors).toEqual([]);
});

test("moves one chart between the two scene positions and removes its complete footer when hidden", async ({ page }) => {
  const frame = page.locator("[data-mono-scene-preview]");
  await page.getByRole("button", { name: "Настроить график", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "График" });
  await dialog.getByLabel("Положение графика").selectOption("bottom");
  await page.keyboard.press("Escape");
  const chart = frame.locator(".mono-chart-view");
  expect((await chart.boundingBox())!.y).toBeGreaterThan((await frame.locator(".mono-asset-list").boundingBox())!.y);
  await page.getByRole("button", { name: "Настроить график", exact: true }).click();
  await dialog.getByLabel("Показывать график").uncheck();
  await page.keyboard.press("Escape");
  await expect(chart).toHaveCount(0);
  await expect(frame.getByRole("group", { name: "Период графика" })).toHaveCount(0);
  await page.getByRole("button", { name: "Настроить график", exact: true }).click();
  await dialog.getByLabel("Показывать график").check();
  await dialog.getByLabel("Положение графика").selectOption("top");
  await page.keyboard.press("Escape");
  expect((await chart.boundingBox())!.y).toBeLessThan((await frame.locator(".mono-asset-list").boundingBox())!.y);
});

test("privacy covers balance, assets and graph after changing appearance and period", async ({ page }) => {
  const frame = page.locator("[data-mono-scene-preview]");
  await frame.getByRole("button", { name: "За неделю" }).click();
  await frame.getByRole("button", { name: "Скрыть баланс" }).click();
  await page.getByRole("button", { name: "Настроить баланс", exact: true }).click();
  await page.getByLabel("Композиция баланса").selectOption("centered");
  await page.keyboard.press("Escape");
  await expect(frame.getByRole("img", { name: "Баланс скрыт" })).toBeVisible();
  await expect(frame.getByText("График скрыт")).toBeVisible();
  expect(await frame.innerHTML()).not.toMatch(/840,75|040,25|900,00|0,12|2,34/);
  await frame.getByRole("button", { name: "Показать баланс" }).click();
  await expect(frame.getByRole("button", { name: "За неделю" })).toHaveAttribute("aria-pressed", "true");
});

test("asset hover is a surface response without a left stripe or geometry movement", async ({ page }) => {
  const rows = page.locator(".mono-asset-list__row");
  for (const row of await rows.all()) {
    await row.evaluate((element) => element.scrollIntoView({ block: "center" }));
    await page.mouse.move(0, 0);
    const before = await row.boundingBox();
    const beforeColor = await row.evaluate((element) => getComputedStyle(element).backgroundColor);
    await row.hover();
    await expect.poll(() => row.evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe(beforeColor);
    expect(await row.boundingBox()).toEqual(before);
    expect(await row.evaluate((element) => getComputedStyle(element).boxShadow)).toBe("none");
  }
});

test("keeps controls outside the real-width scene, including narrow hosts", async ({ page }) => {
  const frame = page.locator("[data-mono-scene-preview]");
  for (const width of [320, 390, 430, 480]) {
    await page.getByRole("button", { name: `Ширина ${width}` }).click();
    expect((await frame.boundingBox())!.width).toBe(width);
    expect(await frame.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    await expect(frame.getByRole("button", { name: "Настроить баланс" })).toHaveCount(0);
  }
  await page.setViewportSize({ width: 320, height: 800 });
  expect((await frame.boundingBox())!.width).toBeLessThanOrEqual(320);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("the compact settings dialog traps focus, supports Escape and restores the launcher", async ({ page }) => {
  const launcher = page.getByRole("button", { name: "Настроить график", exact: true });
  await launcher.click();
  const dialog = page.getByRole("dialog", { name: "График" });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Shift+Tab");
  expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(launcher).toBeFocused();
});
