"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ProductSnapshot } from "@wallet/core";
import { AssetsWalletArt } from "./assets-wallet-art";
import { selectAccountGroups } from "./home-pins";
import { formatFiatMinor } from "./product-format";
import styles from "./assets-wallet-selection.module.css";

type AvailableWalletKind = "custodial" | "depositary";

export type AssetsWalletSelectionProps = {
  canOpen: Readonly<Record<AvailableWalletKind, boolean>>;
  snapshot: Readonly<ProductSnapshot>;
  balanceHidden: boolean;
  onOpenWallet(kind: AvailableWalletKind): void;
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

export function AssetsWalletSelection({ canOpen, snapshot, balanceHidden, onOpenWallet }: AssetsWalletSelectionProps) {
  const titleId = useId();
  const groups = selectAccountGroups(snapshot);
  return <section className={styles.selection} data-r1-wallet-selection aria-labelledby={titleId}>
    <h1 id={titleId} className={styles.visuallyHidden}>Активы</h1>
    <div className={styles.cards}>
      {wallets.map(wallet => {
        const available = wallet.kind !== "private" && canOpen[wallet.kind];
        const accounts = snapshot.accounts.filter(account => account.kind === wallet.kind);
        const group = groups.find(candidate => candidate.kind === wallet.kind);
        const holdingIds = snapshot.holdings.filter(holding => accounts.some(account => account.id === holding.accountId))
          .map(holding => holding.id);
        const ambiguousHoldings = holdingIds.some(id => snapshot.holdings.filter(holding => holding.id === id).length !== 1);
        const estimate = accounts.some(account => account.status === "unavailable") || ambiguousHoldings
          ? null : group?.estimateMinor ?? null;
        return <button key={wallet.kind} type="button" className={styles.card} data-r1-wallet-kind={wallet.kind}
          disabled={!available} onClick={() => { if (wallet.kind !== "private") onOpenWallet(wallet.kind); }}>
          <span className={styles.copy}>
            <strong>{wallet.label}</strong>
            {available ? <span className={styles.estimate}>
              <span>{balanceHidden ? "••••" : estimate === null ? "Нет данных" : `≈ ${formatFiatMinor(estimate)}`}</span>
              <span className={styles.status}>Оценка в USD</span>
            </span> : <span className={styles.status}>Пока недоступно</span>}
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
