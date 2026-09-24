/** Exact approved MONO shader/source, extracted from fa7d6c1.
 * Optical math: Liquid_Prnc_Glass 97175e083782eab2d55b85abafc6a426c269e20a.
 * Copyright (c) 2026 i4w7w4a. MIT License.
 */
import type { Texture } from "ogl";
import type { MonoGlassSettings } from "./mono-optical-glass";

export const MONO_OPTICAL_VERTEX = `#version 300 es
in vec2 position;
out vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

// Port of the Liquid_Prnc_Glass signed optical field, constrained to neutral light.
// All visible pixels sample the source texture; readable content remains live DOM.
export const MONO_OPTICAL_FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D uSource;
uniform vec2 uResolution;
uniform float uTime;
uniform float uIOR;
uniform float uEdgeThickness;
uniform float uEdgeDarkening;
uniform float uHighlightStrength;
uniform float uReflectionStrength;
uniform float uCausticStrength;
uniform float uFieldEnabled;
uniform float uFieldFadeMode;
uniform float uFieldStart;
uniform float uFieldSoftness;
uniform float uFieldCurve;
uniform float uFieldStrength;
uniform float uFlowEnabled;
uniform float uFlowSpeed;
uniform float uFlowStrength;
uniform float uFlowScale;
uniform float uFlowMode;
uniform vec2 uPointer;
uniform float uPointerStrength;
in vec2 vUv;
out vec4 fragColor;

vec2 coverUv(vec2 uv) {
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 scale = vec2(1.0);
  if (aspect > 2.0) scale.y = 2.0 / aspect;
  else scale.x = aspect / 2.0;
  return (uv - 0.5) * scale + 0.5;
}
vec3 sourceAt(vec2 uv) {
  // Reflect overflow back into the source instead of repeating its last column.
  // Positive signed IOR otherwise leaves a frozen vertical strip at the right edge.
  vec2 covered = coverUv(uv);
  vec2 reflected = 1.0 - abs(mod(covered, 2.0) - 1.0);
  return texture(uSource, clamp(reflected, vec2(0.001), vec2(0.999))).rgb;
}
float signedOpticalPower(float ior) { return ior * 0.18032787; }
float luminance(vec3 color) { return dot(color, vec3(0.2126, 0.7152, 0.0722)); }

void main() {
  vec3 baseColor = sourceAt(vUv);
  if (abs(uIOR) < 0.00001 || uFieldEnabled < 0.5) {
    fragColor = vec4(baseColor, 1.0);
    return;
  }
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 centered = (vUv - 0.5) * vec2(aspect, 1.0);
  vec2 travel = vec2(abs(centered.x) / max(aspect * 0.5, 0.001), abs(centered.y) * 2.0);
  float ellipseTravel = length(travel);
  float rectTravel = max(travel.x, travel.y);
  float edgeTravel = mix(ellipseTravel, rectTravel, smoothstep(0.72, 1.18, ellipseTravel) * 0.16);
  float softness = clamp(uFieldSoftness, 0.04, 1.0);
  float start = clamp(uFieldStart, 0.0, 0.9);
  float progress = clamp((edgeTravel - start) / softness, 0.0, 1.0);
  float longRamp = smoothstep(max(0.0, start - softness * 0.45), 1.18, edgeTravel);
  float edgeFade = smoothstep(0.0, 1.0, progress) * longRamp;
  float lensFade = smoothstep(max(0.0, start - softness * 0.8), 1.12, edgeTravel);
  float selectedFade = mix(edgeFade, lensFade, step(0.5, uFieldFadeMode));
  float masterFade = pow(selectedFade, clamp(uFieldCurve, 0.35, 6.0));
  vec2 normal = length(centered) > 0.00001 ? normalize(centered) : vec2(0.0);
  if (uFlowEnabled > 0.5 && uFlowMode > 0.5 && uFlowStrength > 0.0) {
    float phase = uTime * uFlowSpeed * 6.2831853;
    vec2 flow;
    if (uFlowMode < 7.0) {
      float angle = atan(centered.y, centered.x) + phase * 0.42;
      float spiral = length(centered) * uFlowScale * 7.5 - phase;
      flow = vec2(cos(angle + spiral), sin(angle + spiral));
    } else {
      flow = vec2(
        sin((vUv.y * uFlowScale + vUv.x * 0.37) * 6.2831853 + phase),
        cos((vUv.x * uFlowScale - vUv.y * 0.31) * 6.2831853 - phase * 0.83));
    }
    normal = normalize(normal + flow * uFlowStrength * (0.28 + masterFade * 0.72));
  }
  normal = normalize(normal + uPointer * uPointerStrength * (0.24 + masterFade * 0.76));
  float pull = signedOpticalPower(uIOR) * uFieldStrength * (0.055 + uEdgeThickness * 0.38);
  // Keep the physical displacement strong, then use the field only as the material mask.
  // Applying masterFade twice makes a mathematically active lens look visually inert.
  vec2 offset = normal * pull / vec2(aspect, 1.0);
  vec3 opticalColor = sourceAt(vUv + offset);
  float edgeMask = smoothstep(max(start + softness * 0.65, 0.52), 1.2, edgeTravel) * masterFade;
  opticalColor *= 1.0 - clamp(uEdgeDarkening, 0.0, 1.0) * edgeMask * 0.44;
  vec2 light = normalize(vec2(-0.46, -0.89));
  float rim = pow(max(dot(normal, light), 0.0), 2.8) * edgeMask;
  float lip = smoothstep(0.58, 1.0, vUv.y) * edgeMask;
  float drift = sin(uTime * 0.34) * 0.055;
  float reflectionBand = exp(-pow((vUv.x + vUv.y * 0.31 - 0.46 - drift) / 0.13, 2.0));
  float reflection = (rim * 0.74 + reflectionBand * (0.12 + edgeMask * 0.42)) * uReflectionStrength;
  vec3 focusSample = sourceAt(vUv + offset * 1.62);
  float focusDelta = max(0.0, luminance(opticalColor) - luminance(focusSample));
  float caustic = focusDelta * (0.3 + edgeMask * 1.3) * uCausticStrength;
  float sweep = 1.0 - smoothstep(0.0, 0.028, abs(vUv.x - fract(uTime * 0.018 + vUv.y * 0.26)));
  opticalColor += vec3(
    (rim * 0.48 + lip * 0.22 + sweep * edgeMask * 0.08) * uHighlightStrength +
    reflection + caustic
  );
  fragColor = vec4(clamp(mix(baseColor, opticalColor, masterFade), 0.0, 1.0), 1.0);
}`;

