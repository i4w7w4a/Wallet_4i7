"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { detectPlatformBridge, type PlatformBridge, type PlatformWindowLike } from "@wallet/platform";

const noopSubscribe = () => () => undefined;
const clientSnapshot = () => true;
const serverSnapshot = () => false;

/** Host/controller hook, not part of the appearance renderer.
 * Omit the bridge to detect it after client hydration; null means no host.
 * A supplied bridge preserves its already known activity, including initial false.
 * The existing Telegram adapter starts true until its first SDK activity event;
 * this hook cannot recover an earlier state that the bridge does not expose.
 * Document visibility and reduced-mode guards remain in the renderers.
 */
export function useMonoSceneActivity(suppliedPlatform?: PlatformBridge | null): boolean {
  const clientReady = useSyncExternalStore(noopSubscribe, clientSnapshot, serverSnapshot);
  const platform = useMemo(() => suppliedPlatform === undefined
    ? clientReady ? detectPlatformBridge(window as unknown as PlatformWindowLike) : null
    : suppliedPlatform, [clientReady, suppliedPlatform]);
  const subscribe = useCallback((notify: () => void) =>
    platform?.subscribeActivity(() => notify()) ?? (() => undefined), [platform]);
  const getSnapshot = useCallback(() => platform?.isActive() ?? true, [platform]);

  // SSR never detects window or subscribes. If the caller already knows the state,
  // reading that same snapshot on the server avoids inventing an active first frame.
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
