import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Locator } from "@playwright/test";

test.skip(!process.env.MONO_FONT_LAB_BASE_URL, "Run against the dedicated development server.");
test.use({ reducedMotion: "reduce" });
const adapter = readFileSync(path.resolve("src/mono-preview/mono-typography-scene.css"), "utf8");
// Explicit host token fixture; model → tokens is covered separately by unit tests.
const onest = '"Mono Onest", "Mono Plex Sans", Arial, sans-serif';
const plex = '"Mono Plex Sans", "Mono Onest", Arial, sans-serif';
const tokens = {
  "--mono-type-body-family": onest, "--mono-type-body-size": "17px", "--mono-type-body-weight": "450",
  "--mono-type-balance-family": plex, "--mono-type-balance-size": "52px", "--mono-type-balance-weight": "620",
  "--mono-type-button-family": plex, "--mono-type-button-size": "15px", "--mono-type-button-weight": "650",
  "--mono-type-menu-family": onest, "--mono-type-menu-size": "13px", "--mono-type-menu-weight": "750",
  "--mono-type-label-family": plex, "--mono-type-label-size": "14px", "--mono-type-label-weight": "500",
  "--mono-type-mono-family": plex, "--mono-type-mono-size": "12px", "--mono-type-mono-weight": "400",
  "--mono-type-section-size": "24px", "--mono-type-row-value-size": "18px",
  "--mono-type-body-line-height": "1.5", "--mono-type-label-tracking": "0.07em",
  "--mono-type-numeric-features": '"tnum" 1, "lnum" 1', "--mono-type-numeric-variant": "tabular-nums lining-nums",
  "--mono-font-ui": onest, "--mono-font-display": onest, "--mono-font-numeric": plex, "--mono-font-mono": plex,
  "--mono-font-weight-body": "450", "--mono-font-weight-medium": "650", "--mono-font-weight-strong": "600", "--mono-font-weight-balance": "620",
};

async function textStyle(node: Locator) {
  return node.evaluate(element => {
    const style = getComputedStyle(element);
    return { family: style.fontFamily, size: style.fontSize, weight: style.fontWeight,
      lineHeight: style.lineHeight, tracking: style.letterSpacing, variant: style.fontVariantNumeric };
  });
}

async function putTokens(root: Locator, variables: Record<string, string> = tokens) {
  await root.evaluate((element, variables) => {
    for (const [name, value] of Object.entries(variables)) if (name.startsWith("--mono-"))
      (element as HTMLElement).style.setProperty(name, String(value));
  }, variables);
}

