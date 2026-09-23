import { expect, test } from "@playwright/test";

test("three recipes, finite pointer response, invariant content and no extra canvas", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/design-lab/atmosphere");
  const surface = page.locator("[data-atmosphere-surface]");
  const layer = page.locator("[data-mono-background-recipe]");
  await expect(layer).toHaveAttribute("data-motion", "ready");
  for (const [label, recipe] of [["База · Ирис", "baseline"], ["Обсидиан", "obsidian"], ["Световой разрез", "aperture"], ["Обсидиан", "obsidian"]]) {
    await page.getByRole("button", { name: label, exact: true }).click();
    await expect(layer).toHaveAttribute("data-mono-background-recipe", recipe);
    await expect(layer).toHaveCount(1);
    await expect(page.locator("canvas")).toHaveCount(0);
    const bounds = (await surface.boundingBox())!;
    const text = await surface.getByRole("heading").boundingBox();
    await page.mouse.move(bounds.x + bounds.width - 25, bounds.y + 150);
    await expect(layer).toHaveAttribute("data-pointer-active", "true");
    const right = await layer.evaluate(el => el.style.getPropertyValue("--recipe-x"));
    await page.mouse.move(bounds.x + 25, bounds.y + 400);
    await expect.poll(() => layer.evaluate(el => el.style.getPropertyValue("--recipe-x"))).not.toBe(right);
    expect(await surface.getByRole("heading").boundingBox()).toEqual(text);
    await page.mouse.move(5, 5);
    await expect(layer).toHaveAttribute("data-pointer-active", "false");
  }
  await page.getByRole("checkbox", { name: "Спокойный режим" }).check();
  await expect(layer).toHaveAttribute("data-motion", "calm");
  expect(await layer.evaluate(el => el.getAnimations({ subtree: true }).length)).toBe(0);
  expect(errors).toEqual([]);
});

