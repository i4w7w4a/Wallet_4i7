import { expect, test } from "@playwright/test";

test.skip(!process.env.NOVEX_MOTION_LAB_E2E, "Motion Lab is a dev-only route");

test("opens the separate Lab and applies one material draft to all four quick actions", async ({ page, context }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/mono");
  await expect(page.getByRole("button", { name: /Пресет оформления/ })).toBeEnabled();

  const opened = context.waitForEvent("page");
  await page.getByRole("link", { name: /Открыть Motion Lab/ }).click();
  const lab = await opened;
  await expect(lab).toHaveURL(/\/design-lab\?session=.*target=mono\.quick-actions/);
  await lab.getByRole("button", { name: "Материал" }).click();
  await lab.getByRole("spinbutton", { name: "Глубина нажатия" }).fill("2.7");
  await lab.getByRole("spinbutton", { name: "Мягкость возврата" }).fill("270");
  await lab.getByRole("button", { name: "Применить к локальной примерке MONO" }).click();
  await expect(lab.locator('p[role="status"]')).toContainText("MONO подтвердил применение");

  const actions = page.locator(".mono-actions__item");
  await expect(actions).toHaveCount(4);
  for (const action of await actions.all()) {
    await expect(action).toHaveAttribute("data-control-effect", "material");
    await expect(action).toHaveCSS("--press-depth", "2.7px");
  }
  await page.bringToFront();
  const send = page.getByRole("button", { name: /^Отправить/ });
  await send.scrollIntoViewIfNeeded();
  await expect.poll(() => send.evaluate((element) =>
    element.closest(".mono-actions")?.getAnimations({ subtree: true })
      .some((animation) => animation.playState === "running") ?? false)).toBe(false);
  const iconY = () => send.locator(".mono-actions__icon").evaluate((element) =>
    new DOMMatrixReadOnly(getComputedStyle(element).transform).m42);
  const box = await send.boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await expect.poll(iconY).toBeLessThan(-0.8);
  const restingY = await iconY();
  await page.mouse.down();
  await expect.poll(iconY).toBeGreaterThan(2.3);
  await page.mouse.up();
  await expect.poll(async () => Math.abs((await iconY()) - restingY)).toBeLessThan(0.2);
});

test("magnetic draft moves only a quick action label and settles after pointer leave", async ({ page, context }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/mono");
  await expect(page.getByRole("button", { name: /Пресет оформления/ })).toBeEnabled();
  const opened = context.waitForEvent("page");
  await page.getByRole("link", { name: /Открыть Motion Lab/ }).click();
  const lab = await opened;
  await lab.getByRole("button", { name: "Магнит" }).click();
  await lab.getByRole("spinbutton", { name: "Ход магнитного слоя" }).fill("6");
  await lab.getByRole("button", { name: "Применить к локальной примерке MONO" }).click();
  await expect(lab.locator('p[role="status"]')).toContainText("MONO подтвердил применение");

  await page.bringToFront();
  const action = page.getByRole("button", { name: /^Отправить/ });
  await action.scrollIntoViewIfNeeded();
  await expect.poll(() => action.evaluate((element) =>
    element.closest(".mono-actions")?.getAnimations({ subtree: true })
      .some((animation) => animation.playState === "running") ?? false)).toBe(false);
  const box = await action.boundingBox();
  expect(box).not.toBeNull();
  const labelX = () => action.locator(".mono-actions__label").evaluate((element) =>
    new DOMMatrixReadOnly(getComputedStyle(element).transform).m41);
  await page.mouse.move(box!.x + box!.width - 10, box!.y + box!.height / 2, { steps: 5 });
  await expect.poll(labelX).toBeGreaterThan(1);
  expect(await action.boundingBox()).toEqual(box);
  await page.mouse.move(0, 0);
  await expect.poll(async () => Math.abs(await labelX())).toBeLessThan(0.2);
});

test("temporary quick action feedback does not follow a newly created working preset", async ({ page, context }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/mono");
  await expect(page.getByRole("button", { name: /Пресет оформления/ })).toBeEnabled();
  const opened = context.waitForEvent("page");
  await page.getByRole("link", { name: /Открыть Motion Lab/ }).click();
  const lab = await opened;
  await lab.getByRole("button", { name: "Магнит" }).click();
  await lab.getByRole("button", { name: "Применить к локальной примерке MONO" }).click();
  await expect(page.locator(".mono-actions__item").first()).toHaveAttribute("data-control-effect", "magnetic");

  await page.getByRole("button", { name: /Пресет оформления/ }).click();
  await page.getByRole("button", { name: "Создать пресет" }).click();
  await page.getByRole("textbox", { name: "Название пресета" }).fill("Другой образец");
  await page.getByRole("button", { name: "Сохранить пресет" }).click();
  await expect(page.locator(".mono-actions__item").first()).toHaveAttribute("data-control-effect", "material");
});

