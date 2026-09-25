import { Renderer, Texture, type OGLRenderingContext } from "ogl";
import type { Frame, GpuLimits, PointerFrame, PointerPhase, Viewport } from "./contracts";
import { ActiveClock, PointerInput, resolveViewport } from "./host-input";
import type { BackgroundOverlay } from "./overlay";
import type { BackgroundRuntimeStatus } from "./host-contract";
import type {
  ButtonMaterialLayer, MaterialFrameTexture, MaterialMaskSource, MaterialPass,
  MaterialQualityProfile, MaterialRecipeV2, MaterialResourcePlan, MaterialTargetBinding,
  MaterialTargetGeometry,
} from "./material-contract";
import { MaterialCompositor, type MaterialDrawMode } from "./material-compositor";
import { planMaterialSceneBudget } from "./material-scene-budget";
import { materialSceneStructureKey } from "./material-scene-state";
import { resolveMaterialTargetGeometry } from "./material-target-geometry";
import { rasterizeMaterialIcon } from "./material-icon-assets";
import { materialBindingsV2, materialCatalogV2 } from "./registry-v2";
import { parseTargetBindings } from "./target-binding";
import { clearPaperPreparedAssets } from "./effects/paper/prepare";
import type { MaterialBindingV2, PreparedMaterialMountV2 } from "./material-binding-v2";

const TOTAL_BYTES = 32 * 1024 * 1024;
const PROMO_BYTES = 4 * 1024 * 1024;
const CPU_PREPARE_BYTES = 8 * 1024 * 1024;
const EMPTY_POINTER: PointerFrame = { uv: [0.5, 0.5], inside: false, down: false, samples: [] };

export type MaterialSceneInput = Readonly<{
  background: MaterialRecipeV2 | null;
  bindings: readonly MaterialTargetBinding[];
  quality: MaterialQualityProfile;
  paused: boolean;
  restartKey: number;
  hostActive: boolean;
  overlay?: BackgroundOverlay;
  transientAction?: Readonly<{ requestId: number; action: import("./material-contract").MaterialAction }>;
}>;

type Spec = Readonly<{
  key: string;
  recipe: MaterialRecipeV2;
  binding: MaterialBindingV2;
  geometry: MaterialTargetGeometry;
  maskSource?: MaterialMaskSource;
  button?: HTMLElement;
  layer?: ButtonMaterialLayer;
}>;
type ActivePass = Spec & Readonly<{
  pass: MaterialPass<MaterialRecipeV2>;
  plan: MaterialResourcePlan;
  iconTexture?: Texture;
}>;

const effectBinding = (id: MaterialRecipeV2["effectId"]) =>
  materialBindingsV2.find(binding => binding.descriptor.id === id);

function iconTexture(gl: OGLRenderingContext, source: MaterialMaskSource): Texture {
  // Canvas 2D coverage is top-down; WebGL typed-array rows begin at the bottom.
  const rgba = new Uint8Array(source.width * source.height * 4);
  for (let y = 0; y < source.height; y++) for (let x = 0; x < source.width; x++) {
    const pixel = ((source.height - 1 - y) * source.width + x) * 4;
    const alpha = source.coverage[y * source.width + x]!;
    rgba[pixel] = rgba[pixel + 1] = rgba[pixel + 2] = 255;
    rgba[pixel + 3] = alpha;
  }
  return new Texture(gl, { image: rgba, width: source.width, height: source.height,
    type: gl.UNSIGNED_BYTE, format: gl.RGBA, internalFormat: (gl as WebGL2RenderingContext).RGBA8,
    minFilter: gl.LINEAR, magFilter: gl.LINEAR, generateMipmaps: false,
    wrapS: gl.CLAMP_TO_EDGE, wrapT: gl.CLAMP_TO_EDGE, flipY: false });
}

function deleteTexture(gl: OGLRenderingContext, texture: Texture): void {
  gl.renderer.state.textureUnits.forEach((id, index, units) => { if (id === texture.id) units[index] = -1; });
  gl.deleteTexture(texture.texture);
}

/** A lab scene owns one canvas, one WebGL2 context and one RAF for all active passes. */
export class MaterialSceneBackend {
  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: Renderer;
  private readonly gl: OGLRenderingContext;
  private readonly limits: GpuLimits;
  private readonly compositor: MaterialCompositor;
  private readonly clock = new ActiveClock();
  private readonly pointer = new PointerInput();
  private readonly resizeObserver: ResizeObserver;
  private readonly mutationObserver: MutationObserver;
  private viewport: Viewport;
  private input: MaterialSceneInput;
  private passes: ActivePass[] = [];
  private optical: ReturnType<BackgroundOverlay["create"]> | null = null;
  private unsubscribeOverlay: (() => void) | null = null;
  private abort: AbortController | null = null;
  private generation = 0;
  private frameId: number | null = null;
  private lastActionId = 0;
  private structureKey = "";
  private waitingTargets = false;
  private loading = false;
  private lost = false;
  private disposed = false;
  private status: BackgroundRuntimeStatus = { phase: "idle", message: "" };

