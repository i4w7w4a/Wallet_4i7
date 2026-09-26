import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 });

const selectedText = (page: import("@playwright/test").Page) => page.evaluate(() => window.getSelection()?.toString() ?? "");

test("dragging across a display heading does not create a text selection", async ({ page }) => {
  await page.goto("/mono");
  await expect(page.getByRole("button", { name: /Пресет оформления: Первый · перелив/ })).toBeEnabled();
  const box = await page.locator(".mono-balance__heading h1").boundingBox();
  if (!box) throw new Error("Balance heading has no layout box");
  await page.mouse.move(box.x + 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 2, box.y + box.height / 2, { steps: 12 });
  await page.mouse.up();
  expect(await selectedText(page)).toBe("");
});

test("MONO display text resists genuine double click and drag selection while export JSON stays selectable", async ({ page }) => {
  await page.goto("/mono");
  await expect(page.getByRole("button", { name: /Пресет оформления: Первый · перелив/ })).toBeEnabled();
  const title = page.locator(".mono-balance__heading h1");
  await title.dblclick();
  expect(await selectedText(page)).toBe("");

  const box = await title.boundingBox();
  if (!box) throw new Error("Balance heading has no layout box");
  await page.mouse.click(box.x - 8, box.y - 8);
  await page.mouse.move(box.x + 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 2, box.y + box.height / 2, { steps: 12 });
  await page.mouse.up();
  expect(await selectedText(page)).toBe("");

  await page.getByRole("button", { name: "Действия с пресетом" }).click();
  await page.getByRole("button", { name: "Экспортировать" }).click();
  const json = page.getByRole("textbox", { name: "JSON рабочего пресета" });
  await json.click();
  await json.press("ControlOrMeta+A");
  const selection = await json.evaluate(element => {
    const field = element as HTMLTextAreaElement;
    return { start: field.selectionStart, end: field.selectionEnd, length: field.value.length };
  });
  expect(selection.start).toBe(0);
  expect(selection.end).toBe(selection.length);
  expect(selection.length).toBeGreaterThan(100);
});

test("the public viewer and button workshop chrome resist text selection", async ({ page }) => {
  const savedLink = readFileSync(resolve(process.cwd(), "src/mono-preview/fixtures/f979-share-v1.txt"), "utf8").trim();
  await page.goto(`/mono/view${new URL(savedLink).hash}`);
  const viewerHeading = page.locator("[data-mono-viewer] .mono-balance__heading h1");
  await expect(viewerHeading).toBeVisible();
  await viewerHeading.dblclick();
  expect(await selectedText(page)).toBe("");

  await page.goto("/design-lab/buttons");
  const workshopHeading = page.getByRole("heading", { name: "Новая проба кнопок" });
  await expect(workshopHeading).toBeVisible();
  await workshopHeading.dblclick();
  expect(await selectedText(page)).toBe("");
});
