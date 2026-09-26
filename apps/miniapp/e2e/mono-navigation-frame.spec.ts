import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const captures = "test-results/mono-navigation-frame";

test.use({ viewport: { width: 1440, height: 900 }, hasTouch: false, isMobile: false });

test("separate action frames survive product Apply and four wallet sections navigate", async ({ page }) => {
  await mkdir(captures, { recursive: true });
  await page.goto("/design-lab/buttons");
  const frame = page.getByRole("group", { name: "Форма ряда действий" });
  await frame.getByRole("button", { name: "Отдельные кнопки" }).click();
  const row = page.locator(".mono-actions");
  await expect(row).toHaveAttribute("data-frame-mode", "separate");
  const paints = await row.evaluate(element => {
    const page = element.closest<HTMLElement>(".mono-page")!;
    const original = { preset: page.dataset.monoPreset, theme: page.dataset.monoTheme,
      prepaint: document.documentElement.dataset.monoPrepaintTheme };
    const result: { preset: string; theme: string; shadow: string; background: string; image: string; border: string }[] = [];
    for (const preset of ["ledger", "frost", "mercury"]) for (const theme of ["dark", "light"]) {
      page.dataset.monoPreset = preset;
      page.dataset.monoTheme = theme;
      document.documentElement.dataset.monoPrepaintTheme = theme;
      const css = getComputedStyle(element);
      result.push({ preset, theme, shadow: css.boxShadow, background: css.backgroundColor,
        image: css.backgroundImage, border: css.borderTopWidth });
    }
    page.dataset.monoPreset = original.preset!;
    page.dataset.monoTheme = original.theme!;
    if (original.prepaint === undefined) delete document.documentElement.dataset.monoPrepaintTheme;
    else document.documentElement.dataset.monoPrepaintTheme = original.prepaint;
    return result;
  });
  for (const paint of paints) {
    expect(paint.shadow, `${paint.preset}/${paint.theme}`).toBe("none");
    expect(paint.background, `${paint.preset}/${paint.theme}`).toBe("rgba(0, 0, 0, 0)");
    expect(paint.image, `${paint.preset}/${paint.theme}`).toBe("none");
    expect(paint.border, `${paint.preset}/${paint.theme}`).toBe("0px");
  }
  const actions = row.locator(".mono-actions__item");
  await expect(actions).toHaveCount(4);
  await page.getByText("Форма и слой", { exact: true }).click();
  await page.getByRole("slider", { name: "Скругление кромки" }).fill("24");
  await expect(actions.first()).toHaveCSS("border-top-left-radius", "24px");
  await actions.first().hover();
  await expect(actions.first()).toHaveCSS("border-top-left-radius", "24px");
  const labNav = page.getByRole("navigation", { name: "Разделы кошелька" });
  await labNav.getByRole("button", { name: "Профиль" }).click();
  await expect(page.getByRole("heading", { name: "Профиль" })).toBeVisible();
  await page.getByRole("button", { name: "К кнопкам" }).click();
  await expect(row).toBeVisible();
  await page.screenshot({ path: `${captures}/workshop-separate.png`, animations: "disabled" });

  await page.getByRole("button", { name: /В рабочий пресет MONO/ }).click();
  const dialog = page.getByRole("dialog", { name: "Применить материал в MONO" });
  await expect(dialog).toContainText("Отдельные кнопки");
  await dialog.getByRole("textbox", { name: "Название нового рабочего пресета" }).fill("Отдельные действия");
  await dialog.getByRole("button", { name: "Применить в MONO" }).click();
  await expect(dialog).toContainText("Применено:");
  await dialog.getByRole("link", { name: "Открыть MONO" }).click();
  await expect(page.locator(".mono-actions")).toHaveAttribute("data-frame-mode", "separate");
  await page.reload();
  await expect(page.locator(".mono-actions")).toHaveAttribute("data-frame-mode", "separate");
  await expect(page.locator(".mono-actions__item").first()).toHaveCSS("border-top-left-radius", "24px");
  const nav = page.getByRole("navigation", { name: "Разделы кошелька" });
  for (const width of [320, 390, 430, 480]) {
    await page.getByRole("button", { name: `Экран ${width} пикселей` }).click();
    await expect.poll(async () => (await page.locator("[data-mono-preview]").boundingBox())?.width).toBe(width);
    await expect.poll(async () => (await nav.boundingBox())?.width).toBe(width);
  }
  await nav.getByRole("button", { name: "Активы" }).click();
  await expect(page.getByRole("heading", { name: "Все активы" })).toBeVisible();
  await expect(nav.getByRole("button", { name: "Активы" })).toHaveAttribute("aria-current", "page");
  await page.screenshot({ path: `${captures}/assets-active-nav.png`, animations: "disabled" });
  await nav.getByRole("button", { name: "История" }).click();
  await expect(page.getByRole("heading", { name: "История операций" })).toBeVisible();
  await expect(page.getByText("История операций пока не подключена")).toBeVisible();
  await nav.getByRole("button", { name: "Профиль" }).click();
  await page.getByRole("button", { name: "Скрыть суммы" }).click();
  await nav.getByRole("button", { name: "Активы" }).click();
  await expect(page.getByText("Значения скрыты")).toHaveCount(3);
  await nav.getByRole("button", { name: "Обзор" }).click();
  await expect(page.locator(".mono-actions")).toHaveAttribute("data-frame-mode", "separate");
  await expect(page.getByRole("button", { name: "Показать баланс" })).toBeVisible();
  expect(await page.locator("canvas").count()).toBeLessThanOrEqual(1);
});

test("separate fallback remains usable without WebGL", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(this: HTMLCanvasElement, type: string, ...args: unknown[]) {
      if (type === "webgl" || type === "webgl2" || type === "experimental-webgl") return null;
      return original.call(this, type, ...args);
    } as typeof original;
  });
  await page.goto("/design-lab/buttons");
  await page.getByRole("group", { name: "Форма ряда действий" }).getByRole("button", { name: "Отдельные кнопки" }).click();
  await page.getByText("Форма и слой", { exact: true }).click();
  await page.getByRole("slider", { name: "Скругление кромки" }).fill("24");
  const send = page.locator(".mono-actions__item").first();
  await expect(send).toBeVisible();
  const style = await send.evaluate(element => {
    const css = getComputedStyle(element);
    return { border: css.borderTopColor, background: css.backgroundColor, radius: css.borderTopLeftRadius };
  });
  expect(style.border).not.toBe("rgba(0, 0, 0, 0)");
  expect(style.background).not.toBe("rgba(0, 0, 0, 0)");
  expect(style.radius).toBe("24px");
  await send.click();
  await expect(page.getByRole("status", { name: "Статус быстрых действий" })).toContainText("операция недоступна");
});

test("mobile widths keep the active navigation inside the viewport", async ({ page }) => {
  await page.goto("/mono");
  const nav = page.getByRole("navigation", { name: "Разделы кошелька" });
  for (const width of [320, 390, 430, 480]) {
    await page.setViewportSize({ width, height: 800 });
    await nav.getByRole("button", { name: "История" }).click();
    await expect(nav.getByRole("button", { name: "История" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("heading", { name: "История операций" })).toBeVisible();
    const sizes = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      nav: document.querySelector(".mono-nav")!.getBoundingClientRect().width,
    }));
    expect(sizes.scroll).toBeLessThanOrEqual(width + 1);
    expect(sizes.nav).toBeLessThanOrEqual(width + 1);
  }
});
