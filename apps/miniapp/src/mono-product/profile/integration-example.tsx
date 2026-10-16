"use client";

import type { WalletProfile } from "@wallet/core";
import type { ProductProfile } from "../product-profile";
import { createDemoProfileResource } from "./model";
import type { ProductProfileActions, ProductProfileResource } from "./types";

type ExampleProps = {
  View: typeof ProductProfile;
  profile: WalletProfile;
  resource: ProductProfileResource;
  onResourceChange(resource: ProductProfileResource): void;
  onRetry(): void;
  balanceHidden: boolean;
  onBalanceHiddenChange(hidden: boolean): void;
  theme: "dark" | "light";
  onThemeChange(theme: "dark" | "light"): void;
  actions?: ProductProfileActions;
};

/**
 * Unmounted integration example. Its parent owns all resource/preferences state.
 * Retry is delegated; there is no HTTP, persistence or security-success shortcut here.
 * Pass actions only when the host can open the corresponding real workflow.
 */
export function ProfileIntegrationExample({ View, onResourceChange, ...props }: ExampleProps) {
  return <section aria-label="Локальный пример профиля">
    <div role="group" aria-label="Состояние данных в примере">
      <button type="button" onClick={() => onResourceChange({ status: "loading" })}>Загрузка</button>
      <button type="button" onClick={() => onResourceChange({ status: "error", retryable: true })}>Ошибка с повтором</button>
      <button type="button" onClick={() => onResourceChange(createDemoProfileResource())}>Демо-данные</button>
    </div>
    <View {...props} />
  </section>;
}
