/**
 * Adapted for Wallet_4i7 from React Bits at commit
 * 3a1c7f2f9f94ed833934ab5c2635760b9e644583.
 * Copyright (c) 2026 David Haz. MIT + Commons Clause License Condition v1.0.
 */

import { Mesh, Program, Renderer, Triangle } from "ogl";

import type { VisualEffectsConfig } from "@wallet/core";

export type WebThreadsUnavailableReason = "webgl2" | "context-lost";

export type WebThreadsColors = {
  color1: string;
  color2: string;
  color3: string;
  backgroundColor: string;
};

export type WebThreadsEngineInput = {
  effects: VisualEffectsConfig;
  colors: WebThreadsColors;
  viewportWidth: number;
  mouseInteraction: boolean;
  onUnavailable(reason: WebThreadsUnavailableReason): void;
};

export type WebThreadsEngine = {
  update(input: WebThreadsEngineInput): void;
  setRunning(running: boolean): void;
  dispose(): void;
};

type UniformValue = number | boolean | Float32Array;
type Uniform = { value: UniformValue };
type Uniforms = Record<string, Uniform>;

const FAN_MODE: Record<VisualEffectsConfig["fanMode"], number> = {
  center: 0,
  left: 1,
  right: 2,
};

const vertex = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragment = `#version 300 es
precision highp float;
uniform vec2 iResolution;
uniform float iTime;
uniform float uSpeed;
uniform float uThreadCount;
uniform float uFrequency;
uniform float uSpread;
uniform float uTaper;
uniform float uPosition;
uniform float uFanMode;
uniform float uGlow;
uniform float uFalloff;
uniform float uThickness;
uniform float uBrightness;
uniform float uOpacity;
uniform float uMirror;
uniform float uShimmer;
uniform float uGrain;
uniform float uGrainIntensity;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec3 uBackgroundColor;
uniform bool uLightMode;
uniform vec2 uMouse;
uniform float uMouseStrength;
uniform float uEnableMouse;
uniform float uMouseActive;
out vec4 fragColor;

#define TAU 6.28318530718
#define MAX_THREADS 10

float glow(float x, float str, float dist) {
  return dist / pow(max(x, 1e-4), str);
}

void main() {
  vec2 uv = gl_FragCoord.xy / iResolution.xy;
  float n = max(uThreadCount, 1.0);

  float pinchX = uFanMode < 0.5 ? 0.5 : (uFanMode < 1.5 ? 0.0 : 1.0);
  if (uEnableMouse > 0.5) {
    pinchX = mix(pinchX, uMouse.x, clamp(uMouseStrength, 0.0, 1.0) * uMouseActive);
  }

  float spreadDx = uSpread * abs(uv.x - pinchX);
  float baseT = iTime * uSpeed;
  float tauOverN = TAU / n;
  float mirror = uMirror > 0.5 ? sign(pinchX - uv.x) : 1.0;
  bool doShimmer = uShimmer > 0.5;
  float shimmerT = iTime * 1.7;
  float invThickness = 1.0 / max(uThickness, 0.01);
  float xFreq = uv.x * uFrequency;
  float yOff = uv.y - uPosition;
  float ciScale = n > 1.0 ? 1.0 / (n - 1.0) : 0.0;

  vec3 col = vec3(0.0);
  float gsum = 0.0;

  for (int idx = 0; idx < MAX_THREADS; idx++) {
    float i = float(idx);
    if (i >= n) break;

    float amplitude = spreadDx * (1.0 + i * uTaper);
    float shimmer = doShimmer ? sin(shimmerT + i * 1.3) * 0.35 : 0.0;
    float phase = (baseT + i * tauOverN) * mirror + shimmer;
    float sdf = abs(yOff + sin(xFreq + phase) * amplitude) * invThickness;
    float g = glow(sdf, uFalloff, uGlow);
    float ci = i * ciScale;
    vec3 threadCol = mix(uColor1, uColor2, ci);

    col += g * threadCol;
    gsum += g;
  }

  float coreAmt = smoothstep(0.5, 2.2, gsum);
  col = mix(col, uColor3 * gsum, coreAmt * 0.5);

  float bright = uBrightness;
  if (uEnableMouse > 0.5) {
    vec2 md = uv - uMouse;
    float d2 = dot(md, md);
    bright += clamp(uMouseStrength, 0.0, 1.0) * uMouseActive * exp(-d2 * 6.0) * 0.6;
  }
  col *= bright;

  float alpha = clamp(gsum, 0.0, 1.0) * uOpacity;
  vec3 outRgb = col * alpha;

  if (uGrain > 0.5) {
    float gv = (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233)) + iTime) * 43758.5453) - 0.5) * uGrainIntensity;
    outRgb = clamp(outRgb + gv, 0.0, 1.0);
    alpha = clamp(alpha + gv, 0.0, 1.0);
  }

  if (uLightMode) {
    vec3 mapped = vec3(1.0) - exp(-max(col, vec3(0.0)) * 1.3);
    float rawEnergy = clamp(max(mapped.r, max(mapped.g, mapped.b)) * uOpacity, 0.0, 1.0);
    float coverage = smoothstep(0.18, 0.72, rawEnergy);
    coverage *= coverage;
    vec3 hue = mapped / max(max(mapped.r, max(mapped.g, mapped.b)), 1e-4);
    vec3 chroma = pow(clamp(hue, 0.0, 1.0), vec3(0.78));
    vec3 pigment = mix(chroma, vec3(0.08), 0.12);
    vec3 ink = mix(vec3(0.9), pigment, 0.82 + coverage * 0.18);
    fragColor = vec4(mix(uBackgroundColor, ink, coverage), 1.0);
  } else {
    fragColor = vec4(outRgb, alpha);
  }
}
`;

