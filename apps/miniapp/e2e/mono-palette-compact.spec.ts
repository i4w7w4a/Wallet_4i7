import { expect, test } from "@playwright/test";

const WORKING_KEY = "wallet4i7.mono.working-presets.v1";
const PALETTE_ACTIVE_KEY = "wallet4i7.mono.palette-active.v2";

test.use({ hasTouch: false, isMobile: false, viewport: { width: 1440, height: 1000 } });

test("the active working preset survives copy, edit, switch and reload while palette Apply stays separate", async ({ page }) => {
  await page.route("**/api/skin-presets", route => route.fulfill({ status: 503, json: { error: "unavailable" } }));
  await page.goto("/mono");
  const selector = page.getByRole("button", { name: /Пресет оформления:/ });
  await expect(selector).toBeVisible();
  await page.getByRole("button", { name: "Включить палитру" }).click();
  await page.getByRole("slider", { name: "Тон" }).fill("40");
  await expect(page.getByText("Сохранено в этом браузере")).toBeVisible();
  expect(await page.evaluate(key => localStorage.getItem(key), PALETTE_ACTIVE_KEY)).toBeNull();

  await page.getByRole("button", { name: "Действия с пресетом" }).click();
  await page.getByRole("button", { name: "Создать копию" }).click();
  await page.getByRole("textbox", { name: "Название пресета" }).fill("Вариант B");
  await page.getByRole("button", { name: "Сохранить копию" }).click();
  await expect(selector).toHaveAttribute("aria-label", "Пресет оформления: Вариант B");
  await page.getByRole("slider", { name: "Тон" }).fill("160");
  await expect(page.getByText("Сохранено в этом браузере")).toBeVisible();
  await page.reload();
  await expect(selector).toHaveAttribute("aria-label", "Пресет оформления: Вариант B");
  await expect(page.getByRole("slider", { name: "Тон" })).toHaveValue("160");
  await selector.click();
  await page.getByRole("button", { name: "Выбрать Мой пресет" }).click();
  await expect(page.getByRole("slider", { name: "Тон" })).toHaveValue("40");
  await selector.click();
  await page.getByRole("button", { name: "Выбрать Вариант B" }).click();
  await expect(page.getByRole("slider", { name: "Тон" })).toHaveValue("160");

  await page.getByRole("button", { name: "Применить палитру" }).click();
  expect(await page.evaluate(key => localStorage.getItem(key), PALETTE_ACTIVE_KEY)).toContain('"anchorHue":160');
  const working = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), WORKING_KEY);
  expect(working.records.find((record: { name: string }) => record.name === "Мой пресет")
    .document.palette.slots[0].present.config.themes.dark.recipe.anchorHue).toBe(40);
});

test("full JSON import stays a secondary, previewed copy and narrow controls remain accessible", async ({ page }) => {
  await page.goto("/mono");
  await page.getByRole("button", { name: "Включить палитру" }).click();
  await expect(page.getByText("Сохранено в этом браузере")).toBeVisible();
  await page.getByRole("button", { name: "Действия с пресетом" }).click();
  await page.getByRole("button", { name: "Экспортировать" }).click();
  const exported = await page.getByRole("textbox", { name: "JSON рабочего пресета" }).inputValue();
  await page.getByRole("button", { name: "Закрыть экспорт" }).click();
  await page.getByRole("button", { name: "Импортировать" }).click();
  await page.getByLabel("Файл JSON").setInputFiles({
    name: "mono-working-preset.json", mimeType: "application/json", buffer: Buffer.from(exported, "utf8"),
  });
  await expect(page.getByRole("textbox", { name: "JSON для импорта" })).not.toBeEmpty();
  await page.getByRole("button", { name: "Проверить импорт" }).click();
  await expect(page.getByRole("region", { name: "Предпросмотр импорта" })).toBeVisible();
  const before = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).records.length, WORKING_KEY);
  await page.getByRole("button", { name: "Создать копию из импорта" }).click();
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).records.length, WORKING_KEY)).toBe(before + 1);

  for (const width of [320, 390, 430, 480]) {
    await page.setViewportSize({ width, height: 850 });
    await page.getByRole("button", { name: "Открыть быстрые настройки" }).click();
    const selector = page.getByRole("button", { name: /Пресет оформления:/ });
    await expect(selector).toBeVisible();
    const box = await selector.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    if (width === 390 && process.env.MONO_WORKING_CAPTURE === "1")
      await page.screenshot({ path: test.info().outputPath("working-preset-mobile-390.png"), animations: "disabled" });
    await page.getByRole("button", { name: "Действия с пресетом" }).click();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Действия с пресетом" })).toHaveAttribute("aria-expanded", "false");
    await expect(selector).toBeVisible();
    await page.keyboard.press("Escape");
  }
});