test("an older Lab tab cannot apply after another session opens", async ({ page, context }) => {
  await page.goto("/mono");
  await expect(page.getByRole("button", { name: /Пресет оформления/ })).toBeEnabled();
  const olderOpened = context.waitForEvent("page");
  await page.getByRole("link", { name: /Открыть Motion Lab/ }).click();
  const olderLab = await olderOpened;
  await page.bringToFront();
  const newerOpened = context.waitForEvent("page");
  await page.getByRole("link", { name: /Открыть Motion Lab/ }).click();
  const newerLab = await newerOpened;

  await olderLab.getByRole("button", { name: "Магнит" }).click();
  await olderLab.getByRole("button", { name: "Применить к локальной примерке MONO" }).click();
  await expect(olderLab.locator('p[role="status"]')).toContainText("Сеанс MONO устарел");
  await expect(page.locator(".mono-actions__item").first()).toHaveAttribute("data-control-effect", "material");

  await newerLab.getByRole("button", { name: "Магнит" }).click();
  await newerLab.getByRole("button", { name: "Применить к локальной примерке MONO" }).click();
  await expect(newerLab.locator('p[role="status"]')).toContainText("MONO подтвердил применение");
  await expect(page.locator(".mono-actions__item").first()).toHaveAttribute("data-control-effect", "magnetic");
});

test("another MONO tab cannot answer for the originating MONO session", async ({ context }) => {
  const otherMono = await context.newPage();
  await otherMono.goto("/mono");
  await expect(otherMono.getByRole("button", { name: /Пресет оформления/ })).toBeEnabled();
  const originatingMono = await context.newPage();
  await originatingMono.goto("/mono");
  await expect(originatingMono.getByRole("button", { name: /Пресет оформления/ })).toBeEnabled();
  const opened = context.waitForEvent("page");
  await originatingMono.getByRole("link", { name: /Открыть Motion Lab/ }).click();
  const lab = await opened;
  await lab.getByRole("button", { name: "Магнит" }).click();
  await lab.getByRole("button", { name: "Применить к локальной примерке MONO" }).click();
  await expect(lab.locator('p[role="status"]')).toContainText("MONO подтвердил применение");
  await expect(originatingMono.locator(".mono-actions__item").first()).toHaveAttribute("data-control-effect", "magnetic");
  await expect(otherMono.locator(".mono-actions__item").first()).toHaveAttribute("data-control-effect", "material");
});

test("MONO rejects a Lab opened for a previous working preset", async ({ page, context }) => {
  await page.goto("/mono");
  await expect(page.getByRole("button", { name: /Пресет оформления/ })).toBeEnabled();
  const opened = context.waitForEvent("page");
  await page.getByRole("link", { name: /Открыть Motion Lab/ }).click();
  const lab = await opened;

  await page.getByRole("button", { name: /Пресет оформления/ }).click();
  await page.getByRole("button", { name: "Создать пресет" }).click();
  await page.getByRole("textbox", { name: "Название пресета" }).fill("Свежий образец");
  await page.getByRole("button", { name: "Сохранить пресет" }).click();
  await lab.getByRole("button", { name: "Магнит" }).click();
  await lab.getByRole("button", { name: "Применить к локальной примерке MONO" }).click();
  await expect(lab.locator('p[role="status"]')).toContainText("Активный рабочий пресет изменился");
  await expect(page.locator(".mono-actions__item").first()).toHaveAttribute("data-control-effect", "material");
});

test("MONO rejects an Apply addressed to another control", async ({ page, context }) => {
  await page.goto("/mono");
  await expect(page.getByRole("button", { name: /Пресет оформления/ })).toBeEnabled();
  const opened = context.waitForEvent("page");
  await page.getByRole("link", { name: /Открыть Motion Lab/ }).click();
  const originalLab = await opened;
  const wrongUrl = new URL(originalLab.url());
  wrongUrl.searchParams.set("target", "mono.other-control");
  const wrongLab = await context.newPage();
  await wrongLab.goto(wrongUrl.toString());
  await wrongLab.getByRole("button", { name: "Магнит" }).click();
  await wrongLab.getByRole("button", { name: "Применить к локальной примерке MONO" }).click();
  await expect(wrongLab.locator('p[role="status"]')).toContainText("MONO отклонил цель");
  await expect(page.locator(".mono-actions__item").first()).toHaveAttribute("data-control-effect", "material");
});

