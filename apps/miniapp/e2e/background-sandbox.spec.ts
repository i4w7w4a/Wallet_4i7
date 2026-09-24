import { expect, test, type Page } from "@playwright/test";

// Run against ORACLE's cumulative preview. This suite starts no server and does not update visual baselines.
const LIBRARY = "wallet4i7.background-sandbox.library.v1";
const WORKSPACE = "wallet4i7.background-sandbox.workspace.v1";
const PROTECTED = ["wallet4i7.mono.working-presets.v2", "wallet4i7.mono.working-presets.v1", "wallet4i7.mono.atmosphere-lab.v1", "wallet4i7.theme.v1"];

async function open(page: Page) {
  await page.goto("/design-lab/atmosphere");
  await expect(page.locator("[data-background-sandbox]")).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Материал", exact: true })).toHaveValue("silk");
  await expect(page.getByRole("button", { name: "Сохранить", exact: true })).toBeEnabled();
}
async function saveAs(page: Page, name: string, first = false) {
  if (first) await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  else {
    await page.getByRole("button", { name: "Дополнительно", exact: true }).click();
    await page.getByRole("button", { name: "Сохранить как…", exact: true }).click();
  }
  await page.getByRole("textbox", { name: "Имя пробы" }).fill(name);
  await page.getByRole("button", { name: "Сохранить пробу", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("[data-save-status]")).toHaveText("Сохранено");
}
async function library(page: Page) { await page.getByRole("button", { name: "Открыть библиотеку" }).click(); }

test("Silk: two names → switch → return → reload → A/B without product writes", async ({ page }, info) => {
  await page.addInitScript(keys => {
    const marker = "bg-e2e-protected-seeded", log = "bg-e2e-protected-writes";
    const set = Storage.prototype.setItem, remove = Storage.prototype.removeItem, clear = Storage.prototype.clear;
    if (!sessionStorage.getItem(marker)) {
      for (const key of keys) set.call(localStorage, key, "preserve-sandbox-e2e");
      set.call(sessionStorage, marker, "true"); set.call(sessionStorage, log, "[]");
    }
    const record = (operation: string) => set.call(sessionStorage, log, JSON.stringify([
      ...JSON.parse(sessionStorage.getItem(log) ?? "[]"), operation,
    ]));
    Storage.prototype.setItem = function (key, value) {
      if (this === localStorage && keys.includes(key)) record(`set:${key}`);
      return set.call(this, key, value);
    };
    Storage.prototype.removeItem = function (key) {
      if (this === localStorage && keys.includes(key)) record(`remove:${key}`);
      return remove.call(this, key);
    };
    Storage.prototype.clear = function () {
      if (this === localStorage) record("clear");
      return clear.call(this);
    };
  }, PROTECTED);
  await open(page);
  const first = page.getByRole("slider").first();
  const original = await first.inputValue();
  await first.focus(); await first.press("Home"); await first.press("ArrowRight");
  const soft = await first.inputValue();
  await page.getByRole("button", { name: "Отменить", exact: true }).click();
  await expect(first).toHaveValue(await first.getAttribute("min") ?? "0");
  await page.getByRole("button", { name: "Повторить", exact: true }).click();
  await expect(first).toHaveValue(soft);
  await saveAs(page, "Silk · тихий свет", true);
  await first.focus(); await first.press("End");
  const bright = await first.inputValue();
  expect(bright).not.toBe(soft);
  await saveAs(page, "Silk · яркий свет");
  await library(page);
  await page.getByRole("button", { name: "Закрепить «Silk · тихий свет» как A" }).click();
  await page.getByRole("button", { name: "Открыть «Silk · тихий свет»" }).click();
  await expect(first).toHaveValue(soft);
  await library(page);
  await page.getByRole("button", { name: "Открыть «Silk · яркий свет»" }).click();
  await expect(first).toHaveValue(bright);
  await expect.poll(() => page.evaluate(key => {
    const raw = localStorage.getItem(key); return raw ? JSON.parse(raw).slots[0].present.source?.name : null;
  }, WORKSPACE)).toBe("Silk · яркий свет");
  const saved = await page.evaluate(key => localStorage.getItem(key), LIBRARY);
  await page.reload();
  await expect(first).toHaveValue(bright);
  await page.getByRole("button", { name: "Показать A" }).click();
  await expect(first).toBeDisabled();
  await expect(page.locator("canvas")).toHaveCount(1);
  await page.getByRole("button", { name: "Показать B" }).click();
  await expect(first).toHaveValue(bright);
  await expect(page.locator("canvas")).toHaveCount(1);
  expect(await page.evaluate(key => localStorage.getItem(key), LIBRARY)).toBe(saved);
  expect(await page.evaluate(keys => keys.map(key => localStorage.getItem(key)), PROTECTED)).toEqual(PROTECTED.map(() => "preserve-sandbox-e2e"));
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem("bg-e2e-protected-writes") ?? "[]"))).toEqual([]);
  await page.getByRole("button", { name: "Пауза", exact: true }).click();
  await page.screenshot({ path: info.outputPath("silk-sandbox-desktop.png"), fullPage: true });
  await info.attach("acceptance-values", { body: JSON.stringify({ original, soft, bright }), contentType: "application/json" });
});

test("320 / 390 / 430 / 480: clean stage, keyboard modal and real targets", async ({ page }, info) => {
  await open(page);
  await page.getByRole("button", { name: "Пауза", exact: true }).click();
  for (const width of [320, 390, 430, 480]) {
    await page.setViewportSize({ width, height: 900 });
    const stage = page.getByRole("region", { name: "Сцена материала" });
    await expect(stage.locator("[data-mono-logo], .mono-app-header__mark")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const controls = page.locator("[data-background-sandbox] button:visible");
    for (const button of await controls.all()) {
      const box = await button.boundingBox();
      if (box) { expect(box.width).toBeGreaterThanOrEqual(44); expect(box.height).toBeGreaterThanOrEqual(44); }
    }
    const dimensions = await stage.boundingBox();
    expect(dimensions!.width).toBeLessThanOrEqual(width);
    await page.screenshot({ path: info.outputPath(`silk-sandbox-${width}.png`), fullPage: true });
  }
  const save = page.getByRole("button", { name: "Сохранить", exact: true });
  await save.click();
  await expect(page.getByRole("textbox", { name: "Имя пробы" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(save).toBeFocused();
});

test("a stale tab cannot replace the library or claim Saved", async ({ page, context }) => {
  await open(page);
  const other = await context.newPage();
  await other.emulateMedia({ reducedMotion: "reduce" });
  await open(other);
  await saveAs(page, "Первая вкладка", true);
  const before = await page.evaluate(key => localStorage.getItem(key), LIBRARY);
  await other.getByRole("slider").first().focus();
  await other.getByRole("slider").first().press("End");
  await other.getByRole("button", { name: "Сохранить", exact: true }).click();
  await other.getByRole("textbox", { name: "Имя пробы" }).fill("Устаревшая вкладка");
  await other.getByRole("button", { name: "Сохранить пробу", exact: true }).click();
  await expect(other.getByRole("dialog").getByRole("alert")).toContainText("другой вкладке");
  expect(await page.evaluate(key => localStorage.getItem(key), LIBRARY)).toBe(before);
  await other.close();
});
