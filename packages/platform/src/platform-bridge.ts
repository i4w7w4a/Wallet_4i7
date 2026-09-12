export type PlatformUser = {
  id: string;
  name: string;
  username?: string;
  avatarUrl?: string;
};

export type SafeArea = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type HapticType = "selection" | "impact" | "success" | "warning";

export interface PlatformBridge {
  readonly kind: "telegram" | "browser";
  getUser(): PlatformUser;
  getSafeArea(): SafeArea;
  isActive(): boolean;
  haptic(type: HapticType): void;
  setBackHandler(handler: (() => void) | null): () => void;
  subscribeActivity(handler: (active: boolean) => void): () => void;
  openLink(url: string): void;
}

export function normalizeHttpUrl(value: string): string | null {
  try {
    const url = new URL(value);

    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}
