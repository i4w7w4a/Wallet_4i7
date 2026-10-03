"use client";

import { useId, type CSSProperties } from "react";
import type { ProductAccount } from "@wallet/core";
import type { MonoAssetListAppearance, MonoBalanceAppearance } from "../mono-preview/mono-scene-lab-contract";
import type { MonoProductCommands, MonoProductView } from "./product-controller";
import { formatFiatMinor, formatFiatMinorParts, formatQuantity } from "./product-format";
import "./product-home.css";

type ProductProps = { view: MonoProductView; commands: MonoProductCommands };

export function ProductContextLine({ view, commands }: ProductProps) {
  const label = view.context.kind === "all" ? "Все счета" : view.account?.label ?? "Счёт";
  return <div className="mono-product-context">
    <span className="mono-product-context__prefix">СЧЁТ</span>
    {view.snapshot.accounts.length > 1 ? <button type="button" data-mono-product-context-trigger
      aria-label={`Выбрать счёт: ${label}`} onClick={commands.openAccounts}>
      <span>{label}</span><span aria-hidden="true">⌄</span>
    </button> : <strong>{label}</strong>}
    <span className="mono-product-context__demo">DEMO</span>
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
    <p className="mono-product-balance-note">{view.context.kind === "all"
      ? "Оценка всех размещений · не сумма к отправке"
      : "Оценка активов счёта · доступность проверяется по маршруту"}</p>
  </section>;
}

export function ProductBatteryLine({ view, commands }: ProductProps) {
  const pools = view.batteryPools;
  const only = pools.length === 1 ? pools[0]! : null;
  const remaining = only?.remainingTransfers;
  const knownRemaining = typeof remaining === "number" && Number.isSafeInteger(remaining) && remaining >= 0;
  const chargeState = pools.length > 1 ? "multiple" : !only || !knownRemaining ? "unknown"
    : remaining === 0 ? "empty" : "charged";
  const count = pools.length > 1 ? String(pools.length) : knownRemaining ? String(remaining) : "?";
  const summary = pools.length === 0 ? "правила неизвестны"
    : only ? `${only.networkLabel} · ${knownRemaining ? remainingLabel(remaining) : "остаток неизвестен"}`
      : `${pools.length} сетевых пула; остатки не складываются`;
  return <button type="button" className="mono-product-battery" onClick={commands.openBattery}
    data-mono-product-battery-trigger data-charge-state={chargeState}
    aria-label={`Батарейка: ${summary}. Подробнее`}>
    <svg viewBox="0 0 38 22" aria-hidden="true" focusable="false">
      <rect className="mono-product-battery__body" x="1" y="2" width="31" height="18" rx="4" />
      <path className="mono-product-battery__cap" d="M34 8v6" />
      {chargeState === "charged" && <rect className="mono-product-battery__charge" x="4.5" y="5.5" width="24" height="11" rx="2" />}
      {chargeState === "multiple" && <path className="mono-product-battery__multiple" d="M7 8h5m-5 6h5m5-6h5m-5 6h5" />}
    </svg>
    <span className="mono-product-battery__count" aria-hidden="true">{count}</span>
  </button>;
}

export function ProductHoldings({ view, commands, appearance, overview }: ProductProps & {
  appearance: MonoAssetListAppearance;
  overview: boolean;
}) {
  const headingId = useId();
  const groups = view.holdings;
  const accounts = new Map(view.snapshot.accounts.map(account => [account.id, account]));
  const shown = !overview || view.fundsExpanded;
  return <section className="mono-product-funds mono-scene-domain" aria-labelledby={headingId}
    data-variant={appearance.variant} data-density={appearance.density} data-separators={appearance.separators}>
    {overview ? <button className="mono-product-funds__heading" type="button" id={headingId}
      aria-expanded={view.fundsExpanded} onClick={commands.toggleFunds}>
      <span><strong>Мои средства</strong><small>{groups.length} актива · по счетам и сетям</small></span>
      <span aria-hidden="true">{view.fundsExpanded ? "⌃" : "⌄"}</span>
    </button> : <h2 id={headingId} className="mono-product-funds__title">Мои средства</h2>}
    {shown && <ul className="mono-product-funds__list">
      {groups.map(group => <li key={group.assetId}>
        <button type="button" className="mono-product-funds__asset" aria-expanded={view.expandedAssetIds.has(group.assetId)}
          onClick={() => commands.toggleAsset(group.assetId)}>
          <span className="mono-product-funds__symbol" aria-hidden="true">{group.symbol.slice(0, 1)}</span>
          <span className="mono-product-funds__identity"><strong>{group.name}</strong>
            <small>{group.placements.length} {group.placements.length === 1 ? "размещение" : "размещения"}</small></span>
          <span className="mono-product-funds__value"><strong>{view.balanceHidden ? "••••" : formatFiatMinor(group.fiatMinor)}</strong>
            <small>{view.balanceHidden ? "Значения скрыты" : group.symbol}</small></span>
          <span className="mono-product-funds__chevron" aria-hidden="true">{view.expandedAssetIds.has(group.assetId) ? "⌃" : "⌄"}</span>
        </button>
        {view.expandedAssetIds.has(group.assetId) && <ul className="mono-product-funds__placements">
          {group.placements.map(placement => <li key={placement.id}>
            <div className="mono-product-funds__placement-context">
              <strong>{accounts.get(placement.accountId)?.label ?? "Счёт недоступен"}</strong>
              <span>{placement.networkLabel}</span>
            </div>
            <div className="mono-product-funds__placement-values">
              <strong>{view.balanceHidden ? "••••" : `${formatQuantity(placement.quantity)} ${placement.symbol}`}</strong>
              <small>{view.balanceHidden ? "Значения скрыты" : formatFiatMinor(placement.fiatMinor)}</small>
            </div>
          </li>)}
        </ul>}
      </li>)}
      {groups.length === 0 && <li className="mono-product-funds__empty">На этом счёте средств пока нет</li>}
    </ul>}
  </section>;
}

export function accountStatus(account: ProductAccount): string {
  return account.status === "active" ? "Активен" : account.status === "inactive" ? "Не активирован" : "Недоступен";
}

export function remainingLabel(remaining: number | "unknown"): string {
  return remaining === "unknown" ? "остаток неизвестен" : `${remaining} ${remaining === 1 ? "перевод" :
    remaining >= 2 && remaining <= 4 ? "перевода" : "переводов"}`;
}
