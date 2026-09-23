import { expect, test } from "@playwright/test";

const labUrl = "/design-lab";
const button = '[data-control-feedback]';
const inner = '[data-control-feedback] > span > span';

async function innerX(page: import("@playwright/test").Page) {
  return page.locator(inner).evaluate((element) => new DOMMatrixReadOnly(getComputedStyle(element).transform).m41);
}

test("desktop: compare one button, bounded magnetic response, save and validated import", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(labUrl);
  await expect(page.getByRole("heading", { name: "Один объект. Три ощущения." })).toBeVisible();
  await page.getByRole("button", { name: "Магнит" }).click();
  await expect(page.locator(button)).toHaveCount(1);
  await expect(page.locator(button)).toHaveAttribute("data-effect", "magnetic");
  const before = await page.locator(button).boundingBox();
  expect(before).not.toBeNull();

  await page.mouse.move(before!.x + before!.width / 2, before!.y + before!.height / 2);
  await page.mouse.move(before!.x + before!.width - 14, before!.y + before!.height / 2, { steps: 5 });
  await expect.poll(() => innerX(page)).toBeGreaterThan(1);
  expect(await innerX(page)).toBeLessThanOrEqual(8);
  await page.mouse.move(before!.x + 14, before!.y + before!.height / 2);
  await expect.poll(() => innerX(page)).toBeLessThan(-1);
  expect(await page.locator(button).boundingBox()).toEqual(before);
  await page.mouse.move(0, 0);
  await expect.poll(async () => Math.abs(await innerX(page))).toBeLessThan(0.2);

  await page.getByRole("button", { name: "Сравнить с базой" }).click();
  await expect(page.locator(button)).toHaveAttribute("data-effect", "baseline");
  await expect(page.locator(button)).toHaveCount(1);
  await page.getByRole("button", { name: "Вернуться к варианту" }).click();
  await expect(page.locator(button)).toHaveAttribute("data-effect", "magnetic");
  await page.getByRole("button", { name: "Контекст" }).click();
  await page.getByRole("button", { name: "430" }).click();
  await page.getByRole("spinbutton", { name: "Ход магнитного слоя" }).fill("6");
  await page.getByRole("button", { name: "Сохранить пробу" }).click();
  await expect(page.locator('p[role="status"]')).toContainText("сохранена");
  await page.reload();
  await expect(page.getByRole("button", { name: "Магнит" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Контекст" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "430" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("spinbutton", { name: "Ход магнитного слоя" })).toHaveValue("6");
  await page.getByRole("button", { name: "Экспорт JSON" }).click();
  const exported = await page.getByRole("textbox", { name: "Экспортированная проба" }).inputValue();
  expect(JSON.parse(exported)).toMatchObject({ sceneId: "control-feedback-01", effectId: "magnetic", previewWidth: 430, config: { magneticTravel: 6 } });

  await page.getByRole("textbox", { name: "Импорт JSON" }).fill(exported.replace('"effectId": "magnetic"', '"effectId": "material"'));
  await page.getByRole("button", { name: "Проверить импорт" }).click();
  await expect(page.getByRole("button", { name: "Применить импорт" })).toBeEnabled();
  await page.getByRole("button", { name: "Применить импорт" }).click();
  await expect(page.getByRole("button", { name: "Материал" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("textbox", { name: "Импорт JSON" }).fill('{"schemaVersion":2}');
  await page.getByRole("button", { name: "Проверить импорт" }).click();
  await expect(page.getByRole("button", { name: "Применить импорт" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Материал" })).toHaveAttribute("aria-pressed", "true");
});

test("keyboard, touch and reduced motion retain a usable action", async ({ page, browser }) => {
  await page.goto(labUrl);
  await page.getByRole("button", { name: "Материал" }).click();
  await page.getByRole("button", { name: "Проверить отклик" }).focus();
  await page.keyboard.press("Space");
  await expect(page.getByText("Срабатываний: 1")).toBeVisible();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Магнит" }).click();
  const rect = await page.locator(button).boundingBox();
  await page.mouse.move(rect!.x + rect!.width - 15, rect!.y + rect!.height / 2);
  expect(await innerX(page)).toBe(0);
  await page.getByRole("button", { name: "Проверить отклик" }).click();
  await expect(page.getByText("Срабатываний: 2")).toBeVisible();

  const touchContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  try {
    const touchPage = await touchContext.newPage();
    await touchPage.goto(labUrl);
    await touchPage.getByRole("button", { name: "Магнит" }).tap();
    await touchPage.locator(button).tap();
    await expect(touchPage.getByText("Срабатываний: 1")).toBeVisible();
    expect(await touchPage.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  } finally {
    await touchContext.close();
  }
});

test("canonical preview widths remain real sizes and narrow hosts clamp", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(labUrl);
  for (const width of [320, 390, 430, 480]) {
    await page.getByRole("button", { name: String(width), exact: true }).click();
    const box = await page.locator("[data-preview-width]").boundingBox();
    expect(Math.round(box!.width)).toBe(width);
  }
  await page.setViewportSize({ width: 320, height: 800 });
  const box = await page.locator("[data-preview-width]").boundingBox();
  expect(box!.width).toBeLessThan(320);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});



test("hidden tab clears a transient magnetic offset", async ({ page }) => {
  await page.goto(labUrl);
  await page.getByRole("button", { name: "Магнит" }).click();
  const rect = await page.locator(button).boundingBox();
  await page.mouse.move(rect!.x + rect!.width - 15, rect!.y + rect!.height / 2);
  await expect.poll(() => innerX(page)).toBeGreaterThan(1);
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect.poll(async () => Math.abs(await innerX(page))).toBeLessThan(0.2);
});

test("a launched Lab applies only after a matching MONO acknowledgement", async ({ browser }) => {
  const context = await browser.newContext();
  try {
    const host = await context.newPage();
    await host.goto(labUrl);
    await host.evaluate(() => {
      const received: unknown[] = [];
      (window as Window & { motionRequests?: unknown[] }).motionRequests = received;
      const channel = new BroadcastChannel("novex.motion-lab.control-feedback-01.v1");
      channel.onmessage = (event) => {
        const request = event.data as Record<string, unknown>;
        received.push(request);
        channel.postMessage({
          version: 1, kind: "apply-ack", requestId: request.requestId,
          sessionId: request.sessionId, targetId: request.targetId,
          workingPresetId: request.workingPresetId, outcome: "applied",
        });
      };
    });

    const lab = await context.newPage();
    await lab.goto(`${labUrl}?session=c470be42-a482-4eac-b61b-bcfa3aa42110&target=mono.quick-settings-launcher`);
    const storageBefore = await lab.evaluate(() => Object.keys(localStorage).sort());
    await lab.getByRole("button", { name: "Магнит" }).click();
    await lab.getByRole("button", { name: "Применить к локальной примерке MONO" }).click();
    await expect(lab.locator('p[role="status"]')).toContainText("MONO подтвердил применение");
    const requests = await host.evaluate(() => (window as Window & { motionRequests?: unknown[] }).motionRequests);
    expect(requests).toHaveLength(1);
    expect(requests![0]).toMatchObject({ kind: "apply-request", targetId: "mono.quick-settings-launcher", preset: { effectId: "magnetic" } });
    expect(await lab.evaluate(() => Object.keys(localStorage).sort())).toEqual(storageBefore);
  } finally {
    await context.close();
  }
});

test("Lab keeps Apply unavailable without a valid launch and reports a missing host", async ({ page }) => {
  await page.goto(`${labUrl}?session=c470be42-a482-4eac-b61b-bcfa3aa42110&target=wallet.transfer`);
  await expect(page.getByRole("button", { name: "Применить к локальной примерке MONO" })).toHaveCount(0);
  await page.goto(`${labUrl}?session=c470be42-a482-4eac-b61b-bcfa3aa42110&target=mono.quick-settings-launcher`);
  await page.getByRole("button", { name: "Применить к локальной примерке MONO" }).click();
  await expect(page.locator('p[role="status"]')).toContainText("MONO не ответил");
});

test("an acknowledgement from another target cannot claim Apply success", async ({ browser }) => {
  const context = await browser.newContext();
  try {
    const other = await context.newPage();
    await other.goto(labUrl);
    await other.evaluate(() => {
      const channel = new BroadcastChannel("novex.motion-lab.control-feedback-01.v1");
      channel.onmessage = (event) => {
        const request = event.data as Record<string, unknown>;
        channel.postMessage({
          version: 1, kind: "apply-ack", requestId: request.requestId,
          sessionId: request.sessionId, targetId: "mono.other",
          workingPresetId: request.workingPresetId, outcome: "applied",
        });
      };
    });
    const lab = await context.newPage();
    await lab.goto(`${labUrl}?session=c470be42-a482-4eac-b61b-bcfa3aa42110&target=mono.quick-settings-launcher`);
    await lab.getByRole("button", { name: "Применить к локальной примерке MONO" }).click();
    await expect(lab.locator('p[role="status"]')).toContainText("MONO не ответил");
  } finally {
    await context.close();
  }
});
