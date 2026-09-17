import { expect, type Page } from "@playwright/test";

export type MonoRail = "quick" | "fine";

const RAIL_LABELS: Record<MonoRail, string> = {
  quick: "Открыть быстрые настройки",
  fine: "Открыть тонкие настройки",
};

export async function openMonoRail(page: Page, rail: MonoRail) {
  const panel = page.locator(`[data-mono-rail="${rail}"]`);
  const compact = await page.evaluate(() => matchMedia("(max-width: 1199px)").matches);
  if (compact) await expect(page.locator("[data-mono-workbench]")).toHaveAttribute("data-compact-chrome", "true");
  if (await panel.getAttribute("aria-hidden") === "true") {
    await page.getByRole("button", { name: RAIL_LABELS[rail] }).click();
  }
  await expect(panel).toHaveAttribute("aria-hidden", "false");
  return panel;
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
