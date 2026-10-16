/** Liquid_Prnc_Glass MIT adaptation; see mono-gold-liquid-provenance.md and LICENSE.upstream. */
import { normalizeGoldLiquidSettings, planGoldLiquidSize, type GoldLiquidSettings } from "./mono-gold-liquid-settings";

// Linear-sRGB policy, with RGBA8 headroom below the final-media Y <= 0.030 budget.
const MEDIA_Y_KNEE = 0.016;
const MEDIA_Y_LIMIT = 0.028;
const FOLD_CORE_SIGMA_CSS = 12;
const FOLD_GLOW_SIGMA_CSS = 36;
const TAP_RADIUS_CSS = 56;
export const GOLD_LIQUID_INTERACTION_LIMITS = Object.freeze({ tapLifetime: 0.72,
  scrollLifetime: 0.60, scrollShiftCss: 6 });

/** Ephemeral viewport response, never part of an optical preset or wallet state. */
export interface GoldLiquidInteraction {
  /** WebGL UV: x grows right, y grows up. */
  tapUv?: readonly [number, number];
  tapAge?: number;
  tapStrength?: number;
  scrollShiftCss?: number;
}

const VERTEX = `
attribute vec2 aPosition;
varying vec2 vUv;
void main() { vUv = aPosition * 0.5 + 0.5; gl_Position = vec4(aPosition, 0.0, 1.0); }
`;
const FRAGMENT = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uSourceTexture;
uniform vec2 uResolution;
uniform float uTime;
uniform float uIOR;
uniform float uEdgeThickness;
uniform float uCornerRadius;
uniform float uDispersion;
uniform float uEdgeDarkening;
uniform float uHighlightStrength;
uniform float uFieldEnabled;
uniform float uFieldStart;
uniform float uFieldSoftness;
uniform float uFieldFadeMode;
uniform float uFieldCurve;
uniform float uFieldStrength;
uniform float uFlowSpeed;
uniform float uFlowStrength;
uniform float uFlowScale;
uniform float uFoldCoreSigmaPixels;
uniform float uFoldGlowSigmaPixels;
uniform float uTapRadiusPixels;
uniform vec4 uTap;
uniform float uScrollShift;
uniform float uMediaYKnee;
uniform float uMediaYLimit;

