import { expect, test } from "@playwright/test";

import { openMonoRail, openMonoTool } from "./mono-test-helpers";

test("оптику можно настроить живьём, сбросить и применить без изменения V1", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/mono");

  const fine = await openMonoTool(page, "optics");
  const optics = fine.locator('[data-mono-inspector="optics"]');
  await expect(optics).toBeVisible();
  await expect(fine).toHaveAttribute("role", "dialog");
  await expect(fine.getByRole("dialog")).toHaveCount(0);
  const ior = optics.getByRole("slider", { name: /преломление/i });
  await expect(ior).toHaveValue("1.34");

  await ior.fill("-0.90");
  await expect(ior).toHaveValue("-0.9");
  await expect(optics).toContainText("-0.90");
  expect(await page.evaluate(() => localStorage.getItem("wallet4i7.mono.optical-preview.v1"))).toBeNull();

  await optics.getByRole("button", { name: "По умолчанию" }).click();
  await expect(ior).toHaveValue("1.34");
  await ior.fill("-0.80");
  await fine.locator(".mono-inspector-shell__footer").getByRole("button", { name: "Применить оптику" }).click();
  const saved = await page.evaluate(() => localStorage.getItem("wallet4i7.mono.working-presets.v2"));
  expect(JSON.parse(saved ?? "null").records[0].document.optics.ledger.ior).toBe(-0.8);
  expect(await page.evaluate(() => localStorage.getItem("wallet4i7.mono.optical-preview.v1"))).toBeNull();

  await page.reload();
  const reloadedFine = await openMonoTool(page, "optics");
  await expect(reloadedFine.getByRole("slider", { name: /преломление/i })).toHaveValue("-0.8");
  const quick = await openMonoRail(page, "quick");
  await expect(quick.getByRole("link", { name: /V1/i })).toHaveAttribute("href", "/");
});

test("горячие клавиши работают рядом с панелью, но не перехватывают ввод в форме", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/mono");
  const fine = await openMonoTool(page, "optics");

  await page.keyboard.press("2");
  await expect(page.locator("[data-mono-preview]")).toHaveAttribute("data-mono-preset", "frost");

  const refraction = fine.getByRole("slider", { name: "Преломление" });
  await refraction.focus();
  await page.keyboard.press("3");
  await expect(page.locator("[data-mono-preview]")).toHaveAttribute("data-mono-preset", "frost");

  await fine.getByRole("tab", { name: "Свет" }).focus();
  await page.keyboard.press("3");
  await expect(page.locator("[data-mono-preview]")).toHaveAttribute("data-mono-preset", "mercury");
});

test("выключенные ветви материала не оставляют притворно живых controls", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/mono");
  const fine = await openMonoTool(page, "optics");
  const optics = fine.locator('[data-mono-inspector="optics"]');

  await optics.getByRole("tab", { name: "Поле" }).click();
  await optics.getByRole("checkbox", { name: "Оптическое поле" }).uncheck();
  await optics.getByRole("tab", { name: "Линза" }).click();
  await expect(optics.getByRole("slider", { name: "Преломление" })).toBeDisabled();

  await optics.getByRole("tab", { name: "Поле" }).click();
  await optics.getByRole("checkbox", { name: "Оптическое поле" }).check();
  await optics.getByRole("tab", { name: "Течение" }).click();
  await expect(optics.getByRole("checkbox", { name: "Течение" })).toBeChecked();
  await optics.getByRole("checkbox", { name: "Течение" }).uncheck();
  await expect(optics.getByRole("slider", { name: "Скорость течения" })).toBeDisabled();
  await optics.getByRole("checkbox", { name: "Течение" }).check();
  await expect(optics.getByRole("slider", { name: "Скорость течения" })).toBeEnabled();
});
