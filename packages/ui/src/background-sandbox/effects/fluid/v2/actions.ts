import type { MaterialAction } from "../../../material-contract";
import { makeFluidSeededSplat, type AmbientSplat } from "./clock";
export interface FluidActionState { seed: number; cursor: number; pending: number }
export function createFluidActionState(seed: number): FluidActionState { return { seed, cursor: 0, pending: 0 }; }
export function queueFluidAction(state: FluidActionState, action: MaterialAction): FluidActionState {
  if (action.kind !== "seeded-splats" || !Number.isInteger(action.count) || action.count < 1 || action.count > 6) return state;
  return { ...state, pending: Math.min(12, state.pending + action.count) };
}
export function drainFluidAction(state: FluidActionState, maxPerFrame: number): { state: FluidActionState; splats: AmbientSplat[] } {
  const count = Math.min(state.pending, Number.isFinite(maxPerFrame) ? Math.max(0, Math.min(6, Math.floor(maxPerFrame))) : 0);
  const splats = Array.from({ length: count }, (_, index) => makeFluidSeededSplat(state.seed ^ 0xa5a5a5a5, state.cursor + index));
  return { state: { ...state, pending: state.pending - count, cursor: state.cursor + count }, splats };
}
