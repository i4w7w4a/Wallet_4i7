import { expect, test, type Locator, type Page } from "@playwright/test";
import { openMonoEnvironment } from "./mono-test-helpers";

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 });

/** Compare live GPU and DOM-only pixels strictly outside a rounded host silhouette. */
async function outsideGpuPixels(page: Page, target: Locator, radius: number) {
  const gpu = await target.screenshot({ animations: "disabled" });
  const canvas = page.locator("canvas[data-material-canvas]");
  await expect(canvas).toHaveCount(1);
  await canvas.evaluate(element => { element.style.visibility = "hidden"; });
  let fallback: Buffer;
  try { fallback = await target.screenshot({ animations: "disabled" }); }
  finally { await canvas.evaluate(element => { element.style.visibility = ""; }); }
  return page.evaluate(async ([left, right, cornerRadius]) => {
    async function pixels(base64: string) {
      const image = await createImageBitmap(await (await fetch(`data:image/png;base64,${base64}`)).blob());
      const element = document.createElement("canvas");
      element.width = image.width; element.height = image.height;
      const context = element.getContext("2d")!;
      context.drawImage(image, 0, 0);
      return { width: image.width, height: image.height,
        data: context.getImageData(0, 0, image.width, image.height).data };
    }
    const a = await pixels(left), b = await pixels(right);
    let outside = 0, inside = 0;
    for (let y = 0; y < a.height; y++) for (let x = 0; x < a.width; x++) {
      const dx = Math.max(cornerRadius - x - 0.5, 0, x + 0.5 - (a.width - cornerRadius));
      const dy = Math.max(cornerRadius - y - 0.5, 0, y + 0.5 - (a.height - cornerRadius));
      const index = (y * a.width + x) * 4;
      const delta = Math.max(...[0, 1, 2].map(channel => Math.abs(a.data[index + channel]! - b.data[index + channel]!)));
      if (Math.hypot(dx, dy) > cornerRadius + 2 && delta > 5) outside++;
      if (Math.hypot(dx, dy) < cornerRadius - 4 && delta > 5) inside++;
    }
    return { outside, inside };
  }, [gpu.toString("base64"), fallback.toString("base64"), radius] as const);
}

test("the clean MONO starter clips its four GPU borders to the common row in dark and light", async ({ page }, testInfo) => {
  const pageErrors: string[] = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto("/mono");
  await expect(page.getByRole("button", { name: "Пресет оформления: Первый · перелив" })).toBeEnabled();
  await expect(page.locator(".mono-actions[data-frame-mode='group'] [data-material-border-presented='true']"))
    .toHaveCount(4, { timeout: 30_000 });
  expect(await page.evaluate(() => localStorage.getItem("wallet4i7.mono.working-presets.v2"))).toBeNull();
  for (const theme of ["dark", "light"] as const) {
    if (theme === "light") {
      const fine = await openMonoEnvironment(page);
      await fine.getByRole("button", { name: "Светлая тема", exact: true }).click();
      await expect(page.locator("[data-mono-preview]")).toHaveAttribute("data-mono-theme", "light");
    }
    for (const width of [320, 390, 430, 480]) {
      await page.getByRole("button", { name: `Экран ${width} пикселей` }).click();
      const row = page.locator(".mono-actions[data-frame-mode='group']");
      await row.scrollIntoViewIfNeeded();
      await expect(row.locator('[data-material-border-presented="true"]')).toHaveCount(4);
      const radius = await row.evaluate(element => Number.parseFloat(getComputedStyle(element).borderTopLeftRadius));
      expect(radius).toBe(12);
      const pixels = await outsideGpuPixels(page, row, radius);
      expect(pixels.outside, `${theme} ${width}px`).toBe(0);
      await page.screenshot({ path: testInfo.outputPath(`mono-${theme}-${width}.png`), animations: "disabled" });
    }
  }
  expect(pageErrors).toEqual([]);
});

test("a square fill stays inside the separate button's 24px outer border", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto("/design-lab/buttons");
  await expect(page.locator('[data-material-border-presented="true"]')).toHaveCount(4, { timeout: 30_000 });
  await page.getByRole("group", { name: "Форма ряда действий" }).getByRole("button", { name: "Отдельные кнопки" }).click();
  await page.getByText("Форма и слой", { exact: true }).click();
  await page.getByRole("slider", { name: "Скругление кромки" }).press("End");
  await page.getByRole("tab", { name: "Поверхность" }).click();
  await page.getByRole("combobox", { name: "Материал" }).selectOption("liquid-metal");
  await page.getByText("Форма и слой", { exact: true }).click();
  await page.getByRole("slider", { name: "Скругление поверхности" }).press("Home");
  const button = page.locator(".mono-actions__item").first();
  await button.scrollIntoViewIfNeeded();
  await expect(button).toHaveAttribute("data-material-fill-presented", "true", { timeout: 30_000 });
  await expect(button).toHaveAttribute("data-material-border-presented", "true");
  expect(await button.evaluate(element => getComputedStyle(element).borderTopLeftRadius)).toBe("24px");
  const pixels = await outsideGpuPixels(page, button, 24);
  expect(pixels.outside).toBe(0);
  expect(pixels.inside).toBeGreaterThan(100);
  await page.getByRole("button", { name: "Ещё" }).click();
  await page.getByRole("dialog", { name: "Дополнительно" }).getByRole("button", { name: "Экспорт конфигурации JSON" }).click();
  const exported = JSON.parse(await page.getByRole("textbox", { name: "Экспорт конфигурации кнопок" }).inputValue());
  expect(exported.actions["quick.send"].border.radiusCss).toBe(24);
  expect(exported.actions["quick.send"].fill.radiusCss).toBe(0);
  expect(exported.actions["quick.send"].border.recipe.params.roundness).toBe(0.14);
  expect(pageErrors).toEqual([]);
});

