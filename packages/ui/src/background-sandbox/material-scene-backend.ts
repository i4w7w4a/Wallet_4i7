import { Renderer, Texture, type OGLRenderingContext } from "ogl";
import type { Frame, GpuLimits, PointerFrame, PointerPhase, Viewport } from "./contracts";
import { ActiveClock, PointerInput, ViewportMotionInput, resolveViewport } from "./host-input";
import { FLUID_VIEWPORT_RESPONSE_DEFAULTS, parseFluidViewportResponse,
  type FluidViewportResponseV1 } from "./fluid-viewport-response";
import { overlayFrameList, type BackgroundOverlay, type OverlaySource } from "./overlay";
import { normalizeBackgroundEdgeFinish } from "./material-edge-finish";
import { MATERIAL_VIEWPORT_MOTION_REBASE_EVENT, type BackgroundRuntimeStatus } from "./host-contract";
import type {
  BackgroundEdgeFinishV1, ButtonMaterialLayer, MaterialFrameTexture, MaterialMaskSource, MaterialPass,
  MaterialQualityProfile, MaterialRecipeV2, MaterialResourcePlan, MaterialTargetBinding,
  MaterialTargetGeometry,
} from "./material-contract";
import { MaterialCompositor, type MaterialDrawMode } from "./material-compositor";
import { planMaterialSceneBudget } from "./material-scene-budget";
import { materialSceneStructureKey } from "./material-scene-state";
import { materialPointerOverControl, materialPointerPhase } from "./material-scene-pointer";
import { resolveMaterialHostClip, resolveMaterialTargetGeometry,
  type MaterialHostClip } from "./material-target-geometry";
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
  edgeFinish?: BackgroundEdgeFinishV1;
  viewportResponse?: FluidViewportResponseV1;
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
  private readonly viewportElement: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: Renderer;
  private readonly gl: OGLRenderingContext;
  private readonly limits: GpuLimits;
  private readonly compositor: MaterialCompositor;
  private readonly clock = new ActiveClock();
  private readonly pointer = new PointerInput();
  private readonly viewportMotion: ViewportMotionInput;
  private readonly reducedMotion: MediaQueryList | null;
  private readonly resizeObserver: ResizeObserver;
  private readonly mutationObserver: MutationObserver;
  private viewport: Viewport;
  private viewportResponse: FluidViewportResponseV1;
  private input: MaterialSceneInput;
  private passes: ActivePass[] = [];
  private optical: ReturnType<BackgroundOverlay["create"]> | null = null;
  private unsubscribeOverlay: (() => void) | null = null;
  private abort: AbortController | null = null;
  private generation = 0;
  private frameId: number | null = null;
  private viewportMotionReset = true;
  private touchScroll: { id: number; y: number; startX: number; startY: number;
    intent: "pending" | "vertical" | "other" } | null = null;
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
    this.viewportResponse = parseFluidViewportResponse(input.viewportResponse) ?? FLUID_VIEWPORT_RESPONSE_DEFAULTS;
    // The stage is the visible viewport; MONO's scrollable wallet is taller than it.
    // A width-limited stage may sit inside a wider scrolling viewport. The canvas
    // follows that viewport vertically while keeping the stage's real CSS width.
    this.viewportElement = root.closest<HTMLElement>("[data-material-scrollport]") ?? root.parentElement ?? root;
    this.viewportMotion = new ViewportMotionInput(this.viewportElement.scrollTop);
    this.reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)") ?? null;
    this.canvas = document.createElement("canvas");
    this.canvas.dataset.materialCanvas = "true";
    this.canvas.setAttribute("aria-hidden", "true");
    Object.assign(this.canvas.style, { position: "absolute", left: "0", top: "0", display: "block", pointerEvents: "none" });
    root.prepend(this.canvas);
    try {
      if (typeof WebGL2RenderingContext === "undefined") throw new Error("Для материалов нужен WebGL2.");
      this.renderer = new Renderer({ canvas: this.canvas, webgl: 2, alpha: true, premultipliedAlpha: true,
        antialias: false, depth: false, dpr: 1 });
      if (!this.renderer.isWebgl2) throw new Error("Для материалов нужен WebGL2.");
      this.gl = this.renderer.gl;
      this.limits = { maxTextureSize: Math.min(4096, this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE) as number,
        this.gl.getParameter(this.gl.MAX_RENDERBUFFER_SIZE) as number),
        maxRenderTargetBytes: TOTAL_BYTES - PROMO_BYTES };
      const size = resolveViewport(root.clientWidth, this.viewportElement.clientHeight,
        window.devicePixelRatio, this.limits.maxTextureSize);
      if (!size) throw new Error("Область материала пока не имеет размера.");
      this.viewport = size;
      this.renderer.dpr = size.dpr;
      this.renderer.setSize(size.cssWidth, size.cssHeight);
      this.syncCanvasToScroll();
      this.compositor = new MaterialCompositor(this.renderer, size);
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.mutationObserver = new MutationObserver(() => { if (this.waitingTargets) void this.select(); });
      this.resizeObserver.observe(root);
      if (this.viewportElement !== root) this.resizeObserver.observe(this.viewportElement);
      this.mutationObserver.observe(root, { childList: true, subtree: true });
      this.viewportElement.addEventListener("scroll", this.scrollChanged, { passive: true });
      this.viewportElement.addEventListener(MATERIAL_VIEWPORT_MOTION_REBASE_EVENT, this.programmaticScrollReset);
      this.viewportElement.addEventListener("wheel", this.wheelChanged, { passive: true });
      this.viewportElement.addEventListener("touchstart", this.touchStarted, { passive: true });
      this.viewportElement.addEventListener("touchmove", this.touchMoved, { passive: true });
      this.viewportElement.addEventListener("touchend", this.touchEnded, { passive: true });
      this.viewportElement.addEventListener("touchcancel", this.touchEnded, { passive: true });
      this.reducedMotion?.addEventListener?.("change", this.motionPreferenceChanged);
      this.canvas.addEventListener("webglcontextlost", this.contextLost);
      this.canvas.addEventListener("webglcontextrestored", this.contextRestored);
      root.addEventListener("pointerenter", this.handlePointer, { passive: true });
      root.addEventListener("pointermove", this.handlePointer, { passive: true });
      root.addEventListener("pointerdown", this.handlePointer, { passive: true });
      root.addEventListener("pointerup", this.handlePointer, { passive: true });
      root.addEventListener("pointerleave", this.handlePointer, { passive: true });
      root.addEventListener("pointercancel", this.handlePointer, { passive: true });
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
      allocatedBytes, passesPerFrame: this.passes.reduce((sum, entry) => sum + entry.plan.passesPerFrame +
        (entry.layer === "icon" ? 1 : 0), 0) + 1,
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
    const rootRect = this.canvas.getBoundingClientRect();
    // A working preset can receive layers in any order. Composite by visual depth,
    // so a later fill transfer cannot cover an earlier icon or border transfer.
    const layerOrder = { fill: 0, border: 1, icon: 2 } as const;
    for (const target of [...parsed.value].sort((left, right) => layerOrder[left.layer] - layerOrder[right.layer])) {
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
      const fluidBackground = this.input.background?.effectId === "fluid" && this.input.background.effectVersion === 2;
      const viewportMotion = fluidBackground ? {
        ...this.viewportMotion.drain(),
        response: this.canCollectViewportMotion() ? this.viewportResponse : FLUID_VIEWPORT_RESPONSE_DEFAULTS,
        ...(this.viewportMotionReset ? { reset: true } : {}),
      } : undefined;
      if (fluidBackground) this.viewportMotionReset = false;
      const hostClips = new Map<HTMLElement, MaterialHostClip | undefined>();
      let backgroundSource: OverlaySource | null = null;
      this.compositor.clear();
      for (const entry of this.passes) {
        const geometry = entry.button && entry.layer
          ? this.currentButtonGeometry(entry) : entry.geometry;
        if (!geometry) continue;
        if (geometry.pixelWidth !== entry.geometry.pixelWidth || geometry.pixelHeight !== entry.geometry.pixelHeight) {
          void this.select(); return;
        }
        const frame: Frame = { ...timing, pointer: entry.key === "background" ? backgroundPointer : EMPTY_POINTER,
          ...(entry.key === "background" && viewportMotion ? { viewportMotion } : {}) };
        const texture: MaterialFrameTexture = entry.pass.render(frame, geometry);
        if (entry.key === "background" && this.input.overlay) {
          // Reconstruct the same source-over color as the background canvas over
          // its solid CSS base. Premultiplied textures must not be blended twice.
          const components = getComputedStyle(this.root).backgroundColor.match(/[\d.]+/g)?.map(Number);
          const base = components && components.length >= 3 && (components[3] ?? 1) === 1
            ? [components[0]! / 255, components[1]! / 255, components[2]! / 255] as const : null;
          const finish = normalizeBackgroundEdgeFinish(this.input.edgeFinish);
          if (texture.alphaMode === "opaque" || base) backgroundSource = {
            ...texture, baseColor: base ?? [0, 0, 0],
            edgeFinish: [finish.sideDarkening, finish.inset, finish.softness],
          };
        }
        const mode: MaterialDrawMode = entry.key === "background" ? "background" : entry.layer!;
        const drawn = this.compositor.draw(texture, geometry, mode, texture.alphaMode === "opaque",
          entry.iconTexture, entry.key === "background" ? this.input.edgeFinish : undefined,
          entry.button ? this.currentButtonHostClip(entry.button, hostClips) : undefined);
        if (drawn && entry.button && entry.layer) entry.button.setAttribute(`data-material-${entry.layer}-presented`, "true");
      }
      if (this.input.overlay) {
        this.optical ??= this.input.overlay.create(this.gl, this.limits);
        const frames = overlayFrameList(this.optical.render({ ...timing, pointer: backgroundPointer },
          this.viewport, this.canvas, backgroundSource));
        for (const overlayFrame of frames) {
          const [x, y, width, height] = overlayFrame.rect;
          const region: MaterialTargetGeometry = { capability: "background", x, y, width, height,
            pixelWidth: Math.max(1, Math.ceil(width * this.viewport.dpr)),
            pixelHeight: Math.max(1, Math.ceil(height * this.viewport.dpr)), dpr: this.viewport.dpr,
            radiusCss: overlayFrame.radius, borderWidthCss: 0, mask: { kind: "rounded-rect" } };
          this.compositor.draw(overlayFrame, region, "promo", true, undefined, undefined, undefined, overlayFrame.opacity);
        }
        this.input.overlay.markPresented(frames.length > 0);
      }
      this.publish(this.input.paused ? "paused" : "running", this.input.paused ? "Пауза" : "Живые материалы");
    } catch (error) { this.fail(error); }
  }

  private currentButtonGeometry(entry: ActivePass): MaterialTargetGeometry | null {
    if (!entry.button || !entry.layer) return null;
    const element = entry.layer === "icon" ? entry.button.querySelector<HTMLElement>(".mono-actions__icon") : entry.button;
    if (!element) return null;
    return resolveMaterialTargetGeometry(this.canvas.getBoundingClientRect(), element.getBoundingClientRect(),
      this.viewport, `button-${entry.layer}`, entry.geometry.mask, entry.geometry.radiusCss, entry.geometry.borderWidthCss);
  }

  private currentButtonHostClip(button: HTMLElement,
    cache: Map<HTMLElement, MaterialHostClip | undefined>): MaterialHostClip | undefined {
    const row = button.closest<HTMLElement>(".mono-actions");
    if (!row || row.dataset.frameMode === "icons") return undefined;
    const separate = row.dataset.frameMode === "separate";
    const host = separate ? button : row;
    if (cache.has(host)) return cache.get(host);
    const style = getComputedStyle(host);
    const borderCss = separate ? 0 : Number.parseFloat(style.borderTopWidth) || 0;
    const radiusCss = Number.parseFloat(style.borderTopLeftRadius) || 0;
    const statusTop = separate ? undefined : row.querySelector<HTMLElement>(".mono-actions__status")?.getBoundingClientRect().top;
    const clip = resolveMaterialHostClip(this.canvas.getBoundingClientRect(), host.getBoundingClientRect(), {
      layoutWidth: host.offsetWidth, layoutHeight: host.offsetHeight, radiusCss, borderCss,
      box: separate ? "border" : "padding", statusTop,
    }) ?? undefined;
    cache.set(host, clip);
    return clip;
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
    this.frameId = null; this.clock.pause(); this.resetViewportMotion();
  }
  private invalidate(): void {
    if (this.input.paused) this.draw(); else this.schedule();
  }
  private readonly visibilityChanged = () => {
    if (document.visibilityState === "hidden") { this.pointer.reset(); this.stop(); }
    else { this.draw(); this.schedule(); }
  };
  private syncCanvasToScroll(): void {
    this.canvas.style.top = `${this.viewportElement.scrollTop}px`;
  }
  private scrollMax(): number {
    return Math.max(0, this.viewportElement.scrollHeight - this.viewportElement.clientHeight);
  }
  private canCollectViewportMotion(): boolean {
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    return this.input.background?.effectId === "fluid" && this.input.background.effectVersion === 2 &&
      this.viewportResponse.enabled && this.viewportResponse.strength > 0 && this.input.hostActive && !this.input.paused &&
      !this.loading && !this.lost && !this.reducedMotion?.matches && !saveData &&
      document.visibilityState !== "hidden";
  }
  private resetViewportMotion(): void {
    this.viewportMotion.reset(this.viewportElement.scrollTop);
    this.viewportMotionReset = true;
    this.touchScroll = null;
  }
  private readonly motionPreferenceChanged = () => { this.resetViewportMotion(); this.invalidate(); };
  private readonly programmaticScrollReset = () => {
    this.syncCanvasToScroll();
    this.resetViewportMotion();
  };
  private readonly scrollChanged = () => {
    this.syncCanvasToScroll();
    if (this.canCollectViewportMotion())
      this.viewportMotion.recordScroll(this.viewportElement.scrollTop, this.scrollMax(), this.viewportElement.clientHeight);
    else this.viewportMotion.reset(this.viewportElement.scrollTop);
    this.invalidate();
  };
  private readonly wheelChanged = (event: WheelEvent) => {
    if (!this.canCollectViewportMotion()) return;
    const height = this.viewportElement.clientHeight;
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? height : 1);
    this.viewportMotion.recordBoundaryAttempt(delta, this.viewportElement.scrollTop, this.scrollMax(), height);
    this.invalidate();
  };
  private readonly touchStarted = (event: TouchEvent) => {
    if (!this.canCollectViewportMotion() || event.touches.length !== 1) { this.touchScroll = null; return; }
    const touch = event.touches.item(0);
    if (touch) this.touchScroll = { id: touch.identifier, y: touch.clientY,
      startX: touch.clientX, startY: touch.clientY, intent: "pending" };
  };
  private readonly touchMoved = (event: TouchEvent) => {
    const tracking = this.touchScroll;
    if (!tracking || !this.canCollectViewportMotion() || event.touches.length !== 1) return;
    const touch = event.touches.item(0);
    if (!touch || touch.identifier !== tracking.id) { this.touchScroll = null; return; }
    const delta = tracking.y - touch.clientY;
    tracking.y = touch.clientY;
    if (tracking.intent === "pending") {
      const vertical = Math.abs(touch.clientY - tracking.startY);
      const horizontal = Math.abs(touch.clientX - tracking.startX);
      if (vertical >= 5 && vertical > horizontal * 1.25) tracking.intent = "vertical";
      else if (horizontal >= 5 && horizontal > vertical * 1.25) tracking.intent = "other";
    }
    if (tracking.intent !== "vertical") return;
    this.viewportMotion.recordBoundaryAttempt(delta, this.viewportElement.scrollTop,
      this.scrollMax(), this.viewportElement.clientHeight);
    this.invalidate();
  };
  private readonly touchEnded = () => { this.touchScroll = null; };
  private readonly handlePointer = (event: PointerEvent) => {
    if (!this.input.background || !this.input.hostActive || this.input.paused) return;
    const phase = event.type.slice("pointer".length) as PointerPhase;
    const isTouch = event.pointerType === "touch";
    const hitTest = this.root.ownerDocument.elementFromPoint;
    const hitTarget = isTouch && typeof hitTest === "function"
      ? hitTest.call(this.root.ownerDocument, event.clientX, event.clientY) : null;
    const overControl = materialPointerOverControl(event.target, hitTarget, this.root) ||
      (isTouch && typeof hitTest === "function" && !hitTarget);
    const routedPhase = isTouch ? phase : materialPointerPhase(phase, overControl);
    if (!routedPhase) return;
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    this.pointer.push({ id: event.pointerId, phase: routedPhase,
      pointerType: event.pointerType === "touch" || event.pointerType === "pen" ? event.pointerType : "mouse",
      uv: [(event.clientX - rect.left) / rect.width, 1 - (event.clientY - rect.top) / rect.height],
      time: this.clock.sampleTime(event.timeStamp), buttons: routedPhase === "cancel" ? 0 : event.buttons },
    isTouch && overControl);
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
    const beforeResponse = this.viewportResponse;
    this.input = next;
    this.viewportResponse = parseFluidViewportResponse(next.viewportResponse) ?? FLUID_VIEWPORT_RESPONSE_DEFAULTS;
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
        this.resetViewportMotion();
      }
      if (this.viewportResponse.enabled !== beforeResponse.enabled ||
          (this.viewportResponse.strength === 0 && beforeResponse.strength !== 0))
        this.resetViewportMotion();
      if (next.transientAction && next.transientAction.requestId > this.lastActionId) {
        this.lastActionId = next.transientAction.requestId;
        this.passes.find(entry => entry.key === "background")?.pass.invokeAction?.(next.transientAction.action);
      }
      if (next.paused || !next.hostActive) { this.pointer.reset(); this.stop(); }
      else this.schedule();
      if (next.paused || next.restartKey !== before.restartKey || before.overlay !== next.overlay) this.draw();
    } catch (error) { this.fail(error); }
  }

  resize(): void {
    if (this.disposed || this.lost) return;
    this.syncCanvasToScroll();
    const size = resolveViewport(this.root.clientWidth, this.viewportElement.clientHeight, window.devicePixelRatio,
      this.limits.maxTextureSize);
    if (!size || (size.cssWidth === this.viewport.cssWidth && size.cssHeight === this.viewport.cssHeight &&
        size.pixelWidth === this.viewport.pixelWidth && size.pixelHeight === this.viewport.pixelHeight)) return;
    this.resetViewportMotion();
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
    this.viewportElement.removeEventListener("scroll", this.scrollChanged);
    this.viewportElement.removeEventListener(MATERIAL_VIEWPORT_MOTION_REBASE_EVENT, this.programmaticScrollReset);
    this.viewportElement.removeEventListener("wheel", this.wheelChanged);
    this.viewportElement.removeEventListener("touchstart", this.touchStarted);
    this.viewportElement.removeEventListener("touchmove", this.touchMoved);
    this.viewportElement.removeEventListener("touchend", this.touchEnded);
    this.viewportElement.removeEventListener("touchcancel", this.touchEnded);
    this.reducedMotion?.removeEventListener?.("change", this.motionPreferenceChanged);
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
