import { defineConfig } from "@playwright/test";

const baseURL = process.env.BG_SANDBOX_URL ?? "http://localhost:3142";

export default defineConfig({
  testDir: "./e2e",
  testMatch: ["background-sandbox.spec.ts", "background-sandbox-runtime.spec.ts"],
  workers: 1,
  outputDir: process.env.BG_SANDBOX_EVIDENCE ?? "./test-results/background-sandbox",
  reporter: "list",
  use: { baseURL, viewport: { width: 1440, height: 1000 },
    hasTouch: false, colorScheme: "dark", trace: "retain-on-failure" },
});
