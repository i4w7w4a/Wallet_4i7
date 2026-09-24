import { Mesh, Program, RenderTarget, Triangle, type OGLRenderingContext, type Texture } from "ogl";
import type { CreateResult, Effect, EffectDiagnostics, EffectInit, Frame, FrameTexture, GpuFailure, Viewport } from "../../contracts";
import { FluidDragInput } from "./input";
import { planFluidAllocation, type FluidAllocation, type FluidSize } from "./quality";
import { parseFluidParams, type FluidParams } from "./schema";
import { createSeedSplats } from "./seed";
import * as shaders from "./shaders";

type Gl = OGLRenderingContext & WebGL2RenderingContext;
type PassName = Exclude<keyof typeof shaders, "vertex">;
type UniformValue = number | readonly number[] | Texture;
type Pair = { read: RenderTarget; write: RenderTarget };
type Targets = { velocity: Pair; dye: Pair; pressure: Pair; curl: RenderTarget; divergence: RenderTarget; output: RenderTarget };

// Transported RGB channels are pigment weights. Palette updates recolor the existing field.
const PALETTES = {
  graphite: [[0.62, 0.68, 0.75], [0.34, 0.4, 0.5], [0.63, 0.54, 0.43]],
  lagoon: [[0.13, 0.65, 0.66], [0.15, 0.32, 0.62], [0.64, 0.71, 0.68]],
  copper: [[0.76, 0.35, 0.15], [0.42, 0.24, 0.28], [0.71, 0.64, 0.49]],
} as const;
const BACKGROUND = [0.018, 0.021, 0.028];
const passNames: readonly PassName[] = ["clear", "splat", "curl", "vorticity", "divergence", "decayPressure", "pressure", "gradient", "advect", "display"];

class FluidFailure extends Error {
  constructor(readonly code: GpuFailure["code"], message: string) { super(message); }
}
const validSeed = (seed: number) => Number.isInteger(seed) && seed >= 0 && seed <= 0xffffffff;
const validViewport = (viewport: Viewport) => [viewport.cssWidth, viewport.cssHeight, viewport.pixelWidth, viewport.pixelHeight, viewport.dpr].every((n) => Number.isFinite(n) && n > 0);
function swap(pair: Pair) { [pair.read, pair.write] = [pair.write, pair.read]; }

/** No renderer, canvas, scheduling, listeners, or storage: all of those belong to the host. */
export function createFluidEffect(gl: OGLRenderingContext, init: EffectInit<FluidParams>): CreateResult<Effect<FluidParams>> {
  const params = parseFluidParams(init.params);
  if (!params || !validSeed(init.seed) || !validViewport(init.viewport)) return { ok: false, error: { code: "invalid-config", message: "Недопустимые параметры, seed или размер Fluid." } };
  if (!gl.renderer.isWebgl2) return { ok: false, error: { code: "webgl2-unavailable", message: "Fluid требует WebGL2." } };
  if (gl.isContextLost()) return { ok: false, error: { code: "context-lost", message: "Графический контекст Fluid потерян." } };
  if (!gl.renderer.getExtension("EXT_color_buffer_float")) return { ok: false, error: { code: "unsupported-format", message: "GPU не поддерживает float render targets для Fluid." } };
  const effect = new FluidEffect(gl as Gl, { ...init, params });
  try {
    effect.initialize();
    return { ok: true, value: effect };
  } catch (error) {
    effect.dispose();
    return { ok: false, error: { code: error instanceof FluidFailure ? error.code : "resource-allocation", message: error instanceof Error ? error.message : "Не удалось создать Fluid." } };
  }
}

class FluidEffect implements Effect<FluidParams> {
  private readonly programs = new Map<PassName, Program>();
  private readonly meshes = new Map<PassName, Mesh>();
  private readonly ownedTargets: RenderTarget[] = [];
  private geometry: Triangle | null = null;
  private targets: Targets | null = null;
  private allocation: FluidAllocation | null = null;
  private viewport: Viewport;
  private params: FluidParams;
  private seed: number;
  private resetPending = true;
  private displayDirty = true;
  private disposed = false;
  private passes = 0;
  private pigmentIndex = 0;
  private readonly input = new FluidDragInput();

  constructor(private readonly gl: Gl, private readonly init: EffectInit<FluidParams>) {
    this.viewport = { ...init.viewport };
    this.params = { ...init.params };
    this.seed = init.seed;
  }

  initialize(): void {
    // Plan before programs/geometry too, so a rejected budget has no allocation side effects.
    const plan = this.plan(this.viewport);
    this.geometry = new Triangle(this.gl);
    for (const name of passNames) {
      const program = new Program(this.gl, { vertex: shaders.vertex, fragment: shaders[name], uniforms: {}, depthTest: false, depthWrite: false, cullFace: false, transparent: false });
      this.programs.set(name, program);
      if (!this.gl.getProgramParameter(program.program, this.gl.LINK_STATUS)) throw new FluidFailure("shader-error", `Fluid: не удалось связать проход ${name}.`);
      this.meshes.set(name, new Mesh(this.gl, { geometry: this.geometry, program }));
    }
    this.allocate(plan);
  }

