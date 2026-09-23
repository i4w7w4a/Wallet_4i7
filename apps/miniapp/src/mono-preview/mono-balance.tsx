"use client";

import { useId, type CSSProperties } from "react";
import { formatMonoMoney, formatMonoPercent, type MonoMoneyFormat } from "./mono-balance-format";
import type { MonoBalanceAppearance } from "./mono-scene-lab-contract";
import "./mono-balance.css";

export type MonoBalanceProps = {
  value: number | bigint;
  format: MonoMoneyFormat;
  change24h?: number;
  hidden: boolean;
  onHiddenChange?: (hidden: boolean) => void;
  appearance: Readonly<MonoBalanceAppearance>;
  label?: string;
};

const FRACTION_SCALE = { small: 0.42, medium: 0.56, large: 1 } as const;

export function MonoBalance({ value, format, change24h, hidden, onHiddenChange, appearance, label = "Общий баланс" }: MonoBalanceProps) {
  const titleId = useId();
  const money = hidden ? null : formatMonoMoney(value, format);
  const fractionScale = FRACTION_SCALE[appearance.fractionSize];
  // A conservative fit bound; exceptional lengths wrap intact instead of clipping digits.
  const fit = money?.parts.reduce((width, part) => width + [...part.value].length * (
    part.type === "currency" ? 0.34 : part.type === "fraction" || part.type === "decimal"
      ? 0.7 * fractionScale : part.type === "group" || part.type === "literal" ? 0.34 : 0.7
  ), 0.5) ?? 5;
  const changeAvailable = change24h !== undefined && Number.isFinite(change24h);
  return <section className="mono-balance" aria-labelledby={titleId}
    data-composition={appearance.composition} data-fraction-tone={appearance.fractionTone}
    style={{ "--mono-balance-fraction-scale": fractionScale, "--mono-balance-fit": fit } as CSSProperties}>
    <div className="mono-balance__heading">
      <h1 id={titleId}>{label}</h1>
      {onHiddenChange && <button type="button" className="mono-balance__privacy"
        aria-label={hidden ? "Показать баланс" : "Скрыть баланс"} aria-pressed={hidden}
        onClick={() => onHiddenChange(!hidden)}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
          <circle cx="12" cy="12" r="2.5" />{hidden && <path d="m4 4 16 16" />}</svg>
      </button>}
    </div>
    <div className="mono-balance__amount" role="img" aria-label={hidden ? "Баланс скрыт" : money?.accessibleLabel}>
      <bdi data-mono-balance-visual aria-hidden="true" dir="auto">
        {hidden ? <span className="mono-balance__mask">••••••</span> : money?.parts.map((part, index) =>
          <span key={index} data-number-part={part.type}>{part.value}</span>)}
      </bdi>
    </div>
    {changeAvailable && <p className="mono-balance__change" aria-label={hidden ? "Изменение скрыто" : undefined}>
      {hidden ? <span aria-hidden="true">••••</span> : <>
        <span className="mono-balance__direction" aria-hidden="true">{change24h > 0 ? "+" : change24h < 0 ? "−" : "="}</span>
        <span>{formatMonoPercent(change24h, format.locale)}</span>
      </>}
      <span className="mono-balance__period">за 24 часа</span>
    </p>}
  </section>;
}
