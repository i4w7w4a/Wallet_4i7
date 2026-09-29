/** Factors passed to the actual velocity/dye advection and pressure shaders. */
import type { FluidViewportResponseV1 } from "../../../fluid-viewport-response";
import type { ViewportMotionFrame } from "../../../contracts";

export type FluidViewportMotionState = Readonly<{ scrollY: number; edgeY: number }>;
export const EMPTY_FLUID_VIEWPORT_MOTION: FluidViewportMotionState = Object.freeze({ scrollY: 0, edgeY: 0 });

const MAX_MOTION = 0.12;
const bounded = (value: number) => Number.isFinite(value) ? Math.max(-MAX_MOTION, Math.min(MAX_MOTION, value)) : 0;

/** Real-time momentum for viewport input, separate from dye and solver dissipation. */
export function stepFluidViewportMotion(state: FluidViewportMotionState, input: Pick<ViewportMotionFrame, "deltaY" | "blockedY">,
  elapsedSeconds: number, response: Pick<FluidViewportResponseV1, "enabled" | "strength" | "inertia" | "edgeResponse">): FluidViewportMotionState {
  if (!response.enabled || response.strength <= 0) return EMPTY_FLUID_VIEWPORT_MOTION;
  const dt = Number.isFinite(elapsedSeconds) ? Math.max(0, Math.min(0.25, elapsedSeconds)) : 0;
  // Curved half-life keeps the first slider steps near a true immediate settle.
  const halfLife = 0.9 * Math.pow(response.inertia, 1.5);
  const retention = response.inertia === 0 ? 0 : Math.pow(0.5, dt / halfLife);
  return {
    scrollY: bounded(bounded(state.scrollY) * retention + bounded(input.deltaY) * response.strength),
    edgeY: response.edgeResponse === 0 ? 0 :
      bounded(bounded(state.edgeY) * retention + bounded(input.blockedY) * response.strength * response.edgeResponse),
  };
}

export function fluidV2Decay(dt: number, velocityDissipation: number, dyeDissipation: number, pressureRetention: number) {
  return {
    velocity: 1 / (1 + velocityDissipation * dt),
    dye: 1 / (1 + dyeDissipation * dt),
    pressure: Math.pow(pressureRetention, dt * 60),
  };
}
