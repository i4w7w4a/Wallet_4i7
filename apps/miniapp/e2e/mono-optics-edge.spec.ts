import { expect, test } from "@playwright/test";
import { closeCompactMonoRail, openMonoRail } from "./mono-test-helpers";

test.use({ hasTouch: false, isMobile: false, viewport: { width: 466, height: 1000 } });

test("утверждённая положительная линза не замораживает крайний столбец текстуры", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      value: function (this: HTMLCanvasElement, kind: string, options?: WebGLContextAttributes) {
        return Reflect.apply(original, this, [kind,
          kind === "webgl2" ? { ...options, preserveDrawingBuffer: true } : options]);
      },
    });
    // Isolate refraction from flow and lighting, leaving the accepted IOR and field unchanged.
    localStorage.setItem("wallet4i7.mono.optical-preview.v1", JSON.stringify({
      version: 1,
      presets: { ledger: {
        flowEnabled: false, highlightStrength: 0, reflectionStrength: 0,
        causticStrength: 0, edgeDarkening: 0, pointerStrength: 0,
      } },
    }));
  });
  await page.goto("/mono");
  await expect(page.locator("[data-optics=webgl]")).toBeVisible();
  await page.waitForTimeout(200);

  const tail = await page.locator("[data-mono-optical-canvas]").evaluate((canvas) => {
    const gl = (canvas as HTMLCanvasElement).getContext("webgl2");
    if (!gl) throw new Error("WebGL2 unavailable");
    const width = gl.drawingBufferWidth;
    const height = gl.drawingBufferHeight;
    const row = new Uint8Array(width * 4);
    gl.readPixels(0, Math.round(height * 0.8), width, 1, gl.RGBA, gl.UNSIGNED_BYTE, row);
    return Array.from({ length: 8 }, (_, index) => row[(width - 8 + index) * 4]);
  });

  expect(new Set(tail).size, `right-edge luminance: ${tail.join(", ")}`).toBeGreaterThanOrEqual(3);
});

test("переключение вариантов не рисует сплошную светлую рейку справа", async ({ page }) => {
  await page.goto("/mono");
  const promo = page.locator(".mono-promo-frame");

  for (const variant of ["1 · Ledger", "2 · Frost", "3 · Mercury", "1 · Ledger"]) {
    const quick = await openMonoRail(page, "quick");
    await quick.getByRole("button", { name: variant }).click();
    await closeCompactMonoRail(page, "quick");
    await promo.hover();
    await page.waitForTimeout(460);

    const geometry = await promo.evaluate((frame) => {
      const optical = frame.querySelector<HTMLElement>('[data-testid="mono-optical-glass"]')!;
      const canvas = optical.querySelector<HTMLCanvasElement>("canvas")!;
      return {
        borderRight: getComputedStyle(frame).borderRightColor,
        canvasWidth: canvas.clientWidth,
        canvasHeight: canvas.clientHeight,
        opticalWidth: optical.clientWidth,
        opticalHeight: optical.clientHeight,
      };
    });

    expect(geometry.borderRight, variant).toBe("rgba(0, 0, 0, 0)");
    expect(geometry.canvasWidth, variant).toBe(geometry.opticalWidth);
    expect(geometry.canvasHeight, variant).toBe(geometry.opticalHeight);
  }
});
