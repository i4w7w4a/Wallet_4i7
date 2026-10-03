import type { MonoGlassSettings } from "./mono-glass-settings";

export type MonoOpticalRegionOptions = Readonly<{
  /** Promo keeps its approved relief; panels borrow the current background pass. */
  source?: "relief" | "background";
  onPresented?: (presented: boolean) => void;
}>;

export type MonoOpticalLease = {
  update(settings: Readonly<MonoGlassSettings>): void;
  /** Request a host frame after a DOM geometry change, including while paused. */
  invalidate?(): void;
  dispose(): void;
};
export interface MonoSharedOpticalHost {
  subscribe(listener: () => void): () => void;
  getSnapshot(): boolean;
  register(element: HTMLElement, settings: Readonly<MonoGlassSettings>, options?: MonoOpticalRegionOptions): MonoOpticalLease;
}
export type MonoOpticalRegion = Readonly<{
  element: HTMLElement; settings: Readonly<MonoGlassSettings>; source: "relief" | "background";
}>;

/** DOM region leases only; owns no canvas, context, RAF, listeners or persistence. */
export function createMonoOpticalHost() {
  const regions = new Map<MonoOpticalRegion, { presented: boolean; onPresented?: (presented: boolean) => void }>();
  let available = false;
  const subscribers = new Set<() => void>();
  const invalidations = new Set<() => void>();
  const present = (next: boolean) => {
    if (available === next) return;
    available = next;
    subscribers.forEach(listener => listener());
  };
  const invalidate = () => invalidations.forEach(listener => listener());
  const syncPromo = () => present([...regions].some(([region, state]) => region.source === "relief" && state.presented));
  const markRegionPresented = (region: MonoOpticalRegion, next: boolean) => {
    const state = regions.get(region);
    if (!state || state.presented === next) return;
    state.presented = next;
    state.onPresented?.(next);
    syncPromo();
  };
  const remove = (region: MonoOpticalRegion) => {
    markRegionPresented(region, false);
    regions.delete(region);
    syncPromo();
  };
  const binding: MonoSharedOpticalHost = {
    subscribe(listener) { subscribers.add(listener); return () => { subscribers.delete(listener); }; },
    getSnapshot: () => available,
    register(element, settings, options = {}) {
      // Strict Mode/remounts can replace a lease before its previous cleanup runs.
      for (const region of regions.keys()) if (region.element === element) remove(region);
      const owned = { element, settings, source: options.source ?? "relief" };
      regions.set(owned, { presented: false, onPresented: options.onPresented });
      invalidate();
      return {
        invalidate() { if (regions.has(owned)) invalidate(); },
        update(next) {
          if (!regions.has(owned) || JSON.stringify(owned.settings) === JSON.stringify(next)) return;
          owned.settings = next; invalidate();
        },
        dispose() { if (regions.has(owned)) { remove(owned); invalidate(); } },
      };
    },
  };
  return {
    binding,
    getRegion: () => [...regions.keys()].find(region => region.source === "relief") ?? null,
    getRegions: (): readonly MonoOpticalRegion[] => [...regions.keys()],
    markRegionPresented,
    // Compatibility with the original Promo-only consumer. Global failure clears
    // every lease; global success can never falsely enable a background lens.
    markPresented(next: boolean) {
      for (const region of regions.keys()) if (!next || region.source === "relief") markRegionPresented(region, next);
    },
    subscribeInvalidation(listener: () => void) { invalidations.add(listener); return () => { invalidations.delete(listener); }; },
  };
}

export type MonoOpticalHost = ReturnType<typeof createMonoOpticalHost>;
