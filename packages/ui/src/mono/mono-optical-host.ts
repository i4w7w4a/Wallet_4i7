import type { MonoGlassSettings } from "./mono-optical-glass";

export type MonoOpticalLease = {
  update(settings: Readonly<MonoGlassSettings>): void;
  dispose(): void;
};
export interface MonoSharedOpticalHost {
  subscribe(listener: () => void): () => void;
  getSnapshot(): boolean;
  register(element: HTMLElement, settings: Readonly<MonoGlassSettings>): MonoOpticalLease;
}
export type MonoOpticalRegion = Readonly<{ element: HTMLElement; settings: Readonly<MonoGlassSettings> }>;

/** A single DOM region registration; owns no canvas, context, RAF, or persistence. */
export function createMonoOpticalHost() {
  let region: MonoOpticalRegion | null = null;
  let available = false;
  const subscribers = new Set<() => void>();
  const invalidations = new Set<() => void>();
  const present = (next: boolean) => {
    if (available === next) return;
    available = next;
    subscribers.forEach(listener => listener());
  };
  const invalidate = () => invalidations.forEach(listener => listener());
  const binding: MonoSharedOpticalHost = {
    subscribe(listener) { subscribers.add(listener); return () => { subscribers.delete(listener); }; },
    getSnapshot: () => available,
    register(element, settings) {
      if (region && region.element !== element && region.element.isConnected) throw new Error("Only one shared Promo region may be active.");
      const owned = { element, settings };
      region = owned; present(false); invalidate();
      return {
        update(next) {
          if (region !== owned || JSON.stringify(owned.settings) === JSON.stringify(next)) return;
          owned.settings = next; invalidate();
        },
        dispose() { if (region === owned) { region = null; present(false); invalidate(); } },
      };
    },
  };
  return {
    binding,
    getRegion: () => region,
    markPresented: present,
    subscribeInvalidation(listener: () => void) { invalidations.add(listener); return () => { invalidations.delete(listener); }; },
  };
}

export type MonoOpticalHost = ReturnType<typeof createMonoOpticalHost>;
