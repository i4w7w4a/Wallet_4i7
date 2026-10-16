// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("Gold asset namespace", () => {
  beforeEach(() => {
    vi.stubEnv("NOVEX_GOLD_ASSET_PREFIX", undefined);
    vi.stubEnv("NOVEX_NEXT_DIST_DIR", undefined);
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("keeps the default config without an asset prefix or base path", async () => {
    const { default: config } = await import("../../next.config");

    expect(config).not.toHaveProperty("assetPrefix");
    expect(config).not.toHaveProperty("basePath");
    expect(config).not.toHaveProperty("distDir");
    expect(config.devIndicators).toBe(false);
  });

  it("prefixes assets only for the exact accepted /gold flag", async () => {
    vi.stubEnv("NOVEX_GOLD_ASSET_PREFIX", "/gold");
    const { default: config } = await import("../../next.config");

    expect(config.assetPrefix).toBe("/gold");
    expect(config).not.toHaveProperty("basePath");
    expect(config.devIndicators).toBe(false);
  });

  it.each([
    "",
    "/mono",
    "/gold/",
    " /gold",
    "/gold ",
    "/GOLD",
    "https://example.invalid/gold",
  ])("does not opt in for the foreign or malformed flag %j", async (flag) => {
    vi.stubEnv("NOVEX_GOLD_ASSET_PREFIX", flag);
    const { default: config } = await import("../../next.config");

    expect(config).not.toHaveProperty("assetPrefix");
    expect(config).not.toHaveProperty("basePath");
  });

  it.each([undefined, "/gold"])(
    "preserves the optional distDir with the asset flag %j",
    async (flag) => {
      vi.stubEnv("NOVEX_GOLD_ASSET_PREFIX", flag);
      vi.stubEnv("NOVEX_NEXT_DIST_DIR", ".next-gold-isolated");
      const { default: config } = await import("../../next.config");

      expect(config.distDir).toBe(".next-gold-isolated");
      expect(config).not.toHaveProperty("basePath");
    },
  );
});
