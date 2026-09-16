"use client";

import type { WalletAsset } from "@wallet/core";

import { SpotlightSurface } from "../react-bits/spotlight-surface/spotlight-surface";
import "./dashboard-visuals.css";

export function AssetListCard(props: {
  assets: WalletAsset[];
  finePointer: boolean;
  onSelect(asset: WalletAsset): void;
}) {
  return (
    <SpotlightSurface
      as="section"
      className="wallet-material-surface asset-list"
      finePointer={props.finePointer}
      aria-label="Активы"
    >
      <div className="dashboard-section-heading">
        <div>
          <p>Ваши позиции</p>
          <h2>Активы</h2>
        </div>
        <span>{props.assets.length}</span>
      </div>
      <ul className="asset-list__rows">
        {props.assets.map((asset) => (
          <li key={asset.symbol}>
            <button type="button" className="asset-row" onClick={() => props.onSelect(asset)}>
              <span className="asset-row__title">
                <span className="asset-row__name">{asset.name}</span>
                <span className="asset-row__symbol">{asset.symbol}</span>
              </span>
              <Sparkline values={asset.sparkline} />
              <span className="asset-row__value">{formatUsd(asset.value)}</span>
            </button>
          </li>
        ))}
      </ul>
    </SpotlightSurface>
  );
}

function Sparkline(props: { values: number[] }) {
  return (
    <svg className="asset-row__spark" viewBox="0 0 64 24" role="presentation" aria-hidden="true">
      <path d={toChartPath(props.values, 64, 24)} fill="none" stroke="var(--color-accent, #5b8cff)" strokeWidth="1.8" />
    </svg>
  );
}

function formatUsd(amount: number): string {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "USD" }).format(amount);
}

function toChartPath(values: number[], width: number, height: number): string {
  if (values.length === 0) {
    return "";
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = width / Math.max(values.length - 1, 1);

  return values
    .map((value, index) => {
      const x = index * step;
      const y = height - 3 - ((value - min) / span) * (height - 6);
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}
