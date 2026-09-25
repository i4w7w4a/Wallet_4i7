import { expect, test, type Page } from "@playwright/test";
import { openMonoEnvironment } from "./mono-test-helpers";

async function createLightStrataPreset(page: Page) {
  await page.goto("/mono");
  await expect(page.locator("[data-mono-preview]")).toHaveAttribute("data-palette-ready", "true");
  await page.getByRole("button", { name: /Пресет оформления:/ }).click();
  await page.getByRole("button", { name: "Создать пресет" }).click();
  await page.getByRole("textbox", { name: "Название пресета" }).fill("Light Strata");
  await page.getByRole("button", { name: "Сохранить пресет" }).click();
  const fine = await openMonoEnvironment(page);
  await fine.getByRole("button", { name: "Светлая тема", exact: true }).click();
  await fine.getByRole("button", { name: "Слои", exact: true }).click();
  await fine.getByRole("button", { name: "Применить настройку", exact: true }).click();
  await expect(page.locator(".mono-page[data-mono-theme='light'][data-mono-background='strata']")).toBeVisible();
  await expect(page.locator(".mono-working-preset__status")).toContainText("Сохранено в этом браузере");
}

async function applyButtonMaterial(page: Page, layer: "Поверхность" | "Иконка" | "Кромка", effect?: string) {
  await page.goto("/design-lab/buttons");
  await page.getByRole("group", { name: "Редактируемые кнопки" }).getByRole("button", { name: "Отправить" }).click();
  await page.getByRole("tab", { name: layer }).click();
  if (effect) await page.getByRole("combobox", { name: "Материал", exact: true }).selectOption(effect);
  await page.getByRole("button", { name: "В рабочий пресет MONO…" }).click();
  const dialog = page.getByRole("dialog", { name: "Применить материал в MONO" });
  await expect(dialog.getByRole("combobox", { name: "Рабочий пресет" })).toHaveValue(/.+/);
  await dialog.getByRole("button", { name: "Применить в MONO" }).click();
  await expect(dialog.getByRole("status")).toContainText("Light Strata");
  const unloadPrompts: string[] = [];
  const onDialog = (prompt: import("@playwright/test").Dialog) => {
    unloadPrompts.push(prompt.type());
    void prompt.accept();
  };
  page.on("dialog", onDialog);
  await dialog.getByRole("link", { name: "Открыть MONO" }).click();
  page.off("dialog", onDialog);
  expect(unloadPrompts).toEqual([]);
  await expect(page.locator("[data-material-scene]")).toHaveAttribute("data-gpu-phase", "running");
}

test("a button-only material preserves the original light Strata background and action panel", async ({ page }) => {
  await createLightStrataPreset(page);
  const scene = page.locator(".mono-page[data-mono-preset='ledger']");
  await expect(scene).toHaveAttribute("data-mono-theme", "light");
  await expect(scene).toHaveAttribute("data-mono-background", "strata");
  const paint = () => scene.evaluate(element => {
    const panel = element.querySelector(".mono-actions");
    if (!panel) throw new Error("MONO action panel is missing");
    return {
      pageImage: getComputedStyle(element).backgroundImage,
      pageColor: getComputedStyle(element).backgroundColor,
      panelImage: getComputedStyle(panel).backgroundImage,
      panelColor: getComputedStyle(panel).backgroundColor,
    };
  });
  const before = await paint();
  expect(before.pageImage).toContain("repeating-linear-gradient");
  await page.screenshot({ path: test.info().outputPath("light-strata-original.png"), animations: "disabled" });

  await applyButtonMaterial(page, "Кромка");
  await expect(page.locator("[data-mono-product-material][data-mono-effect-background='false']")).toBeVisible();
  const materialScene = page.locator("[data-material-scene][data-material-canvas-layer='foreground']");
  await expect(materialScene).toBeVisible();
  await expect(materialScene).toHaveAttribute("data-gpu-phase", "running");
  await expect(scene.locator(".mono-promo[data-optics='shared-webgl']")).toBeVisible();
  await expect(scene.locator("[data-material-target='quick.send']")).toHaveAttribute("data-material-border-presented", "true");
  await expect.poll(() => scene.locator(".mono-promo-frame").evaluate(node => getComputedStyle(node).opacity)).toBe("1");
  await expect(scene).toHaveAttribute("data-mono-theme", "light");
  await expect(scene).toHaveAttribute("data-mono-background", "strata");
  expect(await paint()).toEqual(before);
  await page.screenshot({ path: test.info().outputPath("light-strata-button-border.png"), animations: "disabled" });
});