export function createWebThreadsEngine(
  canvas: HTMLCanvasElement,
  initialInput: WebThreadsEngineInput,
): WebThreadsEngine | null {
  const context = canvas.getContext("webgl2", {
    alpha: true,
    antialias: false,
    premultipliedAlpha: true,
  });
  if (!context) {
    initialInput.onUnavailable("webgl2");
    return null;
  }

  const dpr =
    initialInput.viewportWidth <= 480
      ? Math.min(window.devicePixelRatio || 1, 1.5)
      : Math.min(window.devicePixelRatio || 1, 2);
  const renderer = new Renderer({
    canvas,
    webgl: 2,
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    depth: false,
    dpr,
  });
  if (!renderer.isWebgl2) {
    initialInput.onUnavailable("webgl2");
    return null;
  }

  const gl = renderer.gl;
  gl.clearColor(0, 0, 0, 0);
  const uniforms: Uniforms = {
    iTime: { value: 0 },
    iResolution: { value: new Float32Array([1, 1]) },
    uSpeed: { value: 0 },
    uThreadCount: { value: 1 },
    uFrequency: { value: 1 },
    uSpread: { value: 0 },
    uTaper: { value: 0 },
    uPosition: { value: 0.5 },
    uFanMode: { value: 0 },
    uGlow: { value: 0 },
    uFalloff: { value: 1 },
    uThickness: { value: 1 },
    uBrightness: { value: 1 },
    uOpacity: { value: 1 },
    uMirror: { value: 1 },
    uShimmer: { value: 0 },
    uGrain: { value: 1 },
    uGrainIntensity: { value: 0 },
    uColor1: { value: new Float32Array([1, 1, 1]) },
    uColor2: { value: new Float32Array([1, 1, 1]) },
    uColor3: { value: new Float32Array([1, 1, 1]) },
    uBackgroundColor: { value: new Float32Array([0, 0, 0]) },
    uLightMode: { value: false },
    uMouse: { value: new Float32Array([0.5, 0.5]) },
    uMouseStrength: { value: 0 },
    uEnableMouse: { value: 0 },
    uMouseActive: { value: 0 },
  };
  const geometry = new Triangle(gl);
  const program = new Program(gl, { vertex, fragment, uniforms });
  const mesh = new Mesh(gl, { geometry, program });

  let input = initialInput;
  let disposed = false;
  let running = false;
  let intersecting = true;
  let frame: number | null = null;
  let lastFrameTime: number | null = null;
  let elapsed = 0;
  const currentMouse: [number, number] = [0.5, 0.5];
  const targetMouse: [number, number] = [0.5, 0.5];
  let currentActive = 0;
  let targetActive = 0;

  const resize = () => {
    if (disposed) return;
    const target = canvas.parentElement ?? canvas;
    const rect = target.getBoundingClientRect();
    renderer.setSize(Math.max(1, Math.floor(rect.width)), Math.max(1, Math.floor(rect.height)));
    const resolution = uniforms.iResolution?.value;
    if (resolution instanceof Float32Array) {
      resolution[0] = gl.drawingBufferWidth;
      resolution[1] = gl.drawingBufferHeight;
    }
    renderer.render({ scene: mesh });
  };

  const schedule = () => {
    if (disposed || !running || !intersecting || frame !== null) return;
    frame = requestAnimationFrame(loop);
  };

  const stop = () => {
    if (frame !== null) {
      cancelAnimationFrame(frame);
      frame = null;
    }
    lastFrameTime = null;
  };

  function loop(time: number) {
    frame = null;
    if (disposed || !running || !intersecting) return;
    if (lastFrameTime !== null) elapsed += (time - lastFrameTime) * 0.001;
    lastFrameTime = time;
    setNumber(uniforms, "iTime", elapsed);
    currentMouse[0] += 0.05 * (targetMouse[0] - currentMouse[0]);
    currentMouse[1] += 0.05 * (targetMouse[1] - currentMouse[1]);
    currentActive += 0.05 * (targetActive - currentActive);
    setVector(uniforms, "uMouse", currentMouse);
    setNumber(uniforms, "uMouseActive", currentActive);
    renderer.render({ scene: mesh });
    schedule();
  }

  const onPointerMove = (event: PointerEvent) => {
    if (!input.mouseInteraction) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const outsideCanvas =
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom;
    if (outsideCanvas) {
      targetActive = 0;
      return;
    }
    targetMouse[0] = (event.clientX - rect.left) / rect.width;
    targetMouse[1] = 1 - (event.clientY - rect.top) / rect.height;
    targetActive = 1;
  };
  const onPointerEnter = () => {
    if (input.mouseInteraction) targetActive = 1;
  };
  const onPointerLeave = () => {
    targetActive = 0;
  };
  const onContextLost = (event: Event) => {
    event.preventDefault();
    stop();
    running = false;
    input.onUnavailable("context-lost");
  };

  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerenter", onPointerEnter);
  window.addEventListener("pointerleave", onPointerLeave);
  canvas.addEventListener("webglcontextlost", onContextLost);

  const resizeObserver =
    typeof ResizeObserver === "undefined" ? null : new ResizeObserver(resize);
  resizeObserver?.observe(canvas.parentElement ?? canvas);
  const intersectionObserver =
    typeof IntersectionObserver === "undefined"
      ? null
      : new IntersectionObserver(([entry]) => {
          intersecting = entry?.isIntersecting ?? false;
          if (intersecting) schedule();
          else stop();
        });
  intersectionObserver?.observe(canvas);

  const engine: WebThreadsEngine = {
    update(nextInput) {
      if (disposed) return;
      input = nextInput;
      applyInput(uniforms, nextInput);
      if (!nextInput.mouseInteraction) targetActive = 0;
      resize();
    },
    setRunning(nextRunning) {
      if (disposed || running === nextRunning) return;
      running = nextRunning;
      if (running) schedule();
      else stop();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      running = false;
      stop();
      resizeObserver?.disconnect();
      intersectionObserver?.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerenter", onPointerEnter);
      window.removeEventListener("pointerleave", onPointerLeave);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      program.remove();
      geometry.remove();
    },
  };

  applyInput(uniforms, initialInput);
  resize();
  return engine;
}

