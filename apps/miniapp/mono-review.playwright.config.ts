import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

/** Run against an already built, immutable local review server. */
export default defineConfig({
  ...base,
  testMatch: "mono-*.spec.ts",
  outputDir: "./test-results/mono-review",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  webServer: undefined,
  use: {
    ...base.use,
    baseURL: process.env.MONO_REVIEW_BASE_URL ?? "http://127.0.0.1:3120",
  },
});
