import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./test-results-material",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  expect: { timeout: 20_000 },
  use: {
    baseURL: process.env.MATERIAL_LAB_BASE_URL ?? "http://127.0.0.1:3142",
    browserName: "chromium",
    viewport: { width: 1280, height: 900 },
    colorScheme: "dark",
    trace: "retain-on-failure",
  },
});
