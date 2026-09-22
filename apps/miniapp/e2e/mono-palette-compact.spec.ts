import { expect, test } from "@playwright/test";
import { createHash } from "node:crypto";
import { MONO_PALETTE_SCHEMA_HASH, normalizeMonoPaletteConfig, resolveMonoPalette } from "../../../packages/ui/src/mono/mono-palette";

const MONO_PALETTE_ACTIVE_KEY = "wallet4i7.mono.palette-active.v2";
const MONO_PALETTE_PRESETS_KEY = "wallet4i7.mono.palette-presets.v2";

test.use({ hasTouch: false, isMobile: false, viewport: { width: 1440, height: 1000 } });

test("compact palette actions keep draft, Apply, local save and JSON import distinct", async ({ page }) => {
  await page.route("**/api/skin-presets", route => route.fulfill({ json: { presets: [] } }));
  await page.goto("/mono");
  await page.getByRole("button", { name: "Включить палитру" }).click();
  const hue = page.getByRole("slider", { name: "Тон" });
  await expect(page.getByRole("button", { name: "Применить палитру" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Имя пресета" })).toBeHidden();
  await expect(page.getByRole("region", { name: "Серверная библиотека" })).toBeHidden();
  await expect(page.getByRole("textbox", { name: "JSON пресета" })).toBeHidden();

  await hue.fill("40");
  const preview = page.locator("[data-mono-preview]");
  const chartColor = () => preview.evaluate(node => getComputedStyle(node).getPropertyValue("--mono-palette-chartLine-ff").trim());
  const originalColor = await chartColor();
  await page.getByRole("button", { name: "Другая палитра" }).click();
  await expect.poll(chartColor).not.toBe(originalColor);
  const randomizedColor = await chartColor();
  await expect(hue).toHaveValue("40");
  await page.getByRole("button", { name: "Отменить цвет" }).click();
  await expect.poll(chartColor).toBe(originalColor);
  await page.getByRole("button", { name: "Повторить цвет" }).click();
  await expect.poll(chartColor).toBe(randomizedColor);
  await page.getByRole("button", { name: "Сравнить A/B" }).press("Enter");
  await expect(page.getByRole("button", { name: "Применить палитру" })).toBeDisabled();
  await page.getByRole("button", { name: "Сравнить A/B" }).press("Enter");
  expect(await page.evaluate(key => localStorage.getItem(key), MONO_PALETTE_ACTIVE_KEY)).toBeNull();
  expect(await page.evaluate(key => localStorage.getItem(key), MONO_PALETTE_PRESETS_KEY)).toBeNull();

  await page.getByRole("button", { name: "Применить палитру" }).click();
  const applied = await page.evaluate(key => localStorage.getItem(key), MONO_PALETTE_ACTIVE_KEY);
  expect(applied).toContain('"anchorHue":40');
  await page.getByRole("button", { name: "Сохранить вариант" }).click();
  await page.getByRole("textbox", { name: "Имя пресета" }).fill("Мой тестовый вариант");
  await page.getByRole("button", { name: "Сохранить новый" }).click();
  await expect.poll(() => page.evaluate(key => localStorage.getItem(key), MONO_PALETTE_PRESETS_KEY))
    .toContain("Мой тестовый вариант");
  expect(await page.evaluate(key => localStorage.getItem(key), MONO_PALETTE_ACTIVE_KEY)).toBe(applied);

  await page.getByRole("button", { name: "Варианты", exact: true }).click();
  await expect(page.getByRole("region", { name: "Локальные варианты" }).getByRole("article", { name: "Мой тестовый вариант" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Серверная библиотека" })).toBeVisible();
  await page.getByRole("button", { name: "Дополнительные действия" }).press("Enter");
  const lab = page.getByRole("region", { name: "Color Lab" });
  await expect(lab.getByRole("button", { name: "Копировать JSON" })).toBeVisible();
  await expect(lab.getByRole("button", { name: "Скачать JSON" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "JSON пресета" })).toBeHidden();
  await page.getByRole("button", { name: "Импорт JSON" }).click();
  const incoming = normalizeMonoPaletteConfig();
  incoming.themes.dark.recipe.anchorHue = 70;
  const body = {
    schemaVersion: 1, skinId: "mono-ledger-v1", configVersion: 1, engineVersion: 1,
    catalogVersion: 1, schemaHash: MONO_PALETTE_SCHEMA_HASH, config: incoming,
    resolved: { dark: resolveMonoPalette(incoming.themes.dark), light: resolveMonoPalette(incoming.themes.light) },
  };
  const preset = { ...body, contentHash: `sha256-${createHash("sha256").update(JSON.stringify(body)).digest("hex")}` };
  await page.getByRole("textbox", { name: "JSON пресета" }).fill(JSON.stringify(preset));
  await page.getByRole("button", { name: "Предпросмотр импорта" }).click();
  await expect(page.getByRole("region", { name: "Различия импорта" })).toBeVisible();
  await expect(hue).toHaveValue("40");
  await page.getByRole("button", { name: "Принять в черновик" }).click();
  await expect(hue).toHaveValue("70");
  expect(await page.evaluate(key => localStorage.getItem(key), MONO_PALETTE_ACTIVE_KEY)).toBe(applied);
});

test("compact toolbar remains keyboard-accessible with 44px targets and no horizontal overflow", async ({ page }) => {
  await page.goto("/mono");
  await page.getByRole("button", { name: "Включить палитру" }).click();
  const controls = ["Отменить цвет", "Повторить цвет", "Сравнить A/B", "Дополнительные действия"];
  for (const name of controls) {
    const box = await page.getByRole("button", { name }).boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }
  await page.getByRole("button", { name: "Дополнительные действия" }).press("Enter");
  await expect(page.getByRole("button", { name: "Импорт JSON" })).toBeVisible();
  for (const width of [320, 390, 430, 480]) {
    await page.setViewportSize({ width, height: 850 });
    await expect(page.getByRole("button", { name: "Открыть быстрые настройки" })).toBeVisible();
    await page.getByRole("button", { name: "Открыть быстрые настройки" }).click();
    await expect(page.getByRole("button", { name: "Применить палитру" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.keyboard.press("Escape");
  }
});
