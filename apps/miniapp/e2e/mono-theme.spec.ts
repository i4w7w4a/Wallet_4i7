import { expect, test, type Page } from "@playwright/test";
import { closeCompactMonoRail, openMonoEnvironment, openMonoRail } from "./mono-test-helpers";

function channels(color: string): [number, number, number] {
  const values = color.match(/[\d.]+/g)?.slice(0, 3).map(Number);
  if (!values || values.length !== 3) throw new Error(`Expected an RGB color, got ${color}`);
  return values as [number, number, number];
}

function luminance(color: string): number {
  const linear = channels(color).map((value) => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

function contrast(foreground: string, background: string): number {
  const pair = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (pair[0] + 0.05) / (pair[1] + 0.05);
}

async function lightPage(page: Page) {
  await page.goto("/mono");
  await expect(page.locator("[data-mono-preview]")).toHaveAttribute("data-palette-ready", "true");
  const fine = await openMonoEnvironment(page);
  await fine.getByRole("button", { name: "Светлая тема", exact: true }).click();
  await expect(page.locator("[data-mono-preview]")).toHaveAttribute("data-mono-theme", "light");
  await closeCompactMonoRail(page, "fine");
}

test("светлая тема имеет тёплую керамическую основу и читаемую графитовую иерархию", async ({ page }) => {
  await lightPage(page);

  const palette = await page.evaluate(() => {
    const style = (selector: string) => getComputedStyle(document.querySelector(selector)!);
    const canvas = style(".mono-page");
    const amount = style(".mono-balance__amount");
    const secondary = style(".mono-balance__heading h1");
    const selected = style('.mono-workbench__directions button[aria-pressed="true"]');
    const promo = style(".mono-promo-frame");
    const promoText = style(".mono-promo__content strong");
    return {
      canvas: canvas.backgroundColor,
      canvasArt: canvas.backgroundImage,
      colorScheme: canvas.colorScheme,
      amount: amount.color,
      secondary: secondary.color,
      selectedBackground: selected.backgroundColor,
      selectedText: selected.color,
      promo: promo.backgroundColor,
      promoText: promoText.color,
    };
  });

  const [red, green, blue] = channels(palette.canvas);
  expect(red).toBeGreaterThan(green);
  expect(green).toBeGreaterThan(blue);
  expect(luminance(palette.canvas)).toBeGreaterThan(0.68);
  expect(luminance(palette.canvas)).toBeLessThan(0.92);
  expect(palette.canvasArt).toContain("radial-gradient");
  expect(palette.colorScheme).toBe("light");
  expect(contrast(palette.amount, palette.canvas)).toBeGreaterThanOrEqual(7);
  expect(contrast(palette.secondary, palette.canvas)).toBeGreaterThanOrEqual(4.5);
  // The tooling lives outside the light phone scene and retains its own neutral dark chrome.
  expect(luminance(palette.selectedBackground)).toBeLessThan(0.08);
  expect(contrast(palette.selectedText, palette.selectedBackground)).toBeGreaterThanOrEqual(4.5);
  expect(luminance(palette.promo)).toBeLessThan(0.08);
  expect(contrast(palette.promoText, palette.promo)).toBeGreaterThanOrEqual(7);
});

test("светлая тема сохраняет читабельность Frost и Mercury без горизонтального переполнения на 320 px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 780 });
  await lightPage(page);
  const quick = await openMonoRail(page, "quick");

  for (const preset of ["Frost", "Mercury"]) {
    await quick.getByRole("button", { name: new RegExp(preset) }).click();
    await closeCompactMonoRail(page, "quick");
    const environment = await openMonoEnvironment(page);
    await environment.getByRole("button", { name: "Светлая тема", exact: true }).click();
    await expect(page.locator("[data-mono-preview]")).toHaveAttribute("data-mono-theme", "light");
    await closeCompactMonoRail(page, "fine");
    const geometry = await page.evaluate(() => {
      const main = document.querySelector(".mono-page")!;
      const hero = document.querySelector(".mono-hero")!;
      const mainStyle = getComputedStyle(main);
      const heroStyle = getComputedStyle(hero);
      return {
        viewport: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        canvas: mainStyle.backgroundColor,
        heroBackdrop: heroStyle.backgroundColor === "rgba(0, 0, 0, 0)"
          ? mainStyle.backgroundColor
          : heroStyle.backgroundColor,
        heroText: getComputedStyle(document.querySelector(".mono-balance__amount")!).color,
      };
    });
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.viewport);
    expect(luminance(geometry.canvas)).toBeGreaterThan(0.68);
    expect(contrast(geometry.heroText, geometry.heroBackdrop)).toBeGreaterThanOrEqual(7);
    if (preset !== "Mercury") await openMonoRail(page, "quick");
  }
});

