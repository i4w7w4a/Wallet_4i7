"use client";

import { useId, useLayoutEffect, useRef, type CSSProperties } from "react";
import type { AccountContext, ProductAccountKind } from "@wallet/core";
import type { MonoProductCommands, MonoProductView } from "../mono-product/product-controller";
import { ProductBalance } from "../mono-product/product-home";
import { AccountKindIcon } from "../mono-product/accounts-workspace/account-kind-icon";
import { formatFiatMinor } from "../mono-product/product-format";
import type { MonoBalanceAppearance } from "./mono-scene-lab-contract";

type Props = {
  view: MonoProductView;
  commands: MonoProductCommands;
  appearance: MonoBalanceAppearance;
  blinkEnabled: boolean;
  disabled?: boolean;
  onSelectContext(context: AccountContext): void;
  onOpenAccounts(): void;
  onOpenGroup(kind: ProductAccountKind): void;
};

/** Gold presentation of the existing account context; owns no selected account or financial state. */
export function MonoGoldAccountDeck({ view, commands, appearance, blinkEnabled, disabled = false,
  onSelectContext, onOpenAccounts, onOpenGroup }: Props) {
  const selector = useRef<HTMLDivElement>(null);
  const pinsId = useId();
  const accounts = view.snapshot.accounts.filter(account => account.kind !== "private" && account.status === "active" &&
    view.snapshot.accounts.filter(candidate => candidate.id === account.id).length === 1);
  const choices: { label: string; context: AccountContext }[] = [
    { label: "Все", context: { kind: "all" } },
    ...accounts.map(account => ({ label: account.label, context: { kind: "account" as const, accountId: account.id } })),
  ];
  const selectedIndex = choices.findIndex(choice => choice.context.kind === "all" ? view.context.kind === "all"
    : view.context.kind === "account" && choice.context.accountId === view.context.accountId);
  const pins = view.homeTotalOnly ? [] : view.homePinnedKinds.flatMap(kind =>
    view.accountGroups.filter(group => group.kind === kind && group.available));
  useLayoutEffect(() => {
    selector.current?.querySelector<HTMLElement>('[aria-pressed="true"]')
      ?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [selectedIndex, choices.length]);

  return <section className="mono-gold-account-deck" data-product-gold-account-deck>
    <div className="mono-gold-account-deck__selector" ref={selector}>
      <div className="mono-gold-account-deck__track" role="group" aria-label="Счёт для обзора"
        style={{ "--mono-gold-account-count": choices.length,
          "--mono-gold-account-index": Math.max(0, selectedIndex) } as CSSProperties}>
        <span className="mono-gold-account-deck__indicator" aria-hidden="true" hidden={selectedIndex < 0} />
        {choices.map((choice, index) => <button type="button" className="mono-gold-account-deck__account"
          key={choice.context.kind === "all" ? "all" : choice.context.accountId}
          data-gold-account-context={choice.context.kind === "all" ? "all" : choice.context.accountId}
          aria-pressed={index === selectedIndex} aria-label={choice.label} title={choice.label} disabled={disabled}
          onClick={() => onSelectContext(choice.context)}>{choice.label}</button>)}
      </div>
    </div>
    {selectedIndex < 0 && <p className="mono-gold-account-deck__context-note">
      {view.account?.label ?? "Счёт недоступен"} · Только просмотр
    </p>}
    <div className="mono-gold-account-deck__balance">
      <ProductBalance view={view} commands={commands} appearance={appearance} blinkEnabled={blinkEnabled} compact />
    </div>
    <button type="button" className="mono-gold-account-deck__accounts" data-mono-gold-accounts-trigger
      disabled={disabled} onClick={onOpenAccounts}>Мои счета<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <path d="m6 4 4 4-4 4" />
      </svg></button>
    {pins.length > 0 && <div className="mono-gold-account-deck__pins mono-product-overview__pins"
      role="group" aria-label="Закреплённые группы счетов">
      {pins.map(group => <button key={group.kind} type="button" disabled={disabled}
        className="mono-gold-account-deck__pin mono-product-overview__pin" data-product-account-group-trigger={group.kind}
        aria-label={`Открыть группу ${group.label}`} aria-describedby={`${pinsId}-${group.kind}`}
        onClick={() => onOpenGroup(group.kind)}>
        <AccountKindIcon kind={group.kind} className="mono-gold-account-deck__icon mono-product-overview__icon" />
        <span className="mono-gold-account-deck__group mono-product-overview__group">{group.label}</span>
        <span id={`${pinsId}-${group.kind}`} className="mono-gold-account-deck__estimate mono-product-overview__estimate">
          <bdi>{view.balanceHidden ? "••••" : group.estimateMinor === null ? "Нет оценки" : formatFiatMinor(group.estimateMinor)}</bdi>
        </span>
      </button>)}
    </div>}
  </section>;
}
