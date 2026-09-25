import { Mesh, Program, RenderTarget, Triangle, type OGLRenderingContext, type Texture } from "ogl";
import type { CreateResult, EffectDiagnostics, Frame, GpuFailure, Viewport } from "../../../contracts";
import type { MaterialAction, MaterialFrameTexture, MaterialInit, MaterialPass, MaterialResourcePlan, MaterialTargetGeometry } from "../../../material-contract";
import { FluidDragInput } from "../input";
import { createSeedSplats } from "../seed";
import { createFluidActionState, drainFluidAction, queueFluidAction, type FluidActionState } from "./actions";
import { createFluidClock, stepFluidClock, type FluidClock } from "./clock";
import { fluidHexToRgb, resolveFluidV2Colors } from "./colors";
import { fluidV2Decay } from "./dynamics";
import { planFluidV2Allocation, type FluidSize, type FluidV2Allocation } from "./quality";
import { parseFluidV2Params, type FluidV2Params } from "./schema";
import * as v2Shaders from "./shaders";

type Gl = OGLRenderingContext & WebGL2RenderingContext;
type Pair = { read: RenderTarget; write: RenderTarget };
type Targets = {
  velocity: Pair; dyeA: Pair; dyeB: Pair; pressure: Pair;
  curl: RenderTarget; divergence: RenderTarget; output: RenderTarget;
  bloom: RenderTarget[]; sunMask: RenderTarget; sunrays: RenderTarget; sunTemp: RenderTarget;
};
const shaders = {
  clear: v2Shaders.clear,
  velocitySplat: v2Shaders.velocitySplat,
  pigmentSplat: v2Shaders.pigmentSplat,
  curl: v2Shaders.curl,
  vorticity: v2Shaders.vorticity,
  divergence: v2Shaders.divergence,
  decayPressure: v2Shaders.decayPressure,
  pressure: v2Shaders.pressure,
  gradient: v2Shaders.gradient,
  advect: v2Shaders.advect,
  bloomPrefilter: v2Shaders.bloomPrefilter,
  bloomDownsample: v2Shaders.bloomDownsample,
  sunraysMask: v2Shaders.sunraysMask,
  sunrays: v2Shaders.sunrays,
  sunraysBlur: v2Shaders.sunraysBlur,
  display: v2Shaders.display,
};
type PassName = keyof typeof shaders;
type UniformValue = number | readonly number[] | Texture;
const validSeed = (seed: number) => Number.isInteger(seed) && seed >= 0 && seed <= 0xffffffff;
const sizeMatches = (a: MaterialTargetGeometry, b: MaterialTargetGeometry) => a.pixelWidth === b.pixelWidth && a.pixelHeight === b.pixelHeight;
const swap = (pair: Pair) => { [pair.read, pair.write] = [pair.write, pair.read]; };

class FluidV2Failure extends Error {
  constructor(readonly code: GpuFailure["code"], message: string) { super(message); }
}

/** Host owns Renderer/canvas/RAF/input routing. This adapter owns only passes and FBOs. */
export function createFluidV2Pass(gl: OGLRenderingContext, init: MaterialInit<FluidV2Params, null> & { plan: MaterialResourcePlan }): CreateResult<MaterialPass<FluidV2Params>> {
  const params = parseFluidV2Params(init.params);
  if (!params || !validSeed(init.seed) || init.geometry.capability !== "background" || init.geometry.mask.kind !== "rounded-rect") {
    return { ok: false, error: { code: "invalid-config", message: "Fluid v2 требует полный recipe, seed и фоновую геометрию." } };
  }
  if (!gl.renderer.isWebgl2) return { ok: false, error: { code: "webgl2-unavailable", message: "Fluid v2 требует WebGL2." } };
  if (gl.isContextLost()) return { ok: false, error: { code: "context-lost", message: "Контекст Fluid v2 потерян." } };
  if (!gl.renderer.getExtension("EXT_color_buffer_float")) return { ok: false, error: { code: "unsupported-format", message: "GPU не поддерживает float render targets для Fluid v2." } };
  const effect = new FluidV2Pass(gl as Gl, { ...init, params });
  try { effect.initialize(); return { ok: true, value: effect }; }
  catch (error) {
    effect.dispose();
    return { ok: false, error: { code: error instanceof FluidV2Failure ? error.code : "resource-allocation", message: error instanceof Error ? error.message : "Не удалось создать Fluid v2." } };
  }
}

