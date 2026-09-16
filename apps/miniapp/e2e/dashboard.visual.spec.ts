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
    test(`${paletteName}: initial Dashboard ${width}px не переполняет viewport`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: HEIGHTS[width] });
      await seedPreferences(page, {
        ...DEFAULT_THEME,
        background,
        surface,
        accent,
        glassTint,
      });
      await page.goto("/");
      await expect(page.locator("[data-wallet-visual-layer]")).toBeVisible();
      await expect(page.getByRole("region", { name: "Баланс" })).toBeVisible();
      await expect(page.locator("video")).toHaveCount(0);

      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      await expect(page).toHaveScreenshot(`dashboard-${paletteName}-${width}.png`, {
        animations: "disabled",
      });
    });
  }
}

test("default palette на 390px получает deterministic visual preset", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedVisualEffects(page);
  await page.goto("/");
  await expect(page.locator("[data-wallet-visual-layer]")).toBeVisible();
  await expect(page.getByRole("region", { name: "Баланс" })).toBeVisible();
  await expect(page).toHaveScreenshot("dashboard-default-390.png", {
    animations: "disabled",
  });
});

test("interaction-flow работает отдельно от initial screenshots", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedPreferences(page, DEFAULT_THEME);
  await page.goto("/");

  await exerciseDashboard(page);
});

test("все touch targets сохраняют минимум 44x44 на 320px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await seedPreferences(page, DEFAULT_THEME);
  await page.goto("/");

  expect(await undersizedTouchTargets(page)).toEqual([]);
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

test("reduced transparency отключает blur нижней навигации", async ({ page }) => {
  await page.addInitScript(() => {
    const nativeMatchMedia = window.matchMedia.bind(window);
    window.matchMedia = (query: string) => {
      const nativeQuery = nativeMatchMedia(query);
      if (query !== "(prefers-reduced-transparency: reduce)") {
        return nativeQuery;
      }

      return {
        matches: true,
        media: query,
        onchange: null,
        addEventListener: nativeQuery.addEventListener.bind(nativeQuery),
        removeEventListener: nativeQuery.removeEventListener.bind(nativeQuery),
        addListener: nativeQuery.addListener.bind(nativeQuery),
        removeListener: nativeQuery.removeListener.bind(nativeQuery),
        dispatchEvent: nativeQuery.dispatchEvent.bind(nativeQuery),
      };
    };
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await seedPreferences(page, DEFAULT_THEME);
  await page.goto("/");

  await expect(page.locator(".wallet-dashboard")).toHaveAttribute(
    "data-reduced-transparency",
    "true",
  );
  const navStyle = await page.locator(".wallet-controls__bottom-navigation").evaluate((node) => {
    const style = getComputedStyle(node);
    return {
      backdropFilter: style.backdropFilter,
      backgroundColor: style.backgroundColor,
    };
  });
  expect(navStyle.backdropFilter).toBe("none");
  expect(navStyle.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
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

async function seedVisualEffects(page: Page) {
  await page.addInitScript(
    ({ visualStorageKey, savedEffects }) => {
      window.localStorage.setItem(visualStorageKey, JSON.stringify(savedEffects));
    },
    {
      visualStorageKey: VISUAL_STORAGE_KEY,
      savedEffects: STATIC_VISUAL_EFFECTS,
    },
  );
}

async function undersizedTouchTargets(page: Page) {
  return page.locator("button:visible").evaluateAll((buttons) =>
    buttons.flatMap((button) => {
      const rect = button.getBoundingClientRect();
      if (rect.width >= 44 && rect.height >= 44) {
        return [];
      }

      return [
        {
          label: button.getAttribute("aria-label") ?? button.textContent?.trim() ?? "button",
          width: rect.width,
          height: rect.height,
        },
      ];
    }),
  );
}

async function exerciseDashboard(page: Page) {
  await expect(page.locator("[data-wallet-visual-layer]")).toBeVisible();
  await expect(page.getByRole("region", { name: "Баланс" })).toBeVisible();
  await expect(page.locator("video")).toHaveCount(0);

  const receiveAction = page
    .locator(".wallet-click-spark")
    .filter({ has: page.getByRole("button", { name: "Получить", exact: true }) });
  await receiveAction.getByRole("button", { name: "Получить", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Получить" })).toBeVisible();
  await page.waitForTimeout(80);
  const sparkColor = await receiveAction.locator("canvas").evaluate((node) => {
    return (node as HTMLCanvasElement).getContext("2d")?.strokeStyle ?? null;
  });
  expect(sparkColor).toMatch(/#5b8cff|rgb\(91,\s*140,\s*255\)/i);
  await page.getByRole("button", { name: "Закрыть", exact: true }).click();

  await page.getByRole("button", { name: "Портфель" }).click();
  await expect(page.locator('[data-dashboard-surface="content"]')).toBeVisible();
  await expect
    .poll(
      () =>
        page
          .locator(".wallet-gooey-nav__particle.is-active")
          .evaluateAll((particles) =>
            Math.max(
              0,
              ...particles.map((particle) =>
                Number.parseFloat(getComputedStyle(particle).opacity),
              ),
            ),
          ),
      { intervals: [25, 25, 50], timeout: 700 },
    )
    .toBeGreaterThan(0.05);
  await page.getByRole("button", { name: "Главная" }).click();

  await page.getByRole("button", { name: "Студия темы" }).click();
  await expect(page.getByRole("dialog", { name: "Студия темы" })).toBeVisible();
  await page.getByRole("button", { name: "Закрыть", exact: true }).click();
}
