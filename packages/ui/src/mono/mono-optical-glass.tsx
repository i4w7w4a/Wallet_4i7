/**
 * Optical field math adapted from Liquid_Prnc_Glass at
 * 97175e083782eab2d55b85abafc6a426c269e20a.
 * Copyright (c) 2026 i4w7w4a. MIT License.
 * https://github.com/i4w7w4a/Liquid_Prnc_Glass
 */

"use client";

import { useEffect, useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { Mesh, Program, Renderer, Texture, Triangle } from "ogl";

export type MonoOpticalPreset = "ledger" | "frost" | "mercury";

export type MonoGlassSettings = {
  ior: number;
  edgeThickness: number;
  edgeDarkening: number;
  highlightStrength: number;
  reflectionStrength: number;
  causticStrength: number;
  fieldEnabled: boolean;
  fieldFadeMode: 0 | 1;
  fieldStart: number;
  fieldSoftness: number;
  fieldCurve: number;
  fieldStrength: number;
  flowEnabled: boolean;
  flowMode: 0 | 5 | 9;
  flowSpeed: number;
  flowStrength: number;
  flowScale: number;
  pointerStrength: number;
};

type NumericGlassKey = Exclude<keyof MonoGlassSettings, "fieldEnabled" | "fieldFadeMode" | "flowEnabled" | "flowMode">;

export const MONO_GLASS_BOUNDS = {
  ior: { min: -2, max: 2, step: 0.01 },
  edgeThickness: { min: 0.06, max: 0.24, step: 0.005 },
  edgeDarkening: { min: 0, max: 0.65, step: 0.01 },
  highlightStrength: { min: 0, max: 1.1, step: 0.01 },
  reflectionStrength: { min: 0, max: 1.25, step: 0.01 },
  causticStrength: { min: 0, max: 1, step: 0.01 },
  fieldStart: { min: 0.18, max: 0.72, step: 0.01 },
  fieldSoftness: { min: 0.25, max: 1, step: 0.01 },
  fieldCurve: { min: 0.6, max: 3, step: 0.01 },
  fieldStrength: { min: 0, max: 2.5, step: 0.01 },
  flowSpeed: { min: 0, max: 0.7, step: 0.01 },
  flowStrength: { min: 0, max: 0.5, step: 0.01 },
  flowScale: { min: 1, max: 4.5, step: 0.01 },
  pointerStrength: { min: 0, max: 0.4, step: 0.01 },
} as const satisfies Record<NumericGlassKey, { min: number; max: number; step: number }>;

export const MONO_GLASS_DEFAULTS: Readonly<Record<MonoOpticalPreset, Readonly<MonoGlassSettings>>> = {
  ledger: { ior: 1.34, edgeThickness: 0.165, edgeDarkening: 0.5, highlightStrength: 0.54,
    reflectionStrength: 0.59, causticStrength: 0.63, fieldEnabled: true, fieldFadeMode: 1,
    fieldStart: 0.34, fieldSoftness: 0.99, fieldCurve: 2.69, fieldStrength: 1.92,
    flowEnabled: true, flowMode: 5, flowSpeed: 0.29, flowStrength: 0.44, flowScale: 4.47, pointerStrength: 0.23 },
  frost: { ior: -0.62, edgeThickness: 0.12, edgeDarkening: 0.32, highlightStrength: 0.44,
    reflectionStrength: 0.55, causticStrength: 0.5, fieldEnabled: true, fieldFadeMode: 0,
    fieldStart: 0.52, fieldSoftness: 0.66, fieldCurve: 1.55, fieldStrength: 1.4,
    flowEnabled: true, flowMode: 9, flowSpeed: 0.14, flowStrength: 0.22, flowScale: 2.8, pointerStrength: 0.13 },
  mercury: { ior: -0.83, edgeThickness: 0.16, edgeDarkening: 0.36, highlightStrength: 0.53,
    reflectionStrength: 0.85, causticStrength: 0.82, fieldEnabled: true, fieldFadeMode: 0,
    fieldStart: 0.47, fieldSoftness: 0.68, fieldCurve: 1.45, fieldStrength: 2.1,
    flowEnabled: true, flowMode: 5, flowSpeed: 0.28, flowStrength: 0.36, flowScale: 3, pointerStrength: 0.18 },
};

export function normalizeMonoGlassSettings(
  preset: MonoOpticalPreset,
  overrides: Partial<MonoGlassSettings> = {},
): MonoGlassSettings {
  const defaults = MONO_GLASS_DEFAULTS[preset];
  const result: MonoGlassSettings = { ...defaults };
  for (const key of Object.keys(MONO_GLASS_BOUNDS) as NumericGlassKey[]) {
    const value = overrides[key];
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    const { min, max } = MONO_GLASS_BOUNDS[key];
    result[key] = Math.min(max, Math.max(min, value));
  }
  if (typeof overrides.fieldEnabled === "boolean") result.fieldEnabled = overrides.fieldEnabled;
  if (typeof overrides.flowEnabled === "boolean") result.flowEnabled = overrides.flowEnabled;
  if (overrides.fieldFadeMode === 0 || overrides.fieldFadeMode === 1) result.fieldFadeMode = overrides.fieldFadeMode;
  if (overrides.flowMode === 0 || overrides.flowMode === 5 || overrides.flowMode === 9) result.flowMode = overrides.flowMode;
  if (result.flowMode === 0) result.flowEnabled = false;
  return result;
}

const vertex = `#version 300 es
in vec2 position;
out vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

// Port of the Liquid_Prnc_Glass signed optical field, constrained to neutral light.
// All visible pixels sample the source texture; readable content remains live DOM.
const fragment = `#version 300 es
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

type Uniform = { value: number | Float32Array | Texture };
type Uniforms = Record<string, Uniform>;
type Engine = {
  update(settings: MonoGlassSettings): void;
  setPointer(x: number, y: number): void;
  setRunning(active: boolean): void;
  dispose(): void;
};

export function MonoOpticalGlass({ preset, settings, active = true, className, children }: {
  preset: MonoOpticalPreset; settings?: Partial<MonoGlassSettings>; active?: boolean; className?: string; children?: ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<Engine | null>(null);
  const inputRef = useRef({ preset, settings });
  const activeRef = useRef(active);
  const runtimeBlockedRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const root = rootRef.current;
    if (!canvas || !root) return;
    const motionQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)") ?? null;
    const connection = getNetworkInformation();
    let disposed = false;
    let unavailable = false;
    let mountedEngine: Engine | null = null;
    const isRuntimeBlocked = () => Boolean(motionQuery?.matches || connection?.saveData);
    const showFallback = () => {
      root.dataset.optics = "fallback";
      canvas.style.opacity = "0";
    };
    const disposeEngine = () => {
      const engine = mountedEngine;
      if (engine) {
        engine.dispose();
        if (engineRef.current === engine) engineRef.current = null;
        mountedEngine = null;
      }
      showFallback();
    };
    const ensureEngine = () => {
      if (disposed || unavailable || mountedEngine || isRuntimeBlocked()) return;
      try {
        const engine = createEngine(canvas, root,
          normalizeMonoGlassSettings(inputRef.current.preset, inputRef.current.settings), () => {
          unavailable = true;
          showFallback();
        });
        if (!engine) {
          unavailable = true;
          showFallback();
          return;
        }
        mountedEngine = engine;
        engineRef.current = engine;
        root.dataset.optics = "webgl";
        canvas.style.opacity = "1";
        engine.setRunning(activeRef.current && !runtimeBlockedRef.current);
      } catch {
        unavailable = true;
        showFallback();
        return;
      }
    };
    const syncRuntimeCapabilities = () => {
      runtimeBlockedRef.current = isRuntimeBlocked();
      if (runtimeBlockedRef.current) {
        disposeEngine();
        return;
      }
      ensureEngine();
      engineRef.current?.setRunning(activeRef.current);
    };
    motionQuery?.addEventListener("change", syncRuntimeCapabilities);
    connection?.addEventListener?.("change", syncRuntimeCapabilities);
    syncRuntimeCapabilities();
    return () => {
      disposed = true;
      motionQuery?.removeEventListener("change", syncRuntimeCapabilities);
      connection?.removeEventListener?.("change", syncRuntimeCapabilities);
      disposeEngine();
    };
  }, []);

  useEffect(() => {
    inputRef.current = { preset, settings };
    engineRef.current?.update(normalizeMonoGlassSettings(preset, settings));
  }, [preset, settings]);
  useEffect(() => {
    activeRef.current = active;
    engineRef.current?.setRunning(active && !runtimeBlockedRef.current);
  }, [active]);

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    engineRef.current?.setPointer(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      (1 - (event.clientY - rect.top) / rect.height) * 2 - 1,
    );
  }

  return (
    <div ref={rootRef} className={className} data-testid="mono-optical-glass"
      data-optics="fallback"
      onPointerMove={onPointerMove} onPointerLeave={() => engineRef.current?.setPointer(0, 0)}
      style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", isolation: "isolate",
        background: "radial-gradient(ellipse 90% 95% at 75% 75%, #555 0%, #232323 23%, #101010 58%, #080808 100%)" }}>
      <canvas ref={canvasRef} aria-hidden="true" data-mono-optical-canvas
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block",
          opacity: 0, pointerEvents: "none" }} />
      <div style={{ position: "relative", zIndex: 1, width: "100%", height: "100%" }}>{children}</div>
    </div>
  );
}

