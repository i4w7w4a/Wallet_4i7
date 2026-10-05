"use client";

import { selectFiatBalanceMinor, selectHoldings, type AccountContext, type ProductAccount, type ProductSnapshot } from "@wallet/core";
import { formatFiatMinor } from "./product-format";
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

  return <div className={styles.chooser} data-product-account-chooser>
    <p className={styles.intro}>«Все счета» — общая оценка стоимости, не доступный остаток для отправки.</p>
    <ul className={styles.accountList} aria-label="Счета">
      <li>
        <button type="button" className={styles.accountRow} aria-current={context.kind === "all" ? "true" : undefined}
          data-account-context="all" onClick={() => onSelectContext({ kind: "all" })}>
          <AccountContextIcon className={styles.accountIcon} stacked />
          <span className={styles.accountCopy}><strong>Все счета</strong><small>Общая оценка</small></span>
          <span className={styles.accountValue}>{estimate({ kind: "all" })}</span>
          <SelectionMark />
        </button>
      </li>
      {snapshot.accounts.map(account => <li key={account.id}>
        <button type="button" className={styles.accountRow}
          aria-current={context.kind === "account" && context.accountId === account.id ? "true" : undefined}
          data-account-context={account.id} data-account-status={account.status}
          onClick={() => onSelectContext({ kind: "account", accountId: account.id })}>
          <AccountContextIcon className={styles.accountIcon} />
          <span className={styles.accountCopy}><strong>{account.label}</strong><small>{accountStatus[account.status]}</small></span>
          <span className={styles.accountValue}>{estimate({ kind: "account", accountId: account.id })}</span>
          <SelectionMark />
        </button>
      </li>)}
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
