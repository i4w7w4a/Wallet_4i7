import type { OGLRenderingContext, Texture } from "ogl";

/** ABI v1. This file has no runtime imports, renderer, registry, or storage. */
export type EffectId = "silk" | "fluid";
export type Vec2 = readonly [number, number];

/** P is the concrete adapter's validated parameter type, never a defaults patch. */
export type Config<I extends EffectId, P> = Readonly<{
  kind: "novex-background";
  version: 1;
  effectId: I;
  effectVersion: 1;
  seed: number;
  params: Readonly<P>;
}>;

/** Unknown params cross the shell/storage boundary only through descriptor parsing. */
export type BackgroundRecipe<I extends EffectId = EffectId, P = unknown> =
  Config<I, P> & Readonly<{ assetIds: readonly string[] }>;

export type ValidationIssue = Readonly<{
  code: string;
  message: string;
  field?: string;
}>;
export type ParseResult<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; issues: readonly ValidationIssue[] }>;

/** Color lists are complete normalized snapshots, never mutable palette patches. */
export type ParameterValue = number | boolean | string | readonly string[];
export type ParameterGroup = "color" | "motion" | "surface" | "light" | "physics" | "precise";
export type ParameterControl<K extends string = string> = Readonly<{
  key: K;
  label: string;
  description?: string;
  /** Inspector organization only; not persisted in a recipe. */
  group?: ParameterGroup;
}> & (
  | Readonly<{ kind: "range"; min: number; max: number; step: number; unit?: string }>
  | Readonly<{ kind: "select"; options: readonly Readonly<{ value: string; label: string }>[] }>
  | Readonly<{ kind: "toggle" }>
  | Readonly<{ kind: "color" }>
  | Readonly<{ kind: "color-list"; minItems: number; maxItems: number }>
);

/** Defaults, controls, and strict parsing share the adapter's single set of bounds. */
export interface ParameterSchema<P> {
  readonly defaults: Readonly<P>;
  readonly controls: readonly ParameterControl<Extract<keyof P, string>>[];
  parse(input: unknown): ParseResult<P>;
}

export type Viewport = Readonly<{
  cssWidth: number;
  cssHeight: number;
  pixelWidth: number;
  pixelHeight: number;
  dpr: number;
}>;

export type PointerPhase = "enter" | "move" | "down" | "up" | "leave" | "cancel";
export type PointerSample = Readonly<{
  id: number;
  phase: PointerPhase;
  pointerType?: "mouse" | "pen" | "touch";
  /** UV origin is bottom-left. Initial/re-entry/resize samples have zero delta. */
  uv: Vec2;
  delta: Vec2;
  /** Seconds on the host's active clock, not wall-clock time. */
  time: number;
  buttons: number;
}>;
export type PointerFrame = Readonly<{
  uv: Vec2;
  inside: boolean;
  down: boolean;
  /** Bounded, ordered, consumed once. UI/control events are not included. */
  samples: readonly PointerSample[];
}>;
export type Frame = Readonly<{
  /** Active seconds; paused/hidden time is excluded. */
  time: number;
  /** Bounded seconds; the first frame after resume/reset has dt=0. */
  dt: number;
  pointer: PointerFrame;
}>;

/** Adapter-owned output. Borrowed until its next resize/dispose; never delete in host. */
export type FrameTexture = Readonly<{
  texture: Texture;
  width: number;
  height: number;
}>;

/** Runtime policy, never persisted as artistic parameters. Includes all owned targets. */
export type GpuLimits = Readonly<{
  maxTextureSize: number;
  maxRenderTargetBytes: number;
}>;
export type EffectDiagnostics = Readonly<{
  targetCount: number;
  allocatedBytes: number;
  passesPerFrame: number;
  quality: string;
  notes: readonly string[];
}>;
export type GpuFailure = Readonly<{
  code: "webgl2-unavailable" | "unsupported-format" | "budget-exceeded"
    | "shader-error" | "resource-allocation" | "context-lost" | "invalid-config";
  message: string;
}>;
export type CreateResult<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; error: GpuFailure }>;

export interface Effect<P> {
  /** Reallocation may restart a simulation; disclose that in diagnostics/UI. */
  resize(viewport: Viewport): void;
  /** No rendering, scheduling, or implicit reset of the simulation. */
  update(params: Readonly<P>): void;
  /** Own passes/FBO only. The default framebuffer belongs to the host compositor. */
  render(frame: Frame): FrameTexture;
  reset(seed: number): void;
  /** Idempotent; delete all owned resources, never lose the borrowed GL context. */
  dispose(): void;
  getDiagnostics?(): EffectDiagnostics;
}

export type EffectInit<P> = Readonly<{
  params: Readonly<P>;
  seed: number;
  viewport: Viewport;
  limits: GpuLimits;
}>;
export type EffectProvenance = Readonly<{
  id: string;
  sourceUrl: string;
  revision: string;
  license: string;
  changes: readonly string[];
}>;
export type EffectPreset<P> = Readonly<{
  id: string;
  label: string;
  seed: number;
  params: Readonly<P>;
}>;

export interface Definition<I extends EffectId, P> {
  readonly id: I;
  readonly abiVersion: 1;
  readonly configVersion: 1;
  readonly label: string;
  readonly description: string;
  readonly schema: ParameterSchema<P>;
  readonly presets: readonly EffectPreset<P>[];
  readonly assetIds: readonly string[];
  readonly provenance: EffectProvenance;
  /** Explicit failure presentation, not a substitute advertised as a running effect. */
  readonly fallback: Readonly<{ color: string; label: string }>;
  /** Failure must clean partial allocations. Never create a Renderer/canvas/RAF here. */
  create(gl: OGLRenderingContext, init: EffectInit<P>): CreateResult<Effect<P>>;
}
