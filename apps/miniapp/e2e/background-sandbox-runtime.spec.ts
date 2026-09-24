import { expect, test } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { installSandboxProbe, snapshot } from "./background-sandbox-probe";

test("Fluid ownership, pointer drawing, pause and platform guards on the real host", async ({ page }, info) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await installSandboxProbe(page);
  await page.goto("/design-lab/atmosphere");
  const surface = page.locator("[data-background-surface]");
  const material = page.getByRole("combobox", { name: "Материал", exact: true });
  await expect(surface).toHaveAttribute("data-gpu-phase", "running");
  await page.getByRole("button", { name: "Пауза", exact: true }).click();
  await expect.poll(async () => (await snapshot(page)).pendingRaf).toBe(0);
  const baseline = await snapshot(page);
  for (let i = 0; i < 6; i++) {
    await material.selectOption("fluid");
    await expect(surface).toHaveAttribute("data-effect-id", "fluid");
    await expect(surface).toHaveAttribute("data-gpu-phase", "paused");
    await expect(page.locator("canvas")).toHaveCount(1);
    expect((await snapshot(page)).live).toBe(1);
    await material.selectOption("silk");
    await expect(surface).toHaveAttribute("data-gpu-phase", "paused");
    expect((await snapshot(page)).resources).toEqual(baseline.resources);
  }
  await material.selectOption("fluid");
  await expect(surface).toHaveAttribute("data-gpu-phase", "paused");
  const force = page.getByRole("slider", { name: "Сила", exact: true });
  await force.focus(); await force.press("End");
  const changed = await force.inputValue();
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await page.getByRole("textbox", { name: "Имя пробы" }).fill("Fluid · инерция");
  await page.getByRole("button", { name: "Сохранить пробу", exact: true }).click();
  await expect(page.locator("[data-save-status]")).toHaveText("Сохранено");
  await page.reload();
  await expect(material).toHaveValue("fluid");
  await expect(force).toHaveValue(changed);
  await expect(surface).toHaveAttribute("data-gpu-phase", "running");
  const box = (await surface.boundingBox())!;
  await page.mouse.move(box.x + box.width * .25, box.y + box.height * .45);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * .72, box.y + box.height * .62, { steps: 18 });
  await page.mouse.up();
  await page.screenshot({ path: info.outputPath("fluid-after-drag.png"), fullPage: true });
  await surface.evaluate(element => { element.style.transform = "translateX(400vw)"; });
  await expect(surface).toHaveAttribute("data-gpu-phase", "paused");
  const offscreen = await snapshot(page);
  await page.waitForTimeout(140);
  expect((await snapshot(page)).draws).toBe(offscreen.draws);
  await surface.evaluate(element => { element.style.transform = ""; });
  await expect(surface).toHaveAttribute("data-gpu-phase", "running");
  for (const guard of ["visibility", "activity"] as const) {
    await page.evaluate(kind => {
      if (kind === "visibility") window.__sandboxProbe.visibility(true);
      else window.__sandboxProbe.activity(false);
    }, guard);
    await expect(surface).toHaveAttribute("data-gpu-phase", "paused");
    const before = await snapshot(page);
    await page.waitForTimeout(140);
    expect((await snapshot(page)).draws).toBe(before.draws);
    expect((await snapshot(page)).pendingRaf).toBe(0);
    await page.evaluate(kind => {
      if (kind === "visibility") window.__sandboxProbe.visibility(false);
      else window.__sandboxProbe.activity(true);
    }, guard);
    await expect(surface).toHaveAttribute("data-gpu-phase", "running");
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(surface).toHaveAttribute("data-gpu-phase", "fallback");
  await expect(page.locator("canvas")).toHaveCount(0);
  await expect.poll(async () => (await snapshot(page)).live).toBe(0);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(surface).toHaveAttribute("data-gpu-phase", "running");
  await page.evaluate(() => window.__sandboxProbe.saveData(true));
  await expect(surface).toHaveAttribute("data-gpu-phase", "fallback");
  await expect(page.locator("canvas")).toHaveCount(0);
  await page.evaluate(() => window.__sandboxProbe.saveData(false));
  await expect(surface).toHaveAttribute("data-gpu-phase", "running");
  await page.evaluate(() => window.__sandboxProbe.lose());
  await expect(surface).toHaveAttribute("data-gpu-phase", "lost");
  await expect.poll(async () => (await snapshot(page)).pendingRaf).toBe(0);
  await page.evaluate(() => window.__sandboxProbe.restore());
  await expect(surface).toHaveAttribute("data-gpu-phase", "running");
  await expect(page.locator("canvas")).toHaveCount(1);
  await expect(force).toHaveValue(changed);
  const final = await snapshot(page);
  await writeFile(info.outputPath("ownership-and-guards.json"), JSON.stringify({ baseline, offscreen, final, errors }, null, 2));
  await info.attach("ownership-and-guards", { body: JSON.stringify({ baseline, final, errors }, null, 2), contentType: "application/json" });
  expect(final.live).toBe(1);
  expect(final.pendingRaf).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
});

