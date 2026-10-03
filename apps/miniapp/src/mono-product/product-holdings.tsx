"use client";

import { useId } from "react";
import { resolveActionRoutes, type ProductAccount, type ProductHolding, type ProductSnapshot } from "@wallet/core";
import type { MonoAssetListAppearance } from "../mono-preview/mono-scene-lab-contract";
import type { MonoProductCommands, MonoProductView } from "./product-controller";
import { formatFiatMinor, formatQuantity } from "./product-format";

export type ProductHoldingsProps = {
  view: MonoProductView;
  commands: MonoProductCommands;
  appearance: MonoAssetListAppearance;
  overview: boolean;
  onPlacementAction?: (holdingId: string, action: "send" | "receive") => void;
};

const plurals = new Intl.PluralRules("ru");

export function ProductHoldings({ view, commands, appearance, overview, onPlacementAction }: ProductHoldingsProps) {
  const headingId = useId();
  const listId = `${headingId}-holdings`;
  const groups = view.holdings;
  const accounts = new Map(view.snapshot.accounts.map(account => [account.id, account]));
  const expandable = overview && groups.length > 0;
  const shown = !expandable || view.fundsExpanded;
  const count = countLabel(groups.length, ["актив", "актива", "активов"]);

  return <section className="mono-product-funds mono-scene-domain" aria-labelledby={headingId}
    data-variant={appearance.variant} data-density={appearance.density} data-separators={appearance.separators}>
    <h2 id={headingId} className="mono-product-funds__title">
      {expandable ? <button className="mono-product-funds__heading" type="button"
        aria-expanded={view.fundsExpanded} aria-controls={listId} onClick={commands.toggleFunds}>
        <span>Мои средства</span><small>{count}</small><Chevron expanded={view.fundsExpanded} />
      </button> : <span className="mono-product-funds__heading">
        <span>Мои средства</span>{groups.length > 0 && <small>{count}</small>}
      </span>}
    </h2>
    {shown && (groups.length > 0 ? <ul id={listId} className="mono-product-funds__list">
      {groups.map((group, index) => {
        const expanded = view.expandedAssetIds.has(group.assetId);
        const placementsId = `${headingId}-placements-${index}`;
        return <li key={group.assetId}>
          <button type="button" className="mono-product-funds__asset" aria-expanded={expanded}
            aria-controls={placementsId} onClick={() => commands.toggleAsset(group.assetId)}>
            <span className="mono-product-funds__symbol" aria-hidden="true">{group.symbol.slice(0, 1)}</span>
            <span className="mono-product-funds__identity"><strong>{group.name}</strong>
              <small>{countLabel(group.placements.length, ["размещение", "размещения", "размещений"])}</small></span>
            <span className="mono-product-funds__value"><strong>{view.balanceHidden ? "••••" : formatFiatMinor(group.fiatMinor)}</strong>
              <small>{group.symbol}</small></span>
            <Chevron expanded={expanded} />
          </button>
          {expanded && <ul id={placementsId} className="mono-product-funds__placements" aria-label={`Размещения ${group.symbol}`}>
            {group.placements.map(placement => <Placement key={placement.id} placement={placement}
              account={accounts.get(placement.accountId)} snapshot={view.snapshot} hidden={view.balanceHidden}
              onAction={onPlacementAction} />)}
          </ul>}
        </li>;
      })}
    </ul> : <EmptyHoldings view={view} commands={commands} />)}
  </section>;
}

function Placement({ placement, account, snapshot, hidden, onAction }: {
  placement: ProductHolding;
  account?: ProductAccount;
  snapshot: Readonly<ProductSnapshot>;
  hidden: boolean;
  onAction: ProductHoldingsProps["onPlacementAction"];
}) {
  // The aggregate view is never an operation source. Resolve this placement's account only.
  const context = { kind: "account", accountId: placement.accountId } as const;
  const allows = (action: "send" | "receive") => resolveActionRoutes(snapshot, context, action).routes.some(route =>
    route.accountId === placement.accountId && route.assetId === placement.assetId && route.networkId === placement.networkId);
  const canSend = allows("send");
  const actions = onAction ? (["receive", "send"] as const).filter(action => action === "send" ? canSend : allows(action)) : [];
  const accountLabel = account?.label ?? "Счёт недоступен";
  const availability = !account || account.status === "unavailable" ? "Счёт недоступен"
    : account.status === "inactive" ? "Счёт не активирован"
      : canSend ? hidden ? "Доступно: ••••" : isQuantity(placement.availableQuantity)
        ? `Доступно: ${formatQuantity(placement.availableQuantity)} ${placement.symbol}` : "Доступно: нет данных"
        : null;

  return <li>
    <div className="mono-product-funds__placement-context">
      <strong>{accountLabel}</strong><span>{placement.networkLabel || "Сеть неизвестна"}</span>
    </div>
    <div className="mono-product-funds__placement-values">
      <strong>{hidden ? "••••" : isQuantity(placement.quantity)
        ? `${formatQuantity(placement.quantity)} ${placement.symbol}` : "Количество неизвестно"}</strong>
      <small>{hidden ? "Значения скрыты" : formatFiatMinor(placement.fiatMinor)}</small>
    </div>
    {(availability || actions.length > 0) && <div className="mono-product-funds__placement-footer">
      <small className="mono-product-funds__availability">{availability}</small>
      {actions.length > 0 && <div className="mono-product-funds__placement-actions">
        {actions.map(action => {
          const label = `${action === "send" ? "Отправить" : "Получить"} ${placement.symbol} · ${accountLabel} · ${placement.networkLabel}`;
          return <button key={action} type="button" aria-label={label} title={label}
            data-mono-product-placement-id={placement.id} data-mono-product-placement-action={action}
            onClick={() => onAction?.(placement.id, action)}><ActionArrow action={action} /></button>;
        })}
      </div>}
    </div>}
  </li>;
}

function EmptyHoldings({ view, commands }: Pick<ProductHoldingsProps, "view" | "commands">) {
  const canReceive = resolveActionRoutes(view.snapshot, view.context, "receive").routes.length > 0;
  const title = view.account?.status === "inactive" ? "Счёт не активирован"
    : view.account?.status === "unavailable" ? "Счёт недоступен" : "Активов пока нет";
  return <div className="mono-product-funds__empty">
    <strong>{title}</strong>
    <p>{canReceive ? "Выберите актив и сеть для получения. Здесь появятся ваши средства."
      : "Доступного способа получения пока нет."}</p>
    {canReceive ? <button type="button" onClick={() => commands.openIntent("receive")}>
      <ActionArrow action="receive" />Получить активы
    </button> : view.snapshot.accounts.length > 1 && <button type="button" onClick={commands.openAccounts}>Выбрать счёт</button>}
  </div>;
}

function Chevron({ expanded }: { expanded: boolean }) {
  return <svg className="mono-product-funds__chevron" data-expanded={expanded} viewBox="0 0 16 16" aria-hidden="true">
    <path d={expanded ? "m4 10 4-4 4 4" : "m4 6 4 4 4-4"} />
  </svg>;
}

function ActionArrow({ action }: { action: "send" | "receive" }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d={action === "send" ? "M6 18 18 6M7 6h11v11" : "M18 6 6 18M6 7v11h11"} />
  </svg>;
}

function isQuantity(value: string | undefined): value is string {
  return typeof value === "string" && /^\d+(?:\.\d+)?$/.test(value);
}

function countLabel(count: number, forms: readonly [string, string, string]): string {
  const plural = plurals.select(count);
  return `${count} ${forms[plural === "one" ? 0 : plural === "few" ? 1 : 2]}`;
}
