import type { PointerPhase } from "./contracts";

/** Controls keep their native events; a gesture already in the scene still terminates. */
export function materialPointerPhase(phase: PointerPhase, overControl: boolean): PointerPhase | null {
  if (!overControl) return phase;
  if (phase === "up" || phase === "cancel" || phase === "leave") return phase;
  if (phase === "move") return "cancel";
  return null;
}
