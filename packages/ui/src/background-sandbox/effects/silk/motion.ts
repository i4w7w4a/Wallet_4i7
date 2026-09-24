export interface SilkMotion {
  phase: number;
  elapsed: number;
  pointerX: number;
  pointerY: number;
  pointerWeight: number;
}

export function createSilkMotion(seed: number): SilkMotion {
  // No ambient entropy. Seed zero preserves the upstream time-zero baseline.
  const phase = ((Math.imul(seed >>> 0, 0x9e3779b1) >>> 0) / 0x100000000) * 64;
  return { phase, elapsed: 0, pointerX: 0.5, pointerY: 0.5, pointerWeight: 0 };
}

export function advanceSilkMotion(
  previous: SilkMotion,
  dt: number,
  flowSpeed: number,
  pointer: readonly [number, number] | null,
): SilkMotion {
  if (!Number.isFinite(dt) || dt <= 0) return previous;
  const seconds = Math.min(dt, 0.1);
  const validPointer = pointer?.every(Number.isFinite) ? pointer : null;
  // Exponential response is a function of seconds, never frames. Coordinates
  // and influence remain continuous across leave/re-entry; no sentinel branch.
  const positionBlend = -Math.expm1(-seconds / 0.12);
  const weightBlend = -Math.expm1(-seconds / (validPointer ? 0.16 : 0.32));
  return {
    phase: previous.phase + seconds * (Number.isFinite(flowSpeed) ? flowSpeed : 0),
    elapsed: previous.elapsed + seconds,
    pointerX: validPointer
      ? previous.pointerX + (Math.min(1, Math.max(0, validPointer[0])) - previous.pointerX) * positionBlend
      : previous.pointerX,
    pointerY: validPointer
      ? previous.pointerY + (Math.min(1, Math.max(0, validPointer[1])) - previous.pointerY) * positionBlend
      : previous.pointerY,
    pointerWeight: previous.pointerWeight + ((validPointer ? 1 : 0) - previous.pointerWeight) * weightBlend,
  };
}
