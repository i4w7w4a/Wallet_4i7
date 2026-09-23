import { expect, test } from "@playwright/test";
import { closeCompactMonoRail, openMonoRail } from "./mono-test-helpers";

test("логотип Novex остаётся читаемым на всех ширинах MONO", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto("/mono");

  await expect(page).toHaveTitle("MONO LEDGER — Novex Wallet");
  const logo = page.getByRole("img", { name: "Novex Wallet" });
  await expect(logo).toBeVisible();
  const cornerAlphas = await page.evaluate(async () => {
    const svg = new Image();
    svg.src = "/brand/novex-logo.svg";
    await svg.decode();
    const canvas = document.createElement("canvas");
    canvas.width = svg.naturalWidth;
    canvas.height = svg.naturalHeight;
    const context = canvas.getContext("2d")!;
    context.drawImage(svg, 0, 0);
    return [[0, 0], [canvas.width - 1, 0], [0, canvas.height - 1], [canvas.width - 1, canvas.height - 1]]
      .map(([x, y]) => context.getImageData(x, y, 1, 1).data[3]);
  });
  expect(cornerAlphas, "SVG сохраняет прозрачное поле").toEqual([0, 0, 0, 0]);
  await expect(page.locator(".mono-app-header__person strong")).toHaveText("Демо пользователь");
  await expect(page.locator(".mono-app-header__signal")).toContainText("DEMO");
  await expect(page.locator(".mono-promo__overline")).toHaveText("NOVEX WALLET / PRIVATE");
  await expect(page.locator(".mono-promo__seal")).toBeEmpty();

  for (const variant of ["bare", "plaque"] as const) {
    if (variant === "plaque") {
      await page.setViewportSize({ width: 320, height: 844 });
      const quick = await openMonoRail(page, "quick");
      await quick.getByRole("button", { name: "Логотип с плашкой" }).click();
      await closeCompactMonoRail(page, "quick");
    }
    for (const width of [320, 390, 430, 480, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      const geometry = await page.evaluate(() => {
        const logo = document.querySelector<SVGSVGElement>(".mono-app-header__mark svg")!;
        const mark = document.querySelector<HTMLElement>(".mono-app-header__mark")!;
        const name = document.querySelector<HTMLElement>(".mono-app-header__person strong")!;
        const signal = document.querySelector<HTMLElement>(".mono-app-header__signal")!;
        const markBox = mark.getBoundingClientRect();
        const nameBox = name.getBoundingClientRect();
        const signalBox = signal.getBoundingClientRect();
        return {
          paths: logo.querySelectorAll("path").length,
          variant: document.querySelector<HTMLElement>(".mono-page")!.dataset.monoLogoVariant,
          markRight: markBox.right,
          nameLeft: nameBox.left,
          nameRight: nameBox.right,
          signalLeft: signalBox.left,
          nameContentWidth: name.scrollWidth,
          nameBoxWidth: name.clientWidth,
          previewWidth: document.querySelector<HTMLElement>(".mono-page")!.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
          viewportWidth: document.documentElement.clientWidth,
        };
      });
      expect(geometry.paths, `${width}px: контуры логотипа видны`).toBe(11);
      expect(geometry.variant).toBe(variant);
      expect(geometry.markRight).toBeLessThanOrEqual(geometry.nameLeft);
      expect(geometry.nameRight).toBeLessThanOrEqual(geometry.signalLeft);
      expect(geometry.nameContentWidth, `${width}px: имя не обрезано`).toBeLessThanOrEqual(geometry.nameBoxWidth);
      expect(geometry.previewWidth).toBe(width === 1280 ? 480 : width);
      expect(geometry.scrollWidth, `${width}px: нет горизонтального переполнения`).toBeLessThanOrEqual(geometry.viewportWidth);
    }
  }
});

