import { expect, test, type Page } from "@playwright/test";

const THEME_STORAGE_KEY = "wallet4i7.theme.v1";
const VISUAL_STORAGE_KEY = "wallet4i7.visual.v1";
const WIDTHS = [320, 390, 430, 480] as const;
const HEIGHTS: Record<(typeof WIDTHS)[number], number> = {
  320: 700,
  390: 844,
  430: 932,
  480: 960,
};

const DEFAULT_THEME = {
  version: 1,
  background: "#05070B",
  surface: "#111620",
  accent: "#5B8CFF",
  glassTint: "#7C6CFF",
  radius: 24,
  density: 1,
  glassOpacity: 0.24,
  glassBlur: 18,
  highlightIntensity: 0.55,
  refractionIntensity: 0.35,
  motionIntensity: 0.8,
};

const STATIC_VISUAL_EFFECTS = {
  version: 1,
  speed: 0,
  threadCount: 7,
  frequency: 3,
  spread: 0.55,
  taper: 0.18,
  position: 0.46,
  fanMode: "right",
  glow: 0.08,
  falloff: 2,
  thickness: 0.65,
  brightness: 1.25,
  opacity: 0.92,
  mirror: true,
  shimmer: false,
  grain: false,
  grainIntensity: 0.08,
  pointerInteraction: false,
  pointerStrength: 0.22,
} as const;

const PALETTES = [
  ["ocean", "#05070B", "#111620", "#5B8CFF", "#7C6CFF"],
  ["aurora", "#020B0D", "#0B1A1C", "#00E7C7", "#5B8CFF"],
  ["violet", "#080511", "#171124", "#A56CFF", "#4F8CFF"],
  ["ember", "#100705", "#21120F", "#FF7A45", "#FF3D8D"],
] as const;

for (const [paletteName, background, surface, accent, glassTint] of PALETTES) {
  for (const width of WIDTHS) {
    test(`${paletteName}: Dashboard ${width}px не переполняет viewport`, async ({ page }) => {
      await page.setViewportSize({ width, height: HEIGHTS[width] });
      await seedPreferences(page, {
        ...DEFAULT_THEME,
        background,
        surface,
        accent,
        glassTint,
      });
      await page.goto("/");
      await exerciseDashboard(page);

      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      await expect(page).toHaveScreenshot(`dashboard-${paletteName}-${width}.png`, {
        fullPage: true,
        animations: "disabled",
      });
    });
  }
}

test("default palette на 390px загружается без localStorage", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator("[data-wallet-visual-layer]")).toBeVisible();
  await expect(page.getByRole("region", { name: "Баланс" })).toBeVisible();
  await expect(page).toHaveScreenshot("dashboard-default-390.png", {
    fullPage: true,
    animations: "disabled",
  });
});

test("reduced motion оставляет fallback и доступные controls", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expect(page.locator("[data-wallet-visual-layer]")).toHaveAttribute(
    "data-active",
    "false",
  );
  await expect(page.locator("[data-visual-fallback]")).toBeVisible();
  await page.getByRole("button", { name: "Получить" }).click();
  await expect(page.getByRole("dialog", { name: "Получить" })).toBeVisible();
});

test("WebGL unavailable переключается на poster без потери интерактивности", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      value: () => null,
    });
  });
  await page.setViewportSize({ width: 430, height: 932 });
  await page.goto("/");

  await expect(page.locator("[data-visual-fallback]")).toBeVisible();
  await expect(page.locator("canvas[data-web-threads]")).toHaveCount(0);
  await page.locator(".liquid-promo__action").click();
  await expect(page.getByRole("dialog", { name: "Обменять" })).toBeVisible();
});

async function seedPreferences(page: Page, theme: typeof DEFAULT_THEME) {
  await page.addInitScript(
    ({ themeStorageKey, visualStorageKey, savedTheme, savedEffects }) => {
      window.localStorage.setItem(themeStorageKey, JSON.stringify(savedTheme));
      window.localStorage.setItem(visualStorageKey, JSON.stringify(savedEffects));
    },
    {
      themeStorageKey: THEME_STORAGE_KEY,
      visualStorageKey: VISUAL_STORAGE_KEY,
      savedTheme: theme,
      savedEffects: STATIC_VISUAL_EFFECTS,
    },
  );
}

async function exerciseDashboard(page: Page) {
  await expect(page.locator("[data-wallet-visual-layer]")).toBeVisible();
  await expect(page.getByRole("region", { name: "Баланс" })).toBeVisible();
  await expect(page.locator("video")).toHaveCount(0);

  await page.getByRole("button", { name: "Получить" }).click();
  await expect(page.getByRole("dialog", { name: "Получить" })).toBeVisible();
  await page.getByRole("button", { name: "Закрыть", exact: true }).click();

  await page.getByRole("button", { name: "Портфель" }).click();
  await expect(page.locator('[data-dashboard-surface="content"]')).toBeVisible();
  await page.getByRole("button", { name: "Главная" }).click();

  await page.getByRole("button", { name: "Студия темы" }).click();
  await expect(page.getByRole("dialog", { name: "Студия темы" })).toBeVisible();
  await page.getByRole("button", { name: "Закрыть", exact: true }).click();
}
