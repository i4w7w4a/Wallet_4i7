export type ThreadFanMode = "center" | "left" | "right";

export type VisualEffectsConfig = {
  version: 1;
  speed: number;
  threadCount: number;
  frequency: number;
  spread: number;
  taper: number;
  position: number;
  fanMode: ThreadFanMode;
  glow: number;
  falloff: number;
  thickness: number;
  brightness: number;
  opacity: number;
  mirror: boolean;
  shimmer: boolean;
  grain: boolean;
  grainIntensity: number;
  pointerInteraction: boolean;
  pointerStrength: number;
};

export const DEFAULT_VISUAL_EFFECTS = {
  version: 1,
  speed: 0.75,
  threadCount: 7,
  frequency: 3,
  spread: 0.55,
  taper: 0.18,
  position: 0.46,
  fanMode: "right",
  glow: 0.08,
  falloff: 2,
  thickness: 0.65,
  brightness: 1.25,
  opacity: 0.92,
  mirror: true,
  shimmer: true,
  grain: true,
  grainIntensity: 0.08,
  pointerInteraction: true,
  pointerStrength: 0.22,
} as const satisfies VisualEffectsConfig;

const FAN_MODES = new Set<ThreadFanMode>(["center", "left", "right"]);

export function normalizeVisualEffects(input: unknown): VisualEffectsConfig {
  if (!isRecord(input) || input.version !== 1) {
    return { ...DEFAULT_VISUAL_EFFECTS };
  }

  return {
    version: 1,
    speed: numberIn(input.speed, 0, 3, DEFAULT_VISUAL_EFFECTS.speed),
    threadCount: Math.round(
      numberIn(input.threadCount, 1, 10, DEFAULT_VISUAL_EFFECTS.threadCount),
    ),
    frequency: numberIn(input.frequency, 0.5, 8, DEFAULT_VISUAL_EFFECTS.frequency),
    spread: numberIn(input.spread, 0, 1, DEFAULT_VISUAL_EFFECTS.spread),
    taper: numberIn(input.taper, 0, 1, DEFAULT_VISUAL_EFFECTS.taper),
    position: numberIn(input.position, 0, 1, DEFAULT_VISUAL_EFFECTS.position),
    fanMode:
      typeof input.fanMode === "string" && FAN_MODES.has(input.fanMode as ThreadFanMode)
        ? (input.fanMode as ThreadFanMode)
        : DEFAULT_VISUAL_EFFECTS.fanMode,
    glow: numberIn(input.glow, 0.01, 0.25, DEFAULT_VISUAL_EFFECTS.glow),
    falloff: numberIn(input.falloff, 0.5, 4, DEFAULT_VISUAL_EFFECTS.falloff),
    thickness: numberIn(input.thickness, 0.1, 2, DEFAULT_VISUAL_EFFECTS.thickness),
    brightness: numberIn(input.brightness, 0.1, 3, DEFAULT_VISUAL_EFFECTS.brightness),
    opacity: numberIn(input.opacity, 0, 1, DEFAULT_VISUAL_EFFECTS.opacity),
    mirror: booleanOr(input.mirror, DEFAULT_VISUAL_EFFECTS.mirror),
    shimmer: booleanOr(input.shimmer, DEFAULT_VISUAL_EFFECTS.shimmer),
    grain: booleanOr(input.grain, DEFAULT_VISUAL_EFFECTS.grain),
    grainIntensity: numberIn(
      input.grainIntensity,
      0,
      0.5,
      DEFAULT_VISUAL_EFFECTS.grainIntensity,
    ),
    pointerInteraction: booleanOr(
      input.pointerInteraction,
      DEFAULT_VISUAL_EFFECTS.pointerInteraction,
    ),
    pointerStrength: numberIn(
      input.pointerStrength,
      0,
      1,
      DEFAULT_VISUAL_EFFECTS.pointerStrength,
    ),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function numberIn(value: unknown, minimum: number, maximum: number, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(maximum, Math.max(minimum, value))
    : fallback;
}

function booleanOr(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}
