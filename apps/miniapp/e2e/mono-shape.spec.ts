import { expect, test } from "@playwright/test";
import { closeCompactMonoRail, openMonoRail } from "./mono-test-helpers";

const SHAPE_STORAGE_KEY = "wallet4i7.mono.shape-preview.v1";
const WORKING_KEY = "wallet4i7.mono.working-presets.v1";

test.describe("desktop MONO shape lab", () => {
  test.use({ hasTouch: false, isMobile: false, viewport: { width: 1440, height: 1000 } });

  test.beforeEach(async ({ page }) => {
    await page.goto("/mono");
  });

  test("keeps built-in defaults and applies each direction independently", async ({ page }) => {
    const actions = page.locator(".mono-actions");
    const nav = page.locator(".mono-nav");
    const shape = page.getByRole("group", { name: "Настройка формы" });
    const radius = shape.getByRole("slider", { name: "Радиус формы" });

    for (const [variant, expected] of [
      ["1 · Ledger", "12px"],
      ["2 · Frost", "19px"],
      ["3 · Mercury", "14px"],
    ] as const) {
      await page.getByRole("button", { name: variant }).click();
      await expect(actions).toHaveCSS("border-top-left-radius", expected);
      await expect(nav).toHaveCSS("border-top-left-radius", "0px");
    }

    await page.getByRole("button", { name: "1 · Ledger" }).click();
    await radius.fill("24");
    await expect(actions).toHaveCSS("border-top-left-radius", "24px");
    await expect(nav).toHaveCSS("border-top-left-radius", "0px");
    expect(await page.evaluate((key) => localStorage.getItem(key), SHAPE_STORAGE_KEY)).toBeNull();

    await shape.getByRole("radio", { name: "Нижнее меню" }).click();
    await radius.fill("18");
    await expect(actions).toHaveCSS("border-top-left-radius", "24px");
    await expect(nav).toHaveCSS("border-top-left-radius", "18px");
    expect(await page.evaluate((key) => localStorage.getItem(key), SHAPE_STORAGE_KEY)).toBeNull();

    await shape.getByRole("button", { name: "По умолчанию" }).click();
    await expect(actions).toHaveCSS("border-top-left-radius", "12px");
    await expect(nav).toHaveCSS("border-top-left-radius", "0px");

    await shape.getByRole("radio", { name: "Быстрые действия" }).click();
    await radius.fill("20");
    await shape.getByRole("radio", { name: "Нижнее меню" }).click();
    await radius.fill("16");
    await shape.getByRole("button", { name: "Применить форму" }).click();
    expect(await page.evaluate((key) => localStorage.getItem(key), WORKING_KEY)).not.toBeNull();
    expect(await page.evaluate((key) => localStorage.getItem(key), SHAPE_STORAGE_KEY)).toBeNull();

    await page.reload();
    await expect(actions).toHaveCSS("border-top-left-radius", "20px");
    await expect(nav).toHaveCSS("border-top-left-radius", "16px");
    await expect(page.locator("canvas")).toHaveCount(1);
    await expect(page.locator("[data-mono-preview] [data-mono-control]")).toHaveCount(0);

    if (process.env.MONO_SHAPE_CAPTURE === "1") {
      await page.screenshot({ path: test.info().outputPath("shape-lab-desktop.png"), animations: "disabled" });
    }
  });

  test("keeps the live shape stable at every real preview width", async ({ page }) => {
    test.slow(process.env.MONO_SHAPE_CAPTURE === "1", "Capturing eight full scene review artifacts");
    const preview = page.locator("[data-mono-preview]");
    const actions = page.locator(".mono-actions");
    const nav = page.locator(".mono-nav");
    const shape = page.getByRole("group", { name: "Настройка формы" });
    const radius = shape.getByRole("slider", { name: "Радиус формы" });

    for (const width of [320, 390, 430, 480] as const) {
      await page.getByRole("button", { name: `Экран ${width} пикселей` }).click();
      await expect.poll(async () => (await preview.boundingBox())?.width).toBe(width);
      await expect.poll(async () => (await nav.boundingBox())?.width).toBe(width);
      await expect(actions).toHaveCSS("border-top-left-radius", "12px");
      await expect(nav).toHaveCSS("border-top-left-radius", "0px");
      if (process.env.MONO_SHAPE_CAPTURE === "1") {
        await preview.screenshot({ path: test.info().outputPath(`shape-default-${width}.png`), animations: "disabled" });
      }
    }

    await radius.fill("24");
    await shape.getByRole("radio", { name: "Нижнее меню" }).click();
    await radius.fill("18");

    for (const width of [320, 390, 430, 480] as const) {
      await page.getByRole("button", { name: `Экран ${width} пикселей` }).click();
      await expect.poll(async () => (await preview.boundingBox())?.width).toBe(width);
      await expect.poll(async () => (await nav.boundingBox())?.width).toBe(width);
      await expect(actions).toHaveCSS("border-top-left-radius", "24px");
      await expect(nav).toHaveCSS("border-top-left-radius", "18px");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
      for (const target of [actions.locator(".mono-actions__item").first(), nav.locator(".mono-nav__item").first()]) {
        const box = await target.boundingBox();
        expect(box?.height).toBeGreaterThanOrEqual(44);
      }
      if (process.env.MONO_SHAPE_CAPTURE === "1") {
        await preview.screenshot({ path: test.info().outputPath(`shape-live-${width}.png`), animations: "disabled" });
      }
    }
  });
});

