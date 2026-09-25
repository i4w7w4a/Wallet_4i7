export interface FluidClock { time: number; phase: number; emitted: number; seed: number }
export interface AmbientSplat { ordinal: number; x: number; y: number; dx: number; dy: number; pigment: number }
export function createFluidClock(seed: number): FluidClock { return { time: 0, phase: 0, emitted: 0, seed }; }
export function makeFluidSeededSplat(seed: number, ordinal: number): AmbientSplat {
  // Counter-addressed stream: bounded, stable, unaffected by UI controls or frame batching.
  let state = ((seed >>> 0) ^ Math.imul(ordinal + 1, 0x9e3779b9)) >>> 0;
  const random = () => {
    state = (state + 0x6d2b79f5) | 0;
    let x = Math.imul(state ^ (state >>> 15), 1 | state);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
  const x = 0.1 + random() * 0.8;
  const y = 0.1 + random() * 0.8;
  const angle = random() * 2 * Math.PI;
  const speed = 20 + random() * 100;
  return { ordinal, x, y, dx: Math.cos(angle) * speed, dy: Math.sin(angle) * speed, pigment: ordinal % 6 };
}
export function stepFluidClock(clock: FluidClock, frameDt: number, scale: number, mode: "draw" | "ambient", rate: number): { clock: FluidClock; dt: number; splats: AmbientSplat[] } {
  const safeDt = Number.isFinite(frameDt) ? Math.max(0, Math.min(1 / 30, frameDt)) : 0;
  const safeScale = Number.isFinite(scale) ? Math.max(0, Math.min(2, scale)) : 0;
  const dt = safeDt * safeScale;
  const next = { ...clock, time: clock.time + dt };
  const splats: AmbientSplat[] = [];
  if (mode === "ambient" && dt > 0) {
    const safeRate = Number.isFinite(rate) ? Math.max(0, Math.min(2, rate)) : 0;
    next.phase += dt * safeRate;
    while (next.phase >= 1 - 1e-12 && splats.length < 2) {
      splats.push(makeFluidSeededSplat(clock.seed, next.emitted));
      next.emitted++;
      next.phase = Math.max(0, next.phase - 1);
    }
  }
  return { clock: next, dt, splats };
}
