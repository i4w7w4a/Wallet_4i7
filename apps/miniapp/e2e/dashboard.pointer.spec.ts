import { mkdir } from "node:fs/promises";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

const RECORD_POINTER_EVIDENCE = process.env.RECORD_POINTER_EVIDENCE === "1";
const THEME_STORAGE_KEY = "wallet4i7.theme.v1";
const VISUAL_STORAGE_KEY = "wallet4i7.visual.v1";

test.use({
  hasTouch: false,
  isMobile: false,
  video: RECORD_POINTER_EVIDENCE ? "on" : "off",
});

for (const viewport of [
  { width: 390, height: 844 },
  { width: 430, height: 932 },
]) {
  test(`настоящий WebGL реагирует на fine pointer при ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await seedInteractiveScene(page);
    await page.goto("/");

    const canvas = page.locator("canvas[data-web-threads]");
    await expect(canvas).toHaveCount(1);
    expect(
      await canvas.evaluate((node) => (node as HTMLCanvasElement).getContext("webgl2") !== null),
    ).toBe(true);
    await page.waitForTimeout(250);
    const beforePointer = await canvas.screenshot();

    await page.mouse.move(viewport.width - 18, Math.round(viewport.height * 0.28));
    await page.mouse.move(
      Math.round(viewport.width * 0.68),
      Math.round(viewport.height * 0.18),
      { steps: 18 },
    );
    await page.mouse.move(
      Math.round(viewport.width * 0.76),
      Math.round(viewport.height * 0.42),
      { steps: 18 },
    );
    await page.waitForTimeout(300);
    const afterPointer = await canvas.screenshot();

    expect(Buffer.compare(beforePointer, afterPointer)).not.toBe(0);

    if (RECORD_POINTER_EVIDENCE && viewport.width === 390) {
      const evidencePath = path.resolve(
        "e2e/evidence/web-threads-pointer-390x844.webm",
      );
      await mkdir(path.dirname(evidencePath), { recursive: true });
      const video = page.video();
      await page.close();
      await video?.saveAs(evidencePath);
    }
  });
}

async function seedInteractiveScene(page: Page) {
  await page.addInitScript(
    ({ themeStorageKey, visualStorageKey }) => {
      window.localStorage.setItem(
        themeStorageKey,
        JSON.stringify({
          version: 1,
          background: "#05070B",
          surface: "#111620",
          accent: "#5B8CFF",
          glassTint: "#7C6CFF",
          radius: 24,
          density: 1,
          glassOpacity: 0.24,
          glassBlur: 18,
          highlightIntensity: 0.55,
          refractionIntensity: 0.35,
          motionIntensity: 0.8,
        }),
      );
      window.localStorage.setItem(
        visualStorageKey,
        JSON.stringify({
          version: 1,
          speed: 0,
          threadCount: 7,
          frequency: 3,
          spread: 0.55,
          taper: 0.18,
          position: 0.46,
          fanMode: "right",
          glow: 0.08,
          falloff: 2,
          thickness: 0.65,
          brightness: 1.25,
          opacity: 0.92,
          mirror: true,
          shimmer: false,
          grain: false,
          grainIntensity: 0.08,
          pointerInteraction: true,
          pointerStrength: 0.82,
        }),
      );
    },
    {
      themeStorageKey: THEME_STORAGE_KEY,
      visualStorageKey: VISUAL_STORAGE_KEY,
    },
  );
}
