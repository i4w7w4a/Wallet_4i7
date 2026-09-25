export function advanceVaultPhase(phase: number, dt: number, drift: number): number {
  if (!Number.isFinite(dt) || dt <= 0 || !Number.isFinite(drift) || drift === 0) return phase;
  const next = phase + dt * drift;
  if (next <= Math.PI && next >= -Math.PI) return next;
  const turn = 2 * Math.PI;
  return ((((next + Math.PI) % turn) + turn) % turn) - Math.PI;
}

export function hexToRgb(color: string): [number, number, number] {
  return [1, 3, 5].map((index) => Number.parseInt(color.slice(index, index + 2), 16) / 255) as [number, number, number];
}
