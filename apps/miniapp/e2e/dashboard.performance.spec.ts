import { expect, test } from "@playwright/test";

test("Dashboard соблюдает canvas, video и interaction budgets", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    const measuredWindow = window as typeof window & {
      __walletLongTasks?: Array<{ duration: number; startTime: number }>;
    };
    measuredWindow.__walletLongTasks = [];
    if (typeof PerformanceObserver === "undefined") {
      return;
    }

    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          measuredWindow.__walletLongTasks?.push({
            duration: entry.duration,
            startTime: entry.startTime,
          });
        }
      });
      observer.observe({ type: "longtask", buffered: true });
    } catch {
      // Long Tasks API может быть отключён в конкретной headless-сборке Chromium.
    }
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator("[data-wallet-visual-layer]")).toBeVisible();
  await page.waitForTimeout(2_000);

  const canvasCount = await page.locator("canvas[data-web-threads]").count();
  const videoCount = await page.locator("video").count();
  expect(canvasCount).toBeLessThanOrEqual(1);
  expect(videoCount).toBe(0);

  await page.evaluate(() => {
    (
      window as typeof window & {
        __walletLongTasks?: Array<{ duration: number; startTime: number }>;
      }
    ).__walletLongTasks = [];
  });
  const promoAction = page.locator(".liquid-promo__action");
  await promoAction.scrollIntoViewIfNeeded();
  const interaction = await promoAction.evaluate(
    (button) =>
      new Promise<{ endedAt: number; interactionMs: number; startedAt: number }>((resolve) => {
        const startedAt = performance.now();
        const observer = new MutationObserver(() => {
          if (document.querySelector('[role="dialog"]')) {
            observer.disconnect();
            const endedAt = performance.now();
            resolve({ endedAt, interactionMs: endedAt - startedAt, startedAt });
          }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        (button as HTMLButtonElement).click();
      }),
  );
  await expect(page.getByRole("dialog", { name: "Обменять" })).toBeVisible();
  expect(interaction.interactionMs).toBeLessThan(250);

  await page.waitForTimeout(100);
  const longTasks = await page.evaluate(
    () =>
      (
        window as typeof window & {
          __walletLongTasks?: Array<{ duration: number; startTime: number }>;
        }
      ).__walletLongTasks ?? [],
  );
  const interactionLongTasks = longTasks.filter(
    (entry) =>
      entry.startTime >= interaction.startedAt && entry.startTime <= interaction.endedAt,
  );
  const maxLongTaskMs = Math.max(0, ...interactionLongTasks.map((entry) => entry.duration));
  expect(maxLongTaskMs).toBeLessThanOrEqual(100);

  testInfo.annotations.push({
    type: "performance",
    description: JSON.stringify({
      canvasCount,
      videoCount,
      interactionMs: interaction.interactionMs,
      maxLongTaskMs,
    }),
  });

  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.locator("[data-wallet-visual-layer]")).toHaveAttribute(
    "data-active",
    "false",
  );

  await testInfo.attach("performance-evidence.json", {
    body: JSON.stringify(
      {
        canvasCount,
        videoCount,
        interactionMs: interaction.interactionMs,
        maxLongTaskMs,
      },
      null,
      2,
    ),
    contentType: "application/json",
  });
});
