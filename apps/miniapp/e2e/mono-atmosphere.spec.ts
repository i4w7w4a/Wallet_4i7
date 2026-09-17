import { expect, test } from "@playwright/test";

test.use({ hasTouch: false, isMobile: false, viewport: { width: 390, height: 844 } });

test("fine pointer оживляет фон без сдвига банковской композиции", async ({ page }) => {
  await page.goto("/mono");
  const preview = page.locator("[data-mono-preview]");
  const atmosphere = page.locator("[data-mono-atmosphere]");
  await expect(atmosphere).toBeVisible();

  const heroBefore = await page.locator(".mono-hero").boundingBox();
  await page.mouse.move(338, 512);
  await expect(preview).toHaveAttribute("data-pointer-active", "true");
  const first = await preview.evaluate((element) => ({
    x: element.style.getPropertyValue("--mono-pointer-x"),
    y: element.style.getPropertyValue("--mono-pointer-y"),
    shift: element.style.getPropertyValue("--mono-pointer-shift-x"),
  }));
  expect(first.x).toBe("338px");
  expect(first.y).toBe("512px");
  expect(first.shift).not.toBe("0px");
  await expect
    .poll(() =>
      page
        .locator(".mono-app-header__mark")
        .evaluate((element) => getComputedStyle(element).transitionProperty),
    )
    .toContain("transform");

  await page.mouse.move(52, 214);
  const second = await preview.evaluate((element) => ({
    x: element.style.getPropertyValue("--mono-pointer-x"),
    y: element.style.getPropertyValue("--mono-pointer-y"),
  }));
  expect(second).not.toEqual({ x: first.x, y: first.y });
  expect(await page.locator(".mono-hero").boundingBox()).toEqual(heroBefore);
});

test("reduced motion сохраняет атмосферу статичной", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/mono");
  const preview = page.locator("[data-mono-preview]");
  await page.mouse.move(338, 512);

  await expect(preview).toHaveAttribute("data-pointer-active", "false");
  const position = await preview.evaluate((element) => ({
    x: element.style.getPropertyValue("--mono-pointer-x"),
    y: element.style.getPropertyValue("--mono-pointer-y"),
  }));
  expect(position).toEqual({ x: "", y: "" });
});
