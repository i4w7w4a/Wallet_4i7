import { RenderTarget, type OGLRenderingContext } from "ogl";
import type { CreateResult, EffectDiagnostics, Frame, GpuFailure, Viewport } from "../../contracts";
import type { MaterialInit, MaterialPass, MaterialResourcePlan, MaterialTargetGeometry } from "../../material-contract";
import { createParticleCamera, type ParticleCamera } from "./camera";
import { createSourceSphereGeometry } from "./geometry";
import { computeParticlePointer } from "./pointer";
import { planParticleAllocation, type ParticleAllocation } from "./quality";
import { PARTICLE_BOUNDS, parseParticleParams, type ParticleParams } from "./schema";
import { createParticleSeed } from "./seed";
import { particleShaderPair, type ParticleProgramName } from "./shaders";

type Gl = OGLRenderingContext & WebGL2RenderingContext;
type RawTarget = Readonly<{ texture: WebGLTexture; width: number; height: number }>;
type ProgramState = Readonly<{ program: WebGLProgram; locations: Map<string, WebGLUniformLocation | null> }>;
type Uniforms = Readonly<Record<string, number | readonly number[] | Float32Array>>;
type Samplers = readonly (readonly [string, RawTarget])[];
type Targets = {
  position: RawTarget; positionTemp: RawTarget; particleVelocity: RawTarget; particleVelocityTemp: RawTarget;
  random: RawTarget; velocity: RawTarget; velocityTemp: RawTarget; velocityOriginal: RawTarget;
  weight: RawTarget; marker: RawTarget; divergence: RawTarget; pressure: RawTarget;
  pressureTemp: RawTarget; rendering: RawTarget; occlusion: RawTarget; composite: RawTarget;
  shadowDepth: RawTarget;
};

const GRID_SIZE = [40, 20, 20] as const;
const CLEAR = new Float32Array([0, 0, 0, 0]);
const GBUFFER_CLEAR = new Float32Array([-1000, -1000, -1000, -1000]);
const PROGRAMS: readonly ParticleProgramName[] = [
  "transferGrid", "mark", "normalize", "copy", "force", "boundary", "divergence",
  "jacobi", "subtract", "transferParticles", "advect", "sphere", "sphereAO",
  "sphereDepth", "composite", "fxaa",
];

class ParticleFailure extends Error {
  constructor(readonly code: GpuFailure["code"], message: string) { super(message); }
}

function rgb(hex: string): readonly [number, number, number] {
  return [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255) as [number, number, number];
}

function sameAllocation(a: ParticleAllocation, plan: MaterialResourcePlan): boolean {
  return a.attachmentBytes === plan.attachmentBytes && a.textureBytes === plan.textureBytes
    && plan.passesPerFrame === 74;
}

class ParticleEffect implements MaterialPass<ParticleParams> {
  private readonly gl: Gl;
  private readonly quality: MaterialInit<ParticleParams, null>["quality"];
  private readonly limits: MaterialInit<ParticleParams, null>["limits"];
  private viewport: Viewport;
  private params: ParticleParams;
  private seed: number;
  private allocation: ParticleAllocation;
  private camera: ParticleCamera;
  private targets: Targets | null = null;
  private output: RenderTarget | null = null;
  private simFbo: WebGLFramebuffer | null = null;
  private renderFbo: WebGLFramebuffer | null = null;
  private shadowFbo: WebGLFramebuffer | null = null;
  private renderDepth: WebGLRenderbuffer | null = null;
  private particleVao: WebGLVertexArrayObject | null = null;
  private sphereVao: WebGLVertexArrayObject | null = null;
  private quadVao: WebGLVertexArrayObject | null = null;
  private indexCount = 0;
  private readonly ownedTextures: WebGLTexture[] = [];
  private readonly ownedBuffers: WebGLBuffer[] = [];
  private readonly ownedVaos: WebGLVertexArrayObject[] = [];
  private readonly programs = new Map<ParticleProgramName, ProgramState>();
  private frameNumber = 0;
  private passCount = 0;
  private disposed = false;

