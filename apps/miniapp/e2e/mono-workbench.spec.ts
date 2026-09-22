import { expect, test } from "@playwright/test";

test.describe("desktop skin workbench", () => {
  test.use({ hasTouch: false, isMobile: false, viewport: { width: 1440, height: 1000 } });

  test.beforeEach(async ({ page }) => {
    await page.goto("/mono");
  });

  test("keeps every design control outside the centered phone scene", async ({ page }) => {
    const preview = page.locator("[data-mono-preview]");
    const rails = page.locator("[data-mono-rail]");

    await expect(rails).toHaveCount(2);
    await expect(rails.first()).toBeVisible();
    await expect(rails.last()).toBeVisible();
    await expect(preview.locator(".mono-labbar, [data-mono-control]")).toHaveCount(0);

    const box = await preview.boundingBox();
    expect(box).not.toBeNull();
    expect(Math.abs((box!.x + box!.width / 2) - 720)).toBeLessThanOrEqual(1);
  });

  test("switches among four real container widths without detaching the nav", async ({ page }) => {
    const preview = page.locator("[data-mono-preview]");
    const nav = page.locator(".mono-nav");
    const atmosphere = page.locator("[data-mono-atmosphere]");

    for (const width of [320, 390, 430, 480] as const) {
      await page.getByRole("button", { name: `Экран ${width} пикселей` }).click();
      await expect(preview).toHaveAttribute("data-mono-viewport", String(width));
      await expect.poll(async () => (await preview.boundingBox())?.width).toBe(width);
      await expect.poll(async () => (await nav.boundingBox())?.width).toBe(width);
      await expect.poll(async () => (await atmosphere.boundingBox())?.width).toBe(width);
      const gutter = await preview.evaluate((node) => getComputedStyle(node).getPropertyValue("--mono-gutter").trim());
      expect(gutter).toBe(width === 320 ? "12px" : width === 480 ? "28px" : "20px");
    }
  });

  test("collapses sections independently and preserves an unsaved optical draft", async ({ page }) => {
    const refraction = page.getByRole("slider", { name: "Преломление" });
    await refraction.fill("1.2");

    await page.getByRole("button", { name: "Свернуть Оптика" }).click();
    await expect(refraction).toBeHidden();
    await expect(page.locator('[data-mono-section="environment"]')).toBeVisible();

    await page.getByRole("button", { name: "Развернуть Оптика" }).click();
    await expect(refraction).toHaveValue("1.2");
  });

  test("one master control hides both rails without moving the preview", async ({ page }) => {
    const preview = page.locator("[data-mono-preview]");
    await page.getByRole("button", { name: "Свернуть Экран" }).click();
    const centerBefore = await preview.evaluate((node) => {
      const rect = node.getBoundingClientRect();
      return rect.left + rect.width / 2;
    });

    await page.getByRole("button", { name: "Скрыть панели" }).click();
    await expect(page.locator("[data-mono-rail]").first()).toHaveAttribute("aria-hidden", "true");
    await expect(page.getByRole("button", { name: "Показать панели" })).toBeVisible();
    const centerHidden = await preview.evaluate((node) => {
      const rect = node.getBoundingClientRect();
      return rect.left + rect.width / 2;
    });
    expect(centerHidden).toBe(centerBefore);

    await page.getByRole("button", { name: "Показать панели" }).click();
    await expect(page.locator("[data-mono-rail]").first()).toHaveAttribute("aria-hidden", "false");
    await expect(page.getByRole("button", { name: "Развернуть Экран" })).toHaveAttribute("aria-expanded", "false");
  });

  test("master switch does not cover the color action while the rail scrolls", async ({ page }) => {
    await page.getByRole("button", { name: "Включить палитру" }).click();
    const action = page.getByRole("button", { name: "Новый вариант" });
    await page.getByRole("button", { name: "Не менять Основа" }).click();
    await action.click();
    const master = await page.getByRole("button", { name: "Скрыть панели" }).boundingBox();
    const target = await action.boundingBox();
    const railHead = await page.locator(".mono-rail--quick .mono-rail__head").boundingBox();
    expect(master).not.toBeNull();
    expect(target).not.toBeNull();
    expect(railHead).not.toBeNull();
    expect(master!.y + master!.height / 2).toBeLessThanOrEqual(railHead!.y + railHead!.height);
    const overlapX = Math.min(master!.x + master!.width, target!.x + target!.width) - Math.max(master!.x, target!.x);
    const overlapY = Math.min(master!.y + master!.height, target!.y + target!.height) - Math.max(master!.y, target!.y);
    expect(Math.min(overlapX, overlapY)).toBeLessThanOrEqual(0);
    if (process.env.MONO_PALETTE_CAPTURE === "1")
      await page.screenshot({ path: test.info().outputPath("color-rail-scrolled.png"), animations: "disabled" });
  });
});

test.describe("compact skin workbench", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });

  test("clamps a wide profile and exposes the rails as dismissible drawers", async ({ page }) => {
    await page.goto("/mono");
    const preview = page.locator("[data-mono-preview]");
    const quickLauncher = page.getByRole("button", { name: "Открыть быстрые настройки" });

    await expect(quickLauncher).toBeVisible();
    await expect(page.locator('[data-mono-rail="quick"]')).toHaveAttribute("aria-hidden", "true");
    await expect(page.locator('[data-mono-rail="fine"]')).toHaveAttribute("aria-hidden", "true");
    await quickLauncher.click();
    await page.getByRole("button", { name: "Экран 480 пикселей" }).click();
    await expect.poll(async () => (await preview.boundingBox())?.width).toBe(390);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);

    await page.keyboard.press("Escape");
    await expect(page.locator('[data-mono-rail="quick"]')).toHaveAttribute("aria-hidden", "true");
    await expect(quickLauncher).toBeFocused();
  });

  test("keeps keyboard focus inside an open compact drawer", async ({ page }) => {
    await page.goto("/mono");
    await page.getByRole("button", { name: "Открыть быстрые настройки" }).click();
    const quick = page.locator('[data-mono-rail="quick"]');
    const first = quick.getByRole("link", { name: /V1/i });
    const last = quick.getByRole("button", { name: "Точная настройка" });
    await expect(quick).toHaveAttribute("role", "dialog");
    await expect(quick).toHaveAttribute("aria-modal", "true");
    await expect(page.locator(".mono-preview-frame")).toHaveAttribute("inert", "");
    await expect(first).toBeFocused();
    await expect(last).toBeEnabled();
    await page.keyboard.press("Shift+Tab");
    await expect(last).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(first).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Открыть быстрые настройки" })).toBeFocused();
  });
});
