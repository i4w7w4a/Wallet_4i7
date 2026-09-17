import { expect, test, type BrowserContext, type Locator, type Page } from "@playwright/test";

async function openFinePointerPage(context: BrowserContext) {
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:3000/mono");
  return page;
}

async function expectStableBox(target: Locator, interaction: () => Promise<void>) {
  const measureLayout = () => target.evaluate((element) => {
    const htmlElement = element as HTMLElement;
    return {
      x: htmlElement.offsetLeft,
      y: htmlElement.offsetTop,
      width: htmlElement.offsetWidth,
      height: htmlElement.offsetHeight,
    };
  });
  const before = await measureLayout();
  await interaction();
  await target.page().waitForTimeout(110);
  expect(await measureLayout()).toEqual(before);
}

async function hoverStyle(page: Page, target: Locator, property: keyof CSSStyleDeclaration) {
  const before = await target.evaluate((element, name) => getComputedStyle(element)[name], property);
  await expectStableBox(target, () => target.hover());
  await expect.poll(() => target.evaluate((element, name) => getComputedStyle(element)[name], property))
    .not.toBe(before);
  return target.evaluate((element, name) => getComputedStyle(element)[name], property);
}

test("fine pointer даёт сдержанный серебряный отклик без движения раскладки", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    hasTouch: false,
    isMobile: false,
    colorScheme: "dark",
  });
  const page = await openFinePointerPage(context);
  await expect(page.locator("main[data-mono-preview]")).toBeVisible();
  expect(await page.evaluate(() => matchMedia("(hover: hover) and (pointer: fine)").matches)).toBe(true);

  const preset = page.getByRole("button", { name: "2 · Frost" });
  await preset.focus();
  expect(await preset.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe("none");
  expect(await hoverStyle(page, preset, "boxShadow")).not.toBe("none");
  expect(await preset.evaluate((element) => getComputedStyle(element).transitionDuration)).toContain("0.09s");

  expect(await hoverStyle(page, page.locator(".mono-actions__item").first(), "boxShadow")).not.toBe("none");
  expect(await hoverStyle(page, page.locator(".mono-periods span").nth(1), "backgroundColor")).not.toBe("rgba(0, 0, 0, 0)");
  expect(await hoverStyle(page, page.locator(".mono-assets__row").first(), "boxShadow")).not.toBe("none");
  await hoverStyle(page, page.locator(".mono-nav__item").nth(1), "color");
  const promo = page.locator(".mono-promo-frame");
  await hoverStyle(page, promo, "boxShadow");
  await expect(promo).toHaveCSS("border-right-color", "rgba(0, 0, 0, 0)");
  expect(await hoverStyle(page, page.locator(".mono-app-header"), "color")).toBe("rgb(255, 255, 255)");

  await preset.hover();
  await page.mouse.down();
  expect(await preset.evaluate((element) => getComputedStyle(element).transform)).not.toBe("none");
  expect(await preset.evaluate((element) => getComputedStyle(element).transitionDuration)).toContain("0.09s");
  await page.mouse.up();

  await context.close();
});

test("верхние реальные controls отвечают светом, направлением и коротким press", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    hasTouch: false,
    isMobile: false,
    colorScheme: "dark",
  });
  const page = await openFinePointerPage(context);

  const viewport = page.getByRole("button", { name: "Экран 430 пикселей" });
  const idleBorder = await viewport.evaluate((element) => getComputedStyle(element).borderColor);
  await viewport.hover();
  await expect.poll(() => viewport.evaluate((element) => getComputedStyle(element).borderColor)).not.toBe(idleBorder);
  await page.mouse.down();
  expect(await viewport.evaluate((element) => getComputedStyle(element).transform)).not.toBe("none");
  await page.mouse.up();

  const back = page.locator('[data-mono-rail="quick"]').getByRole("link", { name: /V1/i });
  const idleColor = await back.evaluate((element) => getComputedStyle(element).color);
  await back.hover();
  await expect.poll(() => back.evaluate((element) => getComputedStyle(element).color)).not.toBe(idleColor);

  const privacy = page.getByRole("button", { name: "Скрыть баланс" });
  await privacy.hover();
  await expect.poll(() => privacy.evaluate((element) => getComputedStyle(element).backgroundColor))
    .not.toBe("rgba(0, 0, 0, 0)");
  await context.close();
});

test("reduced motion убирает пространственный press, а coarse pointer не получает hover-слой", async ({ browser }) => {
  const reduced = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    hasTouch: false,
    isMobile: false,
    reducedMotion: "reduce",
  });
  const reducedPage = await openFinePointerPage(reduced);
  const reducedPreset = reducedPage.getByRole("button", { name: "2 · Frost" });
  await reducedPreset.hover();
  await reducedPage.mouse.down();
  expect(["none", "matrix(1, 0, 0, 1, 0, 0)"]).toContain(
    await reducedPreset.evaluate((element) => getComputedStyle(element).transform),
  );
  await reducedPage.mouse.up();
  await reduced.close();

  const coarse = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const coarsePage = await openFinePointerPage(coarse);
  expect(await coarsePage.evaluate(() => matchMedia("(hover: hover) and (pointer: fine)").matches)).toBe(false);
  const action = coarsePage.locator(".mono-actions__item").first();
  expect(await action.evaluate((element) => getComputedStyle(element).boxShadow)).toBe("none");
  await coarse.close();
});
