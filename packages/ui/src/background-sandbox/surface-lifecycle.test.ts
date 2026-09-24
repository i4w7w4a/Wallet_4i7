import { afterEach, describe, expect, it, vi } from "vitest";
import { bindMaterial } from "./material-binding";
import { silkDefinition } from "./effects/silk/definition";
import { mountSurface, type SurfaceBackendFactory, type SurfaceInput } from "./surface-lifecycle";
import type { BackgroundRuntimeStatus } from "./host-contract";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); document.body.replaceChildren(); });

function setup(initialReduced = false) {
  let reduced = initialReduced;
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  const reducedEvents = new EventTarget();
  vi.stubGlobal("matchMedia", (query: string) => ({
    get matches() { return query.includes("reduced-motion") ? reduced : query.includes("pointer: fine"); },
    addEventListener: reducedEvents.addEventListener.bind(reducedEvents),
    removeEventListener: reducedEvents.removeEventListener.bind(reducedEvents),
  }));
  vi.stubGlobal("IntersectionObserver", undefined);
  vi.stubGlobal("ResizeObserver", undefined);
  const root = document.createElement("div");
  Object.defineProperties(root, { clientWidth: { value: 390 }, clientHeight: { value: 700 } });
  document.body.append(root);
  const material = bindMaterial(silkDefinition);
  const input: SurfaceInput = { material, recipe: material.descriptor.presets[0]!.recipe,
    paused: false, restartKey: 0, hostActive: true, effectsDisabled: false };
  const events: string[] = [];
  const statuses: BackgroundRuntimeStatus[] = [];
  let acquired = 0;
  const factory: SurfaceBackendFactory = () => {
    acquired++; events.push("acquire");
    return {
      update() { events.push("update"); }, resize() { events.push("resize"); }, pointer() { events.push("pointer"); },
      setActive(value) { events.push(`active:${value}`); },
      dispose() { acquired--; events.push("release"); },
    };
  };
  return { root, input, events, statuses, factory, resources: () => acquired,
    setReduced(value: boolean) { reduced = value; reducedEvents.dispatchEvent(new Event("change")); } };
}

describe("surface capability lifecycle", () => {
  it("releases the actual backend on effects-off without rewriting the supplied recipe", () => {
    const f = setup();
    const original = JSON.stringify(f.input.recipe);
    const host = mountSurface(f.root, f.input, f.factory, value => f.statuses.push(value));
    host.update({ ...f.input, effectsDisabled: true });
    expect(f.resources()).toBe(0);
    expect(f.statuses.at(-1)?.message).toContain("Эффекты выключены");
    expect(JSON.stringify(f.input.recipe)).toBe(original);
    host.update(f.input);
    expect(f.resources()).toBe(1);
    host.dispose();
  });

  it("releases an asynchronously failed render/context and retries only after an explicit restart", async () => {
    const f = setup(); let report!: (status: BackgroundRuntimeStatus) => void;
    const host = mountSurface(f.root, f.input, (...args) => {
      report = args[2]; return f.factory(...args);
    }, value => f.statuses.push(value));
    expect(f.resources()).toBe(1);
    report({ phase: "fallback", message: "Promo allocation failed" });
    await Promise.resolve();
    expect(f.resources()).toBe(0);
    host.update(f.input);
    expect(f.resources()).toBe(0);
    expect(f.statuses.at(-1)?.message).toBe("Promo allocation failed");
    host.update({ ...f.input, restartKey: 1 });
    expect(f.resources()).toBe(1);
    host.dispose();
  });

  it("does not acquire GPU in reduced motion and releases it before entering fallback", () => {
    const f = setup(true);
    const host = mountSurface(f.root, f.input, f.factory, value => f.statuses.push(value));
    expect(f.resources()).toBe(0);
    expect(f.statuses.at(-1)?.phase).toBe("fallback");
    f.setReduced(false);
    expect(f.resources()).toBe(1);
    f.setReduced(true);
    expect(f.resources()).toBe(0);
    expect(f.events.filter(event => event === "acquire" || event === "release")).toEqual(["acquire", "release"]);
    host.dispose(); f.setReduced(false);
    expect(f.resources()).toBe(0);
  });

  it("keeps ordinary edits on the same backend, gates host activity, and disposes once", () => {
    const f = setup();
    const host = mountSurface(f.root, f.input, f.factory, value => f.statuses.push(value));
    host.update({ ...f.input, recipe: { ...f.input.recipe, seed: 3 } });
    host.update({ ...f.input, hostActive: false });
    expect(f.resources()).toBe(1);
    expect(f.events).toContain("active:false");
    expect(f.events.filter(event => event === "acquire")).toHaveLength(1);
    host.dispose(); host.dispose();
    window.dispatchEvent(new Event("resize"));
    expect(f.resources()).toBe(0);
    expect(f.events.filter(event => event === "release")).toHaveLength(1);
  });

  it("reports a failed GPU constructor honestly without retrying on every identical update", () => {
    const f = setup(); let attempts = 0;
    const host = mountSurface(f.root, f.input, () => { attempts++; throw new Error("WebGL2 unavailable"); }, value => f.statuses.push(value));
    host.update(f.input); host.update(f.input);
    expect(attempts).toBe(1);
    expect(f.statuses.at(-1)).toMatchObject({ phase: "fallback", message: "WebGL2 unavailable" });
    host.update({ ...f.input, restartKey: 1 });
    expect(attempts).toBe(2);
    host.dispose();
  });
});