function applyInput(uniforms: Uniforms, input: WebThreadsEngineInput) {
  const { effects, colors } = input;
  setNumber(uniforms, "uSpeed", effects.speed);
  setNumber(uniforms, "uThreadCount", Math.round(effects.threadCount));
  setNumber(uniforms, "uFrequency", effects.frequency);
  setNumber(uniforms, "uSpread", effects.spread);
  setNumber(uniforms, "uTaper", effects.taper);
  setNumber(uniforms, "uPosition", effects.position);
  setNumber(uniforms, "uFanMode", FAN_MODE[effects.fanMode]);
  setNumber(uniforms, "uGlow", effects.glow);
  setNumber(uniforms, "uFalloff", effects.falloff);
  setNumber(uniforms, "uThickness", effects.thickness);
  setNumber(uniforms, "uBrightness", effects.brightness);
  setNumber(uniforms, "uOpacity", effects.opacity);
  setNumber(uniforms, "uMirror", effects.mirror ? 1 : 0);
  setNumber(uniforms, "uShimmer", effects.shimmer ? 1 : 0);
  setNumber(uniforms, "uGrain", effects.grain ? 1 : 0);
  setNumber(uniforms, "uGrainIntensity", effects.grainIntensity);
  setVector(uniforms, "uColor1", hexToRgb(colors.color1));
  setVector(uniforms, "uColor2", hexToRgb(colors.color2));
  setVector(uniforms, "uColor3", hexToRgb(colors.color3));
  setVector(uniforms, "uBackgroundColor", hexToRgb(colors.backgroundColor));
  setNumber(uniforms, "uMouseStrength", effects.pointerStrength);
  setNumber(uniforms, "uEnableMouse", input.mouseInteraction ? 1 : 0);
}

function setNumber(uniforms: Uniforms, key: string, value: number) {
  const uniform = uniforms[key];
  if (uniform) uniform.value = value;
}

function setVector(
  uniforms: Uniforms,
  key: string,
  value: readonly [number, number] | readonly [number, number, number],
) {
  const current = uniforms[key]?.value;
  if (!(current instanceof Float32Array)) return;
  value.forEach((channel, index) => {
    current[index] = channel;
  });
}

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return [1, 1, 1];
  return [
    Number.parseInt(result[1] ?? "ff", 16) / 255,
    Number.parseInt(result[2] ?? "ff", 16) / 255,
    Number.parseInt(result[3] ?? "ff", 16) / 255,
  ];
}
