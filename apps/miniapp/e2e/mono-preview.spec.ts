import { expect, test } from "@playwright/test";
import { closeCompactMonoRail, openMonoRail } from "./mono-test-helpers";

test("MONO LEDGER открывается отдельно от V1 и переключает три визуальных варианта", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/mono");

  const preview = page.locator("main[data-mono-preview]");
  await expect(preview).toBeVisible();
  await expect(preview).toHaveAttribute("data-mono-preset", "ledger");
  await expect(page.getByRole("heading", { name: "Общий баланс" })).toBeVisible();
  const quick = await openMonoRail(page, "quick");
  await expect(quick.getByRole("link", { name: /V1/i })).toHaveAttribute("href", "/");
  await closeCompactMonoRail(page, "quick");
  await page.getByRole("button", { name: "Скрыть баланс" }).click();

  await openMonoRail(page, "quick");
  await quick.getByRole("button", { name: "2 · Frost" }).click();
  await expect(preview).toHaveAttribute("data-mono-preset", "frost");

  await quick.getByRole("button", { name: "3 · Mercury" }).click();
  await expect(preview).toHaveAttribute("data-mono-preset", "mercury");

  await page.keyboard.press("1");
  await expect(preview).toHaveAttribute("data-mono-preset", "ledger");
  await expect(page.getByRole("button", { name: "Показать баланс" })).toBeVisible();
});

test("MONO LEDGER на 320 px не выходит за экран", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/mono");

  await expect(page.locator("main[data-mono-preview]")).toBeVisible();
  const hasOverflow = await page.evaluate(() =>
    document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasOverflow).toBe(false);
});

test("Frost и Mercury меняют композицию, а не только цвет", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/mono");

  const amount = page.locator(".mono-hero__amount");
  const ledgerX = (await amount.boundingBox())?.x ?? 0;
  const quick = await openMonoRail(page, "quick");
  await quick.getByRole("button", { name: "2 · Frost" }).click();
  const frostX = (await amount.boundingBox())?.x ?? 0;
  expect(frostX).toBeGreaterThan(ledgerX + 10);

  await quick.getByRole("button", { name: "3 · Mercury" }).click();
  await closeCompactMonoRail(page, "quick");
  const promoY = (await page.locator(".mono-promo-frame").boundingBox())?.y ?? 0;
  const actionsY = (await page.locator(".mono-actions").boundingBox())?.y ?? 0;
  expect(promoY).toBeLessThan(actionsY);
});

test("рабочие элементы прототипа имеют мобильную область касания", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/mono");

  const quick = await openMonoRail(page, "quick");
  for (const control of [
    quick.getByRole("button", { name: "1 · Ledger" }),
    quick.getByRole("button", { name: "2 · Frost" }),
    quick.getByRole("button", { name: "3 · Mercury" }),
    quick.getByRole("button", { name: "Экран 390 пикселей" }),
  ]) {
    const box = await control.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }
  await closeCompactMonoRail(page, "quick");
  for (const control of [
    page.getByRole("button", { name: "Скрыть баланс" }),
    page.getByRole("button", { name: "Открыть быстрые настройки" }),
    page.getByRole("button", { name: "Открыть тонкие настройки" }),
  ]) {
    const box = await control.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }
});

test("заголовок активов не обрезается нижней навигацией на первом экране", async ({ page }) => {
  const overlaps: string[] = [];
  for (const width of [320, 390, 430, 480]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/mono");
    const quick = await openMonoRail(page, "quick");

    for (const preset of ["1 · Ledger", "2 · Frost", "3 · Mercury"]) {
      await quick.getByRole("button", { name: preset }).click();
      await closeCompactMonoRail(page, "quick");
      const hasOverflow = await page.evaluate(() =>
        document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(hasOverflow, `${width}px, ${preset}: горизонтальное переполнение`).toBe(false);
      await page.waitForTimeout(850);
      const heading = await page.locator(".mono-assets__heading").boundingBox();
      const nav = await page.locator(".mono-nav").boundingBox();
      expect(heading).not.toBeNull();
      expect(nav).not.toBeNull();
      const fullyAbove = heading!.y + heading!.height <= nav!.y - 8;
      const fullyBelow = heading!.y >= nav!.y + 8;
      if (!fullyAbove && !fullyBelow) {
        overlaps.push(`${width}px ${preset}: heading ${heading!.y.toFixed(1)}–${(heading!.y + heading!.height).toFixed(1)}, nav from ${nav!.y.toFixed(1)}`);
      }
      if (preset !== "3 · Mercury") await openMonoRail(page, "quick");
    }
  }
  expect(overlaps, "заголовок активов попадает под навигацию").toEqual([]);
});

test("подписи нижней навигации остаются читаемыми на узком экране", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto("/mono");
  const fontSize = await page.locator(".mono-nav__item span").first().evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).fontSize),
  );
  expect(fontSize).toBeGreaterThanOrEqual(10);
});