  constructor(gl: Gl, init: MaterialInit<ParticleParams, null>, allocation: ParticleAllocation) {
    this.gl = gl;
    this.quality = init.quality;
    this.limits = init.limits;
    this.viewport = init.viewport;
    this.params = parseParticleParams(init.params)!;
    this.seed = init.seed;
    this.allocation = allocation;
    this.camera = createParticleCamera(allocation.output.width / allocation.output.height,
      this.params.camera, allocation.sphereRadius * PARTICLE_BOUNDS.particleSize.max);
    try {
      this.compilePrograms();
      this.allocate(allocation);
      this.reset(init.seed);
    } catch (error) {
      this.dispose();
      throw error;
    } finally { this.restoreOglState(); }
  }

  private compilePrograms(): void {
    const gl = this.gl;
    const compile = (type: number, source: string, name: string) => {
      const shader = gl.createShader(type);
      if (!shader) throw new ParticleFailure("resource-allocation", `Fluid Particles: shader ${name} не создан.`);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(shader) ?? "unknown";
        gl.deleteShader(shader);
        throw new ParticleFailure("shader-error", `Fluid Particles ${name}: ${log}`);
      }
      return shader;
    };
    for (const name of PROGRAMS) {
      const source = particleShaderPair(name);
      const vertex = compile(gl.VERTEX_SHADER, source.vertex, `${name}.vert`);
      let fragment: WebGLShader;
      try { fragment = compile(gl.FRAGMENT_SHADER, source.fragment, `${name}.frag`); }
      catch (error) { gl.deleteShader(vertex); throw error; }
      const program = gl.createProgram();
      if (!program) { gl.deleteShader(vertex); gl.deleteShader(fragment); throw new ParticleFailure("resource-allocation", "Fluid Particles: program не создан."); }
      gl.attachShader(program, vertex);
      gl.attachShader(program, fragment);
      if (source.sphere) {
        gl.bindAttribLocation(program, 0, "a_vertexPosition");
        gl.bindAttribLocation(program, 1, "a_vertexNormal");
        gl.bindAttribLocation(program, 2, "a_textureCoordinates");
      } else {
        gl.bindAttribLocation(program, 0, name === "transferGrid" || name === "mark" ? "a_textureCoordinates" : "a_position");
      }
      gl.linkProgram(program);
      gl.detachShader(program, vertex); gl.detachShader(program, fragment);
      gl.deleteShader(vertex); gl.deleteShader(fragment);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const log = gl.getProgramInfoLog(program) ?? "unknown";
        gl.deleteProgram(program);
        throw new ParticleFailure("shader-error", `Fluid Particles ${name}: ${log}`);
      }
      this.programs.set(name, { program, locations: new Map() });
    }
  }

  private target(width: number, height: number, internalFormat: number, type: number,
    data: Float32Array | null = null, filter: number = this.gl.NEAREST, depth = false): RawTarget {
    const gl = this.gl;
    const texture = gl.createTexture();
    if (!texture) throw new ParticleFailure("resource-allocation", "Fluid Particles: texture не создана.");
    this.ownedTextures.push(texture);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, width, height, 0,
      depth ? gl.DEPTH_COMPONENT : gl.RGBA, type, data);
    return { texture, width, height };
  }

  private verifyColor(target: RawTarget, fbo: WebGLFramebuffer): void {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, target.texture, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      throw new ParticleFailure("unsupported-format", "Fluid Particles: float framebuffer неполон.");
    }
  }

  private allocate(plan: ParticleAllocation): void {
    const gl = this.gl;
    const framebuffer = () => {
      const result = gl.createFramebuffer();
      if (!result) throw new ParticleFailure("resource-allocation", "Fluid Particles: framebuffer не создан.");
      return result;
    };
    this.simFbo = framebuffer(); this.renderFbo = framebuffer(); this.shadowFbo = framebuffer();
    const p = plan.particles;
    const vWidth = (plan.grid[0] + 1) * (plan.grid[2] + 1);
    const vHeight = plan.grid[1] + 1;
    const sWidth = plan.grid[0] * plan.grid[2];
    const sHeight = plan.grid[1];
    const float32 = (w: number, h: number, data: Float32Array | null = null) => this.target(w, h, gl.RGBA32F, gl.FLOAT, data);
    const float16 = (w: number, h: number, filter: number = gl.NEAREST) => this.target(w, h, gl.RGBA16F, gl.HALF_FLOAT, null, filter);
    const rgba8 = (w: number, h: number, filter: number = gl.NEAREST) => this.target(w, h, gl.RGBA8, gl.UNSIGNED_BYTE, null, filter);
    const targets: Targets = {
      position: float32(p.width, p.height), positionTemp: float32(p.width, p.height),
      particleVelocity: float16(p.width, p.height), particleVelocityTemp: float16(p.width, p.height),
      random: float32(p.width, p.height), velocity: float16(vWidth, vHeight, gl.LINEAR),
      velocityTemp: float16(vWidth, vHeight, gl.LINEAR),
      velocityOriginal: float16(vWidth, vHeight, gl.LINEAR), weight: float16(vWidth, vHeight, gl.LINEAR),
      marker: rgba8(sWidth, sHeight), divergence: float16(sWidth, sHeight),
      pressure: float16(sWidth, sHeight), pressureTemp: float16(sWidth, sHeight),
      rendering: float16(plan.output.width, plan.output.height, gl.LINEAR),
      occlusion: rgba8(plan.output.width, plan.output.height, gl.LINEAR),
      composite: rgba8(plan.output.width, plan.output.height, gl.LINEAR),
      shadowDepth: this.target(plan.shadow.width, plan.shadow.height,
        gl.DEPTH_COMPONENT16, gl.UNSIGNED_SHORT, null, gl.LINEAR, true),
    };
    this.targets = targets;
    for (const [name, target] of Object.entries(targets) as [keyof Targets, RawTarget][]) {
      if (name === "random" || name === "shadowDepth") continue;
      this.verifyColor(target, this.simFbo);
    }
    this.renderDepth = gl.createRenderbuffer();
    if (!this.renderDepth) throw new ParticleFailure("resource-allocation", "Fluid Particles: depth buffer не создан.");
    gl.bindRenderbuffer(gl.RENDERBUFFER, this.renderDepth);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, plan.output.width, plan.output.height);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.renderFbo);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.renderDepth);
    this.verifyColor(targets.rendering, this.renderFbo);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, targets.shadowDepth.texture, 0);
    gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      throw new ParticleFailure("unsupported-format", "Fluid Particles: shadow depth framebuffer неполон.");
    }
    this.restoreOglState();
    this.output = new RenderTarget(gl, { width: plan.output.width, height: plan.output.height,
      depth: false, stencil: false, color: 1, internalFormat: gl.RGBA8,
      format: gl.RGBA, type: gl.UNSIGNED_BYTE, minFilter: gl.LINEAR, magFilter: gl.LINEAR });
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.output.buffer);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      throw new ParticleFailure("unsupported-format", "Fluid Particles: output framebuffer неполон.");
    }
    this.buildGeometry(plan);
  }

  private buffer(data: Float32Array | Uint16Array, target: number): WebGLBuffer {
    const gl = this.gl;
    const buffer = gl.createBuffer();
    if (!buffer) throw new ParticleFailure("resource-allocation", "Fluid Particles: geometry buffer не создан.");
    this.ownedBuffers.push(buffer);
    gl.bindBuffer(target, buffer);
    gl.bufferData(target, data, gl.STATIC_DRAW);
    return buffer;
  }

  private vao(): WebGLVertexArrayObject {
    const vao = this.gl.createVertexArray();
    if (!vao) throw new ParticleFailure("resource-allocation", "Fluid Particles: vertex array не создан.");
    this.ownedVaos.push(vao);
    return vao;
  }

  private buildGeometry(plan: ParticleAllocation): void {
    const gl = this.gl;
    this.quadVao = this.vao();
    gl.bindVertexArray(this.quadVao);
    this.buffer(new Float32Array([-1, -1, -1, 1, 1, -1, 1, 1]), gl.ARRAY_BUFFER);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const coordinates = createParticleSeed(plan.particles, this.seed, this.params.initialFill,
      plan.sphereRadius * PARTICLE_BOUNDS.particleSize.max).coordinates;
    const coordinateBuffer = this.buffer(coordinates, gl.ARRAY_BUFFER);
    this.particleVao = this.vao();
    gl.bindVertexArray(this.particleVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, coordinateBuffer);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const sphere = createSourceSphereGeometry();
    this.indexCount = sphere.indices.length;
    const vertexBuffer = this.buffer(sphere.vertices, gl.ARRAY_BUFFER);
    const indexBuffer = this.buffer(sphere.indices, gl.ELEMENT_ARRAY_BUFFER);
    this.sphereVao = this.vao();
    gl.bindVertexArray(this.sphereVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, coordinateBuffer);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(2, 1);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bindVertexArray(null);
  }

  private location(state: ProgramState, name: string): WebGLUniformLocation | null {
    if (!state.locations.has(name)) state.locations.set(name, this.gl.getUniformLocation(state.program, name));
    return state.locations.get(name) ?? null;
  }

  private use(name: ParticleProgramName, uniforms: Uniforms = {}, samplers: Samplers = [], ints: Readonly<Record<string, number>> = {}): ProgramState {
    const gl = this.gl;
    const state = this.programs.get(name)!;
    gl.useProgram(state.program);
    for (const [key, value] of Object.entries(uniforms)) {
      const location = this.location(state, key);
      if (!location) continue;
      if (typeof value === "number") gl.uniform1f(location, value);
      else if (value.length === 2) gl.uniform2fv(location, value);
      else if (value.length === 3) gl.uniform3fv(location, value);
      else if (value.length === 4) gl.uniform4fv(location, value);
      else if (value.length === 16) gl.uniformMatrix4fv(location, false, value);
    }
    for (const [key, value] of Object.entries(ints)) {
      const location = this.location(state, key);
      if (location) gl.uniform1i(location, value);
    }
    samplers.forEach(([key, target], unit) => {
      const location = this.location(state, key);
      if (!location) return;
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, target.texture);
      gl.uniform1i(location, unit);
    });
    return state;
  }

  private color(target: RawTarget, fbo = this.simFbo!): void {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, target.texture, 0);
    gl.viewport(0, 0, target.width, target.height);
  }

  private clear(target: RawTarget): void {
    this.color(target);
    this.gl.clearBufferfv(this.gl.COLOR, 0, CLEAR);
  }

  private fullscreen(name: ParticleProgramName, output: RawTarget, uniforms: Uniforms,
    samplers: Samplers, fbo = this.simFbo!): void {
    const gl = this.gl;
    this.color(output, fbo);
    gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.disable(gl.SCISSOR_TEST);
    gl.colorMask(true, true, true, true);
    this.use(name, uniforms, samplers);
    gl.bindVertexArray(this.quadVao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    this.passCount++;
  }

  private swap(a: keyof Targets, b: keyof Targets): void {
    const targets = this.targets!;
    const saved = targets[a]; targets[a] = targets[b]; targets[b] = saved;
  }

  private transferGrid(target: RawTarget, accumulate: number): void {
    const gl = this.gl;
    const t = this.targets!;
    this.color(target);
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.disable(gl.SCISSOR_TEST);
    gl.enable(gl.BLEND); gl.blendEquation(gl.FUNC_ADD); gl.blendFunc(gl.ONE, gl.ONE);
    gl.clearBufferfv(gl.COLOR, 0, CLEAR);
    gl.bindVertexArray(this.particleVao);
    for (let z = -2; z <= 2; z++) {
      this.use("transferGrid", { u_gridResolution: this.allocation.grid, u_gridSize: GRID_SIZE, u_zOffset: z },
        [["u_positionTexture", t.position], ["u_velocityTexture", t.particleVelocity]], { u_accumulate: accumulate });
      gl.drawArrays(gl.POINTS, 0, this.allocation.particleCount);
      this.passCount++;
    }
    gl.disable(gl.BLEND);
  }

  private mark(): void {
    const gl = this.gl;
    const t = this.targets!;
    this.color(t.marker);
    gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
    gl.clearBufferfv(gl.COLOR, 0, CLEAR);
    this.use("mark", { u_gridResolution: this.allocation.grid, u_gridSize: GRID_SIZE },
      [["u_positionTexture", t.position]]);
    gl.bindVertexArray(this.particleVao);
    gl.drawArrays(gl.POINTS, 0, this.allocation.particleCount);
    this.passCount++;
  }

  private simulate(dt: number, frame: Frame): void {
    const t = this.targets!;
    const grid = this.allocation.grid;
    this.frameNumber++;
    this.transferGrid(t.weight, 0);
    this.transferGrid(t.velocityTemp, 1);
    this.fullscreen("normalize", t.velocity, {}, [["u_weightTexture", t.weight], ["u_accumulatedVelocityTexture", t.velocityTemp]]);
    this.mark();
    this.fullscreen("copy", t.velocityOriginal, {}, [["u_texture", t.velocity]]);
    const pointer = computeParticlePointer(frame.pointer, this.camera,
      this.allocation.output.width / this.allocation.output.height);
    this.fullscreen("force", t.velocityTemp, {
      u_timeStep: dt, u_gridResolution: grid, u_gridSize: GRID_SIZE,
      u_mouseVelocity: pointer.velocity, u_mouseRayOrigin: this.camera.eye,
      u_mouseRayDirection: pointer.ray, u_gravity: this.params.gravity,
      u_pointerForce: this.params.pointerForce,
    }, [["u_velocityTexture", t.velocity]]);
    this.swap("velocity", "velocityTemp");
    this.fullscreen("boundary", t.velocityTemp, { u_gridResolution: grid }, [["u_velocityTexture", t.velocity]]);
    this.swap("velocity", "velocityTemp");
    this.clear(t.divergence);
    this.fullscreen("divergence", t.divergence, { u_gridResolution: grid, u_maxDensity: 10 },
      [["u_velocityTexture", t.velocity], ["u_markerTexture", t.marker], ["u_weightTexture", t.weight]]);
    this.clear(t.pressure);
    for (let i = 0; i < 50; i++) {
      this.fullscreen("jacobi", t.pressureTemp, { u_gridResolution: grid },
        [["u_pressureTexture", t.pressure], ["u_divergenceTexture", t.divergence], ["u_markerTexture", t.marker]]);
      this.swap("pressure", "pressureTemp");
    }
    this.fullscreen("subtract", t.velocityTemp, { u_gridResolution: grid },
      [["u_pressureTexture", t.pressure], ["u_velocityTexture", t.velocity], ["u_markerTexture", t.marker]]);
    this.swap("velocity", "velocityTemp");
    this.fullscreen("transferParticles", t.particleVelocityTemp,
      { u_gridResolution: grid, u_gridSize: GRID_SIZE, u_flipness: this.params.flipRatio },
      [["u_particlePositionTexture", t.position], ["u_particleVelocityTexture", t.particleVelocity],
        ["u_gridVelocityTexture", t.velocity], ["u_originalGridVelocityTexture", t.velocityOriginal]]);
    this.swap("particleVelocity", "particleVelocityTemp");
    this.fullscreen("advect", t.positionTemp, {
      u_gridResolution: grid, u_gridSize: GRID_SIZE, u_timeStep: dt, u_frameNumber: this.frameNumber,
      u_particlesResolution: [this.allocation.particles.width, this.allocation.particles.height],
      u_radiusMargin: this.allocation.sphereRadius * PARTICLE_BOUNDS.particleSize.max,
    }, [["u_positionsTexture", t.position], ["u_randomsTexture", t.random], ["u_velocityGrid", t.velocity]]);
    this.swap("position", "positionTemp");
  }

  private sphere(name: "sphere" | "sphereAO" | "sphereDepth", uniforms: Uniforms, samplers: Samplers): void {
    const gl = this.gl;
    this.use(name, uniforms, samplers);
    gl.bindVertexArray(this.sphereVao);
    gl.drawElementsInstanced(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0, this.allocation.particleCount);
    this.passCount++;
  }

  private drawOutput(): void {
    const gl = this.gl;
    const t = this.targets!;
    const a = this.allocation;
    const camera = this.camera;
    const sphereRadius = a.sphereRadius * this.params.particleSize;
    this.color(t.rendering, this.renderFbo!);
    gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.disable(gl.BLEND); gl.disable(gl.SCISSOR_TEST);
    gl.depthMask(true); gl.colorMask(true, true, true, true);
    gl.clearBufferfv(gl.COLOR, 0, GBUFFER_CLEAR);
    gl.clearBufferfv(gl.DEPTH, 0, new Float32Array([1]));
    this.sphere("sphere", { u_projectionMatrix: camera.projectionMatrix, u_viewMatrix: camera.viewMatrix,
      u_sphereRadius: sphereRadius }, [["u_positionsTexture", t.position], ["u_velocitiesTexture", t.particleVelocity]]);

    this.color(t.occlusion, this.renderFbo!);
    gl.clearBufferfv(gl.COLOR, 0, CLEAR);
    gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.enable(gl.BLEND);
    gl.blendEquation(gl.FUNC_ADD); gl.blendFunc(gl.ONE, gl.ONE); gl.depthMask(false);
    this.sphere("sphereAO", { u_projectionMatrix: camera.projectionMatrix, u_viewMatrix: camera.viewMatrix,
      u_sphereRadius: sphereRadius, u_resolution: [a.output.width, a.output.height], u_fov: camera.fov },
    [["u_positionsTexture", t.position], ["u_velocitiesTexture", t.particleVelocity], ["u_renderingTexture", t.rendering]]);
    gl.disable(gl.BLEND); gl.depthMask(true);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFbo);
    gl.viewport(0, 0, a.shadow.width, a.shadow.height);
    gl.clearBufferfv(gl.DEPTH, 0, new Float32Array([1]));
    gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.enable(gl.SCISSOR_TEST);
    gl.scissor(1, 1, a.shadow.width - 2, a.shadow.height - 2);
    gl.colorMask(false, false, false, false);
    this.sphere("sphereDepth", { u_projectionViewMatrix: camera.lightProjectionViewMatrix,
      u_sphereRadius: sphereRadius }, [["u_positionsTexture", t.position], ["u_velocitiesTexture", t.particleVelocity]]);
    gl.colorMask(true, true, true, true); gl.disable(gl.SCISSOR_TEST);

    this.fullscreen("composite", t.composite, {
      u_resolution: [a.output.width, a.output.height], u_fov: camera.fov,
      u_inverseViewMatrix: camera.inverseViewMatrix, u_shadowResolution: [a.shadow.width, a.shadow.height],
      u_lightProjectionViewMatrix: camera.lightProjectionViewMatrix,
      u_particleColor: rgb(this.params.particleColor), u_backgroundColor: rgb(this.params.backgroundColor),
      u_aoStrength: this.params.aoStrength, u_shadowStrength: this.params.shadowStrength,
    }, [["u_renderingTexture", t.rendering], ["u_occlusionTexture", t.occlusion], ["u_shadowDepthTexture", t.shadowDepth]], this.renderFbo!);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.output!.buffer);
    gl.viewport(0, 0, a.output.width, a.output.height);
    gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
    this.use("fxaa", { u_resolution: [a.output.width, a.output.height] }, [["u_input", t.composite]]);
    gl.bindVertexArray(this.quadVao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    this.passCount++;
  }

  render(frame: Frame, geometry: MaterialTargetGeometry) {
    if (this.disposed || !this.targets || !this.output) throw new ParticleFailure("resource-allocation", "Fluid Particles уже освобождён.");
    if (this.gl.isContextLost()) throw new ParticleFailure("context-lost", "Fluid Particles: контекст потерян.");
    if (geometry.capability !== "background") throw new ParticleFailure("invalid-config", "Fluid Particles требует фоновую геометрию.");
    this.passCount = 0;
    try {
      const dt = Number.isFinite(frame.dt) ? Math.max(0, Math.min(frame.dt, 1 / 60)) * this.params.timeScale : 0;
      if (dt > 0) this.simulate(dt, frame);
      this.drawOutput();
      return { texture: this.output.texture, width: this.allocation.output.width,
        height: this.allocation.output.height, alphaMode: "opaque" as const, colorSpace: "display-srgb" as const };
    } finally { this.restoreOglState(); }
  }

  update(params: Readonly<ParticleParams>): void {
    const parsed = parseParticleParams(params);
    if (!parsed) throw new ParticleFailure("invalid-config", "Fluid Particles: параметры вне схемы.");
    this.params = parsed;
    this.camera = createParticleCamera(this.allocation.output.width / this.allocation.output.height,
      parsed.camera, this.allocation.sphereRadius * PARTICLE_BOUNDS.particleSize.max);
  }

  reset(seed: number): void {
    if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new ParticleFailure("invalid-config", "Fluid Particles: seed вне схемы.");
    if (!this.targets) throw new ParticleFailure("resource-allocation", "Fluid Particles не выделен.");
    const gl = this.gl;
    const t = this.targets;
    this.seed = seed;
    this.frameNumber = 0;
    const seeded = createParticleSeed(this.allocation.particles, seed, this.params.initialFill,
      this.allocation.sphereRadius * PARTICLE_BOUNDS.particleSize.max);
    for (const [target, data] of [[t.position, seeded.positions], [t.random, seeded.randoms]] as const) {
      gl.bindTexture(gl.TEXTURE_2D, target.texture);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, target.width, target.height, gl.RGBA, gl.FLOAT, data);
    }
    for (const [name, target] of Object.entries(t) as [keyof Targets, RawTarget][]) {
      if (name !== "position" && name !== "random" && name !== "shadowDepth") this.clear(target);
    }
    this.restoreOglState();
  }

  resize(viewport: Viewport, geometry: MaterialTargetGeometry): void {
    if (this.disposed) return;
    if (geometry.capability !== "background") throw new ParticleFailure("invalid-config", "Fluid Particles требует фоновую геометрию.");
    const next = planParticleAllocation(viewport, this.limits, this.quality);
    if (!next) throw new ParticleFailure("budget-exceeded", "Fluid Particles не помещается в бюджет после resize.");
    this.viewport = viewport;
    if (next.output.width === this.allocation.output.width && next.output.height === this.allocation.output.height
      && next.profile === this.allocation.profile) return;
    this.releaseTargets();
    this.allocation = next;
    this.camera = createParticleCamera(next.output.width / next.output.height,
      this.params.camera, next.sphereRadius * PARTICLE_BOUNDS.particleSize.max);
    try { this.allocate(next); this.reset(this.seed); } catch (error) { this.dispose(); throw error; }
    finally { this.restoreOglState(); }
  }

  private restoreOglState(): void {
    const gl = this.gl;
    if (gl.isContextLost()) return;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindVertexArray(null);
    gl.useProgram(null);
    gl.activeTexture(gl.TEXTURE0);
    gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.disable(gl.SCISSOR_TEST);
    gl.depthMask(true); gl.colorMask(true, true, true, true);
    const renderer = gl.renderer;
    renderer.state.framebuffer = null;
    renderer.state.currentProgram = null;
    renderer.currentGeometry = null;
    renderer.state.activeTextureUnit = 0;
    renderer.state.textureUnits.fill(-1);
    renderer.state.viewport.width = null;
    renderer.state.viewport.height = null;
    renderer.state.boundBuffer = null;
    renderer.disable(gl.BLEND);
    renderer.disable(gl.DEPTH_TEST);
    renderer.disable(gl.CULL_FACE);
    renderer.disable(gl.SCISSOR_TEST);
    renderer.state.depthMask = true;
    renderer.state.blendFunc.src = -1;
    renderer.state.blendFunc.dst = -1;
    renderer.state.blendEquation.modeRGB = -1;
  }

  private releaseTargets(): void {
    const gl = this.gl;
    if (!gl.isContextLost()) { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.bindVertexArray(null); }
    for (const vao of this.ownedVaos) gl.deleteVertexArray(vao);
    this.ownedVaos.length = 0;
    for (const buffer of this.ownedBuffers) gl.deleteBuffer(buffer);
    this.ownedBuffers.length = 0;
    for (const texture of this.ownedTextures) gl.deleteTexture(texture);
    this.ownedTextures.length = 0;
    if (this.output) {
      for (const texture of this.output.textures) gl.deleteTexture(texture.texture);
      gl.deleteFramebuffer(this.output.buffer);
      this.output = null;
    }
    if (this.renderDepth) gl.deleteRenderbuffer(this.renderDepth);
    if (this.simFbo) gl.deleteFramebuffer(this.simFbo);
    if (this.renderFbo) gl.deleteFramebuffer(this.renderFbo);
    if (this.shadowFbo) gl.deleteFramebuffer(this.shadowFbo);
    this.renderDepth = null; this.simFbo = null; this.renderFbo = null; this.shadowFbo = null;
    this.targets = null; this.quadVao = null; this.particleVao = null; this.sphereVao = null;
    this.restoreOglState();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.releaseTargets();
    for (const state of this.programs.values()) this.gl.deleteProgram(state.program);
    this.programs.clear();
    this.restoreOglState();
  }

  getDiagnostics(): EffectDiagnostics {
    return { targetCount: this.targets ? 18 : 0,
      allocatedBytes: this.targets ? this.allocation.bytes : 0,
      passesPerFrame: this.passCount,
      quality: `${this.allocation.profile} · ${this.allocation.output.width}×${this.allocation.output.height}; ${this.allocation.particleCount} particles; grid ${this.allocation.grid.join("×")}`,
      notes: ["3D PIC/FLIP: particle↔MAC grid, 50 Jacobi iterations, RK2 advection; 69 solver draws and five rendering draws when dt>0.",
        "80 triangles per sphere matches the effective upstream geometry; spherical AO and 256² shadow map retained.",
        "RGBA16F G-buffer and bounded internal resolution replace source fullscreen RGBA32F; driver overhead excluded.",
        "No implicit orbit, wheel or page drag capture. Initial fill applies on Restart; JSON stores no GPU field.",
        "Simulation time is capped to one 1/60 step per host frame, then scaled; no catch-up or endless motion guarantee."],
    };
  }
}