  constructor(private readonly root: HTMLElement, input: MaterialSceneInput,
    private readonly onStatus: (status: BackgroundRuntimeStatus) => void,
    private readonly onRestore: () => void) {
    this.input = input;
    this.canvas = document.createElement("canvas");
    this.canvas.dataset.materialCanvas = "true";
    this.canvas.setAttribute("aria-hidden", "true");
    Object.assign(this.canvas.style, { position: "absolute", inset: "0", display: "block", pointerEvents: "none" });
    root.prepend(this.canvas);
    try {
      this.renderer = new Renderer({ canvas: this.canvas, webgl: 2, alpha: true, premultipliedAlpha: true,
        antialias: false, depth: false, dpr: 1 });
      if (!this.renderer.isWebgl2) throw new Error("Для материалов нужен WebGL2.");
      this.gl = this.renderer.gl;
      this.limits = { maxTextureSize: Math.min(4096, this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE) as number,
        this.gl.getParameter(this.gl.MAX_RENDERBUFFER_SIZE) as number),
        maxRenderTargetBytes: TOTAL_BYTES - PROMO_BYTES };
      const size = resolveViewport(root.clientWidth, root.clientHeight, window.devicePixelRatio, this.limits.maxTextureSize);
      if (!size) throw new Error("Область материала пока не имеет размера.");
      this.viewport = size;
      this.renderer.dpr = size.dpr;
      this.renderer.setSize(size.cssWidth, size.cssHeight);
      this.compositor = new MaterialCompositor(this.renderer, size);
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.mutationObserver = new MutationObserver(() => { if (this.waitingTargets) void this.select(); });
      this.resizeObserver.observe(root);
      this.mutationObserver.observe(root, { childList: true, subtree: true });
      this.canvas.addEventListener("webglcontextlost", this.contextLost);
      this.canvas.addEventListener("webglcontextrestored", this.contextRestored);
      root.addEventListener("pointerenter", this.handlePointer);
      root.addEventListener("pointermove", this.handlePointer);
      root.addEventListener("pointerdown", this.handlePointer);
      root.addEventListener("pointerup", this.handlePointer);
      root.addEventListener("pointerleave", this.handlePointer);
      root.addEventListener("pointercancel", this.handlePointer);
      document.addEventListener("visibilitychange", this.visibilityChanged);
      this.subscribeOverlay();
      void this.select();
    } catch (error) {
      this.canvas.remove();
      throw error;
    }
  }

  private publish(phase: BackgroundRuntimeStatus["phase"], message: string): void {
    if (this.disposed) return;
    const notes = this.passes.flatMap(entry => entry.pass.getDiagnostics?.().notes ?? []);
    const allocatedBytes = this.passes.reduce((sum, entry) => sum + entry.plan.attachmentBytes +
      entry.plan.textureBytes + (entry.iconTexture ? entry.maskSource!.width * entry.maskSource!.height * 4 : 0), 0);
    const diagnostics = this.passes.length ? {
      targetCount: this.passes.reduce((sum, entry) => sum + (entry.pass.getDiagnostics?.().targetCount ?? 0), 0),
      allocatedBytes, passesPerFrame: this.passes.reduce((sum, entry) => sum + entry.plan.passesPerFrame, 0) + 1,
      quality: this.input.quality, notes: ["Один WebGL2 canvas и один RAF. Promo зарезервирован в общих 32 MiB.", ...notes],
    } : undefined;
    const next: BackgroundRuntimeStatus = { phase, message,
      effectId: this.input.background?.effectId ?? this.input.bindings.find(binding => binding.enabled)?.recipe.effectId,
      ...(diagnostics ? { diagnostics } : {}) };
    if (JSON.stringify(next) === JSON.stringify(this.status)) return;
    this.status = next; this.onStatus(next);
  }

  private subscribeOverlay(): void {
    this.unsubscribeOverlay?.();
    this.unsubscribeOverlay = this.input.overlay?.subscribeInvalidation(() => this.invalidate()) ?? null;
  }

  private resolveSpecs(): Spec[] {
    const specs: Spec[] = [];
    const background = this.input.background;
    if (background) {
      const parsed = materialCatalogV2.copyForTarget(background, "background");
      if (!parsed.ok) throw new Error(parsed.issues.map(issue => issue.message).join(" "));
      const binding = effectBinding(parsed.value.effectId);
      if (!binding) throw new Error("Фоновый материал не установлен.");
      specs.push({ key: "background", recipe: parsed.value, binding,
        geometry: { capability: "background", x: 0, y: 0,
          width: this.viewport.cssWidth, height: this.viewport.cssHeight,
          pixelWidth: this.viewport.pixelWidth, pixelHeight: this.viewport.pixelHeight,
          dpr: this.viewport.dpr, radiusCss: 0, borderWidthCss: 0, mask: { kind: "rounded-rect" } } });
    }
    const parsed = parseTargetBindings(this.input.bindings, materialCatalogV2);
    if (!parsed.ok) throw new Error(parsed.issues.map(issue => issue.message).join(" "));
    const rootRect = this.root.getBoundingClientRect();
    for (const target of parsed.value) {
      if (!target.enabled) continue;
      const button = this.root.querySelector<HTMLElement>(`[data-material-target="${target.targetId}"]`);
      const element = target.layer === "icon" ? button?.querySelector<HTMLElement>(".mono-actions__icon") : button;
      if (!button || !element) { this.waitingTargets = true; throw new Error("Жду настоящие кнопки MONO."); }
      const geometry = resolveMaterialTargetGeometry(rootRect, element.getBoundingClientRect(), this.viewport,
        `button-${target.layer}`, target.mask, target.radiusCss, target.borderWidthCss);
      if (!geometry) continue;
      const binding = effectBinding(target.recipe.effectId);
      if (!binding) throw new Error("Материал кнопки не установлен.");
      const maskSource = target.mask.kind === "icon"
        ? rasterizeMaterialIcon(target.mask.assetId, geometry.pixelWidth, geometry.pixelHeight) : undefined;
      specs.push({ key: `${target.targetId}:${target.layer}`, recipe: target.recipe,
        binding, geometry, maskSource, button, layer: target.layer });
    }
    this.waitingTargets = false;
    return specs;
  }

  private async select(): Promise<void> {
    if (this.disposed || this.lost) return;
    const generation = ++this.generation;
    // Record the requested structure before asynchronous CPU preparation. React
    // can deliver the same props again while a Paper mask is still preparing.
    this.structureKey = materialSceneStructureKey(this.input.background, this.input.bindings, this.input.quality);
    this.abort?.abort();
    const abort = new AbortController(); this.abort = abort;
    this.loading = true;
    this.stop();
    this.publish("initializing", "Подготовка материалов и проверка общего GPU-бюджета…");
    try {
      const specs = this.resolveSpecs();
      const prepared = await Promise.all(specs.map(spec => spec.binding.prepare(spec.recipe, spec.geometry,
        this.input.quality, CPU_PREPARE_BYTES, abort.signal, spec.maskSource)));
      if (this.disposed || this.lost || generation !== this.generation || abort.signal.aborted) return;
      const mounts: PreparedMaterialMountV2[] = [];
      for (const result of prepared) {
        if (!result.ok) throw new Error(result.error.message);
        mounts.push(result.value);
      }
      const plans: MaterialResourcePlan[] = [];
      for (const mount of mounts) {
        const result = mount.plan(this.viewport, this.limits);
        if (!result.ok) throw new Error(result.error.message);
        plans.push(result.value);
      }
      const maskBytes = specs.reduce((sum, spec) => sum + (spec.maskSource
        ? spec.maskSource.width * spec.maskSource.height * 4 : 0), 0);
      const budget = planMaterialSceneBudget(plans, maskBytes);
      if (!budget.ok) throw new Error(budget.error.message);
      this.releasePasses(); // No old and new GPU leases overlap.
      const next: ActivePass[] = [];
      try {
        for (let index = 0; index < specs.length; index++) {
          const spec = specs[index]!;
          const result = mounts[index]!.create(this.gl, this.viewport, this.limits, plans[index]!);
          if (!result.ok) throw new Error(result.error.message);
          const mask = spec.maskSource ? iconTexture(this.gl, spec.maskSource) : undefined;
          next.push({ ...spec, pass: result.value, plan: plans[index]!,
            ...(mask ? { iconTexture: mask } : {}) });
        }
      } catch (error) {
        next.forEach(entry => { entry.pass.dispose(); if (entry.iconTexture) deleteTexture(this.gl, entry.iconTexture); });
        throw error;
      }
      this.passes = next;
      this.loading = false;
      this.clock.reset(); this.pointer.reset();
      this.applyCurrentRecipes();
      this.publish(this.input.paused ? "paused" : "running", this.input.paused ? "Пауза" : "Живые материалы");
      this.draw(); this.schedule();
    } catch (error) {
      if (this.disposed || generation !== this.generation || abort.signal.aborted) return;
      this.loading = false;
      if (this.waitingTargets) { this.publish("initializing", "Жду настоящие кнопки MONO."); return; }
      this.fail(error);
    }
  }

  private applyCurrentRecipes(): void {
    const background = this.input.background;
    for (const entry of this.passes) {
      const current = entry.key === "background" ? background : this.input.bindings.find(binding =>
        `${binding.targetId}:${binding.layer}` === entry.key)?.recipe;
      if (!current) continue;
      entry.pass.update(current);
      if (current.seed !== entry.recipe.seed) entry.pass.reset(current.seed);
    }
  }

  private releasePasses(): void {
    for (const entry of this.passes) {
      if (entry.button && entry.layer) entry.button.removeAttribute(`data-material-${entry.layer}-presented`);
      try { entry.pass.dispose(); } finally { if (entry.iconTexture) deleteTexture(this.gl, entry.iconTexture); }
    }
    this.passes = [];
    this.input.overlay?.markPresented(false);
  }

  private fail(error: unknown): void {
    this.stop();
    this.releasePasses();
    this.publish("fallback", error instanceof Error ? error.message : "Материал недоступен.");
  }

  private draw(now?: number): void {
    if (this.disposed || this.lost || this.loading || !this.input.hostActive || document.visibilityState === "hidden") return;
    try {
      const timing = now === undefined ? { time: this.clock.time, dt: 0 } : this.clock.advance(now);
      const backgroundPointer = this.pointer.drain();
      this.compositor.clear();
      for (const entry of this.passes) {
        const geometry = entry.button && entry.layer
          ? this.currentButtonGeometry(entry) : entry.geometry;
        if (!geometry) continue;
        if (geometry.pixelWidth !== entry.geometry.pixelWidth || geometry.pixelHeight !== entry.geometry.pixelHeight) {
          void this.select(); return;
        }
        const frame: Frame = { ...timing, pointer: entry.key === "background" ? backgroundPointer : EMPTY_POINTER };
        const texture: MaterialFrameTexture = entry.pass.render(frame, geometry);
        const mode: MaterialDrawMode = entry.key === "background" ? "background" : entry.layer!;
        const drawn = this.compositor.draw(texture, geometry, mode, texture.alphaMode === "opaque", entry.iconTexture);
        if (drawn && entry.button && entry.layer) entry.button.setAttribute(`data-material-${entry.layer}-presented`, "true");
      }
      if (this.input.overlay) {
        this.optical ??= this.input.overlay.create(this.gl, this.limits);
        const overlayFrame = this.optical.render({ ...timing, pointer: backgroundPointer }, this.viewport, this.root);
        if (overlayFrame) {
          const [x, y, width, height] = overlayFrame.rect;
          const region: MaterialTargetGeometry = { capability: "background", x, y, width, height,
            pixelWidth: Math.max(1, Math.ceil(width * this.viewport.dpr)),
            pixelHeight: Math.max(1, Math.ceil(height * this.viewport.dpr)), dpr: this.viewport.dpr,
            radiusCss: overlayFrame.radius, borderWidthCss: 0, mask: { kind: "rounded-rect" } };
          this.compositor.draw(overlayFrame, region, "promo", true);
        }
        this.input.overlay.markPresented(Boolean(overlayFrame));
      }
      this.publish(this.input.paused ? "paused" : "running", this.input.paused ? "Пауза" : "Живые материалы");
    } catch (error) { this.fail(error); }
  }

  private currentButtonGeometry(entry: ActivePass): MaterialTargetGeometry | null {
    if (!entry.button || !entry.layer) return null;
    const element = entry.layer === "icon" ? entry.button.querySelector<HTMLElement>(".mono-actions__icon") : entry.button;
    if (!element) return null;
    return resolveMaterialTargetGeometry(this.root.getBoundingClientRect(), element.getBoundingClientRect(),
      this.viewport, `button-${entry.layer}`, entry.geometry.mask, entry.geometry.radiusCss, entry.geometry.borderWidthCss);
  }

  private readonly tick = (now: number) => {
    this.frameId = null;
    this.draw(now); this.schedule();
  };
  private schedule(): void {
    if (!this.disposed && !this.lost && !this.loading && this.input.hostActive && !this.input.paused &&
        document.visibilityState !== "hidden" && this.frameId === null) this.frameId = requestAnimationFrame(this.tick);
  }
  private stop(): void {
    if (this.frameId !== null) cancelAnimationFrame(this.frameId);
    this.frameId = null; this.clock.pause();
  }
  private invalidate(): void {
    if (this.input.paused) this.draw(); else this.schedule();
  }
  private readonly visibilityChanged = () => {
    if (document.visibilityState === "hidden") this.stop();
    else { this.draw(); this.schedule(); }
  };
  private readonly handlePointer = (event: PointerEvent) => {
    if (!this.input.background || !this.input.hostActive || this.input.paused) return;
    const phase = event.type.slice("pointer".length) as PointerPhase;
    const target = event.target;
    if (phase !== "leave" && phase !== "cancel" && target instanceof Element &&
        target.closest("button,a,input,select,textarea,[role='button']")) return;
    const rect = this.root.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    this.pointer.push({ id: event.pointerId, phase,
      uv: [(event.clientX - rect.left) / rect.width, 1 - (event.clientY - rect.top) / rect.height],
      time: this.clock.time, buttons: event.buttons });
    this.invalidate();
  };
  private readonly contextLost = (event: Event) => {
    event.preventDefault(); this.lost = true;
    this.abort?.abort(); this.stop();
    try { this.releasePasses(); } catch { /* Native context loss releases GPU storage. */ }
    this.publish("lost", "GPU-контекст потерян · после восстановления поле начнётся заново.");
  };
  private readonly contextRestored = () => { if (!this.disposed) this.onRestore(); };

  update(next: MaterialSceneInput): void {
    if (this.disposed || this.lost) return;
    const before = this.input;
    this.input = next;
    if (before.overlay !== next.overlay) {
      this.unsubscribeOverlay?.(); this.unsubscribeOverlay = null;
      this.optical?.dispose(); this.optical = null;
      before.overlay?.markPresented(false);
      this.subscribeOverlay();
    }
    const key = materialSceneStructureKey(next.background, next.bindings, next.quality);
    if (key !== this.structureKey) { void this.select(); return; }
    try {
      this.applyCurrentRecipes();
      if (next.restartKey !== before.restartKey) {
        for (const entry of this.passes) entry.pass.reset(entry.recipe.seed);
        this.clock.reset(); this.pointer.reset();
      }
      if (next.transientAction && next.transientAction.requestId > this.lastActionId) {
        this.lastActionId = next.transientAction.requestId;
        this.passes.find(entry => entry.key === "background")?.pass.invokeAction?.(next.transientAction.action);
      }
      if (next.paused || !next.hostActive) this.stop();
      else this.schedule();
      if (next.paused || next.restartKey !== before.restartKey || before.overlay !== next.overlay) this.draw();
    } catch (error) { this.fail(error); }
  }

  resize(): void {
    if (this.disposed || this.lost) return;
    const size = resolveViewport(this.root.clientWidth, this.root.clientHeight, window.devicePixelRatio,
      this.limits.maxTextureSize);
    if (!size || (size.cssWidth === this.viewport.cssWidth && size.cssHeight === this.viewport.cssHeight &&
        size.pixelWidth === this.viewport.pixelWidth && size.pixelHeight === this.viewport.pixelHeight)) return;
    this.viewport = size;
    this.renderer.dpr = size.dpr; this.renderer.setSize(size.cssWidth, size.cssHeight);
    this.compositor.resize(size);
    this.pointer.reset();
    void this.select(); // Always re-plan and release before any size-driven reallocation.
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.generation++; this.abort?.abort(); this.stop();
    this.resizeObserver.disconnect(); this.mutationObserver.disconnect();
    this.unsubscribeOverlay?.(); this.unsubscribeOverlay = null;
    this.root.removeEventListener("pointerenter", this.handlePointer);
    this.root.removeEventListener("pointermove", this.handlePointer);
    this.root.removeEventListener("pointerdown", this.handlePointer);
    this.root.removeEventListener("pointerup", this.handlePointer);
    this.root.removeEventListener("pointerleave", this.handlePointer);
    this.root.removeEventListener("pointercancel", this.handlePointer);
    document.removeEventListener("visibilitychange", this.visibilityChanged);
    this.canvas.removeEventListener("webglcontextlost", this.contextLost);
    this.canvas.removeEventListener("webglcontextrestored", this.contextRestored);
    try { this.releasePasses(); } finally {
      this.optical?.dispose(); this.optical = null;
      this.compositor.dispose();
      clearPaperPreparedAssets();
      this.canvas.remove();
      if (!this.gl.isContextLost()) this.gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
  }
}