test("надпись и материал логотипа следуют тёмной и светлой теме", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/mono");
  const preview = page.locator("main[data-mono-preview]");
  const appearance = () => page.evaluate(() => ({
    ink: getComputedStyle(document.querySelector(".mono-logo__wordmark")!).fill,
    icon: getComputedStyle(document.querySelector(".mono-logo__icon-primary")!).fill,
    mark: getComputedStyle(document.querySelector(".mono-app-header__mark")!).backgroundColor,
    canvas: getComputedStyle(document.querySelector(".mono-page")!).backgroundColor,
  }));
  const luminance = (color: string) => {
    const rgb = color.match(/[\d.]+/g)!.slice(0, 3).map(value => Number(value) / 255);
    const linear = rgb.map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  };
  const contrast = (a: string, b: string) => {
    const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (high + 0.05) / (low + 0.05);
  };

  const darkBare = await appearance();
  await expect(preview).toHaveAttribute("data-mono-logo-variant", "bare");
  expect(darkBare.mark).toBe("rgba(0, 0, 0, 0)");
  expect(contrast(darkBare.ink, darkBare.canvas)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(darkBare.icon, darkBare.canvas)).toBeGreaterThanOrEqual(3);

  const quick = await openMonoRail(page, "quick");
  await quick.getByRole("button", { name: "Логотип с плашкой" }).click();
  await closeCompactMonoRail(page, "quick");
  const darkPlaque = await appearance();
  expect(luminance(darkPlaque.mark)).toBeLessThan(0.2);
  expect(contrast(darkPlaque.ink, darkPlaque.mark)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(darkPlaque.icon, darkPlaque.mark)).toBeGreaterThanOrEqual(3);

  const fine = await openMonoRail(page, "fine");
  await fine.getByRole("button", { name: "Светлая тема" }).click();
  await closeCompactMonoRail(page, "fine");
  await expect(preview).toHaveAttribute("data-mono-theme", "light");
  const lightPlaque = await appearance();
  expect(luminance(lightPlaque.mark)).toBeGreaterThan(0.7);
  expect(contrast(lightPlaque.ink, lightPlaque.mark)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(lightPlaque.icon, lightPlaque.mark)).toBeGreaterThanOrEqual(3);

  await openMonoRail(page, "quick");
  await quick.getByRole("button", { name: "Логотип без плашки" }).click();
  await closeCompactMonoRail(page, "quick");
  const lightBare = await appearance();
  expect(lightBare.mark).toBe("rgba(0, 0, 0, 0)");
  expect(contrast(lightBare.ink, lightBare.canvas)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(lightBare.icon, lightBare.canvas)).toBeGreaterThanOrEqual(3);
});

test("свой тон эмблемы включается отдельно от надписи и восстанавливается после reload", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 844 });
  await page.goto("/mono");
  const custom = page.getByRole("checkbox", { name: "Свой цвет эмблемы" });
  const icon = page.locator(".mono-logo__icon-primary").first();
  const wordmark = page.locator(".mono-logo__wordmark").first();
  const initialIcon = await icon.evaluate(node => getComputedStyle(node).fill);
  const initialWordmark = await wordmark.evaluate(node => getComputedStyle(node).fill);

  await expect(custom).not.toBeChecked();
  await expect(page.getByRole("slider", { name: "Тон знака Novex" })).toHaveCount(0);
  await custom.check();
  const hue = page.getByRole("slider", { name: "Тон знака Novex" });
  await expect(hue).toBeVisible();
  await hue.press("Home");
  await expect(hue).toHaveValue("0");
  await expect.poll(() => icon.evaluate(node => getComputedStyle(node).fill)).not.toBe(initialIcon);
  expect(await wordmark.evaluate(node => getComputedStyle(node).fill)).toBe(initialWordmark);
  await page.getByRole("button", { name: "Логотип с плашкой" }).click();

  const saved = await page.evaluate(() => localStorage.getItem("wallet4i7.mono.logo-preview.v1"));
  expect(JSON.parse(saved!)).toEqual({ version: 1, variant: "plaque", customColor: true, hue: 0 });
  await page.reload();
  await expect(custom).toBeChecked();
  await expect(hue).toHaveValue("0");
  await expect(page.locator(".mono-page")).toHaveAttribute("data-mono-logo-variant", "plaque");

  await page.getByRole("button", { name: "Светлая тема" }).click();
  await expect.poll(() => icon.evaluate(node => getComputedStyle(node).fill)).not.toBe(initialIcon);
  await expect.poll(() => wordmark.evaluate(node => getComputedStyle(node).fill)).not.toBe(initialWordmark);
  await custom.uncheck();
  await expect(hue).toHaveCount(0);
  await expect(page.locator(".mono-page")).toHaveAttribute("data-mono-logo-custom", "false");
});

test("MONO LEDGER открывается отдельно от V1 и переключает три визуальных варианта", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/mono");

  const preview = page.locator("main[data-mono-preview]");
  await expect(preview).toBeVisible();
  await expect(preview).toHaveAttribute("data-mono-preset", "ledger");
  await expect(page.getByRole("heading", { name: "Общий баланс" })).toBeVisible();
  const quick = await openMonoRail(page, "quick");
  await expect(quick.getByRole("link", { name: /V1/i })).toHaveAttribute("href", "/");
  await closeCompactMonoRail(page, "quick");
  await page.getByRole("button", { name: "Скрыть баланс" }).click();

  await openMonoRail(page, "quick");
  await quick.getByRole("button", { name: "2 · Frost" }).click();
  await expect(preview).toHaveAttribute("data-mono-preset", "frost");

  await quick.getByRole("button", { name: "3 · Mercury" }).click();
  await expect(preview).toHaveAttribute("data-mono-preset", "mercury");

  await page.keyboard.press("1");
  await expect(preview).toHaveAttribute("data-mono-preset", "ledger");
  await expect(page.getByRole("button", { name: "Показать баланс" })).toBeVisible();
});

