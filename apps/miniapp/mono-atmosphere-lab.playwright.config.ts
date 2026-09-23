import { defineConfig } from "@playwright/test";

const baseURL = process.env.MONO_ATMOSPHERE_LAB_URL ?? "http://localhost:3136";
export default defineConfig({
  testDir: "./e2e", testMatch: "mono-atmosphere-lab.spec.ts", workers: 1,
  outputDir: "./test-results/mono-atmosphere-lab", reporter: "list",
  use: { baseURL, viewport: { width: 1440, height: 1000 }, hasTouch: false,
    colorScheme: "dark", trace: "retain-on-failure" },
  webServer: { command: "pnpm exec next dev --port 3136", url: `${baseURL}/design-lab/atmosphere`, reuseExistingServer: true, timeout: 120_000 },
});
