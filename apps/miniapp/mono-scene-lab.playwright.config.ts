import { defineConfig } from "@playwright/test";

// The scene lab deliberately exists only in development.
export default defineConfig({
  testDir: "./e2e",
  testMatch: "mono-scene-lab.spec.ts",
  outputDir: "./test-results/mono-scene-lab",
  workers: 1,
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:3123", viewport: { width: 1440, height: 1100 }, trace: "retain-on-failure" },
  webServer: {
    command: "pnpm dev --hostname 127.0.0.1 --port 3123",
    url: "http://127.0.0.1:3123",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
