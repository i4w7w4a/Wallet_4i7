import { describe, expect, it } from "vitest";

import { DEFAULT_VISUAL_EFFECTS, normalizeVisualEffects } from "./visual-effects";

describe("normalizeVisualEffects", () => {
  it("ограничивает shader-параметры безопасными диапазонами", () => {
    expect(
      normalizeVisualEffects({
        ...DEFAULT_VISUAL_EFFECTS,
        speed: 99,
        threadCount: 18.7,
        position: -2,
        opacity: 4,
        grainIntensity: -1,
        pointerStrength: 9,
      }),
    ).toMatchObject({
      speed: 3,
      threadCount: 10,
      position: 0,
      opacity: 1,
      grainIntensity: 0,
      pointerStrength: 1,
    });
  });

  it("округляет threadCount и восстанавливает enum/booleans", () => {
    const result = normalizeVisualEffects({
      ...DEFAULT_VISUAL_EFFECTS,
      threadCount: 4.6,
      fanMode: "outside",
      mirror: "yes",
      shimmer: 1,
    });

    expect(result.threadCount).toBe(5);
    expect(result.fanMode).toBe(DEFAULT_VISUAL_EFFECTS.fanMode);
    expect(result.mirror).toBe(DEFAULT_VISUAL_EFFECTS.mirror);
    expect(result.shimmer).toBe(DEFAULT_VISUAL_EFFECTS.shimmer);
  });

  it("сбрасывает неизвестную версию и повреждённый input", () => {
    expect(normalizeVisualEffects({ ...DEFAULT_VISUAL_EFFECTS, version: 2 })).toEqual(
      DEFAULT_VISUAL_EFFECTS,
    );
    expect(normalizeVisualEffects(null)).toEqual(DEFAULT_VISUAL_EFFECTS);
  });
});
