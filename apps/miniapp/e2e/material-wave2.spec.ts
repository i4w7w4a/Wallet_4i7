import { expect, test } from "@playwright/test";

test("button workshop presents Metal fill and Pulsing Border on the four real MONO actions", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto("/design-lab/buttons");
  const scene = page.locator("[data-material-scene]");
  await expect(scene).toHaveAttribute("data-gpu-phase", "running", { timeout: 30_000 });
  await expect(scene.locator("canvas[data-material-canvas]")).toHaveCount(1);
  await expect(scene.locator("[data-material-target]")).toHaveCount(4);
  await expect(scene.locator('[data-material-fill-presented="true"]')).toHaveCount(4);
  await expect(scene.locator('[data-material-border-presented="true"]')).toHaveCount(4);
  const send = scene.getByRole("button", { name: /^Отправить.*операция недоступна/ });
  await send.click();
  await expect(scene.getByRole("status", { name: "Статус быстрых действий" })).toContainText("Отправить — операция недоступна");
  expect(pageErrors).toEqual([]);
  await expect(scene.locator(".mono-page")).toHaveCSS("background-image", "none");
  const withGpu = await scene.locator(".mono-actions").screenshot();
  await scene.locator("canvas[data-material-canvas]").evaluate(canvas => { canvas.style.display = "none"; });
  const withoutGpu = await scene.locator(".mono-actions").screenshot();
  expect(withGpu.equals(withoutGpu)).toBe(false);
});
