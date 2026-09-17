import { expect, test } from "@playwright/test";

test.use({ hasTouch: false, isMobile: false, viewport: { width: 1440, height: 900 } });

function gradientStops(backgroundImage: string): string[] {
  return backgroundImage.match(/rgba?\([^)]*\)/g) ?? [];
}

test("enabled Frost palette retains a visible semantic lightness ramp", async ({ page }) => {
  await page.goto("/mono");
  await page.getByRole("button", { name: "2 · Frost" }).click();
  await page.getByRole("button", { name: "Включить палитру" }).click();

  const hero = page.locator(".mono-hero");
  const darkStops = gradientStops(await hero.evaluate(node => getComputedStyle(node).backgroundImage));
  expect(darkStops.length).toBeGreaterThanOrEqual(3);
  expect(new Set(darkStops).size).toBeGreaterThanOrEqual(2);

  await page.getByRole("button", { name: "Light", exact: true }).click();
  const lightStops = gradientStops(await hero.evaluate(node => getComputedStyle(node).backgroundImage));
  expect(lightStops.length).toBeGreaterThanOrEqual(3);
  expect(new Set(lightStops).size).toBeGreaterThanOrEqual(2);
});

test("enabled palette keeps a painted, non-interactive Promo edge", async ({ page }) => {
  await page.goto("/mono");
  await page.getByRole("button", { name: "Включить палитру" }).click();
  const edge = await page.locator(".mono-promo-frame").evaluate(node => {
    const style = getComputedStyle(node, "::after");
    return { image: style.backgroundImage, pointerEvents: style.pointerEvents,
      width: parseFloat(style.width), frameWidth: node.clientWidth };
  });
  expect(edge.image).toContain("linear-gradient");
  expect(edge.pointerEvents).toBe("none");
  expect(edge.width).toBeCloseTo(edge.frameWidth, 0);
});

test("palette gradient change fades previous paint without another renderer", async ({ page }) => {
  await page.goto("/mono");
  await page.getByRole("button", { name: "Включить палитру" }).click();
  await page.waitForTimeout(450);
  await page.getByRole("button", { name: "Случайная палитра" }).click();

  const layer = page.locator("[data-mono-palette-crossfade]");
  await expect(layer).toHaveCount(1);
  await expect.poll(async () => layer.evaluate(node => {
    const animation = node.getAnimations().find(item => item.playState === "running");
    return animation?.effect?.getTiming().duration ?? 0;
  })).toBeGreaterThanOrEqual(320);
  const result = await layer.evaluate(node => ({
    pointerEvents: getComputedStyle(node).pointerEvents,
    image: getComputedStyle(node).backgroundImage,
    hidden: node.getAttribute("aria-hidden"),
  }));
  expect(result.pointerEvents).toBe("none");
  expect(result.image).toContain("gradient");
  expect(result.hidden).toBe("true");
  await expect(page.locator("canvas")).toHaveCount(1);
});

test("reduced motion swaps palette gradient without a fade", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/mono");
  await page.getByRole("button", { name: "Включить палитру" }).click();
  await page.getByRole("button", { name: "Случайная палитра" }).click();
  const layer = page.locator("[data-mono-palette-crossfade]");
  await expect(layer).toHaveCount(1);
  expect(await layer.evaluate(node => node.getAnimations().length)).toBe(0);
  await expect(layer).toHaveCSS("opacity", "0");
});
