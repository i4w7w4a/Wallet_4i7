import { expect, test } from "@playwright/test";

test.use({ hasTouch: false, isMobile: false, viewport: { width: 1440, height: 1000 } });

test("Color Lab retains one legible phone across four widths, two themes and five harmonies", async ({ page }) => {
  test.setTimeout(process.env.MONO_PALETTE_CAPTURE === "1" ? 90_000 : 45_000);
  await page.goto("/mono");
  await page.getByRole("button", { name: "Включить палитру" }).click();
  await page.getByRole("button", { name: "Точная настройка" }).click();
  const preview = page.locator("[data-mono-preview]");
  const harmonies = ["spectral-graphite", "mineral", "thermal-duet", "analog-mist", "split-prism"];

  for (const width of [320, 390, 430, 480]) {
    await page.getByRole("button", { name: `Экран ${width} пикселей` }).click();
    await expect.poll(async () => (await preview.boundingBox())?.width).toBe(width);
    for (const mode of ["Dark", "Light"] as const) {
      await page.getByRole("button", { name: mode, exact: true }).click();
      for (const harmony of harmonies) {
        await page.getByRole("combobox", { name: "Гармония · точно" }).selectOption(harmony);
        const geometry = await preview.evaluate(node => {
          const rect = node.getBoundingClientRect();
          const style = getComputedStyle(node);
          const balance = node.querySelector(".mono-hero__amount") as HTMLElement | null;
          return {
            width: rect.width,
            scrollWidth: node.scrollWidth,
            clientWidth: node.clientWidth,
            canvasToken: style.getPropertyValue("--mono-palette-canvas-ff").trim(),
            balanceColor: balance ? getComputedStyle(balance).color : "",
          };
        });
        expect(geometry.width).toBe(width);
        expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
        expect(geometry.canvasToken).toMatch(/^rgba?\(/);
        expect(geometry.balanceColor).not.toBe("");
        await expect(page.locator("canvas")).toHaveCount(1);
        if (process.env.MONO_PALETTE_CAPTURE === "1" && ["spectral-graphite", "split-prism"].includes(harmony)) {
          const clip = await preview.boundingBox();
          if (clip) await page.screenshot({ path: test.info().outputPath(`${width}-${mode}-${harmony}.png`), clip, animations: "disabled" });
        }
      }
    }
  }
});
