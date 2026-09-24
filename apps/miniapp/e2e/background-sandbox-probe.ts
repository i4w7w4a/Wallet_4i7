import type { Page } from "@playwright/test";

type Snapshot = { contexts: number; live: number; pendingRaf: number; draws: number; presents: number; resources: Record<string, number> };
export type SandboxProbe = {
  snapshot(): Snapshot;
  activity(active: boolean): void;
  saveData(active: boolean): void;
  visibility(hidden: boolean): void;
  lose(): void;
  restore(): void;
};
declare global { interface Window { __sandboxProbe: SandboxProbe } }

/** Test-only observation of native ownership; no runtime backdoor or substitute adapter. */
export async function installSandboxProbe(page: Page) {
  await page.addInitScript(() => {
    const contexts = new Map<WebGL2RenderingContext, Record<string, Set<unknown>>>();
    const pending = new Set<number>();
    let draws = 0, presents = 0;
    let lostExtension: WEBGL_lose_context | null = null;
    const ensure = (gl: WebGL2RenderingContext) => {
      if (!(gl.canvas instanceof HTMLCanvasElement) || !gl.canvas.matches("[data-background-canvas]")) return null;
      let objects = contexts.get(gl);
      if (!objects) { objects = {}; contexts.set(gl, objects); }
      return objects;
    };
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: Parameters<typeof getContext>) {
      const context = Reflect.apply(getContext, this, args);
      if (context instanceof WebGL2RenderingContext) ensure(context);
      return context;
    } as typeof getContext;
    const api = WebGL2RenderingContext.prototype as unknown as Record<string, (...args: unknown[]) => unknown>;
    for (const name of ["Texture", "Framebuffer", "Renderbuffer", "Buffer", "Program", "Shader", "VertexArray"]) {
      const create = api["create" + name]!, remove = api["delete" + name]!;
      api["create" + name] = function (this: WebGL2RenderingContext, ...args) {
        const value = create.apply(this, args), objects = ensure(this);
        if (value && objects) (objects[name] ??= new Set()).add(value);
        return value;
      };
      api["delete" + name] = function (this: WebGL2RenderingContext, ...args) {
        ensure(this)?.[name]?.delete(args[0]);
        return remove.apply(this, args);
      };
    }
    for (const name of ["drawArrays", "drawElements"]) {
      const draw = api[name]!;
      api[name] = function (this: WebGL2RenderingContext, ...args) {
        if (ensure(this)) { draws++; if (this.getParameter(this.FRAMEBUFFER_BINDING) === null) presents++; }
        return draw.apply(this, args);
      };
    }
    const request = window.requestAnimationFrame.bind(window), cancel = window.cancelAnimationFrame.bind(window);
    window.requestAnimationFrame = callback => {
      const id = request(time => { pending.delete(id); callback(time); });
      pending.add(id); return id;
    };
    window.cancelAnimationFrame = id => { pending.delete(id); cancel(id); };
    const handlers = new Map<string, Set<() => void>>();
    Object.defineProperty(window, "Telegram", { configurable: true, value: { WebApp: {
      initDataUnsafe: { user: { id: 23, first_name: "Local QA" } },
      onEvent(name: string, handler: () => void) { const set = handlers.get(name) ?? new Set(); set.add(handler); handlers.set(name, set); },
      offEvent(name: string, handler: () => void) { handlers.get(name)?.delete(handler); },
    } } });
    const connection = Object.assign(new EventTarget(), { saveData: false });
    Object.defineProperty(navigator, "connection", { configurable: true, value: connection });
    window.__sandboxProbe = {
      snapshot() {
        const resources: Record<string, number> = {}; let live = 0;
        for (const [gl, objects] of contexts) if (!gl.isContextLost()) {
          live++; for (const [kind, values] of Object.entries(objects)) resources[kind] = (resources[kind] ?? 0) + values.size;
        }
        return { contexts: contexts.size, live, pendingRaf: pending.size, draws, presents, resources };
      },
      activity(active) { handlers.get(active ? "activated" : "deactivated")?.forEach(handler => handler()); },
      saveData(active) { connection.saveData = active; connection.dispatchEvent(new Event("change")); },
      visibility(hidden) {
        Object.defineProperty(document, "visibilityState", { configurable: true, value: hidden ? "hidden" : "visible" });
        document.dispatchEvent(new Event("visibilitychange"));
      },
      lose() {
        const gl = [...contexts.keys()].find(gl => !gl.isContextLost());
        lostExtension = gl?.getExtension("WEBGL_lose_context") ?? null;
        lostExtension?.loseContext();
      },
      restore() { lostExtension?.restoreContext(); },
    };
  });
}

export function snapshot(page: Page) { return page.evaluate(() => window.__sandboxProbe.snapshot()); }
