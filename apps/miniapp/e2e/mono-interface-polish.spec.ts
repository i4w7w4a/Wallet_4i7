import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 });

const ready = async (page: import("@playwright/test").Page) => {
  await page.goto("/mono");
  await expect(page.getByRole("button", { name: /Пресет оформления: Первый · перелив/ })).toBeEnabled();
  await expect(page.locator("[data-mono-preview]")).toHaveAttribute("data-mono-motion", "ready");
};

test("profile control routes to the existing demo profile; overview has no decorative counters", async ({ page }) => {
  await ready(page);
  const scene = page.locator("[data-mono-preview]");
  await expect(scene).toHaveAttribute("data-nav-indicator", "original");
  await expect(scene.locator(".mono-balance__privacy")).toHaveAttribute("data-eye-blink", "true");
  await expect(scene.locator(".mono-hero__eyebrow")).not.toContainText("01 / 03");
  await expect(scene.locator(".mono-asset-list__heading")).toHaveText("Активы");
  await expect(scene.locator(".mono-app-header__signal")).toHaveCount(0);
  await scene.getByRole("button", { name: "Открыть профиль" }).click();
  await expect(scene.getByRole("heading", { name: "Профиль" })).toBeVisible();
  await expect(scene).toContainText("Демонстрационный профиль");
  await scene.getByRole("button", { name: "Обзор" }).click();
  await expect(scene.getByRole("heading", { name: "Общий баланс" })).toBeVisible();
});

test("nav choices apply per direction, persist, export and keep real phone widths", async ({ page }, testInfo) => {
  await ready(page);
  const scene = page.locator("[data-mono-preview]");
  await page.locator('[data-mono-tool="navigation"]').click();
  const inspector = page.locator('[data-mono-inspector="navigation"]');
  await expect(inspector.getByRole("button", { name: "Исходный" })).toHaveAttribute("aria-pressed", "true");
  await expect(inspector.getByRole("slider", { name: /Свечение/ })).toBeDisabled();
  await inspector.getByRole("button", { name: "Линия" }).click();
  await expect(scene).toHaveAttribute("data-nav-indicator", "line");
  await expect(inspector.getByRole("slider", { name: /Мягкость/ })).toBeDisabled();
  const glow = inspector.getByRole("slider", { name: /Свечение/ });
  await glow.focus(); await glow.press("End");
  await expect(scene).toHaveCSS("--mono-nav-glow", "100%");
  await expect(inspector.getByRole("slider", { name: /Мягкость/ })).toBeEnabled();
  await inspector.getByRole("checkbox", { name: "Перелив" }).check();
  await expect(inspector.getByRole("slider", { name: /Период/ })).toBeEnabled();
  await expect(scene.locator('.mono-nav__item[data-active="true"] .mono-nav__glint'))
    .toHaveCSS("animation-name", "mono-nav-shimmer");
  await inspector.getByRole("button", { name: "Применить нижнее меню" }).click();
  await page.reload();
  await expect(scene).toHaveAttribute("data-nav-indicator", "line");
  await expect(scene).toHaveCSS("--mono-nav-glow", "100%");

  await page.locator('[data-mono-tool="navigation"]').click();
  await inspector.getByRole("button", { name: "Точка" }).click();
  await expect(scene).toHaveAttribute("data-nav-indicator", "dot");
  await inspector.getByRole("button", { name: "Отменить пробу нижнего меню" }).click();
  await expect(scene).toHaveAttribute("data-nav-indicator", "line");
  await page.getByRole("button", { name: "2 · Frost" }).click();
  await expect(scene).toHaveAttribute("data-nav-indicator", "original");
  await inspector.getByRole("button", { name: "Капсула" }).click();
  await inspector.getByRole("button", { name: "Применить нижнее меню" }).click();
  await page.getByRole("button", { name: "1 · Ledger" }).click();
  await expect(scene).toHaveAttribute("data-nav-indicator", "line");
  await page.getByRole("button", { name: "2 · Frost" }).click();
  await expect(scene).toHaveAttribute("data-nav-indicator", "capsule");
  await page.getByRole("button", { name: "3 · Mercury" }).click();
  await expect(scene).toHaveAttribute("data-nav-indicator", "original");

  for (const width of [320, 390, 430, 480]) {
    await page.getByRole("button", { name: `Экран ${width} пикселей` }).click();
    const size = await scene.evaluate(root => ({ preview: root.clientWidth,
      nav: root.querySelector<HTMLElement>(".mono-nav")?.clientWidth,
      overflow: document.documentElement.scrollWidth > innerWidth }));
    expect(size).toEqual({ preview: width, nav: width, overflow: false });
  }
  await page.getByRole("button", { name: "2 · Frost" }).click();
  await page.screenshot({ path: testInfo.outputPath("frost-capsule-480.png"), fullPage: true });
  await page.getByRole("button", { name: "Действия с пресетом" }).click();
  await page.getByRole("button", { name: "Экспортировать" }).click();
  const exported = JSON.parse(await page.getByRole("textbox", { name: "JSON рабочего пресета" }).inputValue());
  expect(exported.version).toBe(4);
  expect(exported.document.appearance.ledger.navigation).toMatchObject({ indicator: "line", glowPercent: 100, shimmerEnabled: true });
  expect(exported.document.appearance.frost.navigation.indicator).toBe("capsule");
  expect(exported.document.appearance.mercury.navigation.indicator).toBe("original");
});

