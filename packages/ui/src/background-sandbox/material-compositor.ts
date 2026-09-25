import { Geometry, Mesh, Program, type OGLRenderingContext, type Renderer, type Texture } from "ogl";
import type { FrameTexture, Viewport } from "./contracts";
import type { BackgroundEdgeFinishV1, MaterialTargetGeometry } from "./material-contract";
import { normalizeBackgroundEdgeFinish } from "./material-edge-finish";
import { materialScissorRect } from "./material-target-geometry";

const VERTEX = `#version 300 es
in vec2 position;
out vec2 vUv;
void main() { vUv = position * 0.5 + 0.5; gl_Position = vec4(position, 0.0, 1.0); }`;

// Every adapter supplies display-ready sRGB. Inputs with alpha are already premultiplied.
const FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D uSource;
uniform sampler2D uMask;
uniform vec2 uViewport;
uniform vec4 uRegion;
uniform float uRadius;
uniform float uBorder;
uniform float uKind;
uniform float uOpaque;
uniform vec3 uEdgeFinish;
in vec2 vUv;
out vec4 fragColor;

float roundedCoverage(vec2 point, vec2 size, float radius) {
  float r = min(max(radius, 0.0), min(size.x, size.y) * 0.5);
  vec2 q = abs(point - size * 0.5) - (size * 0.5 - r);
  float distance = length(max(q, vec2(0.0))) + min(max(q.x, q.y), 0.0) - r;
  float edge = max(fwidth(distance), 0.001);
  return 1.0 - smoothstep(-edge * 0.5, edge * 0.5, distance);
}

void main() {
  vec2 local = vUv * uViewport - uRegion.xy;
  vec2 uv = local / uRegion.zw;
  vec4 color = texture(uSource, clamp(uv, vec2(0.0), vec2(1.0)));
  float coverage = 1.0;
  if (uKind > 0.5) {
    coverage = roundedCoverage(local, uRegion.zw, uRadius);
    if (uKind > 1.5 && uKind < 2.5) {
      float inner = roundedCoverage(local - vec2(uBorder),
        max(uRegion.zw - vec2(2.0 * uBorder), vec2(0.001)), max(uRadius - uBorder, 0.0));
      coverage = max(coverage - inner, 0.0);
    } else if (uKind > 2.5 && uKind < 3.5) {
      coverage = texture(uMask, clamp(uv, vec2(0.0), vec2(1.0))).a;
    }
  }
  color.rgb *= coverage;
  color.a = mix(color.a, 1.0, uOpaque) * coverage;
  if (uKind < 0.5 && uEdgeFinish.x > 0.0) {
    float fromSide = min(uv.x, 1.0 - uv.x);
    float feather = max(0.015, uEdgeFinish.z);
    float edgeWeight = 1.0 - smoothstep(uEdgeFinish.y, uEdgeFinish.y + feather, fromSide);
    color.rgb *= 1.0 - uEdgeFinish.x * edgeWeight;
  }
  fragColor = color;
}`;

export type MaterialDrawMode = "background" | "fill" | "border" | "icon" | "promo";
const KIND: Readonly<Record<MaterialDrawMode, number>> = {
  background: 0, fill: 1, border: 2, icon: 3, promo: 4,
};

/** One compositor program draws every borrowed pass texture into the host canvas. */
export class MaterialCompositor {
  private readonly gl: OGLRenderingContext;
  private readonly program: Program;
  private readonly geometry: Geometry;
  private readonly mesh: Mesh;
  private readonly uniforms: {
    uSource: { value: Texture | null }; uMask: { value: Texture | null };
    uViewport: { value: Float32Array }; uRegion: { value: Float32Array };
    uRadius: { value: number }; uBorder: { value: number };
    uKind: { value: number }; uOpaque: { value: number };
    uEdgeFinish: { value: Float32Array };
  };
  private disposed = false;

  constructor(private readonly renderer: Renderer, private viewport: Viewport) {
    this.gl = renderer.gl;
    const gl = this.gl;
    this.uniforms = {
      uSource: { value: null }, uMask: { value: null },
      uViewport: { value: new Float32Array([viewport.cssWidth, viewport.cssHeight]) },
      uRegion: { value: new Float32Array([0, 0, viewport.cssWidth, viewport.cssHeight]) },
      uRadius: { value: 0 }, uBorder: { value: 0 }, uKind: { value: 0 }, uOpaque: { value: 1 },
      uEdgeFinish: { value: new Float32Array(3) },
    };
    this.program = new Program(gl, { vertex: VERTEX, fragment: FRAGMENT, uniforms: this.uniforms,
      transparent: true, depthTest: false, depthWrite: false, cullFace: false });
    this.program.setBlendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    if (!gl.getProgramParameter(this.program.program, gl.LINK_STATUS)) throw new Error("Material compositor shader link failed.");
    this.geometry = new Geometry(gl, { position: { size: 2, data: new Float32Array([-1, -1, 3, -1, -1, 3]) } });
    this.mesh = new Mesh(gl, { geometry: this.geometry, program: this.program, frustumCulled: false });
  }

  resize(viewport: Viewport): void {
    this.viewport = viewport;
    this.uniforms.uViewport.value.set([viewport.cssWidth, viewport.cssHeight]);
  }

  clear(): void {
    if (this.disposed) return;
    const gl = this.gl;
    this.renderer.disable(gl.SCISSOR_TEST);
    this.renderer.bindFramebuffer();
    this.renderer.setViewport(this.viewport.pixelWidth, this.viewport.pixelHeight);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  draw(source: FrameTexture, target: MaterialTargetGeometry, mode: MaterialDrawMode,
    opaque: boolean, iconMask?: Texture, edgeFinish?: BackgroundEdgeFinishV1): boolean {
    if (this.disposed) return false;
    const clip = materialScissorRect(target, this.viewport);
    if (!clip) return false;
    const gl = this.gl;
    this.uniforms.uSource.value = source.texture;
    this.uniforms.uMask.value = iconMask ?? source.texture;
    this.uniforms.uRegion.value.set([target.x, target.y, target.width, target.height]);
    this.uniforms.uRadius.value = target.radiusCss;
    this.uniforms.uBorder.value = target.borderWidthCss;
    this.uniforms.uKind.value = KIND[mode];
    this.uniforms.uOpaque.value = opaque ? 1 : 0;
    const finish = normalizeBackgroundEdgeFinish(mode === "background" ? edgeFinish : undefined);
    this.uniforms.uEdgeFinish.value.set([finish.sideDarkening, finish.inset, finish.softness]);
    this.renderer.enable(gl.SCISSOR_TEST);
    gl.scissor(clip.x, clip.y, clip.width, clip.height);
    this.renderer.render({ scene: this.mesh, clear: false, update: false, sort: false, frustumCull: false });
    this.renderer.disable(gl.SCISSOR_TEST);
    return true;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    const gl = this.gl;
    if (Object.values(this.geometry.attributes).some(attribute => attribute.buffer === gl.renderer.state.boundBuffer)) {
      gl.renderer.state.boundBuffer = null;
    }
    if (gl.renderer.currentGeometry?.startsWith(`${this.geometry.id}_`)) gl.renderer.currentGeometry = null;
    this.geometry.remove();
    this.program.uniformLocations?.forEach(location => gl.renderer.state.uniformLocations.delete(location));
    gl.deleteShader(this.program.vertexShader);
    gl.deleteShader(this.program.fragmentShader);
    if (gl.renderer.state.currentProgram === this.program.id) gl.renderer.state.currentProgram = null;
    this.program.remove();
  }
}