test("icon-only then fill and icon keep glyphs, labels, status and Promo above one shared GPU canvas", async ({ page }) => {
  await createLightStrataPreset(page);
  const scene = page.locator(".mono-page[data-mono-preset='ledger']");
  const originalBackground = await scene.evaluate(node => getComputedStyle(node).backgroundImage);
  const originalActions = await scene.locator(".mono-actions").evaluate(node => getComputedStyle(node).backgroundImage);

  await applyButtonMaterial(page, "Иконка", "liquid-metal");
  const send = scene.locator("[data-material-target='quick.send']");
  await expect(send).toHaveAttribute("data-material-icon-presented", "true");
  await expect(send).not.toHaveAttribute("data-material-fill-presented", "true");
  await expect(scene.locator(".mono-promo[data-optics='shared-webgl']")).toBeVisible();
  await expect(scene.locator(".mono-promo__content strong")).toBeVisible();
  await expect(scene.locator(".mono-actions__status")).toBeVisible();
  await expect.poll(() => scene.locator(".mono-actions").evaluate(node => getComputedStyle(node).transform)).toBe("none");
  await expect(page.locator("canvas")).toHaveCount(1);
  expect(await scene.evaluate(node => getComputedStyle(node).backgroundImage)).toBe(originalBackground);
  expect(await scene.locator(".mono-actions").evaluate(node => getComputedStyle(node).backgroundImage)).toBe(originalActions);
  await expect.poll(() => scene.locator(".mono-promo-frame").evaluate(node => getComputedStyle(node).opacity)).toBe("1");
  await page.screenshot({ path: test.info().outputPath("light-strata-icon-only.png"), animations: "disabled" });

  await applyButtonMaterial(page, "Поверхность", "liquid-metal");
  await expect(send).toHaveAttribute("data-material-fill-presented", "true");
  await expect(send).toHaveAttribute("data-material-icon-presented", "true");
  await expect(scene.locator(".mono-promo__content strong")).toBeVisible();
  await expect(scene.locator(".mono-actions__status")).toBeVisible();
  await expect.poll(() => scene.locator(".mono-actions").evaluate(node => getComputedStyle(node).transform)).toBe("none");
  await expect(page.locator("canvas")).toHaveCount(1);
  expect(await scene.evaluate(node => getComputedStyle(node).backgroundImage)).toBe(originalBackground);
  expect(await scene.locator(".mono-actions").evaluate(node => getComputedStyle(node).backgroundImage)).toBe(originalActions);
  await expect.poll(() => scene.locator(".mono-promo-frame").evaluate(node => getComputedStyle(node).opacity)).toBe("1");
  await page.screenshot({ path: test.info().outputPath("light-strata-fill-and-icon.png"), animations: "disabled" });
});

