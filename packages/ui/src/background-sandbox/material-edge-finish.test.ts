import { describe, expect, it } from "vitest";
import { DEFAULT_BACKGROUND_EDGE_FINISH, normalizeBackgroundEdgeFinish } from "./material-edge-finish";

describe("background edge finish", () => {
  it("keeps existing material drafts visually unchanged by default", () => {
    expect(normalizeBackgroundEdgeFinish(undefined)).toEqual(DEFAULT_BACKGROUND_EDGE_FINISH);
    expect(normalizeBackgroundEdgeFinish({ version: 2, sideDarkening: 1, inset: 0.3, softness: 0.3 }))
      .toEqual(DEFAULT_BACKGROUND_EDGE_FINISH);
  });

  it("bounds and isolates the three background-only controls", () => {
    expect(normalizeBackgroundEdgeFinish({ version: 1, sideDarkening: 2, inset: -1, softness: 0.8 }))
      .toEqual({ version: 1, sideDarkening: 1, inset: 0, softness: 0.3 });
    expect(normalizeBackgroundEdgeFinish({ version: 1, sideDarkening: Number.NaN, inset: 0.2, softness: 0.1 }))
      .toEqual({ version: 1, sideDarkening: 0, inset: 0.2, softness: 0.1 });
  });
});
