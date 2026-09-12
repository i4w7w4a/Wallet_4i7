import {
  BrowserPlatformAdapter,
  type BrowserWindowLike,
} from "./browser-platform-adapter";
import type { PlatformBridge } from "./platform-bridge";
import {
  TelegramPlatformAdapter,
  type TelegramWebApp,
} from "./telegram-platform-adapter";

export interface PlatformWindowLike extends BrowserWindowLike {
  readonly Telegram?: {
    readonly WebApp?: TelegramWebApp;
  };
}

export function detectPlatformBridge(windowLike?: PlatformWindowLike): PlatformBridge {
  const webApp = windowLike?.Telegram?.WebApp;

  return webApp === undefined
    ? new BrowserPlatformAdapter(windowLike)
    : new TelegramPlatformAdapter(webApp);
}
