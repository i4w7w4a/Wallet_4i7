import { expect, test } from "@playwright/test";

test("button workshop keeps edge-first defaults and readable opt-in Metal fill and icon", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto("/design-lab/buttons");
  const scene = page.locator("[data-material-scene]");
  await expect(scene).toHaveAttribute("data-gpu-phase", "running", { timeout: 30_000 });
  await expect(scene.locator("canvas[data-material-canvas]")).toHaveCount(1);
  await expect(scene.locator("[data-material-target]")).toHaveCount(4);
  await expect(scene.locator('[data-material-border-presented="true"]')).toHaveCount(4);
  await expect(scene.locator('[data-material-fill-presented="true"]')).toHaveCount(0);
  await page.getByRole("tab", { name: "Поверхность" }).click();
  await page.getByRole("combobox", { name: "Материал" }).selectOption("liquid-metal");
  await expect(scene.locator('[data-material-fill-presented="true"]')).toHaveCount(4);
  await page.getByRole("button", { name: "Отправить", exact: true }).click();
  await page.getByRole("tab", { name: "Иконка" }).click();
  await page.getByRole("combobox", { name: "Материал" }).selectOption("liquid-metal");
  const send = scene.getByRole("button", { name: /^Отправить.*операция недоступна/ });
  await expect(send).toHaveAttribute("data-material-icon-presented", "true");
  const contrast = await send.evaluate(button => {
    function rgba(value: string): [number, number, number, number] {
      const parts = value.match(/[\d.]+/g)?.map(Number) ?? [];
      return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0, parts[3] ?? 1];
    }
    function luminance(rgb: readonly number[]): number {
      const linear = rgb.map(value => { const channel = value / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4; });
      return 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;
    }
    function worstCaseWhiteContrast(element: Element): number {
      const style = getComputedStyle(element);
      const foreground = rgba(style.color), background = rgba(style.backgroundColor);
      const behind = background.slice(0, 3).map(channel =>
        channel * background[3] + 255 * (1 - background[3]));
      const light = Math.max(luminance(foreground), luminance(behind));
      const dark = Math.min(luminance(foreground), luminance(behind));
      return (light + 0.05) / (dark + 0.05);
    }
    const label = button.querySelector(".mono-actions__label")!;
    const icon = button.querySelector(".mono-actions__icon")!;
    return { label: worstCaseWhiteContrast(label), icon: worstCaseWhiteContrast(icon),
      svgOpacity: Number(getComputedStyle(icon.querySelector("svg")!).opacity) };
  });
  expect(contrast.label).toBeGreaterThanOrEqual(4.5);
  expect(contrast.icon).toBeGreaterThanOrEqual(3);
  expect(contrast.svgOpacity).toBeGreaterThanOrEqual(0.5);
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