type NetworkInformationLike = {
  readonly saveData?: boolean;
  addEventListener?: (type: "change", listener: EventListener) => void;
  removeEventListener?: (type: "change", listener: EventListener) => void;
};

function getNetworkInformation() {
  return (navigator as Navigator & { connection?: NetworkInformationLike }).connection;
}

function createEngine(canvas: HTMLCanvasElement, root: HTMLElement, initialSettings: MonoGlassSettings,
  onUnavailable: () => void): Engine | null {
  const context = canvas.getContext("webgl2", { alpha: false, antialias: false });
  if (!context) return null;
  const width = root.clientWidth || root.getBoundingClientRect().width;
  const dpr = Math.min(window.devicePixelRatio || 1, width <= 480 ? 1.5 : 2);
  let renderer: Renderer;
  try {
    renderer = new Renderer({ canvas, webgl: 2, alpha: false, antialias: false, depth: false, dpr });
  } catch {
    context.getExtension?.("WEBGL_lose_context")?.loseContext();
    return null;
  }
  if (!renderer.isWebgl2) {
    context.getExtension?.("WEBGL_lose_context")?.loseContext();
    return null;
  }
  const gl = renderer.gl;
  gl.clearColor(0, 0, 0, 1);
  let source: Texture;
  try {
    source = new Texture(gl, { image: makeNeutralRelief(), width: 512, height: 256,
      type: gl.UNSIGNED_BYTE, format: gl.RGBA, internalFormat: gl.RGBA,
      minFilter: gl.LINEAR, magFilter: gl.LINEAR, wrapS: gl.CLAMP_TO_EDGE,
      wrapT: gl.CLAMP_TO_EDGE, generateMipmaps: false, flipY: false });
  } catch {
    gl.getExtension?.("WEBGL_lose_context")?.loseContext();
    return null;
  }
  const uniforms: Uniforms = {
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
  let geometry: Triangle;
  try {
    geometry = new Triangle(gl);
  } catch {
    gl.deleteTexture(source.texture);
    gl.getExtension?.("WEBGL_lose_context")?.loseContext();
    return null;
  }
  let program: Program;
  try {
    program = new Program(gl, { vertex, fragment, uniforms, depthTest: false, depthWrite: false, cullFace: false });
  } catch {
    geometry.remove();
    gl.deleteTexture(source.texture);
    gl.getExtension?.("WEBGL_lose_context")?.loseContext();
    return null;
  }
  if (!gl.getProgramParameter(program.program, gl.LINK_STATUS)) {
    program.remove();
    geometry.remove();
    gl.deleteTexture(source.texture);
    gl.getExtension?.("WEBGL_lose_context")?.loseContext();
    return null;
  }
  let mesh: Mesh;
  try {
    mesh = new Mesh(gl, { geometry, program });
  } catch {
    program.remove();
    geometry.remove();
    gl.deleteTexture(source.texture);
    gl.getExtension?.("WEBGL_lose_context")?.loseContext();
    return null;
  }
  let currentSettings = initialSettings;
  let active = false;
  let visible = document.visibilityState !== "hidden";
  let intersecting = true;
  let disposed = false;
  let lost = false;
  let frame: number | null = null;
  let lastTime: number | null = null;
  let elapsed = 0;
  const pointer = new Float32Array([0, 0]);
  const pointerTarget = new Float32Array([0, 0]);
  const render = () => renderer.render({ scene: mesh });
  const resize = () => {
    if (disposed) return;
    // Layout dimensions stay truthful while a parent is temporarily scaled by a
    // preset transition. A transformed DOMRect can leave OGL's inline canvas
    // width permanently short after the animation, exposing the fallback edge.
    const rect = root.getBoundingClientRect();
    const width = root.clientWidth || rect.width;
    const height = root.clientHeight || rect.height;
    renderer.setSize(Math.max(1, Math.round(width)), Math.max(1, Math.round(height)));
    const resolution = uniforms.uResolution?.value;
    if (resolution instanceof Float32Array) {
      resolution[0] = gl.drawingBufferWidth;
      resolution[1] = gl.drawingBufferHeight;
    }
    render();
  };
  const stop = () => {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    lastTime = null;
  };
  const pointerIsMoving = () => Math.abs(pointerTarget[0]! - pointer[0]!) > 0.001 ||
    Math.abs(pointerTarget[1]! - pointer[1]!) > 0.001;
  const shouldAnimate = () => !lost && active && visible && intersecting && currentSettings.fieldEnabled && (
    (currentSettings.flowEnabled && currentSettings.flowMode > 0 && currentSettings.flowSpeed > 0) || pointerIsMoving()
  );
  const schedule = () => { if (!disposed && shouldAnimate() && frame === null) frame = requestAnimationFrame(tick); };
  function tick(time: number) {
    frame = null;
    if (disposed || !shouldAnimate()) return;
    const delta = lastTime === null ? 1 / 60 : Math.min(64, Math.max(0, time - lastTime)) / 1000;
    elapsed += delta;
    lastTime = time;
    const pointerEase = 1 - Math.exp(-delta * 9);
    pointer[0] += (pointerTarget[0]! - pointer[0]!) * pointerEase;
    pointer[1] += (pointerTarget[1]! - pointer[1]!) * pointerEase;
    if (!pointerIsMoving()) {
      pointer[0] = pointerTarget[0]!;
      pointer[1] = pointerTarget[1]!;
    }
    uniforms.uTime!.value = elapsed;
    const pointerUniform = uniforms.uPointer!.value;
    if (pointerUniform instanceof Float32Array) pointerUniform.set(pointer);
    render();
    schedule();
  }
  const syncAnimation = () => { if (shouldAnimate()) schedule(); else stop(); };
  const onVisibility = () => { visible = document.visibilityState !== "hidden"; syncAnimation(); };
  const onContextLost = (event: Event) => {
    event.preventDefault();
    lost = true;
    stop();
    active = false;
    onUnavailable();
  };
  let resizeObserver: ResizeObserver | null = null;
  let intersectionObserver: IntersectionObserver | null = null;
  const engine: Engine = {
    update(nextSettings) {
      if (disposed || lost) return;
      currentSettings = nextSettings;
      uniforms.uIOR!.value = nextSettings.ior;
      uniforms.uDispersion!.value = 0;
      uniforms.uEdgeThickness!.value = nextSettings.edgeThickness;
      uniforms.uEdgeDarkening!.value = nextSettings.edgeDarkening;
      uniforms.uHighlightStrength!.value = nextSettings.highlightStrength;
      uniforms.uReflectionStrength!.value = nextSettings.reflectionStrength;
      uniforms.uCausticStrength!.value = nextSettings.causticStrength;
      uniforms.uFieldEnabled!.value = nextSettings.fieldEnabled ? 1 : 0;
      uniforms.uFieldFadeMode!.value = nextSettings.fieldFadeMode;
      uniforms.uFieldStart!.value = nextSettings.fieldStart;
      uniforms.uFieldSoftness!.value = nextSettings.fieldSoftness;
      uniforms.uFieldCurve!.value = nextSettings.fieldCurve;
      uniforms.uFieldStrength!.value = nextSettings.fieldStrength;
      uniforms.uFlowEnabled!.value = nextSettings.flowEnabled ? 1 : 0;
      uniforms.uFlowSpeed!.value = nextSettings.flowSpeed;
      uniforms.uFlowStrength!.value = nextSettings.flowStrength;
      uniforms.uFlowScale!.value = nextSettings.flowScale;
      uniforms.uFlowMode!.value = nextSettings.flowMode;
      uniforms.uPointerStrength!.value = nextSettings.pointerStrength;
      render();
      syncAnimation();
    },
    setPointer(x, y) {
      if (disposed || lost) return;
      pointerTarget[0] = Math.min(1, Math.max(-1, x));
      pointerTarget[1] = Math.min(1, Math.max(-1, y));
      syncAnimation();
    },
    setRunning(nextActive) { if (!disposed && !lost) { active = nextActive; syncAnimation(); } },
    dispose() {
      if (disposed) return;
      disposed = true;
      stop();
      resizeObserver?.disconnect();
      intersectionObserver?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      program.remove();
      geometry.remove();
      gl.deleteTexture(source.texture);
    },
  };
  try {
    resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(resize);
    resizeObserver?.observe(root);
    intersectionObserver = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver(([entry]) => {
      intersecting = entry?.isIntersecting ?? false;
      syncAnimation();
    });
    intersectionObserver?.observe(root);
    document.addEventListener("visibilitychange", onVisibility);
    canvas.addEventListener("webglcontextlost", onContextLost);
    engine.update(initialSettings);
    resize();
    return engine;
  } catch {
    engine.dispose();
    gl.getExtension?.("WEBGL_lose_context")?.loseContext();
    return null;
  }
}

function makeNeutralRelief() {
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
