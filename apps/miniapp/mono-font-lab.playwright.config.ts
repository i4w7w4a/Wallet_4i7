import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "mono-font-lab.spec.ts",
  outputDir: "./test-results/mono-font-lab",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  use: { baseURL: process.env.MONO_FONT_LAB_BASE_URL, browserName: "chromium", viewport: { width: 1280, height: 900 }, trace: "retain-on-failure" },
});