export type MonoOpticalUniforms = Record<string, { value: number | Float32Array | Texture }>;

export function applyMonoOpticalSettings(uniforms: MonoOpticalUniforms, settings: Readonly<MonoGlassSettings>) {
  uniforms.uIOR!.value = settings.ior;
  uniforms.uDispersion!.value = 0;
  uniforms.uEdgeThickness!.value = settings.edgeThickness;
  uniforms.uEdgeDarkening!.value = settings.edgeDarkening;
  uniforms.uHighlightStrength!.value = settings.highlightStrength;
  uniforms.uReflectionStrength!.value = settings.reflectionStrength;
  uniforms.uCausticStrength!.value = settings.causticStrength;
  uniforms.uFieldEnabled!.value = settings.fieldEnabled ? 1 : 0;
  uniforms.uFieldFadeMode!.value = settings.fieldFadeMode;
  uniforms.uFieldStart!.value = settings.fieldStart;
  uniforms.uFieldSoftness!.value = settings.fieldSoftness;
  uniforms.uFieldCurve!.value = settings.fieldCurve;
  uniforms.uFieldStrength!.value = settings.fieldStrength;
  uniforms.uFlowEnabled!.value = settings.flowEnabled ? 1 : 0;
  uniforms.uFlowSpeed!.value = settings.flowSpeed;
  uniforms.uFlowStrength!.value = settings.flowStrength;
  uniforms.uFlowScale!.value = settings.flowScale;
  uniforms.uFlowMode!.value = settings.flowMode;
  uniforms.uPointerStrength!.value = settings.pointerStrength;
}

export function makeMonoOpticalUniforms(source: Texture): MonoOpticalUniforms {
  return {
    uSource: { value: source }, uResolution: { value: new Float32Array([1, 1]) }, uTime: { value: 0 },
    uIOR: { value: 0 }, uDispersion: { value: 0 }, uEdgeThickness: { value: 0 },
    uEdgeDarkening: { value: 0 }, uHighlightStrength: { value: 0 }, uFieldStart: { value: 0 },
    uFieldSoftness: { value: 0 }, uFieldCurve: { value: 1 }, uFieldStrength: { value: 0 },
    uReflectionStrength: { value: 0 }, uCausticStrength: { value: 0 },
    uFieldEnabled: { value: 1 }, uFieldFadeMode: { value: 0 },
    uFlowEnabled: { value: 0 }, uFlowSpeed: { value: 0 }, uFlowStrength: { value: 0 },
    uFlowScale: { value: 1 }, uFlowMode: { value: 0 },
    uPointer: { value: new Float32Array([0, 0]) }, uPointerStrength: { value: 0 },
  };
}

export function makeMonoNeutralRelief() {
  const width = 512;
  const height = 256;
  const pixels = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const v = y / height;
    for (let x = 0; x < width; x += 1) {
      const u = x / width;
      const wave = Math.sin(u * 9.2 + v * 5.7 + Math.sin(v * 7.1) * 0.55);
      const band = Math.exp(-(((v - 0.64 + Math.sin(u * 5.2) * 0.13) / 0.14) ** 2));
      const secondary = Math.exp(-(((v - 0.25 - Math.sin(u * 4.1) * 0.08) / 0.09) ** 2));
      const striation = (0.5 + 0.5 * Math.sin(u * 29 + v * 12 + wave * 0.4)) * band * 22;
      const silverThread = Math.exp(-(((v - 0.79 + Math.sin(u * 5.4) * 0.085) / 0.016) ** 2)) * 35;
      const contourA = Math.abs(v - 0.19 - Math.sin(u * 5.8 + 0.7) * 0.052) < 0.007 ? 58 : 0;
      const contourB = Math.abs(v - 0.46 + Math.sin(u * 4.6 - 0.4) * 0.071) < 0.009 ? 72 : 0;
      const contourC = Math.abs(v - 0.71 - Math.sin(u * 7.2 + 1.6) * 0.043) < 0.006 ? 63 : 0;
      const value = Math.max(0, Math.min(255, Math.round(
        8 + band * (58 + wave * 29) + secondary * 24 + striation + silverThread +
        contourA + contourB + contourC + Math.max(0, wave) * 10,
      )));
      const index = (y * width + x) * 4;
      pixels[index] = value;
      pixels[index + 1] = value;
      pixels[index + 2] = value;
      pixels[index + 3] = 255;
    }
  }
  return pixels;
}
