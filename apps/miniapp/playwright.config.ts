import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./test-results",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  expect: {
    timeout: 5_000,
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.015,
    },
  },
  webServer: {
    command: "pnpm build && pnpm start",
    port: 3000,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  use: {
    baseURL: "http://127.0.0.1:3000",
    colorScheme: "dark",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "mobile-chromium",
      use: { ...devices["iPhone 13"], browserName: "chromium" },
    },
  ],
});
