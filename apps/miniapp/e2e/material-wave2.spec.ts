import { expect, test } from "@playwright/test";

test("Design Lab opens its workshops and preserves the old Motion launch URL", async ({ page }) => {
  await page.goto("/design-lab");
  await expect(page.getByRole("heading", { name: "Лаборатория" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Фоны/ }).first()).toHaveAttribute("href", "/design-lab/atmosphere");
  await expect(page.getByRole("link", { name: /Кнопки/ }).first()).toHaveAttribute("href", "/design-lab/buttons");
  for (const width of [320, 390, 430, 480]) {
    await page.setViewportSize({ width, height: 800 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
    const action = await page.getByRole("navigation", { name: "Мастерские" }).getByRole("link", { name: "Фоны" }).boundingBox();
    expect(action?.height).toBeGreaterThanOrEqual(44);
  }
  await page.goto("/design-lab/motion");
  await expect(page.getByRole("heading", { name: /Один объект/ })).toBeVisible();
  await page.goto("/design-lab?session=invalid&target=mono.quick-actions");
  await expect(page.getByRole("heading", { name: /Один объект/ })).toBeVisible();
  await page.goto("/mono");
  await page.getByRole("button", { name: "Открыть быстрые настройки" }).click();
  await expect(page.getByRole("link", { name: /Design Lab · Фоны и кнопки/ })).toHaveAttribute("href", "/design-lab");
});

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
    return { label: worstCaseWhiteContrast(label), iconBackgroundAlpha: rgba(getComputedStyle(icon).backgroundColor)[3],
      svgOpacity: Number(getComputedStyle(icon.querySelector("svg")!).opacity) };
  });
  expect(contrast.label).toBeGreaterThanOrEqual(4.5);
  expect(contrast.iconBackgroundAlpha).toBe(0);
  expect(contrast.svgOpacity).toBe(0);
  await page.getByRole("button", { name: "Пауза" }).click();
  const metalIcon = await send.locator(".mono-actions__icon").screenshot();
  await page.getByRole("combobox", { name: "Материал" }).selectOption("gem-smoke");
  await expect(send).toHaveAttribute("data-material-icon-presented", "true");
  const smokeIcon = await send.locator(".mono-actions__icon").screenshot();
  const iconDifference = await page.evaluate(async ([metal, smoke]) => {
    async function pixels(base64: string) {
      const image = await createImageBitmap(await (await fetch(`data:image/png;base64,${base64}`)).blob());
      const canvas = document.createElement("canvas"); canvas.width = image.width; canvas.height = image.height;
      const context = canvas.getContext("2d")!; context.drawImage(image, 0, 0);
      return context.getImageData(0, 0, canvas.width, canvas.height).data;
    }
    const a = await pixels(metal), b = await pixels(smoke);
    let changed = 0, total = 0;
    for (let i = 0; i < a.length; i += 4) {
      const delta = Math.max(Math.abs(a[i]! - b[i]!), Math.abs(a[i + 1]! - b[i + 1]!),
        Math.abs(a[i + 2]! - b[i + 2]!));
      if (delta > 24) changed++;
      total += delta;
    }
    return { changed, average: total / (a.length / 4) };
  }, [metalIcon.toString("base64"), smokeIcon.toString("base64")] as const);
  expect(iconDifference.changed).toBeGreaterThanOrEqual(70);
  expect(iconDifference.average).toBeGreaterThanOrEqual(10);
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

