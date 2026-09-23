"use client";

import type { WalletAsset } from "@wallet/core";
import { useId } from "react";
import { formatMonoMoney, formatMonoPercent, type MonoMoneyFormat } from "./mono-balance-format";
import type { MonoAssetListAppearance } from "./mono-scene-lab-contract";
import "./mono-asset-list.css";

export type MonoAssetListProps = {
  assets: readonly Readonly<WalletAsset>[];
  format: MonoMoneyFormat;
  hidden: boolean;
  appearance: Readonly<MonoAssetListAppearance>;
  onAssetSelect?: (asset: Readonly<WalletAsset>) => void;
  quantityPrecision?: number;
};

export function MonoAssetList({ assets, format, hidden, appearance, onAssetSelect, quantityPrecision = 2 }: MonoAssetListProps) {
  const headingId = useId();
  const quantityFormatter = new Intl.NumberFormat(format.locale, { maximumFractionDigits: quantityPrecision });
  return <section className="mono-asset-list" aria-labelledby={headingId}
    data-variant={appearance.variant} data-density={appearance.density} data-separators={appearance.separators}>
    <div className="mono-asset-list__heading"><h2 id={headingId}>Активы</h2><span>{assets.length.toString().padStart(2, "0")}</span></div>
    <ul className="mono-asset-list__items">
      {assets.map((asset) => {
        const content = <>
          <span className="mono-asset-list__identity"><span className="mono-asset-list__symbol" aria-hidden="true">{asset.symbol}</span>
            <span className="mono-asset-list__name"><strong>{asset.name}</strong>
              <small>{hidden ? asset.symbol : `${quantityFormatter.format(asset.amount)} ${asset.symbol}`}</small></span></span>
          <span className="mono-asset-list__value">{hidden ? <>
            <span aria-hidden="true">••••</span><small>Значения скрыты</small>
          </> : <>
            <strong>{formatMonoMoney(asset.value, format).formatted}</strong>
            <small>{formatMonoPercent(asset.change24h, format.locale)}</small>
          </>}</span>
        </>;
        return <li key={asset.symbol}>{onAssetSelect ?
          <button className="mono-asset-list__row" type="button" onClick={() => onAssetSelect(asset)}>{content}</button> :
          <div className="mono-asset-list__row">{content}</div>}
        </li>;
      })}
    </ul>
    {!assets.length && <p className="mono-asset-list__empty">Активов пока нет</p>}
  </section>;
}
