export {
  ThemeProvider,
  useTheme,
  THEME_STORAGE_KEY,
  type ThemeController,
} from "./theme/theme-provider";
export { ThemeStudio } from "./theme/theme-studio";
export { GlassSurface } from "./primitives/glass-surface";
export { ActionButton } from "./primitives/action-button";
export { BottomSheet } from "./primitives/bottom-sheet";
export { HeroVideo } from "./media/hero-video";
export {
  MonoOpticalGlass,
  MONO_GLASS_BOUNDS,
  MONO_GLASS_DEFAULTS,
  normalizeMonoGlassSettings,
  type MonoGlassSettings,
  type MonoOpticalPreset,
} from "./mono/mono-optical-glass";
export { Dashboard } from "./dashboard/dashboard";
export {
  normalizeMonoOklch, srgbToOklch, oklchToSrgb, gamutMapMonoOklch,
  compositeMonoSrgb, monoContrastRatio, monoWorstContrast,
  type MonoOklch, type MonoSrgb,
} from "./mono/mono-color-space";
export {
  MONO_PALETTE_GROUPS, MONO_PALETTE_ROLES, MONO_PALETTE_HARMONIES,
  MONO_PALETTE_RECIPE_BOUNDS, MONO_PALETTE_ROLE_SCHEMA, MONO_PALETTE_SCHEMA_HASH,
  MONO_PALETTE_PROTECTED_SCHEMA_HASH,
  MONO_PALETTE_QUICK_HARMONIES, MONO_PALETTE_RECIPE_RANDOMIZER_SCHEMA_HASH,
  normalizeMonoPaletteConfig, resolveMonoPalette, validateMonoPaletteApply,
  setMonoPaletteLock, updateMonoPaletteRecipe, randomizeMonoPalette, randomizeMonoPaletteRecipe,
  type MonoPaletteConfigV1, type ThemePaletteState, type MonoResolvedPalette,
  type MonoPaletteRecipe, type MonoPaletteRoleState, type MonoPaletteMode,
  type MonoPaletteGroup, type MonoPaletteRole, type MonoPaletteHarmony,
  type MonoPaletteScope, type MonoPaletteIssue, type MonoPaletteRandomizeResult,
  type MonoPaletteRecipeRandomizeResult,
} from "./mono/mono-palette";
export { type DashboardAction } from "./dashboard/quick-actions";
export { type DashboardSection } from "./dashboard/bottom-navigation";
export {
  VISUAL_EFFECTS_STORAGE_KEY,
  VisualEffectsProvider,
  useVisualEffects,
  type VisualEffectsController,
} from "./appearance/visual-effects-provider";
export {
  WalletVisualLayer,
  type VisualRuntimeCapabilities,
} from "./appearance/wallet-visual-layer";
export type { PreferenceStorage, ThemeConfig } from "@wallet/core";
export type {
  EffectId, Vec2, Config, BackgroundRecipe, ValidationIssue, ParseResult,
  ParameterValue, ParameterGroup, ParameterControl, ParameterSchema, Viewport,
  PointerPhase, PointerSample, PointerFrame, Frame, FrameTexture,
  GpuLimits, EffectDiagnostics, GpuFailure, CreateResult,
  Effect, EffectInit, EffectProvenance, EffectPreset, Definition,
} from "./background-sandbox/contracts";
export type {
  MaterialEffectId, MaterialCapability, MaterialEffectVersion, MaterialAssetId,
  MaterialQualityProfile, MaterialAlphaMode, MaterialAction, MaterialActionDescriptor,
  MaterialRecipeV2, NormalizedBackgroundMaterial,
  ButtonTargetId, ButtonMaterialLayer, MaterialMask, MaterialTargetBinding, MaterialTargetGeometry,
  MaterialMaskSource, PreparedMaterialSource, PreparedMaterialAsset, PreparedMaterialAssets, MaterialPrepareRequest,
  MaterialResourcePlan, MaterialInit, MaterialFrameTexture, MaterialPass,
  MaterialDefinition, MaterialDescriptorV2,
} from "./background-sandbox/material-contract";
export type {
  BackgroundMaterialDescriptor, BackgroundPresentation, BackgroundRuntimeStatus,
  BackgroundStageRequest, BackgroundStageRenderer, BackgroundSandboxBindings,
  MaterialCatalogV2, MaterialStageRequestV2, ButtonStageRequest, ButtonWorkshopBindings,
} from "./background-sandbox/host-contract";
export { BackgroundGpuSurface } from "./background-sandbox/background-gpu-surface";
export { createMonoOpticalHost, type MonoSharedOpticalHost } from "./mono/mono-optical-host";
export { createMonoOpticalOverlay } from "./mono/mono-optical-overlay";
export { backgroundMaterials, backgroundMaterialDescriptors, parseBackgroundRecipe } from "./background-sandbox/registry";
export {
  BUTTON_MASK_ASSETS, MATERIAL_RADIUS_BOUNDS, MATERIAL_BORDER_BOUNDS,
  parseTargetBinding, parseTargetBindings, createTargetBinding,
} from "./background-sandbox/target-binding";
export { MATERIAL_ICON_PATHS, monoActionIconPath } from "./background-sandbox/material-icon-assets";
