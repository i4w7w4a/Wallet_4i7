import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    // Heavy MONO component files exhaust their short async waits when run together.
    fileParallelism: false,
    maxWorkers: 1,
    exclude: [...configDefaults.exclude, "e2e/**"],
    globals: true,
  },
});
