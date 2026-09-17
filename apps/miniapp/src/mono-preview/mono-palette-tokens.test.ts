import { describe, expect, it } from "vitest";
import { normalizeMonoPaletteConfig } from "@wallet/ui";

import { monoPaletteChannels } from "./mono-palette-tokens";

describe("mono semantic paint channels", () => {
  it("returns bounded numeric channels, including the two Promo edge tints", () => {
    const dark = normalizeMonoPaletteConfig().themes.dark;
    const channels = monoPaletteChannels(dark);

    for (const name of ["--mono-palette-canvas-ff", "--mono-palette-edgeCool-18", "--mono-palette-edgeWarm-18"]) {
      const [r, g, b, alpha] = channels[name];
      expect([r, g, b, alpha].every(Number.isFinite)).toBe(true);
      expect([r, g, b].every(channel => channel >= 0 && channel <= 255)).toBe(true);
      expect(alpha).toBeGreaterThan(0);
      expect(alpha).toBeLessThanOrEqual(1);
    }
    expect(channels["--mono-palette-canvas-ff"][3]).toBe(1);
    expect(channels["--mono-palette-edgeCool-18"][3]).toBeCloseTo(24 / 255, 8);
    expect(channels["--mono-palette-edgeWarm-18"][3]).toBeCloseTo(24 / 255, 8);
  });
});
