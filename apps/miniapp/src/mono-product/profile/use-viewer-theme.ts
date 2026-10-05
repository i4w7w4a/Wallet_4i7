"use client";

import { useCallback, useEffect, useState } from "react";

type ViewerTheme = "dark" | "light";
const PREFERENCE_KEY = "wallet4i7.mono.viewer-theme.v1";

/** Visitor preference only. A controlled editor must not access this storage. */
export function useViewerTheme(sourceTheme: ViewerTheme, enabled: boolean) {
  const [preference, setPreference] = useState<ViewerTheme | null>(null);

  // Server and first hydration render use the supplied appearance, without browser reads.
  useEffect(() => {
    if (!enabled) return;
    let restored: ViewerTheme | null = null;
    try {
      const raw = window.localStorage.getItem(PREFERENCE_KEY);
      const value: unknown = raw === null ? null : JSON.parse(raw);
      if (value && typeof value === "object" && !Array.isArray(value) &&
        Object.keys(value).length === 2 && "version" in value && value.version === 1 &&
        "theme" in value && (value.theme === "dark" || value.theme === "light")) {
        restored = value.theme;
      }
    } catch { /* Unavailable or corrupt storage leaves the source theme intact. */ }
    setPreference(restored);
  }, [enabled]);

  const onThemeChange = useCallback((theme: ViewerTheme) => {
    if (!enabled) return;
    setPreference(theme);
    try {
      window.localStorage.setItem(PREFERENCE_KEY, JSON.stringify({ version: 1, theme }));
    } catch { /* The choice still works for this visit when persistence is unavailable. */ }
  }, [enabled]);

  return { theme: enabled ? preference ?? sourceTheme : sourceTheme, onThemeChange };
}