class FluidV2Pass implements MaterialPass<FluidV2Params> {
  private readonly programs = new Map<PassName, Program>();
  private readonly meshes = new Map<PassName, Mesh>();
  private readonly ownedTargets: RenderTarget[] = [];
  private readonly input = new FluidDragInput();
  private geometryMesh: Triangle | null = null;
  private targets: Targets | null = null;
  private allocation: FluidV2Allocation | null = null;
  private viewport: Viewport;
  private geometry: MaterialTargetGeometry;
  private params: FluidV2Params;
  private seed: number;
  private clock: FluidClock;
  private actionState: FluidActionState;
  private resetPending = true;
  private displayDirty = true;
  private disposed = false;
  private passes = 0;
  private dragPigment = 0;

  constructor(private readonly gl: Gl, private readonly init: MaterialInit<FluidV2Params, null> & { plan: MaterialResourcePlan }) {
    this.viewport = { ...init.viewport };
    this.geometry = { ...init.geometry };
    this.params = { ...init.params, colors: [...init.params.colors] };
    this.seed = init.seed;
    this.clock = createFluidClock(init.seed);
    this.actionState = createFluidActionState(init.seed);
  }

  initialize(): void {
    const allocation = this.plan(this.geometry);
    this.geometryMesh = new Triangle(this.gl);
    for (const name of Object.keys(shaders) as PassName[]) {
      const program = new Program(this.gl, { vertex: v2Shaders.vertex, fragment: shaders[name], uniforms: {}, depthTest: false, depthWrite: false, cullFace: false, transparent: false });
      this.programs.set(name, program);
      if (!this.gl.getProgramParameter(program.program, this.gl.LINK_STATUS)) throw new FluidV2Failure("shader-error", `Fluid v2: shader pass ${name} не связан.`);
      this.meshes.set(name, new Mesh(this.gl, { geometry: this.geometryMesh, program }));
    }
    this.allocate(allocation);
  }

