import { expect, test, type Page } from "@playwright/test";

type PerformanceSnapshot = {
  firedRafCount: number;
  longTaskSupported: boolean;
  longTasks: Array<{ duration: number; startTime: number }>;
  pendingRafCount: number;
  renderCount: number;
  requestedRafCount: number;
};

test("Dashboard соблюдает WebGL, RAF, render и interaction budgets", async ({ page }, testInfo) => {
  await installPerformanceHarness(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const visualLayer = page.locator("[data-wallet-visual-layer]");
  const canvas = page.locator("canvas[data-web-threads]");
  await expect(visualLayer).toHaveAttribute("data-active", "true");
  await expect(canvas).toHaveCount(1);
  expect(
    await canvas.evaluate((node) => (node as HTMLCanvasElement).getContext("webgl2") !== null),
  ).toBe(true);
  await expect(page.locator("video")).toHaveCount(0);

  await page.waitForTimeout(2_000);
  const activeStart = await readPerformanceSnapshot(page);
  await page.waitForTimeout(250);
  const activeEnd = await readPerformanceSnapshot(page);
  expect(activeEnd.pendingRafCount).toBe(1);
  expect(activeEnd.firedRafCount - activeStart.firedRafCount).toBeGreaterThan(0);
  expect(activeEnd.renderCount - activeStart.renderCount).toBeGreaterThan(0);

  const warmupAction = page
    .locator(".wallet-controls__quick-actions")
    .getByRole("button", { name: "Отправить", exact: true });
  await warmupAction.click();
  await expect(page.getByRole("dialog", { name: "Отправить" })).toBeVisible();
  await page.getByRole("button", { name: "Закрыть", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Отправить" })).toHaveCount(0);
  await expect(visualLayer).toHaveAttribute("data-active", "true");
  await page.waitForTimeout(500);

  await page.evaluate(() => {
    (
      window as typeof window & {
        __walletPerformance?: { clearLongTasks(): void };
      }
    ).__walletPerformance?.clearLongTasks();
  });
  const quickAction = page
    .locator(".wallet-controls__quick-actions")
    .getByRole("button", { name: "Обменять", exact: true });
  const interaction = await quickAction.evaluate(
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

  const monitoringWindowMs = 500;
  await page.waitForTimeout(monitoringWindowMs);
  const interactionSnapshot = await readPerformanceSnapshot(page);
  const interactionLongTasks = interactionSnapshot.longTasks.filter(
    (entry) =>
      entry.startTime < interaction.startedAt + monitoringWindowMs &&
      entry.startTime + entry.duration >= interaction.startedAt,
  );
  const maxLongTaskMs = interactionSnapshot.longTaskSupported
    ? Math.max(0, ...interactionLongTasks.map((entry) => entry.duration))
    : null;
  if (maxLongTaskMs !== null) {
    expect(
      maxLongTaskMs,
      JSON.stringify({ interaction, interactionLongTasks }),
    ).toBeLessThanOrEqual(100);
  }
  await page.getByRole("button", { name: "Закрыть", exact: true }).click();
  await page.waitForTimeout(500);

  await setDocumentVisibility(page, "hidden");
  await expect(visualLayer).toHaveAttribute("data-active", "false");
  await page.waitForTimeout(100);
  const hiddenStart = await readPerformanceSnapshot(page);
  await page.waitForTimeout(250);
  const hiddenEnd = await readPerformanceSnapshot(page);
  expectPaused(hiddenStart, hiddenEnd);

  await setDocumentVisibility(page, "visible");
  await expect(visualLayer).toHaveAttribute("data-active", "true");
  await page.waitForTimeout(100);

  await page.evaluate(() => {
    (
      window as typeof window & { __walletEmitActivity?: (event: "deactivated") => void }
    ).__walletEmitActivity?.("deactivated");
  });
  await expect(visualLayer).toHaveAttribute("data-active", "false");
  await page.waitForTimeout(100);
  const hostInactiveStart = await readPerformanceSnapshot(page);
  await page.waitForTimeout(250);
  const hostInactiveEnd = await readPerformanceSnapshot(page);
  expectPaused(hostInactiveStart, hostInactiveEnd);

  await page.evaluate(() => {
    (
      window as typeof window & { __walletEmitActivity?: (event: "activated") => void }
    ).__walletEmitActivity?.("activated");
  });
  await expect(visualLayer).toHaveAttribute("data-active", "true");
  await page.waitForTimeout(100);

  await page.evaluate(() => {
    (window as typeof window & { __walletSetSaveData?: (active: boolean) => void })
      .__walletSetSaveData?.(true);
  });
  await expect(canvas).toHaveCount(0);
  await expect(page.locator("[data-visual-fallback]")).toBeVisible();
  await page.waitForTimeout(100);
  const saveDataStart = await readPerformanceSnapshot(page);
  await page.waitForTimeout(250);
  const saveDataEnd = await readPerformanceSnapshot(page);
  expectPaused(saveDataStart, saveDataEnd);

  const evidence = {
    canvasCount: 1,
    videoCount: 0,
    interactionMs: interaction.interactionMs,
    monitoringWindowMs,
    longTaskStatus: interactionSnapshot.longTaskSupported ? "measured" : "not-measured",
    maxLongTaskMs,
    activePendingRafCount: activeEnd.pendingRafCount,
    activeRafCallbacks: activeEnd.firedRafCount - activeStart.firedRafCount,
    activeRenders: activeEnd.renderCount - activeStart.renderCount,
    hiddenRafCallbacks: hiddenEnd.firedRafCount - hiddenStart.firedRafCount,
    hiddenRenders: hiddenEnd.renderCount - hiddenStart.renderCount,
    inactiveRafCallbacks:
      hostInactiveEnd.firedRafCount - hostInactiveStart.firedRafCount,
    inactiveRenders: hostInactiveEnd.renderCount - hostInactiveStart.renderCount,
    saveDataRafCallbacks: saveDataEnd.firedRafCount - saveDataStart.firedRafCount,
    saveDataRenders: saveDataEnd.renderCount - saveDataStart.renderCount,
  };
  testInfo.annotations.push({ type: "performance", description: JSON.stringify(evidence) });
  await testInfo.attach("performance-evidence.json", {
    body: JSON.stringify(evidence, null, 2),
    contentType: "application/json",
  });
});

function expectPaused(before: PerformanceSnapshot, after: PerformanceSnapshot) {
  expect(after.pendingRafCount).toBe(0);
  expect(after.firedRafCount - before.firedRafCount).toBeLessThanOrEqual(1);
  expect(after.renderCount - before.renderCount).toBeLessThanOrEqual(1);
}

async function readPerformanceSnapshot(page: Page): Promise<PerformanceSnapshot> {
  return page.evaluate(() => {
    const harness = (
      window as typeof window & {
        __walletPerformance?: { snapshot(): PerformanceSnapshot };
      }
    ).__walletPerformance;
    if (!harness) {
      throw new Error("Performance harness не установлен");
    }
    return harness.snapshot();
  });
}

async function setDocumentVisibility(page: Page, state: "hidden" | "visible") {
  await page.evaluate((nextState) => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => nextState,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  }, state);
}

async function installPerformanceHarness(page: Page) {
  await page.addInitScript(() => {
    type Snapshot = {
      firedRafCount: number;
      longTaskSupported: boolean;
      longTasks: Array<{ duration: number; startTime: number }>;
      pendingRafCount: number;
      renderCount: number;
      requestedRafCount: number;
    };
    const state = {
      firedRafCount: 0,
      longTaskSupported: false,
      longTasks: [] as Snapshot["longTasks"],
      renderCount: 0,
      requestedRafCount: 0,
    };
    const pendingFrames = new Set<number>();
    const nativeRequestAnimationFrame = window.requestAnimationFrame.bind(window);
    const nativeCancelAnimationFrame = window.cancelAnimationFrame.bind(window);

    window.requestAnimationFrame = (callback: FrameRequestCallback) => {
      state.requestedRafCount += 1;
      let frameId = 0;
      frameId = nativeRequestAnimationFrame((time) => {
        pendingFrames.delete(frameId);
        state.firedRafCount += 1;
        callback(time);
      });
      pendingFrames.add(frameId);
      return frameId;
    };
    window.cancelAnimationFrame = (frameId: number) => {
      pendingFrames.delete(frameId);
      nativeCancelAnimationFrame(frameId);
    };

    if (typeof WebGL2RenderingContext !== "undefined") {
      const nativeDrawArrays = WebGL2RenderingContext.prototype.drawArrays;
      WebGL2RenderingContext.prototype.drawArrays = function drawArrays(mode, first, count) {
        state.renderCount += 1;
        return nativeDrawArrays.call(this, mode, first, count);
      };
      const nativeDrawElements = WebGL2RenderingContext.prototype.drawElements;
      WebGL2RenderingContext.prototype.drawElements = function drawElements(
        mode,
        count,
        type,
        offset,
      ) {
        state.renderCount += 1;
        return nativeDrawElements.call(this, mode, count, type, offset);
      };
    }

    if (typeof PerformanceObserver !== "undefined") {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            state.longTasks.push({ duration: entry.duration, startTime: entry.startTime });
          }
        });
        observer.observe({ type: "longtask", buffered: true });
        state.longTaskSupported = true;
      } catch {
        state.longTaskSupported = false;
      }
    }

    const activityHandlers = new Map<"activated" | "deactivated", Set<() => void>>();
    const telegramWebApp = {
      initDataUnsafe: {
        user: { id: 23, first_name: "Performance", username: "performance" },
      },
      onEvent(event: "activated" | "deactivated", handler: () => void) {
        const handlers = activityHandlers.get(event) ?? new Set<() => void>();
        handlers.add(handler);
        activityHandlers.set(event, handlers);
      },
      offEvent(event: "activated" | "deactivated", handler: () => void) {
        activityHandlers.get(event)?.delete(handler);
      },
    };
    Object.defineProperty(window, "Telegram", {
      configurable: true,
      value: { WebApp: telegramWebApp },
    });

    let saveData = false;
    const connectionHandlers = new Set<() => void>();
    Object.defineProperty(navigator, "connection", {
      configurable: true,
      value: {
        get saveData() {
          return saveData;
        },
        addEventListener(_type: "change", handler: () => void) {
          connectionHandlers.add(handler);
        },
        removeEventListener(_type: "change", handler: () => void) {
          connectionHandlers.delete(handler);
        },
      },
    });

    const instrumentedWindow = window as typeof window & {
      __walletEmitActivity?: (event: "activated" | "deactivated") => void;
      __walletPerformance?: {
        clearLongTasks(): void;
        snapshot(): Snapshot;
      };
      __walletSetSaveData?: (active: boolean) => void;
    };
    instrumentedWindow.__walletEmitActivity = (event) => {
      activityHandlers.get(event)?.forEach((handler) => handler());
    };
    instrumentedWindow.__walletSetSaveData = (active) => {
      saveData = active;
      connectionHandlers.forEach((handler) => handler());
    };
    instrumentedWindow.__walletPerformance = {
      clearLongTasks() {
        state.longTasks = [];
      },
      snapshot() {
        return {
          ...state,
          longTasks: [...state.longTasks],
          pendingRafCount: pendingFrames.size,
        };
      },
    };
  });
}
