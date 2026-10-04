"use client";

import { useId, type JSX } from "react";
import type { AccountContext, ProductAccount, ProductActionRoute, ProductHolding, ProductSnapshot } from "@wallet/core";
import { CurrencyLogo } from "../currency-logo";
import { productRouteKey } from "../product-controller";
import { formatFiatMinor } from "../product-format";
import { accountKindLabels, accountStatusLabels, accountOperationsUnavailable, holdingQuantityLabel,
  placementCountLabel, selectAccountsWorkspace } from "./accounts-workspace-data";
import styles from "./product-accounts-workspace.module.css";

export type ProductAccountsWorkspaceProps = {
  snapshot: Readonly<ProductSnapshot>;
  selectedAccountId: string | null;
  context: AccountContext;
  balanceHidden: boolean;
  allowedActions: readonly ProductActionRoute[];
  onInspectAccount(accountId: string): void;
  onBack(): void;
  onUseAccount(accountId: string): void;
  onOpenAction(route: ProductActionRoute): void;
  onOpenHolding(holdingId: string): void;
};

export function ProductAccountsWorkspace({ snapshot, selectedAccountId, context, balanceHidden, allowedActions,
  onInspectAccount, onBack, onUseAccount, onOpenAction, onOpenHolding }: ProductAccountsWorkspaceProps): JSX.Element {
  const titleId = useId(), placementsId = useId(), actionsId = useId();
  const { accounts, selected, permittedRoutes } = selectAccountsWorkspace(snapshot, context, selectedAccountId, allowedActions);
  const detail = selectedAccountId !== null;

  return <section className={styles.workspace} aria-labelledby={titleId}
    data-mono-product-accounts-workspace={selectedAccountId ?? "list"}>
    <button type="button" className={styles.back} onClick={onBack}
      aria-label={detail ? "Назад к счетам" : "Назад в кошелёк"}>
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m14 6-6 6 6 6" /></svg>Назад
    </button>
    {!detail ? <>
      <header className={styles.identity} key="list">
        <div><h1 id={titleId} className={styles.title} tabIndex={-1} data-mono-product-accounts-title>Мои счета</h1>
          <p className={styles.intro}>Откройте счёт, чтобы посмотреть его активы и размещения.</p></div>
      </header>
      {accounts.length === 0 ? <p className={styles.empty}>Счетов пока нет.</p> : <>
        <p className={styles.estimateNote}>Оценка активов в USD. Доступное количество указано в размещениях.</p>
        <ul className={styles.accountList} aria-label="Счета">
          {accounts.map(({ account, holdings, estimateMinor, current }, index) => <li key={account.id}>
            <button type="button" className={styles.accountRow} onClick={() => onInspectAccount(account.id)}
              aria-label={`Открыть счёт: ${account.label}`} aria-current={current ? "true" : undefined}
              aria-describedby={`${titleId}-account-${index}-meta ${titleId}-account-${index}-count ${titleId}-account-${index}-estimate`}
              data-product-account-id={account.id} data-product-account-status={account.status}>
              <AccountKindIcon kind={account.kind} className={styles.accountIcon} />
              <span className={styles.accountCopy}>
                <strong>{account.label}</strong>
                <span id={`${titleId}-account-${index}-meta`} className={styles.meta}>{accountKindLabels[account.kind]} · {accountStatusLabels[account.status]}</span>
                <span id={`${titleId}-account-${index}-count`} className={styles.placementCount}>{placementCountLabel(holdings.length)}
                  {current && <span className={styles.current}>Выбран</span>}</span>
              </span>
              <span id={`${titleId}-account-${index}-estimate`} className={styles.rowEstimate}><bdi>{balanceHidden ? "••••" : `≈ ${formatFiatMinor(estimateMinor)}`}</bdi></span>
              <Chevron />
            </button>
          </li>)}
        </ul>
      </>}
    </> : !selected ? <div className={styles.missing}>
      <h1 id={titleId} className={styles.title} tabIndex={-1} data-mono-product-accounts-title>Счёт недоступен</h1>
      <p className={styles.intro}>Этого счёта больше нет в текущем списке. Вернитесь к счетам.</p>
    </div> : <div key={selected.account.id}>
      <header className={styles.identity}>
        <AccountKindIcon kind={selected.account.kind} className={styles.detailIcon} />
        <div><h1 id={titleId} className={styles.title} tabIndex={-1} data-mono-product-accounts-title>{selected.account.label}</h1>
          <p className={styles.meta}>{accountKindLabels[selected.account.kind]} · {accountStatusLabels[selected.account.status]}</p></div>
      </header>
      <div className={styles.summary}>
        <p className={styles.balanceLabel}>Оценка активов в USD</p>
        <div className={styles.balance} role="group" aria-label="Оценка активов счёта в USD">
          <bdi>{balanceHidden ? "••••" : `≈ ${formatFiatMinor(selected.estimateMinor)}`}</bdi>
        </div>
        <div className={styles.contextLine}>{selected.current ? <span className={styles.contextCurrent}>
          <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="m3 8 3 3 7-7" /></svg>Выбран в кошельке
        </span> : <button type="button" className={styles.useAccount} onClick={() => onUseAccount(selected.account.id)}>
          Выбрать счёт в кошельке<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M4 10h12m-5-5 5 5-5 5" /></svg>
        </button>}</div>
      </div>

      <section className={styles.placements} aria-labelledby={placementsId}>
        <div className={styles.sectionHeading}><h2 id={placementsId}>Размещения</h2><span>{selected.holdings.length}</span></div>
        {selected.holdings.length === 0 ? <p className={styles.empty}>Размещений пока нет.</p> : <ul className={styles.holdingList}>
          {selected.holdings.map(holding => <AccountHolding key={holding.id} holding={holding} hidden={balanceHidden} onOpen={onOpenHolding} />)}
        </ul>}
      </section>

      <section className={styles.operations} aria-labelledby={actionsId}>
        <h2 id={actionsId} className={styles.sectionTitle}>Операции</h2>
        {permittedRoutes.length === 0 ? <p className={styles.hint}>{accountOperationsUnavailable(selected.account)}</p> : <>
          <p className={styles.hint}>Выберите операцию. Условия и доступность проверяются перед подтверждением.</p>
          <div className={styles.actionList} role="group" aria-label="Подготовка операций">
            {permittedRoutes.map(route => <AccountRoute key={productRouteKey(route)} route={route} onOpen={onOpenAction} />)}
          </div>
        </>}
      </section>
    </div>}
  </section>;
}

