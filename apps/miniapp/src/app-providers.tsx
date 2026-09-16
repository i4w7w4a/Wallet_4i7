"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

import type { PreferenceStorage, WalletSnapshot } from "@wallet/core";
import {
  detectPlatformBridge,
  type PlatformBridge,
  type PlatformWindowLike,
} from "@wallet/platform";
import {
  Dashboard,
  ThemeProvider,
  VisualEffectsProvider,
  type VisualRuntimeCapabilities,
} from "@wallet/ui";

type ConnectionLike = {
  readonly saveData?: boolean;
  addEventListener?(type: "change", listener: () => void): void;
  removeEventListener?(type: "change", listener: () => void): void;
};

export function AppProviders(props: { snapshot: WalletSnapshot }) {
  const { snapshot } = props;
  const clientReady = useClientReady();
  const platform = useMemo(
    () =>
      clientReady
        ? detectPlatformBridge(window as unknown as PlatformWindowLike)
        : null,
    [clientReady],
  );
  const storage = useMemo(() => (clientReady ? getBrowserStorage() : null), [clientReady]);
  const hostActive = usePlatformActivity(platform);
  const documentVisible = useDocumentVisible();
  const reducedMotion = useMediaFlag("(prefers-reduced-motion: reduce)");
  const reducedTransparency = useMediaFlag("(prefers-reduced-transparency: reduce)");
  const saveData = useSaveData();
  const coarsePointer = useMediaFlag("(pointer: coarse)");
  const runtime: VisualRuntimeCapabilities = {
    hostActive,
    documentVisible,
    reducedMotion,
    reducedTransparency,
    saveData,
    coarsePointer,
  };

  const displaySnapshot = useMemo(() => {
    if (platform === null) {
      return snapshot;
    }

    const user = platform.getUser();

    return {
      ...snapshot,
      profile: {
        name: user.name || snapshot.profile.name,
        shortAddress: user.username ? `@${user.username}` : user.id || snapshot.profile.shortAddress,
        avatarUrl: user.avatarUrl ?? snapshot.profile.avatarUrl,
      },
    };
  }, [platform, snapshot]);

  if (platform === null || storage === null) {
    return <PosterShell />;
  }

  return (
    <ThemeProvider storage={storage}>
      <VisualEffectsProvider storage={storage}>
        <Dashboard snapshot={displaySnapshot} platform={platform} runtime={runtime} />
      </VisualEffectsProvider>
    </ThemeProvider>
  );
}

function useClientReady(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

function usePlatformActivity(platform: PlatformBridge | null): boolean {
  const subscribe = useCallback(
    (notify: () => void) =>
      platform?.subscribeActivity(() => notify()) ?? (() => undefined),
    [platform],
  );
  const getSnapshot = useCallback(() => platform?.isActive() ?? true, [platform]);

  return useSyncExternalStore(subscribe, getSnapshot, () => true);
}

function useDocumentVisible(): boolean {
  const subscribe = useCallback((notify: () => void) => {
    document.addEventListener("visibilitychange", notify);
    return () => document.removeEventListener("visibilitychange", notify);
  }, []);

  return useSyncExternalStore(
    subscribe,
    () => document.visibilityState !== "hidden",
    () => true,
  );
}

function useMediaFlag(query: string): boolean {
  const subscribe = useCallback(
    (notify: () => void) => {
      const media = window.matchMedia?.(query);
      media?.addEventListener("change", notify);
      return () => media?.removeEventListener("change", notify);
    },
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia?.(query).matches ?? false,
    () => false,
  );
}

function useSaveData(): boolean {
  const getConnection = () =>
    (navigator as Navigator & { connection?: ConnectionLike }).connection;
  const subscribe = useCallback((notify: () => void) => {
    const connection = getConnection();
    connection?.addEventListener?.("change", notify);
    return () => connection?.removeEventListener?.("change", notify);
  }, []);

  return useSyncExternalStore(
    subscribe,
    () => getConnection()?.saveData === true,
    () => false,
  );
}

function noopSubscribe(): () => void {
  return () => undefined;
}

function PosterShell() {
  return (
    <main className="app-poster-shell" aria-label="Wallet_4i7 загружается" data-app-poster-shell>
      <div className="app-poster-shell__orb" aria-hidden="true" />
      <p>Wallet_4i7</p>
      <span>Готовим ваш liquid wallet</span>
    </main>
  );
}

function getBrowserStorage(): PreferenceStorage {
  try {
    const storage = window.localStorage;
    const probe = "wallet4i7.storage.probe";
    storage.setItem(probe, probe);
    storage.removeItem(probe);
    return storage;
  } catch {
    return createMemoryStorage();
  }
}

function createMemoryStorage(): PreferenceStorage {
  const values = new Map<string, string>();

  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}
