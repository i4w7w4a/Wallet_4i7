import { expect, test } from "@playwright/test";

test.skip(process.env.NOVEX_MOTION_LAB_E2E === "1", "Production release check");

test("approved material response survives reload while the Lab stays private", async ({ page }) => {
  await page.goto("/mono");
  const actions = page.locator(".mono-actions__item");
  await expect(actions).toHaveCount(4);
  for (const action of await actions.all()) {
    await expect(action).toHaveAttribute("data-control-effect", "material");
    await expect(action).toHaveCSS("--press-depth", "2.7px");
    await expect(action).toHaveCSS("--settle-ms", "270ms");
  }
  await expect(page.getByRole("link", { name: /Открыть Motion Lab/ })).toHaveCount(0);
  expect((await page.request.get("/design-lab")).status()).toBe(404);

  await page.reload();
  await expect(actions).toHaveCount(4);
  for (const action of await actions.all()) {
    await expect(action).toHaveAttribute("data-control-effect", "material");
    await expect(action).toHaveCSS("--press-depth", "2.7px");
    await expect(action).toHaveCSS("--settle-ms", "270ms");
  }
});
