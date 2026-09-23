import { expect, test } from "@playwright/test";
import { openMonoRail } from "./mono-test-helpers";

test("логотип появляется один раз и остаётся статичным при reduced motion", async ({ page }) => {
  await page.goto("/mono");
  const icon = page.locator(".mono-logo__icon-primary").first();
  const wordmark = page.locator(".mono-logo__wordmark").first();
  await expect(icon).toBeVisible();
  const motion = await icon.evaluate((node) => {
    const style = getComputedStyle(node);
    return { name: style.animationName, count: style.animationIterationCount };
  });
  expect(motion.name).toBe("mono-logo-icon-arrive");
  expect(motion.count).toBe("1");
  await expect.poll(() => wordmark.evaluate((node) => getComputedStyle(node).opacity)).toBe("1");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(() => icon.evaluate((node) => getComputedStyle(node).animationName)).toBe("none");
  await expect.poll(() => wordmark.evaluate((node) => getComputedStyle(node).animationName)).toBe("none");
});

test("смена направления запускает отдельную завершённую композицию без сдвига разметки", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/mono");

  const amount = page.locator(".mono-hero__amount");
  const ledger = await amount.evaluate((element) => getComputedStyle(element).animationName);
  expect(ledger).not.toBe("none");

  const quick = await openMonoRail(page, "quick");
  await quick.getByRole("button", { name: "2 · Frost" }).click();
  const frost = await amount.evaluate((element) => getComputedStyle(element).animationName);
  expect(frost).not.toBe(ledger);

  await quick.getByRole("button", { name: "3 · Mercury" }).click();
  const mercury = await amount.evaluate((element) => getComputedStyle(element).animationName);
  expect(mercury).not.toBe(frost);

  await page.waitForTimeout(800);
  const settled = await amount.evaluate((element) => {
    const style = getComputedStyle(element);
    return { opacity: style.opacity, transform: style.transform };
  });
  expect(settled.opacity).toBe("1");
  expect(["none", "matrix(1, 0, 0, 1, 0, 0)"]).toContain(settled.transform);
});

test("reduced motion сразу показывает спокойный fallback без пространственной хореографии", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/mono");

  await expect(page.locator("[data-optics]")).toHaveAttribute("data-optics", "fallback");
  const animationName = await page.locator(".mono-hero__amount").evaluate((element) =>
    getComputedStyle(element).animationName,
  );
  expect(animationName).toBe("none");
});

test("после раскрытия линия графика доходит до конечной отметки", async ({ page }) => {
  await page.setViewportSize({ width: 480, height: 900 });
  await page.goto("/mono");
  const line = page.locator(".mono-chart__line");
  await expect(line).toBeVisible();
  await page.waitForTimeout(850);

  const coverage = await line.evaluate((element) => {
    const polyline = element as SVGPolylineElement;
    const svg = polyline.ownerSVGElement;
    const matrix = svg?.getScreenCTM();
    if (!matrix) throw new Error("Chart SVG has no screen transform");
    let visibleLength = 0;
    for (let index = 1; index < polyline.points.numberOfItems; index += 1) {
      const from = polyline.points.getItem(index - 1).matrixTransform(matrix);
      const to = polyline.points.getItem(index).matrixTransform(matrix);
      visibleLength += Math.hypot(to.x - from.x, to.y - from.y);
    }
    const dashLength = Number.parseFloat(getComputedStyle(polyline).strokeDasharray);
    return { visibleLength, dashLength };
  });

  expect(coverage.dashLength).toBeGreaterThanOrEqual(coverage.visibleLength);
});