test("background then button Apply survives normal links, direction switch and reload in one working preset", async ({ page }) => {
  await createLightStrataPreset(page);
  await page.goto("/design-lab/atmosphere");
  await page.getByRole("combobox", { name: "Материал", exact: true }).selectOption({ label: "Жидкий металл" });
  await page.getByRole("button", { name: "В рабочий пресет MONO…" }).click();
  const dialog = page.getByRole("dialog", { name: "Применить материал в MONO" });
  await expect(dialog.getByRole("combobox", { name: "Рабочий пресет" })).toHaveValue(/.+/);
  await dialog.getByRole("button", { name: "Применить в MONO" }).click();
  await expect(dialog.getByRole("status")).toContainText("Light Strata");
  const unloadPrompts: string[] = [];
  const onDialog = (prompt: import("@playwright/test").Dialog) => {
    unloadPrompts.push(prompt.type());
    void prompt.accept();
  };
  page.on("dialog", onDialog);
  await dialog.getByRole("link", { name: "Открыть MONO" }).click();
  page.off("dialog", onDialog);
  expect(unloadPrompts).toEqual([]);
  await expect(page.locator("[data-mono-product-material][data-mono-effect-background='true']")).toBeVisible();
  await expect(page.locator("[data-material-scene]")).toHaveAttribute("data-gpu-phase", "running");
  const first = await page.evaluate(() => {
    const library = JSON.parse(localStorage.getItem("wallet4i7.mono.working-presets.v2")!);
    const record = library.records.find((item: { id: string }) => item.id === library.activeId);
    return { name: record.name, revision: record.revision, background: record.document.background,
      effect: record.document.materials.ledger.background?.recipe.effectId,
      buttons: record.document.materials.ledger.buttons?.bindings ?? [],
      frost: record.document.materials.frost };
  });
  expect(first.name).toBe("Light Strata");
  expect(first.background).toBe("strata");
  expect(first.effect).toBe("liquid-metal");
  expect(first.buttons).toEqual([]);
  await page.screenshot({ path: test.info().outputPath("background-applied.png"), animations: "disabled" });

  await applyButtonMaterial(page, "Кромка");
  const second = await page.evaluate(() => {
    const library = JSON.parse(localStorage.getItem("wallet4i7.mono.working-presets.v2")!);
    const record = library.records.find((item: { id: string }) => item.id === library.activeId);
    return { name: record.name, revision: record.revision, background: record.document.background,
      effect: record.document.materials.ledger.background?.recipe.effectId,
      buttons: record.document.materials.ledger.buttons?.bindings ?? [],
      frost: record.document.materials.frost };
  });
  expect(second.name).toBe(first.name);
  expect(second.background).toBe(first.background);
  expect(second.effect).toBe(first.effect);
  expect(second.revision).toBe(first.revision + 1);
  expect(second.buttons).toHaveLength(1);
  expect(second.buttons[0].targetId).toBe("quick.send");
  expect(second.buttons[0].layer).toBe("border");
  expect(second.frost).toEqual(first.frost);
  await expect(page.locator("[data-mono-product-material][data-mono-effect-background='true']")).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(1);
  await page.getByRole("button", { name: /Frost/ }).click();
  await expect(page.locator(".mono-page")).toHaveAttribute("data-mono-preset", "frost");
  await expect(page.locator("[data-mono-product-material]")).toHaveCount(0);
  await page.getByRole("button", { name: /Ledger/ }).click();
  await expect(page.locator("[data-mono-product-material][data-mono-effect-background='true']")).toBeVisible();
  await page.reload();
  await expect(page.locator("[data-mono-product-material][data-mono-effect-background='true']")).toBeVisible();
  await expect(page.locator("[data-material-scene]")).toHaveAttribute("data-gpu-phase", "running");
  await expect(page.locator("[data-material-target='quick.send']")).toHaveAttribute("data-material-border-presented", "true");
  await expect(page.locator("canvas")).toHaveCount(1);
});

test("a clean stale MONO tab does not block the next material Apply", async ({ page, context }) => {
  await createLightStrataPreset(page);
  const fresh = await context.newPage();
  await applyButtonMaterial(fresh, "Кромка");
  await expect(page.locator(".mono-working-preset__status")).toContainText("Изменён в другой вкладке");
  await applyButtonMaterial(fresh, "Иконка", "liquid-metal");
  await expect(fresh.locator("[data-material-target='quick.send']")).toHaveAttribute("data-material-border-presented", "true");
  await expect(fresh.locator("[data-material-target='quick.send']")).toHaveAttribute("data-material-icon-presented", "true");
  await fresh.close();
});