test("cancel discards the Lab draft without changing MONO", async ({ page, context }) => {
  await page.goto("/mono");
  await expect(page.getByRole("button", { name: /Пресет оформления/ })).toBeEnabled();
  const opened = context.waitForEvent("page");
  await page.getByRole("link", { name: /Открыть Motion Lab/ }).click();
  const lab = await opened;
  await lab.getByRole("button", { name: "Магнит" }).click();
  await lab.getByRole("spinbutton", { name: "Ход магнитного слоя" }).fill("7");
  await lab.getByRole("button", { name: "Отменить изменения" }).click();
  await expect(lab.getByRole("button", { name: "Материал" })).toHaveAttribute("aria-pressed", "true");
  await expect(lab.getByRole("spinbutton", { name: "Глубина нажатия" })).toHaveValue("1.6");
  await expect(page.locator(".mono-actions__item").first()).toHaveAttribute("data-control-effect", "material");
});

test("MONO rejects a bounded request whose preset is outside the schema", async ({ page, context }) => {
  await page.goto("/mono");
  await expect(page.getByRole("button", { name: /Пресет оформления/ })).toBeEnabled();
  const opened = context.waitForEvent("page");
  await page.getByRole("link", { name: /Открыть Motion Lab/ }).click();
  const lab = await opened;
  const outcome = await lab.evaluate(async () => {
    const query = new URL(location.href).searchParams;
    const requestId = crypto.randomUUID();
    const channel = new BroadcastChannel("novex.motion-lab.control-feedback-01.v1");
    try {
      return await new Promise<string>((resolve) => {
        const timer = setTimeout(() => resolve("timeout"), 2000);
        channel.onmessage = (event: MessageEvent<{ kind?: string; requestId?: string; outcome?: string }>) => {
          if (event.data.kind !== "apply-ack" || event.data.requestId !== requestId) return;
          clearTimeout(timer);
          resolve(event.data.outcome ?? "missing-outcome");
        };
        channel.postMessage({
          version: 1, kind: "apply-request", requestId,
          sessionId: query.get("session"), targetId: query.get("target"),
          workingPresetId: query.get("working"),
          preset: {
            schemaVersion: 1, sceneId: "control-feedback-01", implementationVersion: 1,
            effectId: "material", view: "isolated", previewWidth: 390, status: "draft",
            config: { pressDepth: 40, magneticTravel: 5, settleMs: 270 },
          },
        });
      });
    } finally { channel.close(); }
  });
  expect(outcome).toBe("invalid-preset");
  await expect(page.locator(".mono-actions__item").first()).toHaveAttribute("data-control-effect", "material");
});

test("keyboard Space and Enter show material press and only a demo result", async ({ page, context }) => {
  await page.goto("/mono");
  await expect(page.getByRole("button", { name: /Пресет оформления/ })).toBeEnabled();
  const opened = context.waitForEvent("page");
  await page.getByRole("link", { name: /Открыть Motion Lab/ }).click();
  const lab = await opened;
  await lab.getByRole("button", { name: "Материал" }).click();
  await lab.getByRole("spinbutton", { name: "Глубина нажатия" }).fill("2.7");
  await lab.getByRole("button", { name: "Применить к локальной примерке MONO" }).click();
  await expect(lab.locator('p[role="status"]')).toContainText("MONO подтвердил применение");

  await page.bringToFront();
  const send = page.getByRole("button", { name: /^Отправить/ });
  await send.focus();
  const iconY = () => send.locator(".mono-actions__icon").evaluate((element) =>
    new DOMMatrixReadOnly(getComputedStyle(element).transform).m42);
  for (const key of ["Space", "Enter"]) {
    await expect.poll(async () => Math.abs(await iconY())).toBeLessThan(0.2);
    await page.keyboard.down(key);
    await expect.poll(iconY, { message: `${key} держит визуальный нажим` }).toBeGreaterThan(2.3);
    await page.keyboard.up(key);
    await expect(page.getByRole("status", { name: "Статус быстрых действий" }))
      .toContainText("Отправить — операция недоступна в демо.");
  }
  await expect(send).toBeFocused();
  await expect(send).toHaveCSS("outline-style", "solid");
});

