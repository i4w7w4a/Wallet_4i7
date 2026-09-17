import { expect, test } from "@playwright/test";
import { createHash } from "node:crypto";
import { MONO_PALETTE_SCHEMA_HASH, normalizeMonoPaletteConfig, resolveMonoPalette } from "../../../packages/ui/src/mono/mono-palette";
import type { PresetView } from "../src/preset-library/preset-types";

test.use({ hasTouch: false, isMobile: false, viewport: { width: 1440, height: 1000 } });

test("foreign link previews a diff and forks the edited draft without revision rights", async ({ page }) => {
  const sourceSlug = "ffffffffffffffffffffffffffffffff";
  const forkSlug = "cccccccccccccccccccccccccccccccc";
  const config = normalizeMonoPaletteConfig();
  config.themes.dark.recipe.anchorHue = 43;
  const body = {
    schemaVersion: 1 as const, skinId: "mono-ledger-v1" as const, configVersion: 1 as const, engineVersion: 1 as const,
    catalogVersion: 1 as const, schemaHash: MONO_PALETTE_SCHEMA_HASH, config,
    resolved: { dark: resolveMonoPalette(config.themes.dark), light: resolveMonoPalette(config.themes.light) },
  };
  const preset = { ...body, contentHash: `sha256-${createHash("sha256").update(JSON.stringify(body)).digest("hex")}` };
  const source: PresetView = {
    id: "11111111-1111-4111-8111-111111111111", slug: sourceSlug, sourcePresetId: null,
    currentRevision: 1, createdAt: "2026-09-17T00:00:00.000Z", revision: 1,
    name: "Чужой свет", description: "", visibility: "unlisted", preset, contentHash: preset.contentHash,
  };
  let owned: PresetView[] = [];
  let forkBody: unknown;
  await page.route("**/api/skin-presets", async route => {
    await route.fulfill({ json: { presets: owned } });
  });
  await page.route(`**/api/skin-presets/${sourceSlug}`, async route => {
    await route.fulfill({ json: source });
  });
  await page.route(`**/api/skin-presets/${sourceSlug}/fork`, async route => {
    forkBody = route.request().postDataJSON();
    const fork: PresetView = {
      ...source, id: "22222222-2222-4222-8222-222222222222", slug: forkSlug,
      sourcePresetId: source.id, name: "Мой вариант",
      preset: (forkBody as { preset: PresetView["preset"] }).preset,
      contentHash: (forkBody as { preset: PresetView["preset"] }).preset.contentHash,
    };
    owned = [fork];
    await route.fulfill({ status: 201, json: fork });
  });

  await page.goto(`/mono?preset=${sourceSlug}`);
  const card = page.getByRole("article", { name: "Чужой свет" });
  await expect(card).toBeVisible();
  if (process.env.MONO_PALETTE_CAPTURE === "1") {
    await card.scrollIntoViewIfNeeded();
    await page.screenshot({ path: test.info().outputPath("library.png"), animations: "disabled" });
  }
  await expect(card.getByRole("button", { name: "Новая ревизия" })).toHaveCount(0);
  await card.getByRole("button", { name: "Предпросмотр" }).click();
  await expect(page.getByRole("region", { name: "Различия импорта" })).toBeVisible();
  await expect(page.getByRole("slider", { name: "Тон" })).toHaveValue("250");
  await page.getByRole("button", { name: "Принять в черновик" }).click();
  await expect(page.getByRole("slider", { name: "Тон" })).toHaveValue("43");
  await page.getByRole("slider", { name: "Тон" }).fill("70");
  await page.getByRole("textbox", { name: "Название для сервера" }).fill("Мой вариант");
  await card.getByRole("button", { name: "Создать ответвление" }).click();
  await expect(page.getByRole("article", { name: "Мой вариант" })).toBeVisible();
  expect((forkBody as { preset: PresetView["preset"] }).preset.config.themes.dark.recipe.anchorHue).toBe(70);
  await expect(page.locator("canvas")).toHaveCount(1);
});