export function createParticleEffect(
  gl: OGLRenderingContext,
  init: MaterialInit<ParticleParams, null> & Readonly<{ plan: MaterialResourcePlan }>,
): CreateResult<MaterialPass<ParticleParams>> {
  const parsed = parseParticleParams(init.params);
  if (!parsed || !Number.isInteger(init.seed) || init.seed < 0 || init.seed > 0xffffffff
    || init.geometry.capability !== "background") {
    return { ok: false, error: { code: "invalid-config", message: "Fluid Particles: неправильная конфигурация." } };
  }
  if (!gl.renderer.isWebgl2) return { ok: false, error: { code: "webgl2-unavailable", message: "Fluid Particles требует WebGL2." } };
  if (gl.isContextLost?.()) return { ok: false, error: { code: "context-lost", message: "Fluid Particles: контекст потерян." } };
  if (!gl.getExtension("EXT_color_buffer_float")) {
    return { ok: false, error: { code: "unsupported-format", message: "Fluid Particles требует renderable float targets." } };
  }
  const allocation = planParticleAllocation(init.viewport, init.limits, init.quality);
  if (!allocation) return { ok: false, error: { code: "budget-exceeded", message: "Fluid Particles превышает бюджет GPU." } };
  if (!sameAllocation(allocation, init.plan)) return { ok: false, error: { code: "invalid-config", message: "Fluid Particles: план ресурсов не совпадает." } };
  try { return { ok: true, value: new ParticleEffect(gl as Gl, { ...init, params: parsed }, allocation) }; }
  catch (error) {
    if (error instanceof ParticleFailure) return { ok: false, error: { code: error.code, message: error.message } };
    return { ok: false, error: { code: "resource-allocation", message: `Fluid Particles: ${error instanceof Error ? error.message : "неизвестная ошибка GPU"}` } };
  }
}
