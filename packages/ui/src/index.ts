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
export { Dashboard } from "./dashboard/dashboard";
export { type DashboardAction } from "./dashboard/quick-actions";
export { type DashboardSection } from "./dashboard/bottom-navigation";
export {
  VISUAL_EFFECTS_STORAGE_KEY,
  VisualEffectsProvider,
  useVisualEffects,
  type VisualEffectsController,
} from "./appearance/visual-effects-provider";
export type { PreferenceStorage, ThemeConfig } from "@wallet/core";