test("opts real MonoScene roles in without altering legacy or Material geometry", async ({ page }) => {
  await page.goto("/mono");
  const root = page.locator(".mono-page");
  await expect(root.locator(".mono-actions__label")).toHaveCount(4);
  await page.getByRole("button", { name: "Экран 320 пикселей" }).click();
  await expect(root).toHaveCSS("width", "320px");
  const body = root.locator(".mono-app-header__person strong");
  const button = root.locator(".mono-actions__label").first();
  const menu = root.locator(".mono-nav__item span").first();
  const label = root.locator(".mono-hero__heading-row h1");
  const numeric = root.locator(".mono-assets__value strong").first();
  const quantity = root.locator(".mono-assets__name small").first();
  // The frame width and its dependent container-query styles settle separately.
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  const baseline = await Promise.all([body, button, menu, label, numeric, quantity].map(textStyle));
  await page.addStyleTag({ content: adapter });
  expect(await Promise.all([body, button, menu, label, numeric, quantity].map(textStyle))).toEqual(baseline);

  const originalStyle = await root.getAttribute("style");
  await putTokens(root);
  const material = () => root.locator(".mono-actions__item").first().evaluate(element => {
    const style = getComputedStyle(element);
    return [style.height, style.padding, style.borderRadius, style.transform, style.getPropertyValue("--press-depth")];
  });
  const beforeMaterial = await material();
  const beforeBalance = await textStyle(root.locator(".mono-hero__amount"));
  await root.evaluate(element => { (element as HTMLElement).dataset.monoTypography = "true"; });

  expect(await textStyle(root)).toMatchObject({ size: "17px", weight: "450", lineHeight: "25.5px" });
  expect(await textStyle(body)).toMatchObject({ family: onest, size: "17px", weight: "450" });
  expect(await textStyle(button)).toMatchObject({ family: plex, weight: "650" });
  expect(parseFloat((await textStyle(button)).size)).toBeGreaterThanOrEqual(12);
  expect(parseFloat((await textStyle(button)).size)).toBeLessThanOrEqual(15);
  expect(await textStyle(menu)).toMatchObject({ family: onest, size: "13px", weight: "750" });
  expect(await textStyle(label)).toMatchObject({ family: plex, size: "14px", weight: "500", tracking: "0.98px" });
  expect(await textStyle(numeric)).toMatchObject({ family: plex, size: "18px", weight: "620", variant: "lining-nums tabular-nums" });
  expect(await textStyle(quantity)).toMatchObject({ family: plex, size: "14px" });
  expect(await material()).toEqual(beforeMaterial);
  const afterBalance = await textStyle(root.locator(".mono-hero__amount"));
  expect([afterBalance.size, afterBalance.lineHeight, afterBalance.tracking])
    .toEqual([beforeBalance.size, beforeBalance.lineHeight, beforeBalance.tracking]);
  expect(await root.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.evaluate(async () => { await document.fonts.ready; });
  await page.screenshot({ path: "test-results/mono-font-lab/mono-scene-roles-320.png", fullPage: true });

  // Reachable upper control bounds in the widest curated UI direction.
  await page.addStyleTag({ content: readFileSync(path.resolve("src/mono-preview/mono-font-candidates.css"), "utf8") });
  const wide = '"Mono Manrope", "Mono Plex Mono", Arial, sans-serif';
  const wideTokens: Record<string, string> = { ...tokens,
    "--mono-font-ui": wide, "--mono-font-display": wide, "--mono-font-numeric": wide,
    "--mono-font-mono": '"Mono Plex Mono", "Mono Manrope", monospace',
    "--mono-type-button-size": "16px", "--mono-type-button-weight": "800",
    "--mono-type-menu-size": "15px", "--mono-type-menu-weight": "800", "--mono-font-weight-medium": "800",
  };
  for (const role of ["body", "balance", "button", "menu", "label"]) wideTokens[`--mono-type-${role}-family`] = wide;
  wideTokens["--mono-type-mono-family"] = wideTokens["--mono-font-mono"];
  await putTokens(root, wideTokens);
  expect(await page.evaluate(async () => {
    const loaded = await document.fonts.load('800 16px "Mono Manrope"', "Отправить Получить Профиль");
    await document.fonts.ready;
    return loaded.length;
  })).toBeGreaterThan(0);
  const textBounds = await root.locator(".mono-actions__item, .mono-nav__item").evaluateAll(items => items.map(item => {
    const label = item.querySelector(".mono-actions__label") ?? item.querySelector("span")!;
    const range = document.createRange(); range.selectNodeContents(label);
    const text = range.getBoundingClientRect(), hit = item.getBoundingClientRect();
    const style = getComputedStyle(item);
    return { label: label.textContent, left: text.left - hit.left, right: hit.right - text.right,
      insetLeft: parseFloat(style.paddingLeft), insetRight: parseFloat(style.paddingRight) };
  }));
  for (const bounds of textBounds) {
    expect(bounds.left, `${bounds.label} left edge`).toBeGreaterThanOrEqual(bounds.insetLeft);
    expect(bounds.right, `${bounds.label} right edge`).toBeGreaterThanOrEqual(bounds.insetRight);
  }
  expect(await material()).toEqual(beforeMaterial);
  expect(await textStyle(button)).toMatchObject({ family: wide, weight: "800" });
  expect(await textStyle(menu)).toMatchObject({ family: wide, size: "15px", weight: "800" });
  await page.screenshot({ path: "test-results/mono-font-lab/mono-scene-manrope-max-320.png", fullPage: true });

  await root.evaluate((element, style) => {
    element.removeAttribute("data-mono-typography");
    if (style === null) element.removeAttribute("style"); else element.setAttribute("style", style);
  }, originalStyle);
  expect(await Promise.all([body, button, menu, label, numeric, quantity].map(textStyle))).toEqual(baseline);
});

test("maps new domain components while preserving balance fit and fraction styling", async ({ page }) => {
  await page.goto("/design-lab/scene?format-probe=1");
  await page.getByRole("button", { name: "Ширина 320" }).click();
  const root = page.locator(".mono-scene-lab__scene");
  await expect(root.locator(".mono-balance__amount")).toBeVisible();
  // Existing components are rendered by their own lab. Only supply the future
  // host boundary in this test; never copy component markup or implementation.
  await root.evaluate(element => element.classList.add("mono-page"));
  await putTokens(root);
  const fitting = () => root.locator(".mono-balance").evaluate(element => {
    const host = getComputedStyle(element);
    const amount = getComputedStyle(element.querySelector(".mono-balance__amount")!);
    const fraction = getComputedStyle(element.querySelector('[data-number-part="fraction"]')!);
    return [host.getPropertyValue("--mono-balance-fit"), host.getPropertyValue("--mono-balance-fraction-scale"),
      amount.fontSize, amount.lineHeight, amount.letterSpacing, fraction.fontSize, fraction.color];
  });
  const beforeFit = await fitting();
  await page.addStyleTag({ content: adapter });
  expect(await fitting()).toEqual(beforeFit);
  await root.evaluate(element => { (element as HTMLElement).dataset.monoTypography = "true"; });
  expect(await fitting()).toEqual(beforeFit);
  expect(await textStyle(root.locator(".mono-asset-list__name strong").first()))
    .toMatchObject({ family: onest, size: "17px", weight: "450", lineHeight: "25.5px" });
  expect(await textStyle(root.locator(".mono-asset-list__value strong").first()))
    .toMatchObject({ family: plex, size: "18px", weight: "620" });
  expect(await textStyle(root.locator(".mono-asset-list__name small").first())).toMatchObject({ family: plex });
  expect(await textStyle(root.locator(".mono-chart-view__heading span").first()))
    .toMatchObject({ family: plex, size: "14px", weight: "500", tracking: "0.98px" });
  expect(await textStyle(root.locator(".mono-chart-view__periods button").first()))
    .toMatchObject({ family: plex, size: "15px", weight: "650" });
  await page.screenshot({ path: "test-results/mono-font-lab/scene-role-adapter.png", fullPage: true });
});
