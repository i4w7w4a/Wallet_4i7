import { expect, test } from "@playwright/test";

import { closeCompactMonoRail, openMonoRail } from "./mono-test-helpers";

test.use({ hasTouch: false, isMobile: false, viewport: { width: 390, height: 844 } });

async function wakeTide(page: Parameters<typeof openMonoRail>[0]) {
  await page.mouse.move(72, 250);
  for (const [x, y] of [[128, 286], [196, 332], [272, 378], [338, 424]] as const) {
    await page.waitForTimeout(55);
    await page.mouse.move(x, y, { steps: 2 });
  }
}

test("фон и световая тема выбираются отдельно от Ledger и переживают обновление", async ({ page }) => {
  await page.goto("/mono");
  const preview = page.locator("[data-mono-preview]");
  await expect(preview).toHaveAttribute("data-mono-preset", "ledger");
  await expect(preview).toHaveAttribute("data-mono-background", "iris");
  await expect(preview).toHaveAttribute("data-mono-theme", "dark");

  const fine = await openMonoRail(page, "fine");
  await fine.getByRole("button", { name: "Волна" }).click();
  await fine.getByRole("button", { name: "Светлая тема" }).click();
  await expect(preview).toHaveAttribute("data-mono-background", "tide");
  await expect(preview).toHaveAttribute("data-mono-theme", "light");
  await expect(preview).toHaveAttribute("data-mono-preset", "ledger");

  await page.reload();
  await expect(preview).toHaveAttribute("data-mono-background", "tide");
  await expect(preview).toHaveAttribute("data-mono-theme", "light");
  await expect(preview).toHaveAttribute("data-mono-preset", "ledger");
  const reloadedFine = await openMonoRail(page, "fine");
  await expect(reloadedFine.getByRole("button", { name: "Волна" })).toHaveAttribute("aria-pressed", "true");
});

test("волна оставляет конечный след от движения мыши без второго canvas", async ({ page }) => {
  await page.goto("/mono");
  const fine = await openMonoRail(page, "fine");
  await fine.getByRole("button", { name: "Волна" }).click();
  await closeCompactMonoRail(page, "fine");
  await wakeTide(page);

  await expect.poll(() => page.locator("[data-mono-ripple]").count()).toBeGreaterThan(0);
  expect(await page.locator("[data-mono-ripple]").count()).toBeLessThanOrEqual(6);
  await expect(page.locator("canvas")).toHaveCount(1);
  await expect.poll(() => page.locator("[data-mono-ripple]").count(), { timeout: 3000 }).toBe(0);
});

test("магнитное поле отступает от указателя и возвращается в покой", async ({ page }) => {
  await page.goto("/mono");
  const fine = await openMonoRail(page, "fine");
  await fine.getByRole("button", { name: "Слои" }).click();
  await closeCompactMonoRail(page, "fine");
  const node = page.locator(".mono-atmosphere__node").first();
  await expect(node).toBeVisible();
  const before = await node.evaluate((element) => (element as HTMLElement).style.transform);
  const box = await node.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move((box?.x ?? 0) + 3, (box?.y ?? 0) + 3);
  await expect.poll(() => node.evaluate((element) => (element as HTMLElement).style.transform))
    .not.toBe(before);
  await page.mouse.move(900, 700);
  await expect.poll(() => node.evaluate((element) => {
    const matrix = new DOMMatrix(getComputedStyle(element).transform);
    return Math.hypot(matrix.m41, matrix.m42);
  })).toBeLessThan(0.5);
});

test("включение reduced motion гасит уже активную атмосферу", async ({ page }) => {
  await page.goto("/mono");
  const fine = await openMonoRail(page, "fine");
  await fine.getByRole("button", { name: "Волна" }).click();
  await closeCompactMonoRail(page, "fine");
  await wakeTide(page);
  const preview = page.locator("[data-mono-preview]");
  await expect(preview).toHaveAttribute("data-pointer-active", "true");
  await expect.poll(() => page.locator("[data-mono-ripple]").count()).toBeGreaterThan(0);
  await expect(page.getByTestId("mono-optical-glass")).toHaveAttribute("data-optics", "webgl");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(preview).toHaveAttribute("data-pointer-active", "false");
  await expect(page.locator("[data-mono-ripple]")).toHaveCount(0);
  await expect(page.getByTestId("mono-optical-glass")).toHaveAttribute("data-optics", "fallback");

  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(preview).toHaveAttribute("data-pointer-active", "false");
  await expect(page.getByTestId("mono-optical-glass")).toHaveAttribute("data-optics", "webgl");
});

test("боковая Material Lab не передаёт движение бегунка в фон телефона", async ({ page }) => {
  await page.goto("/mono");
  let fine = await openMonoRail(page, "fine");
  await fine.getByRole("button", { name: "Волна" }).click();
  await closeCompactMonoRail(page, "fine");
  await page.mouse.move(120, 320);
  await expect(page.locator("[data-mono-preview]")).toHaveAttribute("data-pointer-active", "true");

  fine = await openMonoRail(page, "fine");
  await expect(fine.locator(".mono-tuner")).toBeVisible();
  await expect(fine).toHaveAttribute("role", "dialog");
  await expect(fine.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("[data-mono-preview]")).toHaveAttribute("data-pointer-active", "false");
  await expect(page.locator("[data-mono-ripple]")).toHaveCount(0);

  const slider = fine.getByRole("slider", { name: "Преломление" });
  const box = await slider.boundingBox();
  expect(box).not.toBeNull();
  const y = (box?.y ?? 0) + (box?.height ?? 0) / 2;
  await page.mouse.move((box?.x ?? 0) + 12, y);
  await page.mouse.down();
  await page.mouse.move((box?.x ?? 0) + (box?.width ?? 0) - 12, y, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator("[data-mono-preview]")).toHaveAttribute("data-pointer-active", "false");
  await expect(page.locator("[data-mono-ripple]")).toHaveCount(0);
});

test("reduced motion не создаёт волну и не отталкивает элементы", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/mono");
  let fine = await openMonoRail(page, "fine");
  await fine.getByRole("button", { name: "Волна" }).click();
  await closeCompactMonoRail(page, "fine");
  await wakeTide(page);
  await expect(page.locator("[data-mono-ripple]")).toHaveCount(0);

  fine = await openMonoRail(page, "fine");
  await fine.getByRole("button", { name: "Слои" }).click();
  await closeCompactMonoRail(page, "fine");
  const node = page.locator(".mono-atmosphere__node").first();
  await node.waitFor();
  const before = await node.evaluate((element) => (element as HTMLElement).style.transform);
  await page.mouse.move(120, 320);
  expect(await node.evaluate((element) => (element as HTMLElement).style.transform)).toBe(before);
});
