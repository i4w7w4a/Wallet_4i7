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