test.describe("compact MONO shape lab", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });

  test("keeps form controls reachable, focusable and non-color-dependent", async ({ page }) => {
    await page.goto("/mono");
    const quickRail = await openMonoRail(page, "quick");
    const shape = quickRail.getByRole("group", { name: "Настройка формы" });
    await shape.scrollIntoViewIfNeeded();

    const quick = shape.getByRole("radio", { name: "Быстрые действия" });
    const navGroup = shape.getByRole("radio", { name: "Нижнее меню" });
    const range = shape.getByRole("slider", { name: "Радиус формы" });
    const exact = shape.getByRole("spinbutton", { name: "Радиус: точное значение" });
    const reset = shape.getByRole("button", { name: "По умолчанию" });
    const apply = shape.getByRole("button", { name: "Применить форму" });

    for (const control of [quick, navGroup, range, exact, reset, apply]) {
      const box = await control.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }

    const quickVisual = quick.locator("xpath=following-sibling::span");
    const navVisual = navGroup.locator("xpath=following-sibling::span");
    await expect(quickVisual).toContainText("✓");
    await quick.focus();
    await expect(quickVisual).not.toHaveCSS("outline-style", "none");
    await page.keyboard.press("ArrowRight");
    await expect(navGroup).toBeChecked();
    await expect(navVisual).toContainText("✓");

    for (const control of [range, exact, reset, apply]) {
      await control.focus();
      await expect(control).not.toHaveCSS("outline-style", "none");
    }

    const boundary = await quickVisual.evaluate((node) => {
      const style = getComputedStyle(node);
      return { border: style.borderTopColor, background: style.backgroundColor };
    });
    expect(contrast(boundary.border, boundary.background)).toBeGreaterThanOrEqual(3);

    await quick.click();
    await range.fill("24");
    await navGroup.click();
    await range.fill("18");
    await apply.focus();
    await apply.click();
    await expect(apply).toBeFocused();
    await expect(apply).toHaveAttribute("aria-disabled", "true");
    await expect(shape.getByRole("status", { name: "Состояние формы" })).toContainText("Форма применена");

    if (process.env.MONO_SHAPE_CAPTURE === "1") {
      await page.screenshot({ path: test.info().outputPath("shape-compact-drawer-390.png"), animations: "disabled" });
    }
    await closeCompactMonoRail(page, "quick");
    await expect(page.locator(".mono-actions")).toHaveCSS("border-top-left-radius", "24px");
    await expect(page.locator(".mono-nav")).toHaveCSS("border-top-left-radius", "18px");
  });
});

function contrast(foreground: string, background: string): number {
  const luminance = (color: string) => {
    const channels = color.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? [0, 0, 0];
    const linear = channels.map((value) => {
      const channel = value / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return linear[0]! * 0.2126 + linear[1]! * 0.7152 + linear[2]! * 0.0722;
  };
  const left = luminance(foreground), right = luminance(background);
  return (Math.max(left, right) + 0.05) / (Math.min(left, right) + 0.05);
}