test.describe("MONO composition at device DPR 2", () => {
test.use({ deviceScaleFactor: 2 });
test("one canvas keeps the same recipe through faithful MONO fitting and return", async ({ page }, info) => {
  test.setTimeout(60_000);
  await page.goto("/design-lab/atmosphere");
  await expect(page.locator("[data-background-surface]")).toHaveAttribute("data-gpu-phase", "running");
  await page.getByRole("button", { name: "Пауза", exact: true }).click();
  const first = page.getByRole("slider").first();
  const parameter = await first.inputValue();
  const option = page.getByRole("combobox", { name: "Формат сцены" }).locator("option[value=mono]");
  await expect(option).toBeEnabled();
  await page.getByRole("combobox", { name: "Формат сцены" }).selectOption("mono");
  await expect(page.locator("[data-testid=mono-optical-glass]")).toHaveAttribute("data-optics", "shared-webgl");
  await expect(page.getByText(/Техническая примерка: контраст MONO ещё не согласован/)).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(1);
  await expect(page.locator("[data-mono-optical-canvas]")).toHaveCount(0);
  await page.getByRole("button", { name: "Скрыть баланс", exact: true }).click();
  await expect(page.getByRole("button", { name: "Показать баланс", exact: true })).toBeVisible();
  for (const width of [320, 390, 430, 480]) {
    await page.getByRole("group", { name: "Ширина примерки" }).getByRole("button", { name: String(width), exact: true }).click();
    await expect(page.locator("[data-mono-preview]")).toHaveAttribute("data-mono-viewport", String(width));
    await expect(page.locator("[data-testid=mono-optical-glass]")).toHaveAttribute("data-optics", "shared-webgl");
    expect(Math.round((await page.locator("[data-mono-preview]").boundingBox())!.width)).toBe(width);
    await expect.poll(() => page.locator("[data-background-canvas]").evaluate((canvas: HTMLCanvasElement) => canvas.width)).toBe(Math.floor(width * 1.5));
    await page.screenshot({ path: info.outputPath("fitting-" + width + ".png"), fullPage: true });
  }
  await page.getByRole("combobox", { name: "Материал", exact: true }).selectOption("fluid");
  await expect(page.locator("[data-background-surface]")).toHaveAttribute("data-effect-id", "fluid");
  await expect(page.locator("[data-testid=mono-optical-glass]")).toHaveAttribute("data-optics", "shared-webgl");
  await page.screenshot({ path: info.outputPath("fitting-fluid-480.png"), fullPage: true });
  const stage = page.getByRole("region", { name: "Сцена материала" });
  await stage.evaluate(element => { element.scrollTop = element.scrollHeight - element.clientHeight; });
  await expect(page.locator(".mono-assets__disclaimer")).toBeVisible();
  await expect(page.locator("[data-testid=mono-optical-glass]")).toHaveAttribute("data-optics", "shared-webgl");
  await page.screenshot({ path: info.outputPath("fitting-fluid-scrolled.png"), fullPage: true });
  await page.getByRole("combobox", { name: "Материал", exact: true }).selectOption("silk");
  await expect(page.locator("[data-background-surface]")).toHaveAttribute("data-gpu-phase", "paused");
  await page.getByRole("combobox", { name: "Формат сцены" }).selectOption("wide");
  await expect(first).toHaveValue(parameter);
  await expect(page.locator("canvas")).toHaveCount(1);
  await expect(page.locator("[data-testid=mono-optical-glass]")).toHaveCount(0);
});
});

test("the ordinary MONO route retains its private approved Promo and live privacy action", async ({ page }, info) => {
  await page.goto("/mono");
  await expect(page.locator("[data-testid=mono-optical-glass]")).toHaveAttribute("data-optics", "webgl");
  await expect(page.locator("[data-mono-optical-canvas]")).toHaveCount(1);
  await expect(page.locator("[data-background-canvas]")).toHaveCount(0);
  await page.getByRole("button", { name: "Скрыть баланс", exact: true }).click();
  await expect(page.getByRole("button", { name: "Показать баланс", exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath("ordinary-mono-compatibility.png"), fullPage: true });
});