test("Lab Save stays separate and temporary Apply returns to the approved default after MONO reload", async ({ page, context }) => {
  await page.goto("/mono");
  await expect(page.getByRole("button", { name: /Пресет оформления/ })).toBeEnabled();
  const workingBefore = await page.evaluate(() => localStorage.getItem("wallet4i7.mono.working-presets.v1"));
  const opened = context.waitForEvent("page");
  await page.getByRole("link", { name: /Открыть Motion Lab/ }).click();
  const lab = await opened;
  await lab.getByRole("button", { name: "Магнит" }).click();
  await lab.getByRole("button", { name: "Сохранить пробу" }).click();
  await expect(lab.locator('p[role="status"]')).toContainText("Проба сохранена только в локальном Motion Lab");
  await expect(page.locator(".mono-actions__item").first()).toHaveAttribute("data-control-effect", "material");
  expect(await page.evaluate(() => localStorage.getItem("wallet4i7.mono.working-presets.v1"))).toBe(workingBefore);

  await lab.getByRole("button", { name: "Применить к локальной примерке MONO" }).click();
  await expect(page.locator(".mono-actions__item").first()).toHaveAttribute("data-control-effect", "magnetic");
  expect(await page.evaluate(() => localStorage.getItem("wallet4i7.mono.working-presets.v1"))).toBe(workingBefore);
  await page.reload();
  await expect(page.locator(".mono-actions__item").first()).toHaveAttribute("data-control-effect", "material");
});

test("applied quick actions keep their target size at canonical widths and a narrow host", async ({ page, context }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/mono");
  await expect(page.getByRole("button", { name: /Пресет оформления/ })).toBeEnabled();
  const opened = context.waitForEvent("page");
  await page.getByRole("link", { name: /Открыть Motion Lab/ }).click();
  const lab = await opened;
  await lab.getByRole("button", { name: "Материал" }).click();
  await lab.getByRole("button", { name: "Применить к локальной примерке MONO" }).click();
  await expect(page.locator(".mono-actions__item").first()).toHaveAttribute("data-control-effect", "material");

  for (const width of [320, 390, 430, 480]) {
    await page.getByRole("button", { name: `Экран ${width} пикселей` }).click();
    const previewBox = await page.locator("[data-mono-preview]").boundingBox();
    expect(Math.round(previewBox!.width)).toBe(width);
    for (const action of await page.locator(".mono-actions__item").all()) {
      const box = await action.boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
  }
  await page.setViewportSize({ width: 320, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test("touch can open the Lab and try a quick action without an operation", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  try {
    const mono = await context.newPage();
    await mono.goto("http://127.0.0.1:3118/mono");
    await mono.getByRole("button", { name: "Открыть быстрые настройки" }).tap();
    await expect(mono.getByRole("button", { name: /Пресет оформления/ })).toBeEnabled();
    const opened = context.waitForEvent("page");
    await mono.getByRole("link", { name: /Открыть Motion Lab/ }).tap();
    const lab = await opened;
    await lab.getByRole("button", { name: "Материал" }).tap();
    await lab.getByRole("button", { name: "Применить к локальной примерке MONO" }).tap();
    await expect(lab.locator('p[role="status"]')).toContainText("MONO подтвердил применение");

    await mono.getByRole("button", { name: "Открыть быстрые настройки" }).tap();
    const send = mono.getByRole("button", { name: /^Отправить/ });
    await expect(send).toHaveAttribute("data-control-effect", "material");
    await send.tap();
    await expect(mono.getByRole("status", { name: "Статус быстрых действий" }))
      .toContainText("Отправить — операция недоступна в демо.");
    expect(await mono.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  } finally { await context.close().catch(() => {}); }
});

test("reduced motion keeps magnetic and material feedback static", async ({ page, context }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/mono");
  await expect(page.getByRole("button", { name: /Пресет оформления/ })).toBeEnabled();
  const opened = context.waitForEvent("page");
  await page.getByRole("link", { name: /Открыть Motion Lab/ }).click();
  const lab = await opened;
  await lab.getByRole("button", { name: "Магнит" }).click();
  await lab.getByRole("button", { name: "Применить к локальной примерке MONO" }).click();
  await expect(page.locator(".mono-actions__item").first()).toHaveAttribute("data-control-effect", "magnetic");

  await page.bringToFront();
  const send = page.getByRole("button", { name: /^Отправить/ });
  await send.scrollIntoViewIfNeeded();
  const box = await send.boundingBox();
  await page.mouse.move(box!.x + box!.width - 10, box!.y + box!.height / 2);
  const labelX = await send.locator(".mono-actions__label").evaluate((element) =>
    new DOMMatrixReadOnly(getComputedStyle(element).transform).m41);
  expect(labelX).toBe(0);

  await lab.getByRole("button", { name: "Материал" }).click();
  await lab.getByRole("spinbutton", { name: "Глубина нажатия" }).fill("2.7");
  await lab.getByRole("button", { name: "Применить к локальной примерке MONO" }).click();
  await expect(send).toHaveAttribute("data-control-effect", "material");
  await page.mouse.down();
  const iconY = await send.locator(".mono-actions__icon").evaluate((element) =>
    new DOMMatrixReadOnly(getComputedStyle(element).transform).m42);
  expect(iconY).toBe(0);
  await page.mouse.up();
});
