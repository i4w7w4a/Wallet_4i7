import type { ReactNode } from "react";
import type {
  BackgroundRecipe, EffectDiagnostics, EffectId, EffectProvenance,
  ParameterControl, ParameterValue, ParseResult,
} from "./contracts";
import type {
  BackgroundEdgeFinishV1, MaterialAction, MaterialCapability, MaterialDescriptorV2, MaterialEffectId, MaterialQualityProfile, MaterialRecipeV2,
  MaterialTargetBinding, NormalizedBackgroundMaterial,
} from "./material-contract";

/** UI facade. Concrete adapter parameter types remain inside the typed registry. */
export interface BackgroundMaterialDescriptor {
  readonly id: EffectId;
  readonly label: string;
  readonly description: string;
  readonly provenance: EffectProvenance;
  readonly presets: readonly Readonly<{ id: string; label: string; recipe: BackgroundRecipe }>[];
  /** Validate the entire recipe, including version/seed/assets and effect parameters. */
  parseRecipe(input: unknown): ParseResult<BackgroundRecipe>;
  readControls(recipe: BackgroundRecipe): readonly Readonly<{
    control: ParameterControl;
    value: ParameterValue;
    disabled?: boolean;
  }>[];
  /** A full validated replacement, never a silently applied partial patch. */
  updateParameter(recipe: BackgroundRecipe, key: string, value: ParameterValue): ParseResult<BackgroundRecipe>;
}

export type BackgroundPresentation =
  | Readonly<{ mode: "standalone"; shape: "wide" | "square" | "portrait" }>
  | Readonly<{ mode: "mono"; width: 320 | 390 | 430 | 480 }>;

export type BackgroundRuntimeStatus = Readonly<{
  phase: "idle" | "initializing" | "running" | "paused" | "fallback" | "lost" | "disposed";
  message: string;
  effectId?: EffectId | MaterialEffectId;
  diagnostics?: EffectDiagnostics;
}>;

export type BackgroundStageRequest = Readonly<{
  recipe: BackgroundRecipe;
  presentation: BackgroundPresentation;
  paused: boolean;
  /** Change on explicit Restart/Open/A-B to restart phase/history, not on sliders. */
  restartKey: number;
  onStatus?: (status: BackgroundRuntimeStatus) => void;
}>;

export type BackgroundStageRenderer = (request: BackgroundStageRequest) => ReactNode;

/** Supplied by ORACLE's real registry/route; the shell never acquires GPU resources. */
export interface BackgroundSandboxBindings {
  readonly materials: readonly BackgroundMaterialDescriptor[];
  readonly renderStage: BackgroundStageRenderer;
  readonly fittingAvailable: boolean;
  readonly fittingUnavailableReason?: string;
  parseRecipe(input: unknown): ParseResult<BackgroundRecipe>;
  /** Optional v2 facade; v1 callers and storage remain valid without it. */
  readonly materialCatalogV2?: MaterialCatalogV2;
  readonly renderMaterialStageV2?: (request: MaterialStageRequestV2) => ReactNode;
}

/** Static catalog of real installed v2 adapters. Explicit copy returns an independent snapshot. */
export interface MaterialCatalogV2 {
  readonly materials: readonly MaterialDescriptorV2[];
  parseRecipe(input: unknown): ParseResult<MaterialRecipeV2>;
  copyForTarget(input: unknown, capability: MaterialCapability): ParseResult<MaterialRecipeV2>;
}
export type MaterialStageRequestV2 = Readonly<{
  recipe: NormalizedBackgroundMaterial;
  edgeFinish?: BackgroundEdgeFinishV1;
  presentation: BackgroundPresentation;
  quality: MaterialQualityProfile;
  paused: boolean;
  restartKey: number;
  /** Monotone local request ID prevents replay on ordinary React renders. Never persist. */
  transientAction?: Readonly<{ requestId: number; action: MaterialAction }>;
  onStatus?: (status: BackgroundRuntimeStatus) => void;
}>;
/** Separate button-lab renderer. Its state and storage belong to the button workshop. */
export type ButtonStageRequest = Readonly<{
  bindings: readonly MaterialTargetBinding[];
  frameMode?: "group" | "separate";
  width: 320 | 390 | 430 | 480;
  quality: MaterialQualityProfile;
  paused: boolean;
  restartKey: number;
  /** Only an explicitly copied full snapshot; the two workshop drafts never share a reference. */
  previewBackground?: NormalizedBackgroundMaterial;
  onStatus?: (status: BackgroundRuntimeStatus) => void;
}>;
export interface ButtonWorkshopBindings {
  readonly materialCatalog: MaterialCatalogV2;
  readonly renderStage: (request: ButtonStageRequest) => ReactNode;
}
