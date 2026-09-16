"use client";

import type { WalletAsset, WalletBalance } from "@wallet/core";

import { SpotlightSurface } from "../react-bits/spotlight-surface/spotlight-surface";
import "./dashboard-visuals.css";

const SEGMENT_COLORS = ["var(--color-accent, #5b8cff)", "var(--color-glass-tint, #7c6cff)", "#9ad7ff"];

export function PortfolioSummaryCard(props: {
  balance: WalletBalance;
  assets: WalletAsset[];
  finePointer: boolean;
}) {
  const total = props.assets.reduce((sum, asset) => sum + asset.value, 0) || props.balance.amount;
  const segments = toDonutSegments(props.assets, total);

  return (
    <SpotlightSurface
      as="section"
      className="wallet-material-surface portfolio-summary"
      finePointer={props.finePointer}
      aria-label="Портфель"
    >
      <div className="dashboard-section-heading">
        <div>
          <p>Распределение</p>
          <h2>Портфель</h2>
        </div>
      </div>
      <div className="portfolio-summary__allocation">
        <div className="portfolio-summary__chart-wrap">
          <svg className="portfolio-summary__chart" viewBox="0 0 120 120" aria-hidden="true">
            {segments.map((segment) => (
              <circle
                key={segment.symbol}
                cx="60"
                cy="60"
                r="36"
                fill="none"
                stroke={segment.color}
                strokeWidth="16"
                strokeDasharray={`${segment.length} ${segment.gap}`}
                strokeDashoffset={segment.offset}
                transform="rotate(-90 60 60)"
              />
            ))}
          </svg>
          <span>{props.assets.length}</span>
        </div>
        <ul className="portfolio-summary__legend">
          {props.assets.map((asset, index) => {
            const share = total === 0 ? 0 : asset.value / total;

            return (
              <li key={asset.symbol}>
                <span>
                  <span
                    className="portfolio-summary__swatch"
                    style={{ background: SEGMENT_COLORS[index % SEGMENT_COLORS.length] }}
                    aria-hidden="true"
                  />
                  {asset.name}
                </span>
                <span>{formatPercent(share)}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </SpotlightSurface>
  );
}

function toDonutSegments(assets: WalletAsset[], total: number) {
  const circumference = 2 * Math.PI * 36;
  let consumed = 0;

  return assets.map((asset, index) => {
    const share = total === 0 ? 0 : asset.value / total;
    const length = share * circumference;
    const offset = -consumed * circumference;
    consumed += share;

    return {
      symbol: asset.symbol,
      color: SEGMENT_COLORS[index % SEGMENT_COLORS.length],
      length,
      gap: circumference,
      offset,
    };
  });
}

function formatPercent(share: number): string {
  return new Intl.NumberFormat("ru-RU", { style: "percent", maximumFractionDigits: 0 }).format(share);
}
