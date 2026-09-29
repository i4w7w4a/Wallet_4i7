import { describe, expect, it, vi } from "vitest";

// Next exposes client exports as non-callable references to a server module.
vi.mock("./mono-optical-glass", () => ({
  MonoOpticalGlass: () => null,
  normalizeMonoGlassSettings: () => { throw new Error("RSC client reference called on server"); },
}));

import { normalizeMonoGlassSettings } from "../index";

describe("server glass settings boundary", () => {
  it("normalizes a published preset without calling a client component export", () => {
    const settings = normalizeMonoGlassSettings("ledger", { ior: 10, flowMode: 0 });
    expect(settings.ior).toBe(2);
    expect(settings.flowMode).toBe(0);
    expect(settings.flowEnabled).toBe(false);
    expect(settings.edgeThickness).toBe(0.165);
  });
});
