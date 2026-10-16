"use client";

import { ActionRouteMenu, type ActionRouteMenuProps } from "./action-route-menu";
import { useLayoutEffect, useRef } from "react";
import type { ProductSendMode } from "./product-controller";
import styles from "./send-menu.module.css";

export type SendMenuProps = Omit<ActionRouteMenuProps, "action" | "headerContent"> & {
  mode?: ProductSendMode;
  onModeChange?(mode: ProductSendMode): void;
};

export function SendMenu({ mode = "external", onModeChange, ...props }: SendMenuProps) {
  return <ActionRouteMenu {...props} action="send" headerContent={onModeChange
    ? <SendModeSelector mode={mode} onSelect={onModeChange} /> : undefined} />;
}

export function SendModeSelector({ mode, onSelect, disabled = false, focusInternal = false }: {
  mode: ProductSendMode; onSelect(mode: ProductSendMode): void; disabled?: boolean; focusInternal?: boolean;
}) {
  const internal = useRef<HTMLButtonElement>(null);
  const restored = useRef(false);
  useLayoutEffect(() => {
    if (focusInternal && !restored.current) {
      restored.current = true;
      internal.current?.focus({ preventScroll: true });
    }
  }, [focusInternal]);
  return <div className={styles.modes} role="group" aria-label="Способ отправки">
    <button ref={internal} type="button" aria-pressed={mode === "internal"} disabled={disabled}
      onClick={() => onSelect("internal")}>На свой счёт</button>
    <button type="button" aria-pressed={mode === "external"} disabled={disabled}
      onClick={() => onSelect("external")}>На внешний адрес</button>
  </div>;
}
