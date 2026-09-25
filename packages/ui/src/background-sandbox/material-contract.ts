import type { OGLRenderingContext } from "ogl";
import type {
  BackgroundRecipe, CreateResult, EffectDiagnostics, EffectPreset, EffectProvenance,
  Frame, FrameTexture, GpuLimits, ParameterControl, ParameterSchema, ParameterValue,
  ParseResult, Viewport,
} from "./contracts";

/** ABI v2 adds materials and targets; the exact v1 Config/parser remain unchanged. */
export type MaterialEffectId =
  | "fluid" | "fluid-particles" | "vault-grid"
  | "liquid-metal" | "gem-smoke" | "heatmap" | "pulsing-border";
export type MaterialCapability = "background" | "button-fill" | "button-icon" | "button-border";
export type MaterialEffectVersion<I extends MaterialEffectId> = I extends "fluid" ? 2 : 1;
export type MaterialAssetId =
  | "mono.quick.send" | "mono.quick.receive" | "mono.quick.swap" | "mono.quick.buy";
export type MaterialQualityProfile = "economy" | "balanced" | "detail";
export type MaterialAlphaMode = "opaque" | "premultiplied";
/** A command acts on the live field only. It never enters params, trials or workspace. */
export type MaterialAction = Readonly<{
  kind: "seeded-splats";
  count: 1 | 2 | 3 | 4 | 5 | 6;
}>;
export type MaterialActionDescriptor = Readonly<{
  kind: MaterialAction["kind"];
  label: string;
  minCount: 1;
  maxCount: 6;
}>;

/** Versioned, full artistic data. Runtime quality and simulated pixels never enter this value. */
export type MaterialRecipeV2<
  I extends MaterialEffectId = MaterialEffectId,
  P = unknown,
> = Readonly<{
  kind: "novex-material";
  version: 2;
  effectId: I;
  effectVersion: MaterialEffectVersion<I>;
  seed: number;
  params: Readonly<P>;
  assetIds: readonly MaterialAssetId[];
}>;
export type NormalizedBackgroundMaterial = BackgroundRecipe | MaterialRecipeV2;

export type ButtonTargetId = "quick.send" | "quick.receive" | "quick.swap" | "quick.buy";
export type ButtonMaterialLayer = "fill" | "icon" | "border";
export type MaterialMask = Readonly<{ kind: "rounded-rect" }>
  | Readonly<{ kind: "icon"; assetId: MaterialAssetId }>;
/** Saved target binding; rect/pixel dimensions are measured from the live DOM each frame. */
export type MaterialTargetBinding = Readonly<{
  targetId: ButtonTargetId;
  layer: ButtonMaterialLayer;
  recipe: MaterialRecipeV2;
  mask: MaterialMask;
  radiusCss: number;
  borderWidthCss: number;
  enabled: boolean;
}>;
/** Live region. Coordinates are CSS px, bottom-left origin in the shared canvas. */
export type MaterialTargetGeometry = Readonly<{
  capability: MaterialCapability;
  x: number;
  y: number;
  width: number;
  height: number;
  pixelWidth: number;
  pixelHeight: number;
  dpr: number;
  radiusCss: number;
  borderWidthCss: number;
  mask: MaterialMask;
}>;
/** Only the allowlisted icon paths can become CPU masks; no raw SVG/URL in a recipe. */
export type MaterialMaskSource = Readonly<{
  assetId: MaterialAssetId;
  width: number;
  height: number;
  coverage: Uint8Array;
}>;
export type PreparedMaterialSource =
  | Readonly<{ kind: "icon"; assetId: MaterialAssetId }>
  | Readonly<{ kind: "geometry"; key: string }>;
