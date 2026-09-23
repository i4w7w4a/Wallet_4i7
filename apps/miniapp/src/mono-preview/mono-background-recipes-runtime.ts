import { monoBackgroundPointer, type MonoBackgroundRecipeConfig } from "./mono-background-recipes";

export type MonoBackgroundRuntime = { active: boolean; hostActive: boolean; effectsDisabled: boolean };
type Connection = EventTarget & { readonly saveData?: boolean };

/** No frame queue, timers, React renders per pointer sample, or GPU resources. */
export function mountMonoBackgroundMotion(layer: HTMLElement, surface: HTMLElement,
  config: MonoBackgroundRecipeConfig, runtime: MonoBackgroundRuntime): () => void {
  const doc = layer.ownerDocument;
  const view = doc.defaultView;
  const reset = () => {
    layer.dataset.pointerActive = "false";
    for (const key of ["--recipe-x", "--recipe-y", "--mono-pointer-shift-x", "--mono-pointer-shift-y"]) layer.style.setProperty(key, "0px");
    layer.style.setProperty("--recipe-angle", "0deg");
    layer.style.setProperty("--mono-pointer-x", "68%");
    layer.style.setProperty("--mono-pointer-y", "31%");
  };
  reset();
  if (!view || !runtime.active || !runtime.hostActive || runtime.effectsDisabled || config.calm) {
    layer.dataset.motion = config.calm ? "calm" : runtime.effectsDisabled ? "effects-off" : "inactive";
    return reset;
  }
  const fine = view.matchMedia("(hover: hover) and (pointer: fine)");
  const reduced = view.matchMedia("(prefers-reduced-motion: reduce)");
  const connection = (view.navigator as Navigator & { connection?: Connection }).connection;
  let intersecting = true;
  let listening = false;
  let disposed = false;
  const reason = () => doc.visibilityState === "hidden" ? "hidden"
    : reduced.matches ? "reduced" : !fine.matches ? "coarse"
    : connection?.saveData ? "save-data" : !intersecting ? "offscreen" : "ready";
  const move = (event: PointerEvent) => {
    if (event.pointerType !== "mouse" || reason() !== "ready") return;
    const bounds = surface.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const x = Math.max(0, Math.min(bounds.width, event.clientX - bounds.left));
    const y = Math.max(0, Math.min(bounds.height, event.clientY - bounds.top));
    const point = monoBackgroundPointer(x, y, bounds.width, bounds.height, config);
    layer.style.setProperty("--recipe-x", `${point.x.toFixed(2)}px`);
    layer.style.setProperty("--recipe-y", `${point.y.toFixed(2)}px`);
    layer.style.setProperty("--recipe-angle", `${point.angle.toFixed(2)}deg`);
    // Exact iris travel budget is retained; these values belong only to the backdrop.
    layer.style.setProperty("--mono-pointer-x", `${x}px`);
    layer.style.setProperty("--mono-pointer-y", `${y}px`);
    layer.style.setProperty("--mono-pointer-shift-x", `${((x / bounds.width * 2 - 1) * 11).toFixed(2)}px`);
    layer.style.setProperty("--mono-pointer-shift-y", `${((y / bounds.height * 2 - 1) * 7).toFixed(2)}px`);
    layer.dataset.pointerActive = "true";
  };
  const detach = () => {
    surface.removeEventListener("pointermove", move);
    surface.removeEventListener("pointerleave", reset);
    surface.removeEventListener("pointercancel", reset);
    listening = false;
  };
  const sync = () => {
    if (disposed) return;
    layer.dataset.motion = reason();
    if (reason() === "ready") {
      if (!listening) {
        surface.addEventListener("pointermove", move, { passive: true });
        surface.addEventListener("pointerleave", reset);
        surface.addEventListener("pointercancel", reset);
        listening = true;
      }
    } else { detach(); reset(); }
  };
  const observer = typeof view.IntersectionObserver === "function" ? new view.IntersectionObserver(entries => {
    intersecting = entries[0]?.isIntersecting ?? false; sync();
  }) : null;
  observer?.observe(surface);
  doc.addEventListener("visibilitychange", sync);
  fine.addEventListener("change", sync);
  reduced.addEventListener("change", sync);
  connection?.addEventListener("change", sync);
  sync();
  return () => {
    disposed = true; detach(); observer?.disconnect();
    doc.removeEventListener("visibilitychange", sync);
    fine.removeEventListener("change", sync);
    reduced.removeEventListener("change", sync);
    connection?.removeEventListener("change", sync);
    layer.dataset.motion = "inactive"; reset();
  };
}
