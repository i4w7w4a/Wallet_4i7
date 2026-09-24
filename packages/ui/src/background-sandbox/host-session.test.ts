import { describe, expect, it } from "vitest";
import type { Texture } from "ogl";
import type { BackgroundRecipe, Effect, Frame, Viewport } from "./contracts";
import { EffectSession, type PreparedMaterial } from "./host-session";

const viewport: Viewport = { cssWidth: 390, cssHeight: 500, pixelWidth: 585, pixelHeight: 750, dpr: 1.5 };
const recipe = (effectId: "silk" | "fluid", amount = 1): BackgroundRecipe => ({
  kind: "novex-background", version: 1, effectId, effectVersion: 1, seed: 7,
  params: { amount }, assetIds: [],
});

/** GPU is external to jsdom. This double accounts for every acquired/released lease. */
function fixture() {
  const callbacks = new Map<number, FrameRequestCallback>();
  const frames: Frame[] = [];
  const events: string[] = [];
  let next = 0;
  let acquired = 0;
  let peak = 0;
  let presented = 0;
  const session = new EffectSession({
    requestFrame(callback) { const id = ++next; callbacks.set(id, callback); return id; },
    cancelFrame(id) { callbacks.delete(id); },
    present() { presented++; },
    onStatus() {},
  }, viewport);
  const material = (id: "silk" | "fluid"): PreparedMaterial => ({
    id,
    mount(initial) {
      acquired++; peak = Math.max(peak, acquired); events.push(`mount:${id}`);
      let disposed = false;
      let current = initial;
      const effect: Effect<BackgroundRecipe> = {
        update(value) { current = value; events.push(`update:${(value.params as { amount: number }).amount}`); },
        resize() { events.push(`resize:${id}`); },
        render(frame) {
          if (disposed) throw new Error("render after dispose");
          frames.push(frame); events.push(`render:${id}:${(current.params as { amount: number }).amount}`);
          return { texture: {} as Texture, width: 585, height: 750 };
        },
        reset(seed) { events.push(`reset:${seed}`); },
        dispose() { if (!disposed) { disposed = true; acquired--; events.push(`dispose:${id}`); } },
      };
      return { ok: true, value: effect };
    },
  });
  const tick = (now: number) => {
    const current = [...callbacks.entries()];
    callbacks.clear();
    for (const [, callback] of current) callback(now);
  };
  return { session, callbacks, frames, events, material, tick,
    resources: () => ({ acquired, peak, presented }) };
}

describe("single host effect session", () => {
  it("disposes the previous effect before creating its replacement and keeps one RAF", async () => {
    const f = fixture();
    await f.session.select(Promise.resolve(f.material("silk")), recipe("silk"));
    f.tick(1000); f.tick(1020);
    expect(f.callbacks.size).toBe(1);
    await f.session.select(Promise.resolve(f.material("fluid")), recipe("fluid"));
    expect(f.events.indexOf("dispose:silk")).toBeLessThan(f.events.indexOf("mount:fluid"));
    expect(f.resources().peak).toBe(1);
    f.session.dispose(); f.session.dispose();
    f.tick(9000);
    expect(f.callbacks.size).toBe(0);
    expect(f.resources().acquired).toBe(0);
  });

  it("does not acquire a stale asynchronously prepared effect", async () => {
    const f = fixture();
    let finish!: (value: PreparedMaterial) => void;
    const old = f.session.select(new Promise(resolve => { finish = resolve; }), recipe("silk"));
    await f.session.select(Promise.resolve(f.material("fluid")), recipe("fluid"));
    finish(f.material("silk")); await old;
    expect(f.events.filter(event => event.startsWith("mount:"))).toEqual(["mount:fluid"]);
    f.session.dispose();
  });

  it("applies edits received during prepare without mounting obsolete parameters", async () => {
    const f = fixture();
    let finish!: (value: PreparedMaterial) => void;
    const pending = f.session.select(new Promise(resolve => { finish = resolve; }), recipe("silk", 1));
    f.session.update(recipe("silk", 4));
    finish(f.material("silk")); await pending; f.tick(100);
    expect(f.events).toContain("render:silk:4");
    expect(f.events).not.toContain("render:silk:1");
    f.session.dispose();
  });

  it("stops all hidden frames, resumes with zero dt and does not reset on parameter edits", async () => {
    const f = fixture();
    await f.session.select(Promise.resolve(f.material("silk")), recipe("silk"));
    f.tick(0); f.tick(20);
    f.session.setActive(false);
    const before = f.resources().presented;
    f.session.update(recipe("silk", 3)); f.session.resize({ ...viewport, cssHeight: 600 });
    f.tick(500000);
    expect(f.resources().presented).toBe(before);
    expect(f.callbacks.size).toBe(0);
    f.session.setActive(true); f.tick(500020);
    expect(f.frames.at(-1)).toMatchObject({ time: 0.02, dt: 0 });
    expect(f.events.some(event => event.startsWith("reset:"))).toBe(false);
    f.session.restart(); f.tick(500040);
    expect(f.frames.at(-1)).toMatchObject({ time: 0, dt: 0 });
    expect(f.events).toContain("reset:7");
    f.session.dispose();
  });

  it("leaves a failed mount as an explicit fallback with no scheduled frames", async () => {
    const f = fixture();
    await f.session.select(Promise.resolve(f.material("silk")), recipe("silk"));
    await f.session.select(Promise.resolve({ id: "fluid", mount: () => ({ ok: false,
      error: { code: "unsupported-format", message: "Float targets unavailable" } }) }), recipe("fluid"));
    expect(f.session.status.phase).toBe("fallback");
    expect(f.session.status.message).toContain("Float");
    expect(f.resources().acquired).toBe(0);
    expect(f.callbacks.size).toBe(0);
    f.session.dispose();
  });

  it("defers GPU acquisition while inactive and ignores prepare completion after disposal", async () => {
    const f = fixture();
    f.session.setActive(false);
    await f.session.select(Promise.resolve(f.material("silk")), recipe("silk"));
    expect(f.resources().acquired).toBe(0);
    f.session.setActive(true);
    expect(f.resources().acquired).toBe(1);
    let finish!: (value: PreparedMaterial) => void;
    const pending = f.session.select(new Promise(resolve => { finish = resolve; }), recipe("fluid"));
    f.session.dispose(); finish(f.material("fluid")); await pending;
    expect(f.resources().acquired).toBe(0);
    expect(f.events).not.toContain("mount:fluid");
    expect(f.callbacks.size).toBe(0);
  });

  it("allows one frozen redraw for paused edits without advancing simulation or retaining a RAF", async () => {
    const f = fixture();
    await f.session.select(Promise.resolve(f.material("silk")), recipe("silk"));
    f.tick(0); f.tick(20);
    f.session.setPaused(true);
    const before = f.resources().presented;
    f.session.update(recipe("silk", 9));
    expect(f.resources().presented).toBe(before + 1);
    expect(f.frames.at(-1)).toMatchObject({ time: 0.02, dt: 0 });
    expect(f.callbacks.size).toBe(0);
    f.session.dispose();
  });
});