test("blink stops when hidden or reduced, and its inspector trial cancels cleanly", async ({ page }) => {
  await ready(page);
  const scene = page.locator("[data-mono-preview]");
  const eye = scene.locator(".mono-balance__privacy");
  await expect(eye.locator("svg")).toHaveCSS("animation-name", "mono-eye-blink");
  await page.locator('[data-mono-tool="balance"]').click();
  const inspector = page.locator('[data-mono-inspector="balance"]');
  await inspector.getByRole("checkbox", { name: "Моргание глаза" }).uncheck();
  await expect(eye).toHaveAttribute("data-eye-blink", "false");
  await inspector.getByRole("button", { name: "Отменить пробу" }).click();
  await expect(eye).toHaveAttribute("data-eye-blink", "true");
  await eye.click();
  await expect(eye).toHaveAttribute("data-eye-blink", "false");
  await expect(eye.locator("svg")).toHaveCSS("animation-name", "none");
  await eye.click();
  await expect(eye).toHaveAttribute("data-eye-blink", "true");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(scene).toHaveAttribute("data-mono-motion", "static");
  await expect(eye.locator("svg")).toHaveCSS("animation-name", "none");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(scene).toHaveAttribute("data-mono-motion", "ready");
});

test("saveData, offscreen and visibility events stop decoration without changing its preference", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "connection", {
      configurable: true, value: Object.assign(new EventTarget(), { saveData: true }),
    });
  });
  const page = await context.newPage();
  await page.goto(`${baseURL}/mono`);
  await expect(page.getByRole("button", { name: /Пресет оформления: Первый · перелив/ })).toBeEnabled();
  const scene = page.locator("[data-mono-preview]");
  const eye = scene.locator(".mono-balance__privacy");
  await expect(scene).toHaveAttribute("data-mono-motion", "static");
  await expect(eye).toHaveAttribute("data-eye-blink", "true");
  await expect(eye.locator("svg")).toHaveCSS("animation-name", "none");
  await page.evaluate(() => {
    const connection = (navigator as Navigator & { connection: EventTarget & { saveData: boolean } }).connection;
    connection.saveData = false;
    connection.dispatchEvent(new Event("change"));
  });
  await expect(scene).toHaveAttribute("data-mono-motion", "ready");
  await scene.evaluate(element => { element.style.transform = "translateY(-300vh)"; });
  await expect(scene).toHaveAttribute("data-mono-motion", "static");
  await scene.evaluate(element => { element.style.transform = ""; });
  await expect(scene).toHaveAttribute("data-mono-motion", "ready");
  // Headless tabs may both report visible; dispatch the same document event explicitly.
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(scene).toHaveAttribute("data-mono-motion", "static");
  await page.evaluate(() => {
    Reflect.deleteProperty(document, "visibilityState");
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(scene).toHaveAttribute("data-mono-motion", "ready");
  await context.close();
});

test.describe("compact menu inspector", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("opens from the tool drawer and keeps the phone free of horizontal overflow", async ({ page }) => {
    await page.goto("/mono");
    const launcher = page.getByRole("button", { name: "Открыть быстрые настройки" });
    await expect(launcher).toBeVisible();
    await launcher.click();
    await page.locator('[data-mono-tool="navigation"]').click();
    const fine = page.locator('[data-mono-rail="fine"]');
    await expect(fine).toHaveAttribute("role", "dialog");
    await expect(fine).toHaveAttribute("aria-hidden", "false");
    await fine.getByRole("button", { name: "Точка" }).click();
    await expect(page.locator("[data-mono-preview]")).toHaveAttribute("data-nav-indicator", "dot");
    await fine.getByRole("button", { name: "Применить нижнее меню" }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
    await page.keyboard.press("Escape");
    await expect(fine).toHaveAttribute("aria-hidden", "true");
  });
});