function AccountHolding({ holding, hidden, onOpen }: {
  holding: ProductHolding; hidden: boolean; onOpen: ProductAccountsWorkspaceProps["onOpenHolding"];
}) {
  const network = holding.networkLabel || "Сеть неизвестна";
  return <li className={styles.holding}>
    <button type="button" className={styles.holdingButton} onClick={() => onOpen(holding.id)}
      aria-label={`Открыть актив: ${holding.name} · ${holding.symbol} · ${network}`} data-product-holding-id={holding.id}>
      <CurrencyLogo assetId={holding.assetId} className={styles.currencyIcon} />
      <span className={styles.holdingCopy}><strong>{holding.name}</strong><span>{holding.symbol} · {network}</span></span>
      <Chevron />
    </button>
    <dl className={styles.holdingValues}>
      <div><dt>Количество</dt><dd><span role="group" aria-label={`Количество ${holding.symbol} · ${network}`}>
        <bdi>{holdingQuantityLabel(holding.quantity, holding.symbol, hidden)}</bdi>
      </span></dd></div>
      <div><dt>Доступно</dt><dd><span role="group" aria-label={`Доступное количество ${holding.symbol} · ${network}`}>
        <bdi>{holdingQuantityLabel(holding.availableQuantity, holding.symbol, hidden)}</bdi>
      </span></dd></div>
      <div><dt>Оценка в USD</dt><dd><bdi>{hidden ? "••••" : `≈ ${formatFiatMinor(holding.fiatMinor)}`}</bdi></dd></div>
    </dl>
  </li>;
}

const actionLabels = { send: "Отправить", receive: "Получить", buy: "Купить", swap: "Обмен" } as const;
const prepareLabels = { send: "Подготовить отправку", receive: "Подготовить получение", buy: "Подготовить покупку",
  swap: "Подготовить обмен" } as const;
const actionPaths = { send: "M6 18 18 6M7 6h11v11", receive: "M18 6 6 18M6 7v11h11",
  buy: "M12 4v16M4 12h16", swap: "M4 8h16m-4-4 4 4-4 4M20 16H4m4-4-4 4 4 4" } as const;

function AccountRoute({ route, onOpen }: { route: ProductActionRoute; onOpen: ProductAccountsWorkspaceProps["onOpenAction"] }) {
  if (route.action === "withdraw") return null;
  const mode = route.action === "receive"
    ? route.receiveMode === "internal-transfer" ? "Перевод между счетами" : "Внешнее получение" : null;
  const network = route.networkLabel || "Сеть неизвестна";
  return <button type="button" className={styles.action} onClick={() => onOpen(route)}
    aria-label={`${prepareLabels[route.action]} ${route.symbol} · ${route.accountLabel} · ${network}${mode ? ` · ${mode}` : ""}`}
    data-product-account-route-key={productRouteKey(route)}>
    <svg className={styles.actionIcon} viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d={actionPaths[route.action]} /></svg>
    <span className={styles.actionCopy}><strong>{actionLabels[route.action]}</strong>
      <span>{route.symbol} · {network}{mode && <span className={styles.receiveMode}>{mode}</span>}</span></span>
    <Chevron />
  </button>;
}

function AccountKindIcon({ kind, className }: { kind: ProductAccount["kind"]; className: string }) {
  return <svg className={className} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
    {kind === "custodial" ? <><path d="M6 11h20M8 11v13m8-13v13m8-13v13M5 25h22M6 8l10-4 10 4" /></>
      : kind === "depositary" ? <><path d="M6 10 16 5l10 5v13l-10 5-10-5ZM6 10l10 5 10-5M16 15v13" /></>
        : <><circle cx="16" cy="16" r="10" /><path d="M12 12h8v8h-8Z" /></>}
  </svg>;
}

function Chevron() {
  return <svg className={styles.chevron} viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="m6 4 4 4-4 4" /></svg>;
}
