import { expect, type Page } from "@playwright/test";

export type MonoRail = "quick" | "fine";
export type MonoTool = "balance" | "assets" | "chart" | "typography" | "color" | "shape" | "logo" | "environment" | "optics";
const TOOL_LABELS: Record<MonoTool, string> = {
  balance: "Баланс", assets: "Активы", chart: "График", typography: "Шрифты", color: "Цвет",
  shape: "Форма и кнопки", logo: "Логотип", environment: "Среда", optics: "Оптика",
};

const RAIL_LABELS: Record<MonoRail, string> = {
  quick: "Открыть быстрые настройки",
  fine: "Открыть тонкие настройки",
};

export async function openMonoRail(page: Page, rail: MonoRail) {
  if (await page.locator("[data-mono-workbench]").getAttribute("data-panels-visible") === "false")
    await page.getByRole("button", { name: "Показать панели", exact: true }).click();
  const panel = page.locator(`[data-mono-rail="${rail}"]`);
  const compact = await page.evaluate(() => matchMedia("(max-width: 1199px)").matches);
  if (compact) await expect(page.locator("[data-mono-workbench]")).toHaveAttribute("data-compact-chrome", "true");
  if (await panel.getAttribute("aria-hidden") === "true") {
    await page.getByRole("button", { name: RAIL_LABELS[rail] }).click();
  }
  await expect(panel).toHaveAttribute("aria-hidden", "false");
  return panel;
}

/** Follow the same dock → selected inspector route used in the workbench. */
export async function openMonoTool(page: Page, tool: MonoTool) {
  const fine = page.locator('[data-mono-rail="fine"]');
  if (await fine.getAttribute("aria-hidden") !== "true" &&
      await fine.locator('[data-mono-inspector="' + tool + '"]').count()) return fine;
  const dock = await openMonoRail(page, "quick");
  await dock.getByRole("button", { name: TOOL_LABELS[tool], exact: true }).click();
  await expect(fine).toHaveAttribute("aria-hidden", "false");
  await expect(fine.locator('[data-mono-inspector="' + tool + '"]')).toBeVisible();
  return fine;
}

export async function openMonoEnvironment(page: Page) {
  const fine = await openMonoTool(page, "environment");
  const section = fine.locator("details").filter({ hasText: "Исходная среда и тема" });
  if (await section.getAttribute("open") === null) await section.locator("summary").click();
  return fine;
}

export async function closeCompactMonoRail(page: Page, rail: MonoRail) {
  const panel = page.locator(`[data-mono-rail="${rail}"]`);
  if (await panel.getAttribute("aria-hidden") !== "true") {
    const launcher = page.getByRole("button", { name: RAIL_LABELS[rail] });
    if (await launcher.isVisible()) {
      await page.keyboard.press("Escape");
      await expect(panel).toHaveAttribute("aria-hidden", "true");
      await expect(launcher).toBeFocused();
    }
  }
}
