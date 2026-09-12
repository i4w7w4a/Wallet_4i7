"use client";

import { useCallback, useSyncExternalStore } from "react";

export function useMediaFlag(query: string): boolean {
  const subscribe = useCallback(
    (notify: () => void) => {
      if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
        return () => undefined;
      }

      const media = window.matchMedia(query);
      media.addEventListener("change", notify);
      return () => media.removeEventListener("change", notify);
    },
    [query],
  );
  const getSnapshot = useCallback(() => readMedia(query), [query]);

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

function readMedia(query: string): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }

  return window.matchMedia(query).matches;
}
