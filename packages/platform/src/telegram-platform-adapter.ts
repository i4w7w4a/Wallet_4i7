import {
  normalizeHttpUrl,
  type HapticType,
  type PlatformBridge,
  type PlatformUser,
  type SafeArea,
} from "./platform-bridge";

export type TelegramActivityEvent = "activated" | "deactivated";

export type TelegramUser = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
};

export type TelegramSafeAreaInset = {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
};

export interface TelegramBackButton {
  show?(): void;
  hide?(): void;
  onClick?(handler: () => void): void;
  offClick?(handler: () => void): void;
}

export interface TelegramHapticFeedback {
  selectionChanged?(): void;
  impactOccurred?(style: "light" | "medium" | "heavy" | "rigid" | "soft"): void;
  notificationOccurred?(type: "success" | "warning" | "error"): void;
}

export interface TelegramWebApp {
  // Только недоверенные данные отображения. Поля авторизации намеренно нет.
  readonly initDataUnsafe?: {
    readonly user?: TelegramUser;
  };
  readonly safeAreaInset?: TelegramSafeAreaInset;
  readonly contentSafeAreaInset?: TelegramSafeAreaInset;
  readonly BackButton?: TelegramBackButton;
  readonly HapticFeedback?: TelegramHapticFeedback;
  onEvent?(event: TelegramActivityEvent, handler: () => void): void;
  offEvent?(event: TelegramActivityEvent, handler: () => void): void;
  openLink?(url: string): void;
}

const TELEGRAM_FALLBACK_USER: PlatformUser = {
  id: "telegram",
  name: "Пользователь Telegram",
};

export class TelegramPlatformAdapter implements PlatformBridge {
  readonly kind = "telegram";
  #active = true;

  constructor(private readonly webApp: TelegramWebApp) {}

  getUser(): PlatformUser {
    const user = this.webApp.initDataUnsafe?.user;

    if (user === undefined) {
      return { ...TELEGRAM_FALLBACK_USER };
    }

    const platformUser: PlatformUser = {
      id: String(user.id),
      name: [user.first_name, user.last_name].filter(Boolean).join(" "),
    };

    if (user.username !== undefined) {
      platformUser.username = user.username;
    }

    if (user.photo_url !== undefined) {
      platformUser.avatarUrl = user.photo_url;
    }

    return platformUser;
  }

  getSafeArea(): SafeArea {
    const content = this.webApp.contentSafeAreaInset;
    const hardware = this.webApp.safeAreaInset;

    return {
      top: normalizeInset(content?.top, hardware?.top),
      right: normalizeInset(content?.right, hardware?.right),
      bottom: normalizeInset(content?.bottom, hardware?.bottom),
      left: normalizeInset(content?.left, hardware?.left),
    };
  }

  isActive(): boolean {
    return this.#active;
  }

  haptic(type: HapticType): void {
    const haptic = this.webApp.HapticFeedback;

    if (type === "selection") {
      safely(() => haptic?.selectionChanged?.());
      return;
    }

    if (type === "impact") {
      safely(() => haptic?.impactOccurred?.("medium"));
      return;
    }

    safely(() => haptic?.notificationOccurred?.(type));
  }

  setBackHandler(handler: (() => void) | null): () => void {
    const backButton = this.webApp.BackButton;

    if (handler === null || typeof backButton?.onClick !== "function") {
      safely(() => backButton?.hide?.());
      return noop;
    }

    try {
      backButton.onClick(handler);
      backButton.show?.();
    } catch {
      safely(() => backButton.hide?.());
      return noop;
    }

    let cleaned = false;

    return () => {
      if (cleaned) {
        return;
      }

      cleaned = true;
      safely(() => backButton.offClick?.(handler));
      safely(() => backButton.hide?.());
    };
  }

  subscribeActivity(handler: (active: boolean) => void): () => void {
    if (typeof this.webApp.onEvent !== "function") {
      return noop;
    }

    const onActivated = () => {
      this.#active = true;
      handler(true);
    };
    const onDeactivated = () => {
      this.#active = false;
      handler(false);
    };
    const activatedRegistered = safely(() => this.webApp.onEvent?.("activated", onActivated));
    const deactivatedRegistered = safely(() =>
      this.webApp.onEvent?.("deactivated", onDeactivated),
    );
    let cleaned = false;

    return () => {
      if (cleaned) {
        return;
      }

      cleaned = true;

      if (activatedRegistered) {
        safely(() => this.webApp.offEvent?.("activated", onActivated));
      }

      if (deactivatedRegistered) {
        safely(() => this.webApp.offEvent?.("deactivated", onDeactivated));
      }
    };
  }

  openLink(value: string): void {
    const url = normalizeHttpUrl(value);

    if (url === null || typeof this.webApp.openLink !== "function") {
      return;
    }

    safely(() => this.webApp.openLink?.(url));
  }
}

function normalizeInset(primary: number | undefined, fallback: number | undefined): number {
  const value = primary ?? fallback;

  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
}

function safely(operation: () => void): boolean {
  try {
    operation();
    return true;
  } catch {
    return false;
  }
}

function noop(): void {}