test("MONO LEDGER на 320 px не выходит за экран", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/mono");

  await expect(page.locator("main[data-mono-preview]")).toBeVisible();
  const hasOverflow = await page.evaluate(() =>
    document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasOverflow).toBe(false);
});

test("Frost и Mercury меняют композицию, а не только цвет", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/mono");

  const amount = page.locator(".mono-hero__amount");
  const ledgerX = (await amount.boundingBox())?.x ?? 0;
  const quick = await openMonoRail(page, "quick");
  await quick.getByRole("button", { name: "2 · Frost" }).click();
  const frostX = (await amount.boundingBox())?.x ?? 0;
  expect(frostX).toBeGreaterThan(ledgerX + 10);

  await quick.getByRole("button", { name: "3 · Mercury" }).click();
  await closeCompactMonoRail(page, "quick");
  const promoY = (await page.locator(".mono-promo-frame").boundingBox())?.y ?? 0;
  const actionsY = (await page.locator(".mono-actions").boundingBox())?.y ?? 0;
  expect(promoY).toBeLessThan(actionsY);
});

test("рабочие элементы прототипа имеют мобильную область касания", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/mono");

  const quick = await openMonoRail(page, "quick");
  for (const control of [
    quick.getByRole("button", { name: "1 · Ledger" }),
    quick.getByRole("button", { name: "2 · Frost" }),
    quick.getByRole("button", { name: "3 · Mercury" }),
    quick.getByRole("button", { name: "Экран 390 пикселей" }),
    quick.getByRole("button", { name: "Логотип без плашки" }),
    quick.getByRole("button", { name: "Логотип с плашкой" }),
  ]) {
    const box = await control.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }
  const logoColor = quick.getByRole("checkbox", { name: "Свой цвет эмблемы" });
  expect((await logoColor.locator("xpath=..").boundingBox())?.height).toBeGreaterThanOrEqual(44);
  await logoColor.check();
  expect((await quick.getByRole("slider", { name: "Тон знака Novex" }).boundingBox())?.height).toBeGreaterThanOrEqual(44);
  await closeCompactMonoRail(page, "quick");
  for (const control of [
    page.getByRole("button", { name: "Скрыть баланс" }),
    page.getByRole("button", { name: "Открыть быстрые настройки" }),
    page.getByRole("button", { name: "Открыть тонкие настройки" }),
  ]) {
    const box = await control.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }
});

test("заголовок активов не обрезается нижней навигацией на первом экране", async ({ page }) => {
  const overlaps: string[] = [];
  for (const width of [320, 390, 430, 480]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/mono");
    const quick = await openMonoRail(page, "quick");

    for (const preset of ["1 · Ledger", "2 · Frost", "3 · Mercury"]) {
      await quick.getByRole("button", { name: preset }).click();
      await closeCompactMonoRail(page, "quick");
      const hasOverflow = await page.evaluate(() =>
        document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(hasOverflow, `${width}px, ${preset}: горизонтальное переполнение`).toBe(false);
      await page.waitForTimeout(850);
      const heading = await page.locator(".mono-assets__heading").boundingBox();
      const nav = await page.locator(".mono-nav").boundingBox();
      expect(heading).not.toBeNull();
      expect(nav).not.toBeNull();
      const fullyAbove = heading!.y + heading!.height <= nav!.y - 8;
      const fullyBelow = heading!.y >= nav!.y + 8;
      if (!fullyAbove && !fullyBelow) {
        overlaps.push(`${width}px ${preset}: heading ${heading!.y.toFixed(1)}–${(heading!.y + heading!.height).toFixed(1)}, nav from ${nav!.y.toFixed(1)}`);
      }
      if (preset !== "3 · Mercury") await openMonoRail(page, "quick");
    }
  }
  expect(overlaps, "заголовок активов попадает под навигацию").toEqual([]);
});

test("подписи нижней навигации остаются читаемыми на узком экране", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto("/mono");
  const fontSize = await page.locator(".mono-nav__item span").first().evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).fontSize),
  );
  expect(fontSize).toBeGreaterThanOrEqual(10);
});
