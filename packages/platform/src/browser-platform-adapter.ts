import {
  normalizeHttpUrl,
  type HapticType,
  type PlatformBridge,
  type PlatformUser,
  type SafeArea,
} from "./platform-bridge";

export interface BrowserWindowLike {
  readonly navigator?: {
    vibrate?: (pattern: number | number[]) => boolean;
  };
  open?(url?: string | URL, target?: string, features?: string): unknown;
}

const BROWSER_USER: PlatformUser = {
  id: "0x3a…f79D",
  name: "Holder",
};

const EMPTY_SAFE_AREA: SafeArea = {
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
};

export class BrowserPlatformAdapter implements PlatformBridge {
  readonly kind = "browser";

  constructor(private readonly windowLike?: BrowserWindowLike) {}

  getUser(): PlatformUser {
    return { ...BROWSER_USER };
  }

  getSafeArea(): SafeArea {
    return { ...EMPTY_SAFE_AREA };
  }

  isActive(): boolean {
    return true;
  }

  haptic(type: HapticType): void {
    void type;
  }

  setBackHandler(handler: (() => void) | null): () => void {
    void handler;

    return noop;
  }

  subscribeActivity(handler: (active: boolean) => void): () => void {
    void handler;

    return noop;
  }

  openLink(value: string): void {
    const url = normalizeHttpUrl(value);

    if (url === null || typeof this.windowLike?.open !== "function") {
      return;
    }

    try {
      this.windowLike.open(url, "_blank", "noopener,noreferrer");
    } catch {
      // Блокировка popup или старый host не должны ломать интерфейс.
    }
  }
}

function noop(): void {}
