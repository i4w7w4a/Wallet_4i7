import type { ReactNode } from "react";
import type {
  BackgroundRecipe, EffectDiagnostics, EffectId, EffectProvenance,
  ParameterControl, ParameterValue, ParseResult,
} from "./contracts";

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
  effectId?: EffectId;
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
}
