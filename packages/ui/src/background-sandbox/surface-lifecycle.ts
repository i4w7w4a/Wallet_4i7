import type { BackgroundRecipe, PointerSample } from "./contracts";
import type { BackgroundRuntimeStatus } from "./host-contract";
import type { MaterialBinding } from "./material-binding";

export type SurfaceInput = Readonly<{
  material: MaterialBinding;
  recipe: BackgroundRecipe;
  paused: boolean;
  restartKey: number;
  hostActive: boolean;
  effectsDisabled: boolean;
}>;

export interface SurfaceBackend {
  update(input: SurfaceInput): void;
  setActive(active: boolean): void;
  resize(): void;
  pointer(sample: Omit<PointerSample, "delta" | "time">): void;
  dispose(): void;
}

export type SurfaceBackendFactory = (
  root: HTMLElement, input: SurfaceInput,
  onStatus: (status: BackgroundRuntimeStatus) => void,
  onRestore: () => void,
) => SurfaceBackend;

export function mountSurface(
  root: HTMLElement, initial: SurfaceInput, factory: SurfaceBackendFactory,
  onStatus: (status: BackgroundRuntimeStatus) => void,
): { update(input: SurfaceInput): void; dispose(): void } {
  let input = initial;
  let backend: SurfaceBackend | null = null;
  let disposed = false;
  let epoch = 0;
  let attemptKey = "";
  let tracking = false;
  let lastPointerId: number | null = null;
  let lastStatus = "";
  let intersecting = typeof IntersectionObserver === "undefined";
  let recovered = false;
  const motion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  const contrast = window.matchMedia?.("(forced-colors: active)");
  const fine = window.matchMedia?.("(hover: hover) and (pointer: fine)");
  const connection = (navigator as Navigator & { connection?: {
    saveData?: boolean; addEventListener?: (name: string, listener: EventListener) => void;
    removeEventListener?: (name: string, listener: EventListener) => void;
  } }).connection;

  const report = (status: BackgroundRuntimeStatus) => {
    if (disposed) return;
    const next = recovered && status.phase === "running"
      ? { ...status, message: "GPU восстановлен · симуляция начата заново." } : status;
    const key = JSON.stringify(next);
    if (key !== lastStatus) { lastStatus = key; onStatus(next); }
  };
  const drop = () => {
    epoch++;
    const previous = backend;
    backend = null;
    previous?.dispose();
  };

  const pointer = (event: PointerEvent) => {
    if (!backend || !tracking || event.isPrimary === false || event.pointerType === "touch") return;
    const phase = event.type.replace("pointer", "") as PointerSample["phase"];
    const blocked = event.target instanceof Element && event.target.closest(
      "button,a,input,select,textarea,summary,[contenteditable=true],[role=slider],[data-background-controls]",
    );
    const rect = root.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    lastPointerId = event.pointerId;
    backend.pointer({ id: event.pointerId, phase: blocked ? "cancel" : phase,
      uv: [(event.clientX - rect.left) / rect.width, 1 - (event.clientY - rect.top) / rect.height],
      buttons: blocked ? 0 : event.buttons });
  };
  const pointerEvents = ["pointerenter", "pointermove", "pointerdown", "pointerup", "pointerleave", "pointercancel"] as const;
  const setTracking = (next: boolean) => {
    if (tracking === next) return;
    tracking = next;
    for (const name of pointerEvents) {
      if (next) root.addEventListener(name, pointer, { passive: true });
      else root.removeEventListener(name, pointer);
    }
    if (!next && lastPointerId !== null) {
      backend?.pointer({ id: lastPointerId, phase: "cancel", uv: [0.5, 0.5], buttons: 0 });
      lastPointerId = null;
    }
  };

  function sync() {
    if (disposed) return;
    const blocked = input.effectsDisabled || motion?.matches || contrast?.matches || connection?.saveData;
    const active = input.hostActive && document.visibilityState !== "hidden" && intersecting &&
      root.clientWidth > 0 && root.clientHeight > 0;
    setTracking(Boolean(!blocked && active && !input.paused && fine?.matches));
    if (blocked) {
      drop(); attemptKey = "";
      const message = input.effectsDisabled ? "Эффекты выключены · статический фон."
        : motion?.matches ? "Ограничение движения · статический фон."
          : connection?.saveData ? "Экономия трафика · статический фон." : "Контрастный режим · статический фон.";
      report({ phase: "fallback", message, effectId: input.recipe.effectId });
      return;
    }
    if (!backend && active) {
      const key = `${input.recipe.effectId}:${input.restartKey}:${root.clientWidth}:${root.clientHeight}:${window.devicePixelRatio}`;
      if (key !== attemptKey) {
        attemptKey = key;
        const mine = ++epoch;
        try {
          backend = factory(root, input, status => { if (mine === epoch) report(status); }, () => {
            if (disposed || mine !== epoch) return;
            recovered = true; drop(); attemptKey = ""; sync();
          });
        } catch (error) {
          report({ phase: "fallback", effectId: input.recipe.effectId,
            message: error instanceof Error ? error.message : "GPU-материал недоступен." });
        }
      }
    }
    if (backend) {
      backend.setActive(active);
      backend.update(input);
      if (active) backend.resize();
    } else if (!active) report({ phase: "paused", message: "Сцена вне активной области.", effectId: input.recipe.effectId });
  }

  const intersection = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver(entries => {
    intersecting = entries[0]?.isIntersecting ?? false; sync();
  });
  const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(sync);
  intersection?.observe(root);
  resize?.observe(root);
  window.addEventListener("resize", sync);
  document.addEventListener("visibilitychange", sync);
  for (const query of [motion, contrast, fine]) query?.addEventListener("change", sync);
  connection?.addEventListener?.("change", sync);
  sync();

  return {
    update(next) {
      if (disposed) return;
      if (next.restartKey !== input.restartKey || next.recipe.effectId !== input.recipe.effectId) recovered = false;
      input = next; sync();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      setTracking(false);
      intersection?.disconnect(); resize?.disconnect();
      window.removeEventListener("resize", sync);
      document.removeEventListener("visibilitychange", sync);
      for (const query of [motion, contrast, fine]) query?.removeEventListener("change", sync);
      connection?.removeEventListener?.("change", sync);
      drop();
    },
  };
}
