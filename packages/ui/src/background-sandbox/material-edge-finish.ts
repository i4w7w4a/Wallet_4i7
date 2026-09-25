import type { BackgroundEdgeFinishV1 } from "./material-contract";

export const DEFAULT_BACKGROUND_EDGE_FINISH: BackgroundEdgeFinishV1 = Object.freeze({
  version: 1, sideDarkening: 0, inset: 0, softness: 0,
});

export const BACKGROUND_EDGE_FINISH_BOUNDS = Object.freeze({
  sideDarkening: [0, 1] as const,
  inset: [0, 0.3] as const,
  softness: [0, 0.3] as const,
});

function bound(value: unknown, key: keyof typeof BACKGROUND_EDGE_FINISH_BOUNDS): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_BACKGROUND_EDGE_FINISH[key];
  const [min, max] = BACKGROUND_EDGE_FINISH_BOUNDS[key];
  return Math.min(max, Math.max(min, value));
}

export function normalizeBackgroundEdgeFinish(input: unknown): BackgroundEdgeFinishV1 {
  if (!input || typeof input !== "object" || (input as { version?: unknown }).version !== 1) {
    return DEFAULT_BACKGROUND_EDGE_FINISH;
  }
  const value = input as Record<string, unknown>;
  return { version: 1, sideDarkening: bound(value.sideDarkening, "sideDarkening"),
    inset: bound(value.inset, "inset"), softness: bound(value.softness, "softness") };
}
