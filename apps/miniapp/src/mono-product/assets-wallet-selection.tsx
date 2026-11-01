"use client";

import { useId } from "react";
import { AssetsWalletArt } from "./assets-wallet-art";
import styles from "./assets-wallet-selection.module.css";

type AvailableWalletKind = "custodial" | "depositary";

export type AssetsWalletSelectionProps = {
  canOpen: Readonly<Record<AvailableWalletKind, boolean>>;
  onOpenWallet(kind: AvailableWalletKind): void;
  onOpenOverview(): void;
};

const wallets = [
  { kind: "custodial", label: "Кастодиальный" },
  { kind: "depositary", label: "Депозитарный" },
  { kind: "private", label: "Приватный" },
] as const;

export function AssetsWalletSelection({ canOpen, onOpenWallet, onOpenOverview }: AssetsWalletSelectionProps) {
  const titleId = useId();
  return <section className={styles.selection} data-r1-wallet-selection aria-labelledby={titleId}>
    <header className={styles.header}>
      <p className={styles.eyebrow}>Портфель · Демо</p>
      <h1 id={titleId}>Активы</h1>
      <button type="button" className={styles.overview} data-r1-overview onClick={onOpenOverview}>
        <span>Общий обзор</span>
        <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M4 10h11m-4-4 4 4-4 4" /></svg>
      </button>
    </header>
    <div className={styles.cards}>
      {wallets.map(wallet => {
        const available = wallet.kind !== "private" && canOpen[wallet.kind];
        return <button key={wallet.kind} type="button" className={styles.card} data-r1-wallet-kind={wallet.kind}
          disabled={!available} onClick={() => { if (wallet.kind !== "private") onOpenWallet(wallet.kind); }}>
          <span className={styles.copy}>
            <strong>{wallet.label}</strong>
            <span className={styles.status} aria-hidden={available || undefined}>{available ? "Открыть" : "Пока недоступно"}</span>
          </span>
          <AssetsWalletArt kind={wallet.kind} className={styles.art} />
          {available && <svg className={styles.chevron} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            <path d="m7 4 6 6-6 6" />
          </svg>}
        </button>;
      })}
    </div>
  </section>;
}
