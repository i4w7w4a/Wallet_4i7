"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  DEFAULT_THEME,
  deriveThemeTokens,
  normalizeTheme,
  type PreferenceStorage,
  type ThemeConfig,
} from "@wallet/core";

import { useMediaFlag } from "./use-media-flag";

export const THEME_STORAGE_KEY = "wallet4i7.theme.v1";

export type ThemeController = {
  theme: ThemeConfig;
  setTheme(patch: Partial<ThemeConfig>): void;
  resetTheme(): void;
};

const ThemeContext = createContext<ThemeController | null>(null);

export function useTheme(): ThemeController {
  const value = useContext(ThemeContext);
  if (!value) {
    throw new Error("useTheme должен вызываться внутри ThemeProvider");
  }
  return value;
}

export function ThemeProvider(props: {
  storage: PreferenceStorage;
  children: ReactNode;
}) {
  const { storage, children } = props;
  const loaded = useMemo(() => readStoredTheme(storage), [storage]);
  const [theme, setThemeState] = useState<ThemeConfig>(loaded.theme);
  const [recovered, setRecovered] = useState(loaded.corrupted);
  const persistFrame = useRef<number | null>(null);
  const reducedMotion = useMediaFlag("(prefers-reduced-motion: reduce)");
  const highContrast = useMediaFlag("(prefers-contrast: more)");
  const reducedTransparency = useMediaFlag("(prefers-reduced-transparency: reduce)");

  const persistTheme = useCallback(
    (next: ThemeConfig) => {
      if (persistFrame.current != null) {
        cancelAnimationFrame(persistFrame.current);
      }

      persistFrame.current = requestAnimationFrame(() => {
        persistFrame.current = null;
        storage.setItem(THEME_STORAGE_KEY, JSON.stringify(next));
      });
    },
    [storage],
  );

  useEffect(() => {
    if (loaded.corrupted) {
      persistTheme(loaded.theme);
    }
  }, [loaded, persistTheme]);

  useEffect(
    () => () => {
      if (persistFrame.current != null) {
        cancelAnimationFrame(persistFrame.current);
      }
    },
    [],
  );

  const setTheme = useCallback(
    (patch: Partial<ThemeConfig>) => {
      setThemeState((current) => {
        const next = normalizeTheme({ ...current, ...patch });
        persistTheme(next);
        return next;
      });
    },
    [persistTheme],
  );

  const resetTheme = useCallback(() => {
    setRecovered(false);
    setThemeState(DEFAULT_THEME);
    persistTheme(DEFAULT_THEME);
  }, [persistTheme]);

  const controller = useMemo<ThemeController>(
    () => ({ theme, setTheme, resetTheme }),
    [theme, setTheme, resetTheme],
  );

  return (
    <ThemeContext.Provider value={controller}>
      <div
        data-theme-root
        className="wallet-theme-root"
        data-reduced-motion={reducedMotion ? "reduce" : "no-preference"}
        data-contrast={highContrast ? "more" : "no-preference"}
        data-reduced-transparency={reducedTransparency ? "reduce" : "no-preference"}
        style={tokensToStyle(theme)}
      >
        {recovered ? (
          <div role="status">Тема сброшена: сохранённые настройки повреждены</div>
        ) : null}
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

function readStoredTheme(storage: PreferenceStorage): {
  theme: ThemeConfig;
  corrupted: boolean;
} {
  const raw = storage.getItem(THEME_STORAGE_KEY);
  if (raw == null || raw === "") {
    return { theme: DEFAULT_THEME, corrupted: false };
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    return {
      theme: normalizeTheme(parsed),
      corrupted: !isVersionOneRecord(parsed),
    };
  } catch {
    return { theme: normalizeTheme(raw), corrupted: true };
  }
}

function isVersionOneRecord(value: unknown): boolean {
  return typeof value === "object" && value !== null && (value as { version?: unknown }).version === 1;
}

function tokensToStyle(theme: ThemeConfig): CSSProperties {
  const tokens = deriveThemeTokens(theme);

  return {
    "--color-background": tokens.background,
    "--color-surface": tokens.surface,
    "--color-accent": tokens.accent,
    "--color-glass-tint": tokens.glassTint,
    "--color-text-primary": tokens.textPrimary,
    "--color-text-muted": tokens.textMuted,
    "--color-border": tokens.border,
    "--radius": `${theme.radius}px`,
    "--density": String(theme.density),
    "--glass-opacity": String(theme.glassOpacity),
    "--glass-blur": `${theme.glassBlur}px`,
    "--highlight-intensity": String(theme.highlightIntensity),
    "--refraction-intensity": String(theme.refractionIntensity),
    "--motion-intensity": String(theme.motionIntensity),
    colorScheme: "dark",
    backgroundColor: "var(--color-background)",
    color: "var(--color-text-primary)",
  } as CSSProperties;
}
