import { expect, test } from "@playwright/test";
import { openMonoRail } from "./mono-test-helpers";

const STORAGE_KEY = "wallet4i7.mono.environment-preview.v1";
const savedEnvironment = JSON.stringify({ version: 1, theme: "light", background: "tide" });

test("сохранённая светлая среда видна до загрузки React, без тёмного первого кадра", async ({ page }) => {
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), {
    key: STORAGE_KEY,
    value: savedEnvironment,
  });
  await page.route(/\/_next\/static\/.*\.(?:js|mjs)(?:\?|$)/, (route) => route.abort());

  await page.goto("/mono", { waitUntil: "domcontentloaded" });

  const appearance = await page.locator("main[data-mono-preview]").evaluate((node) => {
    const style = getComputedStyle(node);
    return {
      serverTheme: node.getAttribute("data-mono-theme"),
      serverBackground: node.getAttribute("data-mono-background"),
      backgroundColor: style.backgroundColor,
      colorScheme: style.colorScheme,
    };
  });

  // JS bundles are blocked: React cannot be responsible for the first-paint result.
  expect(appearance.serverTheme).toBe("dark");
  expect(appearance.serverBackground).toBe("iris");
  expect(appearance.backgroundColor).toBe("rgb(229, 233, 232)");
  expect(appearance.colorScheme).toBe("light");
  await expect(page.locator("[data-mono-rail]").first()).toBeHidden();
  await expect(page.locator("[data-mono-rail]").last()).toBeHidden();
});

test("после гидратации сохранённые тема и фон совпадают с кнопками без ошибок", async ({ page }) => {
  const hydrationErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && /hydrat|mismatch/i.test(message.text())) {
      hydrationErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    if (/hydrat|mismatch/i.test(error.message)) hydrationErrors.push(error.message);
  });
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), {
    key: STORAGE_KEY,
    value: savedEnvironment,
  });

  await page.goto("/mono");
  const preview = page.locator("main[data-mono-preview]");
  await expect(preview).toHaveAttribute("data-mono-theme", "light");
  await expect(preview).toHaveAttribute("data-mono-background", "tide");
  const fine = await openMonoRail(page, "fine");
  await expect(fine.getByRole("button", { name: "Светлая тема" })).toHaveAttribute("aria-pressed", "true");
  await expect(fine.getByRole("button", { name: "Волна" })).toHaveAttribute("aria-pressed", "true");
  expect(hydrationErrors).toEqual([]);
});

test("черновик Light-палитры виден до гидратации без вспышки исходного цвета", async ({ page }) => {
  await page.goto("/mono");
  const quick = await openMonoRail(page, "quick");
  await quick.getByRole("button", { name: "Включить палитру" }).click();
  await quick.getByRole("button", { name: "Light", exact: true }).click();
  await quick.getByRole("slider", { name: "Тон" }).fill("28");
  await page.waitForTimeout(450);
  const preview = page.locator("main[data-mono-preview]");
  const expected = await preview.evaluate((node) => ({
    background: getComputedStyle(node).background,
    paletteCanvas: getComputedStyle(node).getPropertyValue("--mono-palette-canvas-ff").trim(),
  }));
  expect(expected.paletteCanvas).not.toBe("");

  await page.route(/\/_next\/static\/.*\.(?:js|mjs)(?:\?|$)/, (route) => route.abort());
  await page.reload({ waitUntil: "domcontentloaded" });
  const beforeHydration = await preview.evaluate((node) => ({
    background: getComputedStyle(node).background,
    paletteCanvas: getComputedStyle(node).getPropertyValue("--mono-palette-canvas-ff").trim(),
  }));
  expect(beforeHydration).toEqual(expected);
  expect(await preview.getAttribute("data-mono-theme")).toBe("dark");
});

test("prepaint игнорирует повреждённые и исполняемые значения цвета", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("wallet4i7.mono.palette-prepaint.v1", JSON.stringify({
    version: 1, mode: "light", slotId: 1, paletteEnabled: true,
    tokens: { "--mono-palette-canvas-ff": "url(https://example.invalid/unsafe.css)", "--mono-palette-textPrimary-ff": [9999, 0, 0, 1] },
  })));
  await page.route(/\/_next\/static\/.*\.(?:js|mjs)(?:\?|$)/, (route) => route.abort());
  await page.goto("/mono", { waitUntil: "domcontentloaded" });
  expect(await page.locator("html").evaluate(node => (node as HTMLElement).style.getPropertyValue("--mono-palette-canvas-ff"))).toBe("");
  expect(await page.locator("html").evaluate(node => (node as HTMLElement).style.getPropertyValue("--mono-palette-textPrimary-ff"))).toBe("");
});
