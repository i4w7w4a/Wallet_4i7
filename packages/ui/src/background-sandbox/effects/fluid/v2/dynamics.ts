/** Factors passed to the actual velocity/dye advection and pressure shaders. */
import type { FluidViewportResponseV1 } from "../../../fluid-viewport-response";
import type { ViewportMotionFrame } from "../../../contracts";

/** End-of-frame scroll rate and any input held while the host clock has dt=0. */
export type FluidViewportMotionState = Readonly<{
  scrollY: number; edgeY: number; pendingDeltaY: number; pendingBlockedY: number;
}>;
export type FluidViewportMotionDrive = Readonly<{ scrollY: number; edgeY: number }>;
export const EMPTY_FLUID_VIEWPORT_MOTION: FluidViewportMotionState = Object.freeze({
  scrollY: 0, edgeY: 0, pendingDeltaY: 0, pendingBlockedY: 0,
});
const EMPTY_DRIVE: FluidViewportMotionDrive = Object.freeze({ scrollY: 0, edgeY: 0 });

const MAX_DISPLACEMENT = 0.12;
const MAX_RATE = 32;
const bounded = (value: number, limit: number) => Number.isFinite(value)
  ? Math.max(-limit, Math.min(limit, value)) : 0;

/** Integrate viewport displacement as a rate, then average it over real elapsed time. */
export function stepFluidViewportMotion(state: FluidViewportMotionState, input: Pick<ViewportMotionFrame, "deltaY" | "blockedY">,
  elapsedSeconds: number, response: Pick<FluidViewportResponseV1, "enabled" | "strength" | "inertia" | "edgeResponse">):
  { state: FluidViewportMotionState; drive: FluidViewportMotionDrive } {
  if (!response.enabled || response.strength <= 0)
    return { state: EMPTY_FLUID_VIEWPORT_MOTION, drive: EMPTY_DRIVE };
  const dt = Number.isFinite(elapsedSeconds) ? Math.max(0, Math.min(0.25, elapsedSeconds)) : 0;
  const pendingDeltaY = bounded(state.pendingDeltaY + input.deltaY, MAX_DISPLACEMENT);
  const pendingBlockedY = bounded(state.pendingBlockedY + input.blockedY, MAX_DISPLACEMENT);
  if (dt === 0) return { state: { scrollY: state.scrollY, edgeY: state.edgeY,
    pendingDeltaY, pendingBlockedY }, drive: EMPTY_DRIVE };

  const targetY = bounded(pendingDeltaY * response.strength / dt, MAX_RATE);
  const targetEdgeY = bounded(pendingBlockedY * response.strength * response.edgeResponse / dt, MAX_RATE);
  const halfLife = 0.9 * Math.pow(response.inertia, 1.5);
  const retention = response.inertia === 0 ? 0 : Math.exp(-Math.LN2 * dt / halfLife);
  const averageRetention = response.inertia === 0 ? 0 :
    (1 - retention) * halfLife / (Math.LN2 * dt);
  const priorY = bounded(state.scrollY, MAX_RATE);
  const priorEdgeY = response.edgeResponse === 0 ? 0 : bounded(state.edgeY, MAX_RATE);
  const nextY = bounded(priorY * retention + targetY * (1 - retention), MAX_RATE);
  const nextEdgeY = bounded(priorEdgeY * retention + targetEdgeY * (1 - retention), MAX_RATE);
  return {
    state: { scrollY: nextY, edgeY: nextEdgeY, pendingDeltaY: 0, pendingBlockedY: 0 },
    drive: {
      scrollY: bounded(priorY * averageRetention + targetY * (1 - averageRetention), MAX_RATE),
      edgeY: bounded(priorEdgeY * averageRetention + targetEdgeY * (1 - averageRetention), MAX_RATE),
    },
  };
}

export function fluidV2Decay(dt: number, velocityDissipation: number, dyeDissipation: number, pressureRetention: number) {
  return {
    velocity: 1 / (1 + velocityDissipation * dt),
    dye: 1 / (1 + dyeDissipation * dt),
    pressure: Math.pow(pressureRetention, dt * 60),
  };
}
