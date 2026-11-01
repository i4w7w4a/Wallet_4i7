"use client";

import { selectFiatBalanceMinor, selectHoldings, type AccountContext, type ProductAccount, type ProductSnapshot } from "@wallet/core";
import { formatFiatMinor } from "./product-format";
import { AccountKindIcon } from "./accounts-workspace/account-kind-icon";
import styles from "./product-chooser.module.css";

export type ProductAccountChooserProps = {
  snapshot: Readonly<ProductSnapshot>;
  context: AccountContext;
  balanceHidden: boolean;
  onSelectContext(context: AccountContext): void;
};

const accountStatus: Record<ProductAccount["status"], string> = {
  active: "Активен", inactive: "Не активирован · Только просмотр", unavailable: "Недоступен · Только просмотр",
};

export function ProductAccountChooser({ snapshot, context, balanceHidden, onSelectContext }: ProductAccountChooserProps) {
  function estimate(next: AccountContext): string {
    return balanceHidden ? "Значения скрыты" : formatFiatMinor(selectFiatBalanceMinor(selectHoldings(snapshot, next)));
  }

  const wallets = [
    { kind: "custodial", label: "Кастодиальный" },
    { kind: "depositary", label: "Депозитарный" },
    { kind: "private", label: "Приватный" },
  ] as const;

  return <div className={styles.chooser} data-product-account-chooser data-novex-wallet-picker>
    <ul className={styles.accountList} aria-label="Общий обзор">
      <li data-wallet-overview>
        <button type="button" className={styles.accountRow} aria-current={context.kind === "all" ? "true" : undefined}
          data-account-context="all" onClick={() => onSelectContext({ kind: "all" })}>
          <AccountContextIcon className={styles.accountIcon} stacked />
          <span className={styles.accountCopy}><strong>Общий обзор</strong><small>Общая оценка, не остаток для отправки</small></span>
          <span className={styles.accountValue}>{estimate({ kind: "all" })}</span>
          <SelectionMark />
        </button>
      </li>
    </ul>
    <ul className={styles.accountList} aria-label="Кошельки">
      {wallets.flatMap(wallet => {
        const matches = wallet.kind === "private" ? [] : snapshot.accounts.filter(account => account.kind === wallet.kind);
        const entries: (ProductAccount | undefined)[] = matches.length ? matches : [undefined];
        return entries.map((account, index) => {
          const usable = account && snapshot.accounts.filter(item => item.id === account.id).length === 1;
          const reason = account ? "Повторяющийся ID — выбор недоступен" : "Пока недоступен";
          return <li key={`${wallet.kind}-${account?.id ?? "missing"}-${index}`}>
            <button type="button" className={styles.accountRow} data-wallet-type-card={wallet.kind}
              disabled={!usable} data-account-context={usable ? account.id : undefined} data-account-status={account?.status}
              aria-current={usable && context.kind === "account" && context.accountId === account.id ? "true" : undefined}
              onClick={() => { if (usable) onSelectContext({ kind: "account", accountId: account.id }); }}>
              <span data-wallet-type-emblem><AccountKindIcon kind={wallet.kind} className={styles.accountIcon} /></span>
              <span className={styles.accountCopy}><strong data-wallet-type-name>{account?.label ?? wallet.label}</strong>
                <small data-wallet-type-state>{usable ? accountStatus[account.status] : reason}</small></span>
              {usable && <span className={styles.accountValue}>{estimate({ kind: "account", accountId: account.id })}</span>}
              {usable && <SelectionMark />}
            </button>
          </li>;
        });
      })}
    </ul>
  </div>;
}

export function AccountContextIcon({ className, stacked = false }: { className?: string; stacked?: boolean }) {
  return <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {stacked ? <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5M3 17l9 5 9-5" /></>
      : <><rect x="3.5" y="5" width="17" height="14" rx="3" /><path d="M3.5 9.5h17M7 14h3" /></>}
  </svg>;
}

function SelectionMark() {
  return <svg className={styles.selectionMark} width="16" height="16" viewBox="0 0 16 16" fill="none"
    aria-hidden="true" focusable="false">
    <path d="m3 8 3.2 3.2L13 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}