test("в светлой теме три фона дают разную фактуру, а переключатели остаются контрастными", async ({ page }) => {
  await page.goto("/mono");
  const fine = await openMonoEnvironment(page);
  await fine.getByRole("button", { name: "Светлая тема" }).click();

  const choices = [["Ирис", "iris"], ["Волна", "tide"], ["Слои", "strata"]] as const;
  const artworks: string[] = [];
  for (const [choice, background] of choices) {
    await fine.getByRole("button", { name: choice }).click();
    await expect(page.locator("[data-mono-preview]")).toHaveAttribute("data-mono-background", background);
    if (background !== "iris") {
      const apply = fine.getByRole("button", { name: "Применить настройку", exact: true });
      await expect(apply).toHaveAttribute("aria-disabled", "false");
      await apply.click();
      await expect(apply).toHaveAttribute("aria-disabled", "true");
    }
    artworks.push(await page.locator(".mono-page").evaluate((node) => getComputedStyle(node).backgroundImage));
  }
  expect(new Set(artworks).size).toBe(3);

  const controls = await page.evaluate(() => {
    const selected = getComputedStyle(document.querySelector('.mono-environment__themes button[aria-pressed="true"]')!);
    const idle = getComputedStyle(document.querySelector('.mono-environment__themes button[aria-pressed="false"]')!);
    return {
      selectedBackground: selected.backgroundColor,
      selectedText: selected.color,
      idleBackground: idle.backgroundColor,
      idleText: idle.color,
    };
  });
  expect(contrast(controls.selectedText, controls.selectedBackground)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(controls.idleText, controls.idleBackground)).toBeGreaterThanOrEqual(4.5);
});

test("жемчужное световое поле отвечает fine pointer и не перекрывает интерфейс", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 1024, height: 900 }, hasTouch: false, isMobile: false });
  const page = await context.newPage();
  try {
    await lightPage(page);
    const focus = page.locator(".mono-atmosphere__focus");
    const idleOpacity = Number(await focus.evaluate((node) => getComputedStyle(node).opacity));
    await page.mouse.move(512, 480);
    await expect(page.locator(".mono-page")).toHaveAttribute("data-pointer-active", "true");
    await page.waitForTimeout(240);
    const activeOpacity = Number(await focus.evaluate((node) => getComputedStyle(node).opacity));
    expect(activeOpacity).toBeGreaterThan(idleOpacity + 0.2);
    expect(await focus.evaluate((node) => getComputedStyle(node).pointerEvents)).toBe("none");
  } finally {
    await context.close();
  }
});

test("светлая Promo сохраняет заметную серебряную кромку при наведении", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, hasTouch: false, isMobile: false });
  const page = await context.newPage();
  try {
    await lightPage(page);
    const promo = page.locator(".mono-promo-frame");
    const idleShadow = await promo.evaluate((element) => getComputedStyle(element).boxShadow);
    await promo.hover();
    await expect.poll(() => promo.evaluate((element) => getComputedStyle(element).boxShadow))
      .not.toBe(idleShadow);
    await expect(promo).toHaveCSS("border-right-color", "rgba(0, 0, 0, 0)");
  } finally {
    await context.close();
  }
});
