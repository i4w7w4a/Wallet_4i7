import type { BackgroundRecipe, CreateResult, Effect, EffectId, FrameTexture, PointerSample, Viewport } from "./contracts";
import type { BackgroundRuntimeStatus } from "./host-contract";
import { ActiveClock, PointerInput } from "./host-input";

export type PreparedMaterial = Readonly<{
  id: EffectId;
  mount(recipe: BackgroundRecipe, viewport: Viewport): CreateResult<Effect<BackgroundRecipe>>;
}>;
export type SessionDriver = Readonly<{
  requestFrame(callback: FrameRequestCallback): number;
  cancelFrame(id: number): void;
  present(frame: FrameTexture): void;
  onStatus(status: BackgroundRuntimeStatus): void;
}>;

export class EffectSession {
  status: BackgroundRuntimeStatus = { phase: "idle", message: "" };
  private readonly clock = new ActiveClock();
  private readonly input = new PointerInput();
  private instance: Effect<BackgroundRecipe> | null = null;
  private recipe: BackgroundRecipe | null = null;
  private ready: PreparedMaterial | null = null;
  private generation = 0;
  private frame: number | null = null;
  private active = true;
  private paused = false;
  private loading = false;
  private disposed = false;
  private pendingUpdate = false;
  private pendingResize = false;
  private pendingReset = false;

  constructor(private readonly driver: SessionDriver, private viewport: Viewport) {}

  async select(prepared: Promise<PreparedMaterial>, recipe: BackgroundRecipe) {
    if (this.disposed) return;
    const generation = ++this.generation;
    this.recipe = recipe;
    this.ready = null;
    this.loading = true;
    this.stop();
    this.report("initializing", "Подготовка материала…");
    try {
      const material = await prepared;
      if (this.disposed || generation !== this.generation) return;
      if (material.id !== this.recipe.effectId) throw new Error("Материал не соответствует выбранной пробе.");
      this.ready = material;
      this.loading = false;
      this.mountReady();
    } catch (error) {
      if (!this.disposed && generation === this.generation) this.fail(error);
    }
  }

  private mountReady() {
    if (!this.ready || !this.recipe || this.disposed) return;
    if (!this.active) { this.report("paused", "Сцена неактивна."); return; }
    const material = this.ready;
    this.ready = null;
    // Release the old lease before mount can acquire any new effect resources.
    this.release();
    const result = material.mount(this.recipe, this.viewport);
    if (!result.ok) { this.fail(new Error(result.error.message)); return; }
    this.instance = result.value;
    this.clock.reset();
    this.input.reset();
    this.pendingUpdate = this.pendingResize = this.pendingReset = false;
    this.refresh();
    if (this.paused) this.draw();
  }

  update(recipe: BackgroundRecipe) {
    if (this.disposed || recipe.effectId !== this.recipe?.effectId) return;
    this.recipe = recipe;
    this.pendingUpdate = true;
    if (this.paused) this.draw();
  }

  resize(viewport: Viewport) {
    if (this.disposed) return;
    if (this.viewport.cssWidth === viewport.cssWidth && this.viewport.cssHeight === viewport.cssHeight &&
        this.viewport.pixelWidth === viewport.pixelWidth && this.viewport.pixelHeight === viewport.pixelHeight) return;
    this.viewport = viewport;
    this.pendingResize = true;
    this.input.reset();
    if (this.paused) this.draw();
  }

  setActive(active: boolean) {
    if (this.disposed || active === this.active) return;
    this.active = active;
    if (!active) { this.stop(); this.input.reset(); }
    try {
      this.mountReady();
      this.refresh();
      if (active && this.paused) this.draw();
    } catch (error) { this.fail(error); }
  }

  setPaused(paused: boolean) {
    if (this.disposed || paused === this.paused) return;
    this.paused = paused;
    this.stop();
    this.input.reset();
    this.refresh();
  }

  pointer(sample: Omit<PointerSample, "delta" | "time">) {
    if (!this.disposed && this.active && !this.paused && !this.loading) {
      this.input.push({ ...sample, time: this.clock.time });
    }
  }

  restart() {
    if (this.disposed) return;
    this.clock.reset();
    this.input.reset();
    this.pendingReset = true;
    if (this.paused) this.draw();
  }

  private canDraw() { return !this.disposed && this.active && !this.loading && !this.ready && this.instance !== null; }

  private draw(now?: number) {
    if (!this.canDraw() || !this.instance || !this.recipe) return;
    try {
      if (this.pendingResize) { this.instance.resize(this.viewport); this.pendingResize = false; }
      if (this.pendingUpdate) { this.instance.update(this.recipe); this.pendingUpdate = false; }
      if (this.pendingReset) { this.instance.reset(this.recipe.seed); this.pendingReset = false; }
      const timing = now === undefined ? { time: this.clock.time, dt: 0 } : this.clock.advance(now);
      this.driver.present(this.instance.render({ ...timing, pointer: this.input.drain() }));
    } catch (error) { this.fail(error); }
  }

  private readonly tick = (now: number) => {
    this.frame = null;
    if (!this.canDraw() || this.paused) return;
    this.draw(now);
    this.schedule();
  };

  private schedule() {
    if (this.canDraw() && !this.paused && this.frame === null) this.frame = this.driver.requestFrame(this.tick);
  }

  private stop() {
    if (this.frame !== null) this.driver.cancelFrame(this.frame);
    this.frame = null;
    this.clock.pause();
  }

  private refresh() {
    if (!this.instance || this.loading || this.ready || this.disposed) return;
    if (this.active && !this.paused) { this.report("running", "Живой материал"); this.schedule(); }
    else { this.report("paused", this.active ? "Пауза" : "Сцена неактивна."); this.stop(); }
  }

  private release() {
    const instance = this.instance;
    this.instance = null;
    instance?.dispose();
  }

  private fail(error: unknown) {
    this.stop();
    this.loading = false;
    this.ready = null;
    let message = error instanceof Error ? error.message : "Материал недоступен.";
    try { this.release(); } catch { message += " Не удалось подтвердить освобождение ресурсов."; }
    this.report("fallback", message);
  }

  private report(phase: BackgroundRuntimeStatus["phase"], message: string) {
    const next: BackgroundRuntimeStatus = { phase, message, effectId: this.recipe?.effectId,
      diagnostics: this.instance?.getDiagnostics?.() };
    if (JSON.stringify(next) === JSON.stringify(this.status)) return;
    this.status = next;
    this.driver.onStatus(next);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.generation++;
    this.ready = null;
    this.stop();
    this.input.reset();
    try { this.release(); } finally { this.report("disposed", "Сцена закрыта."); }
  }
}
