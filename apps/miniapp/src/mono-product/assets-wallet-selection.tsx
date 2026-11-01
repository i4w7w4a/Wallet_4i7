"use client";

import { useEffect, useId, useRef, useState } from "react";
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

function WalletArt({ kind }: { kind: typeof wallets[number]["kind"] }) {
  const [ready, setReady] = useState(false);
  const image = useRef<HTMLImageElement>(null);
  const root = `/wallet-art/series-a/${kind}`;

  // The image may already have loaded before hydration attached its load handler.
  useEffect(() => {
    if (image.current?.complete && image.current.naturalWidth > 0) setReady(true);
  }, []);

  return <span className={styles.art} aria-hidden="true">
    <span className={styles.artLayer} hidden={ready}><AssetsWalletArt kind={kind} /></span>
    {/* The PNGs are local, resized derivatives; SVG remains available while loading or on error. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img ref={image} className={styles.artLayer} src={`${root}-300.png`}
      srcSet={`${root}-300.png 2x, ${root}-450.png 3x`} width="300" height="300"
      alt="" draggable={false} decoding="async" hidden={!ready}
      onLoad={() => setReady(true)} onError={() => setReady(false)} />
  </span>;
}

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
          <WalletArt key={wallet.kind} kind={wallet.kind} />
          {available && <svg className={styles.chevron} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            <path d="m7 4 6 6-6 6" />
          </svg>}
        </button>;
      })}
    </div>
  </section>;
}
