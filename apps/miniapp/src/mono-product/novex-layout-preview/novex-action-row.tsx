"use client";

import { monoActionIconPath } from "@wallet/ui";

import styles from "./novex-layout-preview.module.css";

export type NovexAction = "receive" | "send" | "buy" | "swap";

export type NovexActionItem = {
  action: NovexAction;
  label: string;
  disabled?: boolean;
  accountActionFocus?: boolean;
  expanded?: boolean;
  controls?: string;
  onClick(): void;
};

export function NovexActionRow({ items }: { items: readonly NovexActionItem[] }) {
  return (
    <div className={styles.actionRow}>
      {items.map(item => (
        <button key={item.action} type="button" className={styles.action}
          disabled={item.disabled} onClick={item.onClick}
          aria-expanded={item.expanded} aria-controls={item.controls}
          data-product-account-quick-action={item.accountActionFocus ? item.action : undefined}>
          <svg className={styles.actionIcon} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d={monoActionIconPath(`quick.${item.action}`)} />
          </svg>
          <span className={styles.actionLabel}>{item.label}</span>
        </button>
      ))}
    </div>
  );
}
