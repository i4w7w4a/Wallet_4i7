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

test("background canvas follows the visible MONO stage while its content scrolls", async ({ page }) => {
  await page.goto("/design-lab/atmosphere");
  const stage = page.getByRole("region", { name: "Сцена материала" });
  await expect(stage.locator("[data-material-scene]")).toHaveAttribute("data-gpu-phase", /running|paused/, { timeout: 30_000 });
  await page.getByRole("combobox", { name: "Формат сцены" }).selectOption("mono");
  await expect(stage).toHaveAttribute("data-mode", "mono");
  const scene = stage.locator("[data-material-scene]");
  await expect(scene).toHaveAttribute("data-gpu-phase", /running|paused/, { timeout: 30_000 });
  const measure = async () => stage.evaluate(element => {
    const canvas = element.querySelector<HTMLCanvasElement>("[data-material-canvas]")!;
    return { stageHeight: element.clientHeight, stageTop: element.getBoundingClientRect().top,
      canvasHeight: canvas.getBoundingClientRect().height, canvasTop: canvas.getBoundingClientRect().top,
      scrollTop: element.scrollTop };
  });
  const before = await measure();
  expect(Math.abs(before.canvasHeight - before.stageHeight)).toBeLessThanOrEqual(2);
  expect(Math.abs(before.canvasTop - before.stageTop)).toBeLessThanOrEqual(3);
  await stage.evaluate(element => { element.scrollTop = 240; });
  const after = await measure();
  expect(after.scrollTop).toBeGreaterThan(0);
  expect(Math.abs(after.canvasTop - after.stageTop)).toBeLessThanOrEqual(3);
});
