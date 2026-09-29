/**
 * Optical field math adapted from Liquid_Prnc_Glass at
 * 97175e083782eab2d55b85abafc6a426c269e20a.
 * Copyright (c) 2026 i4w7w4a. MIT License.
 * https://github.com/i4w7w4a/Liquid_Prnc_Glass
 */

"use client";

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { Mesh, Program, Renderer, Texture, Triangle } from "ogl";
import { MONO_OPTICAL_VERTEX as vertex, MONO_OPTICAL_FRAGMENT as fragment,
  makeMonoNeutralRelief as makeNeutralRelief, makeMonoOpticalUniforms, applyMonoOpticalSettings } from "./mono-optical-kernel";
import type { MonoOpticalLease, MonoSharedOpticalHost } from "./mono-optical-host";
import { normalizeMonoGlassSettings, type MonoGlassSettings, type MonoOpticalPreset } from "./mono-glass-settings";

export {
  MONO_GLASS_BOUNDS, MONO_GLASS_DEFAULTS, normalizeMonoGlassSettings,
  type MonoGlassSettings, type MonoOpticalPreset,
} from "./mono-glass-settings";

type Engine = {
  update(settings: MonoGlassSettings): void;
  setPointer(x: number, y: number): void;
  setRunning(active: boolean): void;
  dispose(): void;
};

type MonoOpticalGlassProps = {
  preset: MonoOpticalPreset; settings?: Partial<MonoGlassSettings>; active?: boolean; className?: string; children?: ReactNode;
  /** Optional lab-owned composition. The normal product renderer is unchanged. */
  sharedHost?: MonoSharedOpticalHost;
};

export function MonoOpticalGlass(props: MonoOpticalGlassProps) {
  return props.sharedHost ? <SharedMonoOpticalGlass {...props} sharedHost={props.sharedHost} />
    : <LocalMonoOpticalGlass {...props} />;
}
const STATIC_RELIEF = "radial-gradient(ellipse 90% 95% at 75% 75%, #555 0%, #232323 23%, #101010 58%, #080808 100%)";
const unavailableSnapshot = () => false;

function SharedMonoOpticalGlass({ preset, settings, className, children, sharedHost }:
  MonoOpticalGlassProps & { sharedHost: MonoSharedOpticalHost }) {
  const root = useRef<HTMLDivElement>(null);
  const lease = useRef<MonoOpticalLease | null>(null);
  const [initial] = useState(() => normalizeMonoGlassSettings(preset, settings));
  const presented = useSyncExternalStore(sharedHost.subscribe, sharedHost.getSnapshot, unavailableSnapshot);
  useLayoutEffect(() => {
    if (!root.current) return;
    const owned = sharedHost.register(root.current, initial);
    lease.current = owned;
    return () => { owned.dispose(); if (lease.current === owned) lease.current = null; };
  }, [sharedHost, initial]);
  useLayoutEffect(() => {
    lease.current?.update(normalizeMonoGlassSettings(preset, settings));
  }, [preset, settings]);
  return <div ref={root} className={className} data-testid="mono-optical-glass"
    data-optics={presented ? "shared-webgl" : "fallback"}
    style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", isolation: "isolate",
      background: presented ? "transparent" : STATIC_RELIEF }}>
    <div style={{ position: "relative", zIndex: 1, width: "100%", height: "100%" }}>{children}</div>
  </div>;
}

function LocalMonoOpticalGlass({ preset, settings, active = true, className, children }: MonoOpticalGlassProps) {
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
  const uniforms = makeMonoOpticalUniforms(source);
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
      applyMonoOpticalSettings(uniforms, nextSettings);
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