test("button drafts survive Save, Apply, Cancel, Undo and reload without entering the background library", async ({ page }) => {
  await page.goto("/design-lab/buttons");
  await expect(page.getByRole("button", { name: "Сохранить", exact: true })).toBeEnabled();
  const scene = page.locator("[data-material-scene]");
  await page.getByRole("tab", { name: "Поверхность" }).click();
  await page.getByRole("combobox", { name: "Материал" }).selectOption("liquid-metal");
  await expect(scene.locator('[data-material-fill-presented="true"]')).toHaveCount(4);
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  const nameDialog = page.getByRole("dialog", { name: "Сохранить пробу" });
  await nameDialog.getByRole("textbox", { name: "Имя пробы" }).fill("QA · четыре кнопки");
  await nameDialog.getByRole("button", { name: "Сохранить пробу" }).click();
  await expect(nameDialog).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("wallet4i7.button-sandbox.library.v1") ?? "null")?.trials?.length)).toBe(1);
  expect(await page.evaluate(() => localStorage.getItem("wallet4i7.background-sandbox.library.v3"))).toBeNull();

  await page.getByRole("button", { name: "Применить", exact: true }).click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("wallet4i7.button-sandbox.accepted.v1"))).not.toBeNull();
  await page.getByRole("combobox", { name: "Материал" }).selectOption("");
  await expect(scene.locator('[data-material-fill-presented="true"]')).toHaveCount(0);
  await page.getByRole("button", { name: "Отменить", exact: true }).click();
  await expect(scene.locator('[data-material-fill-presented="true"]')).toHaveCount(4);
  await page.getByRole("combobox", { name: "Материал" }).selectOption("");
  await page.getByRole("button", { name: "Отменить пробу" }).click();
  await expect(scene.locator('[data-material-fill-presented="true"]')).toHaveCount(4);

  await page.reload();
  await expect(page.getByRole("button", { name: "Сохранить", exact: true })).toBeEnabled();
  await expect(page.locator('[data-material-fill-presented="true"]')).toHaveCount(4);
  await page.getByRole("button", { name: "Открыть", exact: true }).click();
  const library = page.getByRole("dialog", { name: /Библиотека/ });
  await expect(library).toContainText("QA · четыре кнопки");
  await library.getByRole("button", { name: "Закрепить «QA · четыре кнопки» как A" }).click();
  await library.getByRole("button", { name: "Закрыть диалог" }).click();
  await page.getByRole("button", { name: "A", exact: true }).click();
  await expect(page.getByRole("button", { name: "A", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "B", exact: true }).click();
  await expect(page.getByRole("button", { name: "B", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("shared material canvas recovers after WebGL context loss without duplicating itself", async ({ page }) => {
  await page.goto("/design-lab/buttons");
  const scene = page.locator("[data-material-scene]");
  await expect(scene).toHaveAttribute("data-gpu-phase", "running", { timeout: 30_000 });
  const canvas = scene.locator("canvas[data-material-canvas]");
  await expect(canvas).toHaveCount(1);
  const supported = await canvas.evaluate(element => {
    const gl = (element as HTMLCanvasElement).getContext("webgl2");
    const extension = gl?.getExtension("WEBGL_lose_context");
    (window as unknown as { materialLoss?: { restoreContext(): void } }).materialLoss = extension ?? undefined;
    extension?.loseContext();
    return Boolean(extension);
  });
  expect(supported).toBe(true);
  await expect(scene).toHaveAttribute("data-gpu-phase", "lost");
  await canvas.evaluate(() => (window as unknown as { materialLoss: { restoreContext(): void } }).materialLoss.restoreContext());
  await expect(scene).toHaveAttribute("data-gpu-phase", "running", { timeout: 30_000 });
  await expect(scene.locator("canvas[data-material-canvas]")).toHaveCount(1);
  await expect(scene.locator("[data-material-target]")).toHaveCount(4);
});

test("background edge finish survives named Save, Open, reload, Undo and A/B in its own library", async ({ page }) => {
  await page.goto("/design-lab/atmosphere");
  await expect(page.getByRole("button", { name: "Сохранить", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Края" }).click();
  const darkening = page.getByRole("spinbutton", { name: "Затемнение боков — значение" });
  await darkening.fill("0.45");
  await darkening.press("Tab");
  await expect(darkening).toHaveValue("0.45");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  const nameDialog = page.getByRole("dialog", { name: "Сохранить пробу" });
  await nameDialog.getByRole("textbox", { name: "Имя пробы" }).fill("QA · живой фон");
  await nameDialog.getByRole("button", { name: "Сохранить пробу" }).click();
  await expect(nameDialog).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("wallet4i7.background-sandbox.library.v3") ?? "null")?.trials?.[0]?.recipe?.edgeFinish?.sideDarkening)).toBe(0.45);
  expect(await page.evaluate(() => localStorage.getItem("wallet4i7.button-sandbox.library.v1"))).toBeNull();
  await page.reload();
  await expect(page.getByRole("button", { name: "Сохранить", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Края" }).click();
  const recovered = page.getByRole("spinbutton", { name: "Затемнение боков — значение" });
  await expect(recovered).toHaveValue("0.45");
  await recovered.fill("0.20");
  await recovered.press("Tab");
  await expect.poll(async () => Number(await recovered.inputValue())).toBe(0.2);
  await page.getByRole("button", { name: "Отменить", exact: true }).click();
  await expect(recovered).toHaveValue("0.45");
  await page.getByRole("button", { name: "Открыть библиотеку" }).click();
  const library = page.getByRole("dialog", { name: "Библиотека проб" });
  await expect(library).toContainText("QA · живой фон");
  await library.getByRole("button", { name: "Закрепить «QA · живой фон» как A" }).click();
  await library.getByRole("button", { name: "Закрыть диалог" }).click();
  await page.getByRole("button", { name: "Показать A" }).click();
  await expect(page.getByRole("button", { name: "Показать A" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Показать B" }).click();
  await expect(page.getByRole("button", { name: "Показать B" })).toHaveAttribute("aria-pressed", "true");
});

test.describe("Fluid touch in the shared scene", () => {
  test.use({ hasTouch: true });

  test("tap and horizontal drag paint while vertical swipe scrolls MONO", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", error => pageErrors.push(error.message));
    await page.goto("/design-lab/atmosphere");
    await expect(page.getByRole("button", { name: "Сохранить", exact: true })).toBeEnabled();
    await page.getByRole("button", { name: "Движение", exact: true }).click();
    await page.getByRole("combobox", { name: "Режим" }).selectOption("draw");
    const stage = page.getByRole("region", { name: "Сцена материала" });
    const scene = stage.locator("[data-material-scene]");
    await expect(scene).toHaveAttribute("data-gpu-phase", "running", { timeout: 30_000 });
    const canvas = scene.locator("canvas[data-material-canvas]");
    const client = await page.context().newCDPSession(page);
    const rect = await canvas.boundingBox();
    expect(rect).not.toBeNull();
    const x = rect!.x + rect!.width * 0.42, y = rect!.y + rect!.height * 0.45;
    const beforeTap = await canvas.screenshot();
    await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, id: 1 }] });
    await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await page.waitForTimeout(250);
    expect(beforeTap.equals(await canvas.screenshot())).toBe(false);

    await page.getByRole("button", { name: "Перезапустить" }).click();
    await expect(scene).toHaveAttribute("data-gpu-phase", "running", { timeout: 30_000 });
    const beforeDrag = await canvas.screenshot();
    await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, id: 2 }] });
    for (const dx of [20, 45, 80]) await client.send("Input.dispatchTouchEvent", {
      type: "touchMove", touchPoints: [{ x: x + dx, y, id: 2 }],
    });
    await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await page.waitForTimeout(250);
    expect(beforeDrag.equals(await canvas.screenshot())).toBe(false);

    await page.getByRole("combobox", { name: "Формат сцены" }).selectOption("mono");
    await expect(stage).toHaveAttribute("data-mode", "mono");
    await expect(scene).toHaveAttribute("data-gpu-phase", "running", { timeout: 30_000 });
    const phone = await stage.boundingBox();
    expect(phone).not.toBeNull();
    const sx = phone!.x + phone!.width * 0.5, sy = phone!.y + 320;
    await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: sx, y: sy, id: 3 }] });
    for (const dy of [35, 80, 150]) await client.send("Input.dispatchTouchEvent", {
      type: "touchMove", touchPoints: [{ x: sx, y: sy - dy, id: 3 }],
    });
    await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect.poll(() => stage.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
    expect(pageErrors).toEqual([]);
    await client.detach();
  });
});
