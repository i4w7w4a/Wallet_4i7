import type { PointerPhase } from "./contracts";

const CONTROL_SELECTOR = "button,a,input,select,textarea,summary,[contenteditable=true],[role='button'],[role='slider']";

/** Implicit touch capture keeps event.target at the start point, so also inspect the current point. */
export function materialPointerOverControl(target: EventTarget | null, hitTarget: Element | null, root: Element): boolean {
  const isControl = (element: EventTarget | null) => element instanceof Element && Boolean(element.closest(CONTROL_SELECTOR));
  return isControl(target) || isControl(hitTarget) || Boolean(hitTarget && !root.contains(hitTarget));
}

/** Controls keep their native events; a gesture already in the scene still terminates. */
export function materialPointerPhase(phase: PointerPhase, overControl: boolean): PointerPhase | null {
  if (!overControl) return phase;
  if (phase === "cancel" || phase === "leave") return phase;
  if (phase === "up" || phase === "move") return "cancel";
  return null;
}