test("isolated save/reload, compare, undo and import preview keep product settings untouched", async ({ page }) => {
  await page.goto("/design-lab/atmosphere");
  await page.getByRole("button", { name: "Световой разрез", exact: true }).click();
  const intensity = page.getByRole("slider", { name: "Интенсивность", exact: true });
  await intensity.fill("87");
  await page.getByRole("button", { name: "Сохранить пробу", exact: true }).click();
  const saved = await page.evaluate(() => ({ ...localStorage }));
  expect(Object.keys(saved)).toEqual(["wallet4i7.mono.atmosphere-lab.v1"]);
  await page.getByRole("button", { name: "Сравнить с базой", exact: true }).click();
  await expect(page.locator("[data-mono-background-recipe]")).toHaveAttribute("data-mono-background-recipe", "baseline");
  expect(await page.evaluate(() => ({ ...localStorage }))).toEqual(saved);
  await page.getByRole("button", { name: "Вернуться к пробе", exact: true }).click();
  await page.getByRole("button", { name: "По умолчанию", exact: true }).click();
  await page.getByRole("button", { name: "Отменить", exact: true }).click();
  await expect(intensity).toHaveValue("87");
  await page.reload();
  await expect(intensity).toHaveValue("87");
  await expect(page.getByRole("button", { name: "Световой разрез", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("themes and true preview widths remain legible at 320/390/430/480", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1600, height: 1050 });
  await page.goto("/design-lab/atmosphere");
  const surface = page.locator("[data-atmosphere-surface]");
  for (const width of [320, 390, 430, 480]) {
    await page.getByRole("button", { name: String(width), exact: true }).click();
    expect(Math.round((await surface.boundingBox())!.width)).toBe(width);
  }
  await page.getByRole("button", { name: "390", exact: true }).click();
  for (const theme of ["Тёмная", "Светлая"]) {
    await page.getByRole("button", { name: theme, exact: true }).click();
    for (const recipe of ["База · Ирис", "Обсидиан", "Световой разрез"]) {
      await page.getByRole("button", { name: recipe, exact: true }).click();
      await page.mouse.move(5, 5);
      await page.screenshot({ path: testInfo.outputPath(`${theme}-${recipe}.png`) });
      await expect(surface.getByRole("img", { name: "Novex Wallet" })).toBeVisible();
    }
  }
  await page.setViewportSize({ width: 360, height: 800 });
  await page.getByRole("button", { name: "480", exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("reduced motion and a changed preference stop tracking immediately", async ({ page }) => {
  await page.goto("/design-lab/atmosphere");
  await expect(page.locator("[data-mono-background-recipe]")).toHaveAttribute("data-motion", "ready");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator("[data-mono-background-recipe]")).toHaveAttribute("data-motion", "reduced");
  const bounds = (await page.locator("[data-atmosphere-surface]").boundingBox())!;
  await page.mouse.move(bounds.x + 30, bounds.y + 100);
  await expect(page.locator("[data-mono-background-recipe]")).toHaveAttribute("data-pointer-active", "false");
  expect(await page.locator("[data-mono-background-recipe]").evaluate(el => el.getAnimations({ subtree: true }).length)).toBe(0);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(page.locator("[data-mono-background-recipe]")).toHaveAttribute("data-motion", "ready");
});

test("saveData keeps a static composition", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, "connection", {
    value: Object.assign(new EventTarget(), { saveData: true }), configurable: true,
  }));
  await page.goto("/design-lab/atmosphere");
  await expect(page.locator("[data-mono-background-recipe]")).toHaveAttribute("data-motion", "save-data");
  await expect(page.locator("[data-atmosphere-surface]").getByRole("heading")).toBeVisible();
});

test("coarse pointer keeps material static", async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(`${test.info().project.use.baseURL}/design-lab/atmosphere`);
  await expect(page.locator("[data-mono-background-recipe]")).toHaveAttribute("data-motion", "coarse");
  await context.close();
});

test("real MONO context keeps one Promo, four Material actions and readable DOM content", async ({ page }, testInfo) => {
  await page.goto("/design-lab/atmosphere");
  await page.getByRole("button", { name: "Показать в MONO", exact: true }).click({ timeout: 5000 });
  const scene = page.locator("[data-mono-preview]");
  await expect(scene).toHaveCount(1);
  await expect(scene.locator("[data-mono-background-recipe]")).toHaveCount(1);
  await expect(scene.locator("[data-mono-atmosphere]")).toHaveCount(0);
  await expect(scene.locator("canvas")).toHaveCount(1);
  await expect(scene.locator('[data-control-effect="material"]')).toHaveCount(4);
  const canvas = await scene.locator("canvas").elementHandle();
  await page.getByRole("button", { name: "Скрыть баланс", exact: true }).click();
  for (const label of ["Световой разрез", "Обсидиан"]) {
    await page.getByRole("button", { name: label, exact: true }).click();
    await expect(page.getByRole("button", { name: "Показать баланс", exact: true })).toBeVisible();
    expect(await canvas!.evaluate(el => el.isConnected)).toBe(true);
    await expect(scene.locator('[data-control-effect="material"]')).toHaveCount(4);
    await expect(scene.locator(".mono-logo")).toHaveCount(1);
  }
  await page.getByRole("button", { name: "Показать баланс", exact: true }).click();
  for (const theme of ["Тёмная", "Светлая"]) {
    await page.getByRole("button", { name: theme, exact: true }).click();
    for (const label of ["Обсидиан", "Световой разрез"]) {
      await page.getByRole("button", { name: label, exact: true }).click();
      await page.getByRole("slider", { name: "Интенсивность", exact: true }).fill("100");
      await page.mouse.move(5, 5);
      await page.screenshot({ path: testInfo.outputPath(`context-${theme}-${label}.png`), fullPage: true });
    }
  }
  await page.getByRole("button", { name: "Отправить — демо, операция недоступна", exact: true }).click();
  await expect(page.getByRole("status", { name: "Статус быстрых действий" })).toContainText("операция недоступна");
  await page.getByRole("button", { name: "Показать отдельно", exact: true }).click();
  await expect(page.locator("canvas")).toHaveCount(0);
});
