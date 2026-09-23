import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "mono-viewer.spec.ts",
  outputDir: "./test-results/mono-viewer",
  workers: 1,
  reporter: "list",
  use: { ...devices["iPhone 13"], browserName: "chromium", baseURL: process.env.MONO_VIEWER_BASE_URL ?? "http://127.0.0.1:3126", trace: "retain-on-failure" },
});
