"use client";

import { useId, type CSSProperties } from "react";
import type { ProductAccount } from "@wallet/core";
import type { MonoBalanceAppearance } from "../mono-preview/mono-scene-lab-contract";
import type { MonoProductCommands, MonoProductView } from "./product-controller";
import { formatFiatMinor, formatFiatMinorParts } from "./product-format";
import { AccountContextIcon } from "./product-account-chooser";
import "./product-home.css";

export { ProductHoldings, type ProductHoldingsProps } from "./product-holdings";

type ProductProps = { view: MonoProductView; commands: MonoProductCommands };

export function ProductContextLine({ view, commands, accountChooserId }: ProductProps & { accountChooserId?: string }) {
  const label = view.context.kind === "all" ? "Все счета" : view.account?.label ?? "Счёт";
  return <div className="mono-product-context">
    {view.snapshot.accounts.length > 1 ? <button type="button" data-mono-product-context-trigger
      aria-label={`Выбрать счёт: ${label}`} aria-haspopup="dialog" aria-expanded={view.sheet?.kind === "accounts"}
      aria-controls={accountChooserId} onClick={() => view.sheet?.kind === "accounts" ? commands.closeSheet() : commands.openAccounts()}>
      <AccountContextIcon className="mono-product-account-icon" stacked />
      <span>{label}</span><svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="m4 6 4 4 4-4" /></svg>
    </button> : <strong>{label}</strong>}
    <span className="mono-product-context__demo">Демо-режим</span>
  </div>;
}

export function ProductBalance({ view, commands, appearance, blinkEnabled }: ProductProps & {
  appearance: MonoBalanceAppearance;
  blinkEnabled: boolean;
}) {
  const titleId = useId();
  const label = view.context.kind === "all" ? "Общая стоимость" : "Баланс счёта";
  const parts = view.balanceHidden ? null : formatFiatMinorParts(view.balanceMinor);
  const scale = appearance.fractionSize === "small" ? 0.42 : appearance.fractionSize === "large" ? 1 : 0.56;
  const fit = parts?.reduce((width, part) => width + [...part.value].length * (
    part.type === "currency" ? 0.34 : part.type === "fraction" || part.type === "decimal"
      ? 0.7 * scale : part.type === "group" || part.type === "literal" ? 0.34 : 0.7
  ), 0.5) ?? 5;
  return <section className="mono-balance" aria-labelledby={titleId}
    data-composition={appearance.composition} data-fraction-tone={appearance.fractionTone}
    style={{ "--mono-balance-fraction-scale": scale, "--mono-balance-fit": fit } as CSSProperties}>
    <div className="mono-balance__heading">
      <h1 id={titleId}>{label}</h1>
      <button type="button" className="mono-balance__privacy"
        data-eye-blink={blinkEnabled && !view.balanceHidden}
        aria-label={view.balanceHidden ? "Показать баланс" : "Скрыть баланс"}
        aria-pressed={view.balanceHidden}
        onClick={() => commands.setBalanceHidden(!view.balanceHidden)}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
          <circle cx="12" cy="12" r="2.5" />{view.balanceHidden && <path d="m4 4 16 16" />}</svg>
      </button>
    </div>
    <div className="mono-product-balance-row">
      <div className="mono-balance__amount" role="img"
        aria-label={view.balanceHidden ? "Баланс скрыт" : formatFiatMinor(view.balanceMinor)}>
        <bdi data-mono-balance-visual aria-hidden="true" dir="auto">
          {view.balanceHidden ? <span className="mono-balance__mask">••••••</span> : parts?.map((part, index) =>
            <span key={index} data-number-part={part.type}>{part.value}</span>)}
        </bdi>
      </div>
      <ProductBatteryLine view={view} commands={commands} />
    </div>
    <p className="mono-product-balance-note">Оценка активов в USD</p>
  </section>;
}

export function ProductBatteryLine({ view, commands }: ProductProps) {
  const pools = view.batteryPools;
  const only = pools.length === 1 ? pools[0]! : null;
  const percent = only ? view.batteryChargePercent[only.id] ?? null : null;
  const chargeState = pools.length > 1 ? "multiple" : percent === null ? "unknown"
    : percent === 0 ? "empty" : "charged";
  const count = pools.length > 1 ? `${pools.length} сети` : percent !== null ? `${percent}%` : "—";
  const summary = pools.length === 0 ? "правила неизвестны"
    : only ? `${only.networkLabel} · ${percent !== null ? `${percent}% · пример` : "Нет данных"}`
      : `${pools.length} сетевых пула; остатки не складываются`;
  const using = Boolean(view.batteryActivity && pools.some(pool => pool.id === view.batteryActivity?.poolId));
  return <button type="button" className="mono-product-battery" onClick={commands.openBattery}
    data-mono-product-battery-trigger data-charge-state={chargeState}
    data-battery-activity={using ? "using" : "idle"} data-details-open={view.sheet?.kind === "battery"}
    aria-haspopup="dialog" aria-expanded={view.sheet?.kind === "battery"}
    aria-label={`Батарейка: ${summary}. Подробнее`}>
    <svg viewBox="0 0 38 22" aria-hidden="true" focusable="false">
      <rect className="mono-product-battery__body" x="1" y="2" width="31" height="18" rx="4" />
      <path className="mono-product-battery__cap" d="M34 8v6" />
      {chargeState === "charged" && <rect className="mono-product-battery__charge" x="4.5" y="5.5" width={24 * (percent ?? 0) / 100} height="11" rx="2" />}
      {chargeState === "multiple" && <path className="mono-product-battery__multiple" d="M7 8h5m-5 6h5m5-6h5m-5 6h5" />}
    </svg>
    <span className="mono-product-battery__count" aria-hidden="true">{count}</span>
  </button>;
}

export function accountStatus(account: ProductAccount): string {
  return account.status === "active" ? "Активен" : account.status === "inactive" ? "Не активирован" : "Недоступен";
}

export function remainingLabel(remaining: number | "unknown"): string {
  return remaining === "unknown" ? "остаток неизвестен" : `${remaining} ${remaining === 1 ? "перевод" :
    remaining >= 2 && remaining <= 4 ? "перевода" : "переводов"}`;
}
