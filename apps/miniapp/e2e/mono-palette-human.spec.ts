import { expect, test } from "@playwright/test";

test.use({ hasTouch: false, isMobile: false, viewport: { width: 1440, height: 1000 } });

test("human color controls change one preview without exposing the exact editor", async ({ page }) => {
  await page.goto("/mono");
  const field = page.getByRole("group", { name: "Цветовое поле" });
  await expect(field).toHaveAttribute("aria-disabled", "true");
  const quietBounds = await field.boundingBox();
  expect(quietBounds).not.toBeNull();
  await page.mouse.click(quietBounds!.x + quietBounds!.width - 10, quietBounds!.y + quietBounds!.height / 2);
  await page.getByRole("button", { name: "Включить палитру" }).click();
  await expect(page.getByRole("slider", { name: "Тон" })).toHaveValue("250");
  const preview = page.locator("[data-mono-preview]");
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveCount(1);
  await expect(page.getByRole("radio", { name: "Графит" })).toBeChecked();
  await expect(page.getByText("Seed")).toBeHidden();
  const accentBefore = await preview.evaluate(node => getComputedStyle(node).getPropertyValue("--mono-palette-chartLine-ff").trim());

  const bounds = await field.boundingBox();
  expect(bounds).not.toBeNull();
  await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + 10);
  await page.mouse.down();
  await page.mouse.move(bounds!.x + bounds!.width - 10, bounds!.y + bounds!.height / 2, { steps: 6 });
  await page.mouse.up();
  await expect.poll(async () => Number(await page.getByRole("slider", { name: "Тон" }).inputValue())).toBeGreaterThanOrEqual(85);
  await expect.poll(async () => Number(await page.getByRole("slider", { name: "Тон" }).inputValue())).toBeLessThanOrEqual(95);
  expect(await preview.evaluate(node => getComputedStyle(node).getPropertyValue("--mono-palette-chartLine-ff").trim())).not.toBe(accentBefore);
  if (process.env.MONO_PALETTE_CAPTURE === "1")
    await page.screenshot({ path: test.info().outputPath("quick-color-saturated.png"), animations: "disabled" });
  await page.getByRole("button", { name: "Отменить цвет" }).click();
  await expect(page.getByRole("slider", { name: "Тон" })).toHaveValue("250");

  await page.getByRole("radio", { name: "Дымка" }).check();
  await expect(page.getByRole("radio", { name: "Дымка" })).toBeChecked();
  await page.getByRole("button", { name: "Не менять Основа" }).click();
  const foundation = await preview.evaluate(node => getComputedStyle(node).getPropertyValue("--mono-palette-canvas-ff").trim());
  await page.getByRole("button", { name: "Новый вариант" }).click();
  if (process.env.MONO_PALETTE_CAPTURE === "1")
    await page.screenshot({ path: test.info().outputPath("quick-color-variant.png"), animations: "disabled" });
  await expect(page.getByRole("button", { name: "Не менять Основа" })).toHaveAttribute("aria-pressed", "true");
  expect(await preview.evaluate(node => getComputedStyle(node).getPropertyValue("--mono-palette-canvas-ff").trim())).toBe(foundation);
  await expect(canvas).toHaveCount(1);
});

test("quick color panel remains contained at the four phone widths and reduced motion is still", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/mono");
  await page.getByRole("button", { name: "Включить палитру" }).click();
  const preview = page.locator("[data-mono-preview]");
  for (const width of [320, 390, 430, 480]) {
    await page.getByRole("button", { name: `Экран ${width} пикселей` }).click();
    await expect(preview).toHaveAttribute("data-mono-viewport", String(width));
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1440);
  }
  await page.getByRole("button", { name: "Новый вариант" }).click();
  const layer = page.locator("[data-mono-palette-crossfade]");
  expect(await layer.evaluate(node => node.getAnimations().length)).toBe(0);
  await expect(page.locator("canvas")).toHaveCount(1);
});