vec3 decodeSRGB(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c));
}
vec3 encodeSRGB(vec3 c) {
  c = max(c, vec3(0.0));
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
}
vec3 softenLuminance(vec3 color) {
  float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
  if (luminance <= uMediaYKnee) return color;
  float excess = luminance - uMediaYKnee;
  float softened = uMediaYKnee + excess / (1.0 + excess / (uMediaYLimit - uMediaYKnee));
  return color * (softened / luminance);
}
vec3 sampleSource(vec2 uv) {
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 cover = aspect > 1.0 ? vec2(1.0, 1.0 / aspect) : vec2(aspect, 1.0);
  vec2 sourceUv = clamp((uv - 0.5) * cover + 0.5, vec2(0.001), vec2(0.999));
  return decodeSRGB(texture2D(uSourceTexture, sourceUv).rgb);
}
float sdRoundedBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + vec2(r);
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
}
float smootherstep01(float x) {
  x = clamp(x, 0.0, 1.0);
  return x * x * x * (x * (x * 6.0 - 15.0) + 10.0);
}
float flowPotential(vec2 p) {
  float phase = uTime * uFlowSpeed;
  float scale = uFlowScale;
  // Lab shear (mode 10), with its secondary layer fixed instead of twelve unused modes.
  float base = sin((p.x + p.y * 0.36) * scale * 6.0 + phase) +
    sin(p.y * scale * 3.2 - phase * 0.5) * 0.35;
  float layer = sin(dot(p, vec2(0.73, -0.61)) * scale * 8.4 - phase * 1.37) +
    sin(dot(p, vec2(-0.31, 0.92)) * scale * 6.2 + phase * 0.67) * 0.42;
  return mix(base, layer, 0.396);
}
vec2 flowGradient(vec2 p) {
  vec2 eps = vec2(0.0022, 0.0);
  return vec2(flowPotential(p + eps.xy) - flowPotential(p - eps.xy),
    flowPotential(p + eps.yx) - flowPotential(p - eps.yx)) / (eps.x * 2.0) * 0.055;
}
float foldEnvelope(float distancePixels) {
  float core = distancePixels / max(uFoldCoreSigmaPixels, 0.0001);
  float glow = distancePixels / max(uFoldGlowSigmaPixels, 0.0001);
  return exp(-0.5 * core * core) * 0.72 + exp(-0.5 * glow * glow) * 0.28;
}
float foldLight(vec2 p) {
  float phase = uTime * uFlowSpeed;
  float scale = uFlowScale / 2.4;
  vec2 q = p * scale;
  float bendA = q.y * 2.5 + phase * 0.18;
  float bendB = q.y * 2.0 - phase * 0.12 + 0.7;
  float foldA = q.x + q.y * 0.62 - 0.16 - sin(bendA) * 0.24;
  float foldB = q.x - q.y * 0.70 + 0.21 + sin(bendB) * 0.18;
  vec2 gradientA = vec2(1.0, 0.62 - cos(bendA) * 0.60) * scale;
  vec2 gradientB = vec2(1.0, -0.70 + cos(bendB) * 0.36) * scale;
  // Single curves have no interference crossings or zero-gradient contour singularities.
  float distanceA = abs(foldA) * uResolution.y / max(length(gradientA), 0.0001);
  float distanceB = abs(foldB) * uResolution.y / max(length(gradientB), 0.0001);
  return foldEnvelope(distanceA) * 0.68 + foldEnvelope(distanceB) * 0.42;
}
void main() {
  vec3 baseColor = sampleSource(vUv);
  // The lab only zeros displacement. Gold also gates absorption/highlights/dispersion.
  if (uIOR == 0.0 || (uFieldEnabled > 0.5 && uFieldStrength == 0.0)) {
    gl_FragColor = vec4(encodeSRGB(baseColor), 1.0); return;
  }
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 correction = vec2(aspect, 1.0);
  vec2 p = (vUv - 0.5) * correction;
  float thickness = uEdgeThickness;
  vec2 innerSize = vec2(max(0.001, (0.5 - thickness) * aspect), max(0.001, 0.5 - thickness));
  float radius = min(uCornerRadius, min(innerSize.x, innerSize.y));
  float masterFade;
  vec2 normal;
  if (uFieldEnabled > 0.5) {
    vec2 normalizedCenter = abs(vUv - 0.5) * 2.0;
    float ellipseTravel = length(normalizedCenter);
    float rectTravel = max(normalizedCenter.x, normalizedCenter.y);
    float edgeTravel = mix(ellipseTravel, rectTravel, smoothstep(0.72, 1.18, ellipseTravel) * 0.16);
    float progress = clamp((edgeTravel - uFieldStart) / uFieldSoftness, 0.0, 1.0);
    float longRamp = smoothstep(max(0.0, uFieldStart - uFieldSoftness * 0.45), 1.18, edgeTravel);
    float maskFade = pow(smoothstep(0.0, 1.0, progress) * longRamp, uFieldCurve);
    float dissolveFade = pow(smootherstep01(progress), max(0.6, uFieldCurve * 0.82)) * longRamp;
    masterFade = mix(maskFade, dissolveFade, step(0.5, uFieldFadeMode));
    normal = length(p) > 0.00001 ? normalize(p) : vec2(0.0);
  } else {
    float d = sdRoundedBox(p, innerSize, radius);
    masterFade = smoothstep(-0.001, thickness * 0.15, d) *
      (1.0 - smoothstep(thickness * 0.62, thickness * 1.24, d));
    vec2 eps = vec2(0.0015, 0.0);
    vec2 grad = vec2(sdRoundedBox(p + eps.xy, innerSize, radius) - sdRoundedBox(p - eps.xy, innerSize, radius),
      sdRoundedBox(p + eps.yx, innerSize, radius) - sdRoundedBox(p - eps.yx, innerSize, radius));
    normal = length(grad) > 0.00001 ? normalize(grad) : vec2(0.0);
  }
  // Quiet middle and upper balance band. No DOM text or financial data enters this mask.
  float side = smoothstep(0.10, 0.43, abs(vUv.x - 0.5));
  float upperQuiet = smoothstep(0.55, 0.82, vUv.y) * (1.0 - side);
  masterFade *= (0.24 + side * 0.76) * (1.0 - upperQuiet * 0.9);
  vec2 tapDelta = (vUv - uTap.xy) * correction;
  float tapRadius = uTapRadiusPixels / max(uResolution.y, 1.0);
  float tap = 0.0;
  if (uTap.w > 0.0) {
    float tapEnvelope = smoothstep(0.0, 0.05, uTap.z) *
      (1.0 - smoothstep(0.08, ${GOLD_LIQUID_INTERACTION_LIMITS.tapLifetime.toFixed(2)}, uTap.z)) * uTap.w;
    float tapMask = exp(-0.5 * dot(tapDelta, tapDelta) / max(tapRadius * tapRadius, 0.000001));
    tap = tapMask * tapEnvelope;
  }
  // A finite local lens can answer a central tap without brightening the resting field.
  masterFade = max(masterFade, tap * 0.12);
  vec2 moved = normal + flowGradient(p) * uFlowStrength * masterFade;
  moved += tapDelta / max(tapRadius, 0.0001) * tap * 0.10;
  vec2 opticalNormal = length(moved) > 0.00001 ? normalize(moved) : normal;
  float strength = uFieldEnabled > 0.5 ? uFieldStrength : 1.0;
  float pull = uIOR * 0.18032787 * masterFade * strength * (0.055 + thickness * 0.38);
  float responsePower = uIOR / (1.0 + abs(uIOR));
  vec2 offset = opticalNormal * pull / correction + vec2(0.0, uScrollShift * masterFade * responsePower);
  vec3 opticalColor = sampleSource(vUv + offset);
  if (uDispersion > 0.0) {
    opticalColor.r = sampleSource(vUv + offset * (1.0 + uDispersion * 3.5)).r;
    opticalColor.b = sampleSource(vUv + offset * (1.0 - uDispersion * 3.5)).b;
  }
  float rim = pow(max(dot(opticalNormal, normalize(vec2(0.46, 0.89))), 0.0), 2.8);
  float folds = foldLight(p + vec2(0.0, uScrollShift)) * min(uFlowStrength, 1.0);
  float highlight = (folds * 0.48 + rim * 0.035 + tap * 0.65) * uHighlightStrength;
  opticalColor *= 1.0 - uEdgeDarkening * masterFade * 0.36;
  opticalColor += vec3(0.64, 0.36, 0.085) * highlight;
  gl_FragColor = vec4(encodeSRGB(softenLuminance(mix(baseColor, opticalColor, masterFade))), 1.0);
}
`;

/** Once-only area integration and linear-RGB prefilter; movement remains in GLSL. */
function sourcePixels(size: number): Uint8Array {
  // At 512²: two RGB Float32 buffers (6 MiB) + final RGBA8 (1 MiB).
  const linear = new Float32Array(size * size * 3);
  const horizontal = new Float32Array(linear.length);
  const weights = [1, 12, 66, 220, 495, 792, 924, 792, 495, 220, 66, 12, 1];
  const decode = (byte: number) => {
    const c = byte / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const encode = (value: number) => Math.floor(255 * (value <= 0.0031308 ? value * 12.92 :
    1.055 * value ** (1 / 2.4) - 0.055));
  const smooth = (low: number, high: number, value: number) => {
    const t = Math.min(1, Math.max(0, (value - low) / (high - low)));
    return t * t * (3 - 2 * t);
  };
  const gaussian = (distance: number, sigma: number) => Math.exp(-0.5 * (distance / sigma) ** 2);
  const integrate = (i: number, u: number, v: number) => {
    const x = u - 0.5, y = v - 0.5;
    const bendA = y * 2.5, bendB = y * 2.0 + 0.7;
    const distanceA = (x + y * 0.62 - 0.16 - Math.sin(bendA) * 0.24) /
      Math.hypot(1, 0.62 - Math.cos(bendA) * 0.60);
    const distanceB = (x - y * 0.70 + 0.21 + Math.sin(bendB) * 0.18) /
      Math.hypot(1, -0.70 + Math.cos(bendB) * 0.36);
    const folds = gaussian(distanceA, 0.09) * 0.68 + gaussian(distanceB, 0.11) * 0.42;
    const depth = (Math.sin(y * 2.1 + x * 0.6) + 1) * 0.5;
    // The calm strip accounts for portrait cover cropping; the whole upper balance band stays dark.
    const side = smooth(0.06, 0.20, Math.abs(u - 0.5));
    const quiet = (0.22 + side * 0.78) * (1 - smooth(0.55, 0.80, v) * 0.85);
    // Low-frequency folds retain soft depth even when clean-zero optics bypass the shader lens.
    linear[i] += decode(15 + (depth * 7 + folds * 27) * quiet) * 0.25;
    linear[i + 1] += decode(16 + (depth * 6 + folds * 19) * quiet) * 0.25;
    linear[i + 2] += decode(15 + (depth * 5 + folds * 9) * quiet) * 0.25;
  };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 3;
    integrate(i, (x + 0.25) / size, (y + 0.25) / size);
    integrate(i, (x + 0.75) / size, (y + 0.25) / size);
    integrate(i, (x + 0.25) / size, (y + 0.75) / size);
    integrate(i, (x + 0.75) / size, (y + 0.75) / size);
  }
  // Separable 13-tap binomial, sigma ~1.732 texels, with clamped boundary samples.
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 3;
    for (let tap = 0; tap < weights.length; tap++) {
      const sample = (y * size + Math.min(size - 1, Math.max(0, x + tap - 6))) * 3;
      const weight = weights[tap] / 4096;
      for (let channel = 0; channel < 3; channel++) horizontal[i + channel] += linear[sample + channel] * weight;
    }
  }
  linear.fill(0);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 3;
    for (let tap = 0; tap < weights.length; tap++) {
      const sample = (Math.min(size - 1, Math.max(0, y + tap - 6)) * size + x) * 3;
      const weight = weights[tap] / 4096;
      for (let channel = 0; channel < 3; channel++) linear[i + channel] += horizontal[sample + channel] * weight;
    }
  }
  const pixels = new Uint8Array(size * size * 4);
  for (let texel = 0; texel < size * size; texel++) {
    const i = texel * 3, rgba = texel * 4;
    const luminance = linear[i] * 0.2126 + linear[i + 1] * 0.7152 + linear[i + 2] * 0.0722;
    const excess = Math.max(0, luminance - MEDIA_Y_KNEE);
    const softened = MEDIA_Y_KNEE + excess / (1 + excess / (MEDIA_Y_LIMIT - MEDIA_Y_KNEE));
    const scale = luminance > MEDIA_Y_KNEE ? softened / luminance : 1;
    for (let channel = 0; channel < 3; channel++) pixels[rgba + channel] = encode(linear[i + channel] * scale);
    pixels[rgba + 3] = 255;
  }
  return pixels;
}
export interface GoldLiquidRenderer {
  resize(cssWidth: number, cssHeight: number, deviceDpr: number): boolean;
  update(settings: GoldLiquidSettings): void;
  render(activeSeconds: number, interaction?: Readonly<GoldLiquidInteraction>): boolean;
  dispose(): void;
}

export function createGoldLiquidRenderer(canvas: HTMLCanvasElement,
  initialSettings: GoldLiquidSettings): GoldLiquidRenderer | null {
  let gl: WebGLRenderingContext | null;
  try { gl = canvas.getContext("webgl", { alpha: false, antialias: false, depth: false,
    stencil: false, preserveDrawingBuffer: false, powerPreference: "low-power" }); }
  catch { return null; }
  if (!gl || gl.isContextLost()) return null;
  const context = gl;
  const shaders: WebGLShader[] = [];
  let program: WebGLProgram | null = null, texture: WebGLTexture | null = null, buffer: WebGLBuffer | null = null;
  let disposed = false, sized = false;
  let settings = normalizeGoldLiquidSettings(initialSettings);
  const uniforms = new Map<string, WebGLUniformLocation>();
  let hardwareLimit = 2048;
  let rasterRatio = 1, cssHeight = 1;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    if (!context.isContextLost()) {
      context.useProgram(null);
      context.bindBuffer(context.ARRAY_BUFFER, null);
      context.bindTexture(context.TEXTURE_2D, null);
    }
    for (const shader of shaders) context.deleteShader(shader);
    if (program) context.deleteProgram(program);
    if (texture) context.deleteTexture(texture);
    if (buffer) context.deleteBuffer(buffer);
    canvas.width = 1; canvas.height = 1;
    shaders.length = 0; uniforms.clear();
  };
  try {
    const textureLimit = Number(context.getParameter(context.MAX_TEXTURE_SIZE));
    const viewportLimit = context.getParameter(context.MAX_VIEWPORT_DIMS) as Int32Array;
    hardwareLimit = Math.min(2048, Number(context.getParameter(context.MAX_RENDERBUFFER_SIZE)),
      viewportLimit[0], viewportLimit[1]);
    if (!Number.isFinite(textureLimit) || textureLimit < 256 || !Number.isFinite(hardwareLimit) || hardwareLimit < 1)
      throw new Error("Gold GL size limit");
    for (const [kind, source] of [[context.VERTEX_SHADER, VERTEX], [context.FRAGMENT_SHADER, FRAGMENT]] as const) {
      const shader = context.createShader(kind);
      if (!shader) throw new Error("Gold shader allocation");
      shaders.push(shader); context.shaderSource(shader, source); context.compileShader(shader);
      if (!context.getShaderParameter(shader, context.COMPILE_STATUS)) throw new Error("Gold shader compile");
    }
    program = context.createProgram();
    if (!program) throw new Error("Gold program allocation");
    shaders.forEach(shader => context.attachShader(program!, shader));
    context.linkProgram(program);
    if (!context.getProgramParameter(program, context.LINK_STATUS)) throw new Error("Gold shader link");
    buffer = context.createBuffer(); texture = context.createTexture();
    if (!buffer || !texture) throw new Error("Gold texture/buffer allocation");
    context.bindBuffer(context.ARRAY_BUFFER, buffer);
    context.bufferData(context.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), context.STATIC_DRAW);
    context.bindTexture(context.TEXTURE_2D, texture);
    const sourceSize = textureLimit >= 512 ? 512 : 256;
    context.texImage2D(context.TEXTURE_2D, 0, context.RGBA, sourceSize, sourceSize, 0,
      context.RGBA, context.UNSIGNED_BYTE, sourcePixels(sourceSize));
    for (const key of [context.TEXTURE_MIN_FILTER, context.TEXTURE_MAG_FILTER])
      context.texParameteri(context.TEXTURE_2D, key, context.LINEAR);
    for (const key of [context.TEXTURE_WRAP_S, context.TEXTURE_WRAP_T])
      context.texParameteri(context.TEXTURE_2D, key, context.CLAMP_TO_EDGE);
    for (const name of ["uSourceTexture", "uResolution", "uTime", "uIOR", "uEdgeThickness", "uCornerRadius",
      "uDispersion", "uEdgeDarkening", "uHighlightStrength", "uFieldEnabled", "uFieldStart", "uFieldSoftness",
      "uFieldFadeMode", "uFieldCurve", "uFieldStrength", "uFlowSpeed", "uFlowStrength", "uFlowScale",
      "uFoldCoreSigmaPixels", "uFoldGlowSigmaPixels", "uTapRadiusPixels", "uTap", "uScrollShift",
      "uMediaYKnee", "uMediaYLimit"]) {
      const location = context.getUniformLocation(program, name);
      if (location === null) throw new Error("Gold uniform unavailable");
      uniforms.set(name, location);
    }
    const attribute = context.getAttribLocation(program, "aPosition");
    if (attribute < 0) throw new Error("Gold vertex attribute");
    context.useProgram(program); context.enableVertexAttribArray(attribute);
    context.vertexAttribPointer(attribute, 2, context.FLOAT, false, 0, 0);
    context.disable(context.DEPTH_TEST); context.disable(context.STENCIL_TEST); context.disable(context.BLEND);
    // WebGL allocation/upload errors are signalled through getError, not JS throws.
    if (context.getError() !== context.NO_ERROR) throw new Error("Gold GPU allocation/upload");
    return {
      resize(cssWidth, nextCssHeight, deviceDpr) {
        if (disposed || context.isContextLost()) return false;
        const size = planGoldLiquidSize(cssWidth, nextCssHeight, deviceDpr, settings.pixelRatio, hardwareLimit);
        if (!size) { sized = false; return false; }
        if (canvas.width !== size.width) canvas.width = size.width;
        if (canvas.height !== size.height) canvas.height = size.height;
        cssHeight = nextCssHeight;
        rasterRatio = size.height / cssHeight;
        sized = true; return true;
      },
      update(next) { if (!disposed) settings = normalizeGoldLiquidSettings(next); },
      render(activeSeconds, interaction) {
        if (disposed || !sized || context.isContextLost() || !Number.isFinite(activeSeconds)) return false;
        context.useProgram(program); context.viewport(0, 0, canvas.width, canvas.height);
        context.activeTexture(context.TEXTURE0); context.bindTexture(context.TEXTURE_2D, texture);
        context.uniform1i(uniforms.get("uSourceTexture")!, 0);
        context.uniform2f(uniforms.get("uResolution")!, canvas.width, canvas.height);
        context.uniform1f(uniforms.get("uTime")!, Math.max(0, activeSeconds));
        const bounded = (value: number | undefined, fallback: number, min: number, max: number) =>
          typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
        const tapAge = bounded(interaction?.tapAge, GOLD_LIQUID_INTERACTION_LIMITS.tapLifetime,
          0, GOLD_LIQUID_INTERACTION_LIMITS.tapLifetime);
        context.uniform4f(uniforms.get("uTap")!, bounded(interaction?.tapUv?.[0], 0.5, 0, 1),
          bounded(interaction?.tapUv?.[1], 0.5, 0, 1), tapAge,
          tapAge < GOLD_LIQUID_INTERACTION_LIMITS.tapLifetime ? bounded(interaction?.tapStrength, 0, 0, 1) : 0);
        const values: Record<string, number> = {
          uIOR: settings.ior, uEdgeThickness: settings.edgeThickness, uCornerRadius: settings.cornerRadius,
          uDispersion: settings.dispersion, uEdgeDarkening: settings.edgeDarkening, uHighlightStrength: settings.highlightStrength,
          uFieldEnabled: Number(settings.fieldEnabled), uFieldStart: settings.fieldStart, uFieldSoftness: settings.fieldSoftness,
          uFieldFadeMode: settings.fieldFadeMode, uFieldCurve: settings.fieldCurve, uFieldStrength: settings.fieldStrength,
          uFlowSpeed: settings.flowSpeed, uFlowStrength: settings.flowStrength, uFlowScale: settings.flowScale,
          uFoldCoreSigmaPixels: FOLD_CORE_SIGMA_CSS * rasterRatio,
          uFoldGlowSigmaPixels: FOLD_GLOW_SIGMA_CSS * rasterRatio,
          uTapRadiusPixels: TAP_RADIUS_CSS * rasterRatio,
          uScrollShift: bounded(interaction?.scrollShiftCss, 0, -GOLD_LIQUID_INTERACTION_LIMITS.scrollShiftCss,
            GOLD_LIQUID_INTERACTION_LIMITS.scrollShiftCss) / cssHeight,
          uMediaYKnee: MEDIA_Y_KNEE, uMediaYLimit: MEDIA_Y_LIMIT,
        };
        for (const [name, value] of Object.entries(values)) context.uniform1f(uniforms.get(name)!, value);
        context.drawArrays(context.TRIANGLES, 0, 3); return true;
      },
      dispose,
    };
  } catch { dispose(); return null; }
}