export type PreparedMaterialAsset = Readonly<{
  /** A geometry mask has no icon asset ID; its cache key includes size/radius/version. */
  source: PreparedMaterialSource;
  width: number;
  height: number;
  rgba: Uint8Array;
  encoding: "coverage" | "paper-gradient" | "paper-luminance";
}>;
export type PreparedMaterialAssets = Readonly<{
  cacheKey: string;
  byteLength: number;
  assets: readonly PreparedMaterialAsset[];
}>;
export type MaterialPrepareRequest<P> = Readonly<{
  params: Readonly<P>;
  seed: number;
  geometry: MaterialTargetGeometry;
  maskSource?: MaterialMaskSource;
  quality: MaterialQualityProfile;
  maxCpuBytes: number;
}>;
/** Sum attachment + additional texture bytes across all active passes before GPU allocation. */
export type MaterialResourcePlan = Readonly<{
  attachmentBytes: number;
  textureBytes: number;
  passesPerFrame: number;
  quality: string;
}>;
export type MaterialInit<P, A> = Readonly<{
  params: Readonly<P>;
  seed: number;
  viewport: Viewport;
  geometry: MaterialTargetGeometry;
  quality: MaterialQualityProfile;
  limits: GpuLimits;
  prepared: A;
}>;
/** Borrowed output; the compositor does not apply tone mapping or gamma again. */
export type MaterialFrameTexture = FrameTexture & Readonly<{
  alphaMode: MaterialAlphaMode;
  colorSpace: "display-srgb";
}>;
export interface MaterialPass<P> {
  update(params: Readonly<P>): void;
  resize(viewport: Viewport, geometry: MaterialTargetGeometry): void;
  render(frame: Frame, geometry: MaterialTargetGeometry): MaterialFrameTexture;
  /** Optional bounded operation on existing GPU state; this does not call reset. */
  invokeAction?(action: MaterialAction): void;
  reset(seed: number): void;
  dispose(): void;
  getDiagnostics?(): EffectDiagnostics;
}
/** All CPU work runs outside RAF. The host aborts stale prepare and discards late results. */
export interface MaterialDefinition<
  I extends MaterialEffectId,
  P extends object,
  A = null,
> {
  readonly id: I;
  readonly abiVersion: 2;
  readonly effectVersion: MaterialEffectVersion<I>;
  readonly label: string;
  readonly description: string;
  readonly capabilities: readonly MaterialCapability[];
  readonly schema: ParameterSchema<P>;
  /** Pure inspector state. Disabled controls remain present in the normalized recipe. */
  isControlDisabled?(params: Readonly<P>, key: Extract<keyof P, string>, capability?: MaterialCapability): boolean;
  readonly actions?: readonly MaterialActionDescriptor[];
  readonly presets: readonly EffectPreset<P>[];
  readonly assetIds: readonly MaterialAssetId[];
  readonly provenance: EffectProvenance;
  readonly fallback: Readonly<{ color: string; label: string }>;
  /** Optional bounded mask/image preprocessing; cache keys include asset, geometry and version. */
  prepare?(request: MaterialPrepareRequest<P>, signal: AbortSignal): Promise<CreateResult<A>>;
  plan(init: MaterialInit<P, A>): CreateResult<MaterialResourcePlan>;
  /** Never create a Renderer, canvas, RAF or listeners inside an adapter. */
  create(gl: OGLRenderingContext, init: MaterialInit<P, A> & Readonly<{ plan: MaterialResourcePlan }>): CreateResult<MaterialPass<P>>;
}
export interface MaterialDescriptorV2 {
  readonly id: MaterialEffectId;
  readonly effectVersion: 1 | 2;
  readonly label: string;
  readonly description: string;
  readonly capabilities: readonly MaterialCapability[];
  readonly actions?: readonly MaterialActionDescriptor[];
  readonly provenance: EffectProvenance;
  readonly presets: readonly Readonly<{ id: string; label: string; recipe: MaterialRecipeV2 }>[];
  parseRecipe(input: unknown): ParseResult<MaterialRecipeV2>;
  readControls(recipe: MaterialRecipeV2, capability?: MaterialCapability): readonly Readonly<{
    control: ParameterControl;
    value: ParameterValue;
    disabled?: boolean;
  }>[];
  updateParameter(recipe: MaterialRecipeV2, key: string, value: ParameterValue): ParseResult<MaterialRecipeV2>;
}