  private plan(viewport: Viewport): FluidAllocation {
    const limit = Math.min(this.init.limits.maxTextureSize, this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE) as number);
    const plan = planFluidAllocation(viewport.pixelWidth, viewport.pixelHeight, limit, this.init.limits.maxRenderTargetBytes);
    if (!plan) throw new FluidFailure("budget-exceeded", "Fluid не помещается в доступный бюджет GPU.");
    return plan;
  }

  private target(size: FluidSize, internalFormat: number, format: number, type: number, filter: number): RenderTarget {
    const target = new RenderTarget(this.gl, { ...size, depth: false, stencil: false, color: 1, internalFormat, format, type, minFilter: filter, magFilter: filter, wrapS: this.gl.CLAMP_TO_EDGE, wrapT: this.gl.CLAMP_TO_EDGE, unpackAlignment: 1 });
    this.ownedTargets.push(target);
    this.gl.renderer.bindFramebuffer(target);
    if (!this.gl.isFramebuffer(target.buffer) || !this.gl.isTexture(target.texture.texture) || this.gl.checkFramebufferStatus(this.gl.FRAMEBUFFER) !== this.gl.FRAMEBUFFER_COMPLETE) {
      throw new FluidFailure("unsupported-format", "Fluid: float framebuffer недоступен или не выделен.");
    }
    return target;
  }

  private allocate(plan: FluidAllocation): void {
    const gl = this.gl;
    const velocity = () => this.target(plan.simulation, gl.RG16F, gl.RG, gl.HALF_FLOAT, gl.LINEAR);
    const scalar = () => this.target(plan.simulation, gl.R16F, gl.RED, gl.HALF_FLOAT, gl.NEAREST);
    const dye = () => this.target(plan.dye, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, gl.LINEAR);
    this.targets = {
      velocity: { read: velocity(), write: velocity() },
      dye: { read: dye(), write: dye() },
      pressure: { read: scalar(), write: scalar() },
      curl: scalar(), divergence: scalar(),
      output: this.target(plan.output, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR),
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

  private splat(x: number, y: number, dx: number, dy: number, pigment: number, amount: number): void {
    const targets = this.targets!;
    const aspect = this.viewport.cssWidth / this.viewport.cssHeight;
    const radius = this.params.radius / 100 * Math.max(1, aspect);
    const uniforms = { point: [x, y], radius, aspect };
    this.draw("splat", targets.velocity.write, { ...uniforms, source: targets.velocity.read.texture, impulse: [dx, dy, 0], limitValue: 1000 });
    swap(targets.velocity);
    const ink = [0, 0, 0];
    ink[pigment % 3] = amount;
    this.draw("splat", targets.dye.write, { ...uniforms, source: targets.dye.read.texture, impulse: ink, limitValue: 8 });
    swap(targets.dye);
  }

  private step(dt: number): void {
    const t = this.targets!;
    const texelSize = [1 / t.velocity.read.width, 1 / t.velocity.read.height];
    this.draw("curl", t.curl, { texelSize, velocity: t.velocity.read.texture });
    this.draw("vorticity", t.velocity.write, { texelSize, velocity: t.velocity.read.texture, curlField: t.curl.texture, strength: this.params.curl, dt });
    swap(t.velocity);
    this.draw("divergence", t.divergence, { texelSize, velocity: t.velocity.read.texture });
    // Upstream pressure retention is per-frame; preserve its 60 Hz value in seconds.
    this.draw("decayPressure", t.pressure.write, { pressure: t.pressure.read.texture, retention: Math.pow(0.8, dt * 60) });
    swap(t.pressure);
    for (let i = 0; i < this.allocation!.pressureIterations; i++) {
      this.draw("pressure", t.pressure.write, { texelSize, pressure: t.pressure.read.texture, divergenceField: t.divergence.texture });
      swap(t.pressure);
    }
    this.draw("gradient", t.velocity.write, { texelSize, pressure: t.pressure.read.texture, velocity: t.velocity.read.texture });
    swap(t.velocity);
    this.draw("advect", t.velocity.write, { texelSize, velocity: t.velocity.read.texture, source: t.velocity.read.texture, dt, dissipation: this.params.dissipation });
    swap(t.velocity);
    this.draw("advect", t.dye.write, { texelSize, velocity: t.velocity.read.texture, source: t.dye.read.texture, dt, dissipation: 0.7 });
    swap(t.dye);
  }

  render(frame: Frame): FrameTexture {
    if (this.disposed || !this.targets) throw new FluidFailure("resource-allocation", "Fluid уже освобождён.");
    if (this.gl.isContextLost()) throw new FluidFailure("context-lost", "Контекст Fluid потерян; host должен пересоздать adapter.");
    this.passes = 0;
    this.gl.renderer.disable(this.gl.SCISSOR_TEST);
    const t = this.targets;
    if (this.resetPending) {
      for (const target of this.ownedTargets) this.draw("clear", target);
      for (const seed of createSeedSplats(this.seed)) this.splat(seed.x, seed.y, seed.dx * this.params.force / 2600, seed.dy * this.params.force / 2600, seed.pigment, 1.4);
      this.resetPending = false;
      this.displayDirty = true;
    }
    const dt = Number.isFinite(frame.dt) ? Math.max(0, Math.min(1 / 30, frame.dt)) : 0;
    // dt=0 is the host's resume boundary: do not replay queued gestures.
    if (dt > 0) {
      for (const drag of this.input.consume(frame.pointer, this.viewport.cssWidth / this.viewport.cssHeight)) {
        this.splat(drag.x, drag.y, drag.dx * this.params.force, drag.dy * this.params.force, this.pigmentIndex++, 0.35);
      }
      this.step(dt);
      this.displayDirty = true;
    } else this.input.reset();
    if (this.displayDirty) {
      const colors = PALETTES[this.params.palette];
      this.draw("display", t.output, { dye: t.dye.read.texture, texelSize: [1 / t.output.width, 1 / t.output.height], colorA: colors[0], colorB: colors[1], colorC: colors[2], background: BACKGROUND });
      this.displayDirty = false;
    }
    return { texture: t.output.texture, width: t.output.width, height: t.output.height };
  }

  update(params: Readonly<FluidParams>): void {
    const parsed = parseFluidParams(params);
    if (!parsed) throw new FluidFailure("invalid-config", "Параметры Fluid вне schema.");
    this.params = parsed;
    this.displayDirty = true;
  }

  reset(seed: number): void {
    if (!validSeed(seed)) throw new FluidFailure("invalid-config", "Некорректный seed Fluid.");
    this.seed = seed;
    this.pigmentIndex = 0;
    this.input.reset();
    this.resetPending = true;
  }

  resize(viewport: Viewport): void {
    if (this.disposed) return;
    if (!validViewport(viewport)) throw new FluidFailure("invalid-config", "Некорректный размер Fluid.");
    if (Object.keys(viewport).every((key) => viewport[key as keyof Viewport] === this.viewport[key as keyof Viewport])) return;
    const plan = this.plan(viewport);
    this.viewport = { ...viewport };
    // Old borrowed texture expires here. Dispose before allocation to bound peak memory.
    this.releaseTargets();
    try { this.allocate(plan); } catch (error) { this.dispose(); throw error; }
    this.reset(this.seed);
  }

  private releaseTargets(): void {
    const gl = this.gl;
    if (this.ownedTargets.some((target) => target.buffer === gl.renderer.state.framebuffer)) gl.renderer.bindFramebuffer();
    for (const target of this.ownedTargets) {
      for (const texture of target.textures) {
        // Native deletion is necessary: OGL 1.0.11 has no Texture/RenderTarget.remove.
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
      // Program.remove deletes the program only; shaders are retained by OGL.
      this.gl.deleteShader(program.vertexShader);
      this.gl.deleteShader(program.fragmentShader);
      program.remove();
    }
    this.programs.clear();
    this.meshes.clear();
    if (this.geometry) {
      if (this.gl.renderer.currentGeometry?.startsWith(`${this.geometry.id}_`)) this.gl.renderer.currentGeometry = null;
      this.geometry.remove();
      this.geometry = null;
    }
    this.passes = 0;
  }

  getDiagnostics(): EffectDiagnostics {
    const plan = this.allocation;
    return {
      targetCount: this.ownedTargets.length, allocatedBytes: plan?.bytes ?? 0, passesPerFrame: this.passes,
      quality: plan ? `velocity ${plan.simulation.width}×${plan.simulation.height}; dye ${plan.dye.width}×${plan.dye.height}; display ${plan.output.width}×${plan.output.height}` : "disposed",
      notes: ["WebGL2: RG16F velocity, R16F scalar, RGBA16F dye, RGBA8 output; half-float linear filtering.", "20 pressure iterations; 27 simulation + 1 display + 2 per splat (max 4). Idle with dt>0 still runs the solver; dt=0 reuses output.", "Drag only. Host owns passive touch/scroll, all scheduling and reduced-motion guards.", "Resize/reset/Open/A-B restart the seeded field. JSON does not store pixels.", "Bloom/sunrays omitted; procedural dither; 8 MiB maximum color attachment storage, excluding driver overhead."],
    };
  }
}