test("icon-only actions stay frameless while Save, Undo and MONO Apply retain stored layers", async ({ page }, testInfo) => {
  const pageErrors: string[] = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto("/mono");
  await expect(page.getByRole("button", { name: "Пресет оформления: Первый · перелив" })).toBeEnabled();
  await page.getByRole("button", { name: "Действия с пресетом" }).click();
  await page.getByRole("button", { name: "Создать копию" }).click();
  await page.getByRole("textbox", { name: "Название пресета" }).fill("Основа QA");
  await page.getByRole("button", { name: "Сохранить копию" }).click();
  await expect(page.getByRole("button", { name: "Пресет оформления: Основа QA" })).toBeEnabled();

  await page.goto("/design-lab/buttons");
  const choices = page.getByRole("group", { name: "Форма ряда действий" });
  await expect(page.locator('[data-material-border-presented="true"]')).toHaveCount(4, { timeout: 30_000 });
  await choices.getByRole("button", { name: "Иконки + подписи" }).click();
  await expect(page.locator(".mono-actions")).toHaveAttribute("data-frame-mode", "icons");
  await expect(page.getByRole("tab", { name: "Иконка" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tab", { name: "Поверхность" })).toBeDisabled();
  await expect(page.getByRole("tab", { name: "Кромка" })).toBeDisabled();
  await expect(page.getByText(/Поверхность и кромка сохранены, но скрыты/)).toBeVisible();
  await expect(page.locator('[data-material-border-presented="true"]')).toHaveCount(0);
  const action = page.locator(".mono-actions__item").first();
  const bare = await action.evaluate(element => {
    const style = getComputedStyle(element);
    const row = getComputedStyle(element.closest(".mono-actions")!);
    const rect = element.getBoundingClientRect();
    return { background: style.backgroundColor, border: style.borderWidth, shadow: style.boxShadow,
      rowBackground: row.backgroundColor, rowBorder: row.borderWidth, width: rect.width, height: rect.height };
  });
  expect(bare).toMatchObject({ background: "rgba(0, 0, 0, 0)", border: "0px", shadow: "none",
    rowBackground: "rgba(0, 0, 0, 0)", rowBorder: "0px" });
  expect(bare.width).toBeGreaterThanOrEqual(44);
  expect(bare.height).toBeGreaterThanOrEqual(44);
  await action.click();
  await expect(page.getByRole("status", { name: "Статус быстрых действий" })).toContainText("операция недоступна в демо");
  await page.getByRole("button", { name: "Отменить" }).click();
  await expect(page.locator(".mono-actions")).toHaveAttribute("data-frame-mode", "group");
  await page.getByRole("button", { name: "Повторить" }).click();
  await expect(page.locator(".mono-actions")).toHaveAttribute("data-frame-mode", "icons");

  await page.getByRole("combobox", { name: "Материал" }).selectOption("liquid-metal");
  await expect(page.locator('[data-material-icon-presented="true"]')).toHaveCount(4, { timeout: 30_000 });
  await expect(page.locator('[data-material-border-presented="true"]')).toHaveCount(0);
  await page.keyboard.press("Tab");
  await action.focus();
  const focus = await action.evaluate(element => ({ visible: element.matches(":focus-visible"),
    outlineWidth: getComputedStyle(element).outlineWidth }));
  expect(focus.visible).toBe(true);
  expect(Number.parseFloat(focus.outlineWidth)).toBeGreaterThanOrEqual(2);
  await page.screenshot({ path: testInfo.outputPath("icons-workshop.png"), animations: "disabled" });

  await page.getByRole("button", { name: /В рабочий пресет MONO/ }).click();
  const dialog = page.getByRole("dialog", { name: "Применить материал в MONO" });
  await expect(dialog).toContainText("Иконки + подписи");
  await dialog.getByRole("button", { name: "Применить в MONO" }).click();
  await expect(dialog.getByText(/Применено: Основа QA/)).toBeVisible();
  const stored = await page.evaluate(() => {
    const library = JSON.parse(localStorage.getItem("wallet4i7.mono.working-presets.v2")!);
    return library.records.find((record: { id: string }) => record.id === library.activeId).document.materials.ledger.buttons;
  });
  expect(stored.frameMode).toBe("icons");
  expect(stored.bindings.filter((binding: { layer: string }) => binding.layer === "border")).toHaveLength(4);
  expect(stored.bindings.filter((binding: { layer: string }) => binding.layer === "icon")).toHaveLength(4);
  await dialog.getByRole("link", { name: "Открыть MONO" }).click();
  await expect(page.locator(".mono-actions")).toHaveAttribute("data-frame-mode", "icons");
  await expect(page.locator('[data-material-icon-presented="true"]')).toHaveCount(4, { timeout: 30_000 });
  await expect(page.locator('[data-material-border-presented="true"]')).toHaveCount(0);
  await expect(page.locator("canvas[data-material-canvas]")).toHaveCount(1);
  await page.screenshot({ path: testInfo.outputPath("icons-product.png"), animations: "disabled" });
  expect(pageErrors).toEqual([]);
});