  private plan(geometry: MaterialTargetGeometry): FluidV2Allocation {
    const textureCap = Math.min(this.init.limits.maxTextureSize, this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE) as number);
    const allocation = planFluidV2Allocation(geometry.pixelWidth, geometry.pixelHeight, textureCap, this.init.limits.maxRenderTargetBytes, this.init.quality);
    if (!allocation || !Number.isFinite(this.init.plan.attachmentBytes) || allocation.bytes > this.init.plan.attachmentBytes || this.init.plan.textureBytes !== 0) {
      throw new FluidV2Failure("budget-exceeded", "Fluid v2 превышает выделенный GPU-бюджет.");
    }
    return allocation;
  }

  private target(size: FluidSize, internalFormat: number, format: number, type: number, filter: number): RenderTarget {
    const gl = this.gl;
    const target = new RenderTarget(gl, { ...size, depth: false, stencil: false, color: 1, internalFormat, format, type, minFilter: filter, magFilter: filter, wrapS: gl.CLAMP_TO_EDGE, wrapT: gl.CLAMP_TO_EDGE, unpackAlignment: 1 });
    this.ownedTargets.push(target);
    gl.renderer.bindFramebuffer(target);
    if (!gl.isFramebuffer(target.buffer) || !gl.isTexture(target.texture.texture) || gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      throw new FluidV2Failure("unsupported-format", "Fluid v2 float framebuffer неполон.");
    }
    return target;
  }

  private allocate(plan: FluidV2Allocation): void {
    const gl = this.gl;
    const velocity = () => this.target(plan.simulation, gl.RG16F, gl.RG, gl.HALF_FLOAT, gl.LINEAR);
    const scalar = () => this.target(plan.simulation, gl.R16F, gl.RED, gl.HALF_FLOAT, gl.NEAREST);
    const dye = () => this.target(plan.dye, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, gl.LINEAR);
    const post = (size: FluidSize) => this.target(size, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, gl.LINEAR);
    const ray = () => this.target(plan.sunrays, gl.R16F, gl.RED, gl.HALF_FLOAT, gl.LINEAR);
    this.targets = {
      velocity: { read: velocity(), write: velocity() },
      dyeA: { read: dye(), write: dye() }, dyeB: { read: dye(), write: dye() },
      pressure: { read: scalar(), write: scalar() },
      curl: scalar(), divergence: scalar(),
      output: this.target(plan.output, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR),
      bloom: plan.bloom.map(post), sunMask: ray(), sunrays: ray(), sunTemp: ray(),
    };
    this.allocation = plan;
    this.resetPending = true;
    this.displayDirty = true;
  }

  private draw(name: PassName, target: RenderTarget, uniforms: Record<string, UniformValue> = {}): void {
    const program = this.programs.get(name)!;
    for (const [key, value] of Object.entries(uniforms)) {
      if (program.uniforms[key]) program.uniforms[key].value = value;
      else program.uniforms[key] = { value };
    }
    this.gl.renderer.render({ scene: this.meshes.get(name)!, target, clear: false, update: false, sort: false, frustumCull: false });
    this.passes++;
  }

  private colorUniforms(): Record<string, UniformValue> {
    const colors = resolveFluidV2Colors(this.params.colors, this.clock.time, this.params.colorCycleRate);
    return { dyeA: this.targets!.dyeA.read.texture, dyeB: this.targets!.dyeB.read.texture, colorAlpha: this.params.colorAlpha,
      color0: colors[0], color1: colors[1], color2: colors[2], color3: colors[3], color4: colors[4], color5: colors[5] };
  }

  private splat(x: number, y: number, dx: number, dy: number, pigment: number, amount: number): void {
    const targets = this.targets!;
    const aspect = this.geometry.width / this.geometry.height;
    const uniforms = { point: [x, y], aspect, radius: this.params.radius / 100 * Math.max(1, aspect) };
    this.draw("velocitySplat", targets.velocity.write, { ...uniforms, source: targets.velocity.read.texture, impulse: [dx, dy, 0], limitValue: 1000 });
    swap(targets.velocity);
    const colorIndex = pigment % 6;
    const a = [0, 0, 0, 0];
    const b = [0, 0, 0, 0];
    if (colorIndex < 4) a[colorIndex] = amount;
    else b[colorIndex - 4] = amount;
    this.draw("pigmentSplat", targets.dyeA.write, { ...uniforms, source: targets.dyeA.read.texture, impulse: a });
    swap(targets.dyeA);
    this.draw("pigmentSplat", targets.dyeB.write, { ...uniforms, source: targets.dyeB.read.texture, impulse: b });
    swap(targets.dyeB);
  }

  private step(dt: number): void {
    const t = this.targets!;
    const texelSize = [1 / t.velocity.read.width, 1 / t.velocity.read.height];
    const decay = fluidV2Decay(dt, this.params.velocityDissipation, this.params.dyeDissipation, this.params.pressureRetention);
    this.draw("curl", t.curl, { texelSize, velocity: t.velocity.read.texture });
    this.draw("vorticity", t.velocity.write, { texelSize, velocity: t.velocity.read.texture, curlField: t.curl.texture, strength: this.params.curl, dt });
    swap(t.velocity);
    this.draw("divergence", t.divergence, { texelSize, velocity: t.velocity.read.texture });
    this.draw("decayPressure", t.pressure.write, { pressure: t.pressure.read.texture, retention: decay.pressure });
    swap(t.pressure);
    for (let i = 0; i < this.allocation!.pressureIterations; i++) {
      this.draw("pressure", t.pressure.write, { texelSize, pressure: t.pressure.read.texture, divergenceField: t.divergence.texture });
      swap(t.pressure);
    }
    this.draw("gradient", t.velocity.write, { texelSize, pressure: t.pressure.read.texture, velocity: t.velocity.read.texture });
    swap(t.velocity);
    this.draw("advect", t.velocity.write, { texelSize, velocity: t.velocity.read.texture, source: t.velocity.read.texture, dt, retention: decay.velocity });
    swap(t.velocity);
    for (const dye of [t.dyeA, t.dyeB]) {
      this.draw("advect", dye.write, { texelSize, velocity: t.velocity.read.texture, source: dye.read.texture, dt, retention: decay.dye });
      swap(dye);
    }
  }

  private postProcess(): void {
    const t = this.targets!;
    if (this.params.bloomEnabled) {
      this.draw("bloomPrefilter", t.bloom[0], { ...this.colorUniforms(), threshold: this.params.bloomThreshold });
      for (let i = 1; i < t.bloom.length; i++) {
        const previous = t.bloom[i - 1];
        this.draw("bloomDownsample", t.bloom[i], { source: previous.texture, texelSize: [1 / previous.width, 1 / previous.height] });
      }
    }
    if (this.params.sunraysEnabled) {
      this.draw("sunraysMask", t.sunMask, this.colorUniforms());
      this.draw("sunrays", t.sunrays, { mask: t.sunMask.texture, weight: this.params.sunraysWeight });
      this.draw("sunraysBlur", t.sunTemp, { source: t.sunrays.texture, axis: [1 / t.sunrays.width, 0] });
      this.draw("sunraysBlur", t.sunrays, { source: t.sunTemp.texture, axis: [0, 1 / t.sunrays.height] });
    }
    const colors = this.colorUniforms();
    this.draw("display", t.output, { ...colors,
      texelSize: [1 / t.output.width, 1 / t.output.height],
      backgroundColor: fluidHexToRgb(this.params.backgroundColor), backgroundAlpha: this.params.backgroundAlpha,
      shadingOn: Number(this.params.shading), bloomOn: Number(this.params.bloomEnabled), bloomIntensity: this.params.bloomIntensity,
      bloom0: t.bloom[0].texture, bloom1: t.bloom[1].texture, bloom2: t.bloom[2].texture,
      bloom3: t.bloom[3].texture, bloom4: t.bloom[4].texture, bloom5: t.bloom[5].texture,
      sunraysOn: Number(this.params.sunraysEnabled), sunraysTexture: t.sunrays.texture,
    });
  }

  render(frame: Frame, geometry: MaterialTargetGeometry): MaterialFrameTexture {
    if (this.disposed || !this.targets) throw new FluidV2Failure("resource-allocation", "Fluid v2 уже освобождён.");
    if (this.gl.isContextLost()) throw new FluidV2Failure("context-lost", "Контекст Fluid v2 потерян; host должен создать новый pass.");
    if (!sizeMatches(geometry, this.geometry)) throw new FluidV2Failure("invalid-config", "Geometry Fluid v2 изменилась без resize.");
    this.geometry = { ...geometry };
    this.passes = 0;
    this.gl.renderer.disable(this.gl.SCISSOR_TEST);
    if (this.resetPending) {
      for (const target of this.ownedTargets) this.draw("clear", target);
      for (const seed of createSeedSplats(this.seed)) this.splat(seed.x, seed.y, seed.dx * this.params.force / 2600, seed.dy * this.params.force / 2600, seed.pigment, 1.4);
      this.resetPending = false;
      this.displayDirty = true;
    }
    const step = stepFluidClock(this.clock, frame.dt, this.params.timeScale, this.params.mode, this.params.ambientRate);
    this.clock = step.clock;
    const drag = frame.dt > 0 ? this.input.consume(frame.pointer, this.geometry.width / this.geometry.height) : [];
    if (frame.dt <= 0) this.input.reset();
    let available = 4;
    for (const moved of drag) {
      if (!available) break;
      this.splat(moved.x, moved.y, moved.dx * this.params.force, moved.dy * this.params.force, this.dragPigment++, 0.35);
      available--;
    }
    const manual = drainFluidAction(this.actionState, available);
    this.actionState = manual.state;
    for (const point of manual.splats) {
      this.splat(point.x, point.y, point.dx * this.params.force / 2600, point.dy * this.params.force / 2600, point.pigment, 0.5);
      available--;
    }
    for (const point of step.splats.slice(0, available)) {
      this.splat(point.x, point.y, point.dx * this.params.force / 2600, point.dy * this.params.force / 2600, point.pigment, 0.4);
    }
    if (step.dt > 0) { this.step(step.dt); this.displayDirty = true; }
    if (this.displayDirty) { this.postProcess(); this.displayDirty = false; }
    return { texture: this.targets.output.texture, width: this.targets.output.width, height: this.targets.output.height,
      alphaMode: this.params.backgroundAlpha === 1 ? "opaque" : "premultiplied", colorSpace: "display-srgb" };
  }

  update(params: Readonly<FluidV2Params>): void {
    const parsed = parseFluidV2Params(params);
    if (!parsed) throw new FluidV2Failure("invalid-config", "Параметры Fluid v2 вне schema.");
    this.params = parsed;
    this.displayDirty = true;
  }

  invokeAction(action: MaterialAction): void {
    this.actionState = queueFluidAction(this.actionState, action);
    if (this.actionState.pending) this.displayDirty = true;
  }

  reset(seed: number): void {
    if (!validSeed(seed)) throw new FluidV2Failure("invalid-config", "Некорректный seed Fluid v2.");
    this.seed = seed;
    this.clock = createFluidClock(seed);
    this.actionState = createFluidActionState(seed);
    this.dragPigment = 0;
    this.input.reset();
    this.resetPending = true;
  }

  resize(viewport: Viewport, geometry: MaterialTargetGeometry): void {
    if (this.disposed) return;
    if (geometry.capability !== "background" || geometry.pixelWidth <= 0 || geometry.pixelHeight <= 0 || !Number.isFinite(geometry.pixelWidth) || !Number.isFinite(geometry.pixelHeight)) {
      throw new FluidV2Failure("invalid-config", "Некорректная фоновая геометрия Fluid v2.");
    }
    if (sizeMatches(geometry, this.geometry)) { this.viewport = { ...viewport }; this.geometry = { ...geometry }; return; }
    const allocation = this.plan(geometry);
    this.viewport = { ...viewport };
    this.geometry = { ...geometry };
    this.releaseTargets(); // Borrowed output expires before allocation; peak attachment use stays bounded.
    try { this.allocate(allocation); } catch (error) { this.dispose(); throw error; }
    this.reset(this.seed);
  }

  private releaseTargets(): void {
    const gl = this.gl;
    if (this.ownedTargets.some((target) => target.buffer === gl.renderer.state.framebuffer)) gl.renderer.bindFramebuffer();
    for (const target of this.ownedTargets) {
      for (const texture of target.textures) {
        gl.deleteTexture(texture.texture);
        gl.renderer.state.textureUnits.forEach((id, unit) => { if (id === texture.id) gl.renderer.state.textureUnits[unit] = -1; });
      }
      gl.deleteFramebuffer(target.buffer);
    }
    this.ownedTargets.length = 0;
    this.targets = null;
    this.allocation = null;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.input.reset();
    this.releaseTargets();
    for (const program of this.programs.values()) {
      for (const location of program.uniformLocations?.values() ?? []) this.gl.renderer.state.uniformLocations.delete(location);
      if (this.gl.renderer.state.currentProgram === program.id) this.gl.renderer.state.currentProgram = null;
      this.gl.deleteShader(program.vertexShader);
      this.gl.deleteShader(program.fragmentShader);
      program.remove();
    }
    this.programs.clear();
    this.meshes.clear();
    if (this.geometryMesh) {
      if (this.gl.renderer.currentGeometry?.startsWith(`${this.geometryMesh.id}_`)) this.gl.renderer.currentGeometry = null;
      this.geometryMesh.remove();
      this.geometryMesh = null;
    }
    this.passes = 0;
  }

  getDiagnostics(): EffectDiagnostics {
    return {
      targetCount: this.ownedTargets.length,
      allocatedBytes: this.allocation?.bytes ?? 0,
      passesPerFrame: this.passes,
      quality: this.allocation ? `${this.init.quality}; scale ${this.allocation.scale}; velocity ${this.allocation.simulation.width}×${this.allocation.simulation.height}; dye ${this.allocation.dye.width}×${this.allocation.dye.height}; output ${this.allocation.output.width}×${this.allocation.output.height}` : "disposed",
      notes: ["Pavel curl/divergence/pressure/advection with six transported dye pigments and independent velocity/dye decay.", "20 targets are preplanned with optional Bloom/Sunrays, allowing hot toggles without field reset.", "Active dt is capped at 1/30 before timeScale; no catch-up steps. Ambient splats are bounded/deterministic.", "Draw has no autonomous source; transient seeded-splats adds to existing field. Restart/resize/context restore reset the field.", "Positive dt with no visible dye still runs solver. Host owns scheduling, reduced motion, touch scroll and the one canvas/RAF."],
    };
  }
}
