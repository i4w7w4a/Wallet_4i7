"use client";

import { useId, useState, type JSX } from "react";
import type { AccountContext, ProductAccount, ProductActionRoute, ProductHolding, ProductSnapshot } from "@wallet/core";
import { CurrencyLogo } from "../currency-logo";
import { productRouteKey } from "../product-controller";
import { formatFiatMinor } from "../product-format";
import { DisclosureMotion } from "../motion/disclosure-motion";
import disclosureStyles from "../motion/disclosure-motion.module.css";
import { accountKindLabels, accountStatusLabels, accountOperationsUnavailable, holdingQuantityLabel,
  placementCountLabel, selectAccountsWorkspace } from "./accounts-workspace-data";
import { selectAccountPlacementActions, type AccountsActionOrigin } from "./account-placement-actions";
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
  useAccountUnavailableReason?: string;
  expandedHoldingId?: string | null;
  onExpandedHoldingChange?(id: string | null): void;
  onOpenAction(route: ProductActionRoute, origin?: AccountsActionOrigin): boolean | void;
  onOpenHolding(holdingId: string): void;
};

export function ProductAccountsWorkspace({ snapshot, selectedAccountId, context, balanceHidden, allowedActions,
  onInspectAccount, onBack, onUseAccount, useAccountUnavailableReason, expandedHoldingId, onExpandedHoldingChange,
  onOpenAction, onOpenHolding }: ProductAccountsWorkspaceProps): JSX.Element {
  const titleId = useId();
  const { accounts, selected, permittedRoutes } = selectAccountsWorkspace(snapshot, context, selectedAccountId, allowedActions);
  const detail = selectedAccountId !== null;
  const useAccountReason = useAccountUnavailableReason?.trim() || null;
  const contextLabel = context.kind === "all" ? "Все счета"
    : snapshot.accounts.find(account => account.id === context.accountId)?.label ?? "Счёт недоступен";

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
        {!selected.current && <p className={styles.contextHint}>В кошельке сейчас: {contextLabel}.</p>}
        <div className={styles.contextLine}>{selected.current ? <span className={styles.contextCurrent}>
          <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="m3 8 3 3 7-7" /></svg>Выбран в кошельке
        </span> : <button type="button" className={styles.useAccount} onClick={() => onUseAccount(selected.account.id)}
          disabled={Boolean(useAccountReason)} aria-describedby={useAccountReason ? `${titleId}-use-unavailable` : undefined}>
          Выбрать счёт в кошельке<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M4 10h12m-5-5 5 5-5 5" /></svg>
        </button>}</div>
        {!selected.current && useAccountReason && <p id={`${titleId}-use-unavailable`} className={styles.hint}>{useAccountReason}</p>}
      </div>

      <AccountPlacements key={selected.account.id} account={selected.account} holdings={selected.holdings}
        routes={permittedRoutes} hidden={balanceHidden} expandedHoldingId={expandedHoldingId}
        onExpandedHoldingChange={onExpandedHoldingChange} onOpenAction={onOpenAction} onOpenHolding={onOpenHolding} />
    </div>}
  </section>;
}

function AccountPlacements({ account, holdings, routes, hidden, expandedHoldingId, onExpandedHoldingChange,
  onOpenAction, onOpenHolding }: {
  account: ProductAccount; holdings: readonly ProductHolding[]; routes: readonly ProductActionRoute[]; hidden: boolean;
} & Pick<ProductAccountsWorkspaceProps, "expandedHoldingId" | "onExpandedHoldingChange" | "onOpenAction" | "onOpenHolding">) {
  const placementsId = useId(), actionsId = useId();
  const [localExpandedId, setLocalExpandedId] = useState<string | null>(null);
  const [accountEntry, setAccountEntry] = useState<"receive" | "other" | null>(null);
  const placements = selectAccountPlacementActions(holdings, routes);
  const candidateId = expandedHoldingId === undefined ? localExpandedId : expandedHoldingId;
  const expandedId = holdings.some(holding => holding.id === candidateId) ? candidateId : null;
  // A removed local identity must not reopen if it later reappears. The scene owns controlled resets.
  if (localExpandedId !== null && !holdings.some(holding => holding.id === localExpandedId)) setLocalExpandedId(null);
  if ((accountEntry === "receive" && placements.receiveRoutes.length === 0) ||
    (accountEntry === "other" && placements.otherUnplacedRoutes.length === 0)) setAccountEntry(null);
  const changeExpanded = (id: string | null) => {
    if (expandedHoldingId === undefined) setLocalExpandedId(id);
    onExpandedHoldingChange?.(id);
  };

  return <>
    <section className={styles.placements} aria-labelledby={placementsId}>
      <div className={styles.sectionHeading}><h2 id={placementsId}>Размещения</h2><span>{holdings.length}</span></div>
      {holdings.length === 0 ? <p className={styles.empty}>Размещений пока нет.</p> : <ul className={styles.holdingList}>
        {holdings.map(holding => <AccountHolding key={holding.id} holding={holding} account={account} hidden={hidden}
          routes={placements.byHoldingId.get(holding.id) ?? []} expanded={expandedId === holding.id}
          onToggle={() => changeExpanded(expandedId === holding.id ? null : holding.id)}
          onOpenAction={onOpenAction} onOpenHolding={onOpenHolding} />)}
      </ul>}
    </section>
    <section className={styles.operations} aria-labelledby={actionsId}>
      <h2 id={actionsId} className={styles.sectionTitle}>Операции</h2>
      {routes.length === 0 ? <p className={styles.hint}>{accountOperationsUnavailable(account)}</p>
        : <p className={styles.hint}>Условия и доступность проверяются перед подтверждением.</p>}
      <AccountEntry entry="receive" routes={placements.receiveRoutes} open={accountEntry === "receive"}
        onToggle={() => setAccountEntry(accountEntry === "receive" ? null : "receive")} onOpenAction={onOpenAction} />
      <AccountEntry entry="other" routes={placements.otherUnplacedRoutes} open={accountEntry === "other"}
        onToggle={() => setAccountEntry(accountEntry === "other" ? null : "other")} onOpenAction={onOpenAction} />
    </section>
  </>;
}

function AccountHolding({ holding, account, hidden, routes, expanded, onToggle, onOpenAction, onOpenHolding }: {
  holding: ProductHolding; account: ProductAccount; hidden: boolean; routes: readonly ProductActionRoute[];
  expanded: boolean; onToggle(): void;
} & Pick<ProductAccountsWorkspaceProps, "onOpenAction" | "onOpenHolding">) {
  const contentId = useId();
  const launcherId = `${contentId}-trigger`, valuesId = `${contentId}-values`, restrictionId = `${contentId}-restriction`;
  const variantsId = `${contentId}-variants`;
  const [choiceAction, setChoiceAction] = useState<"send" | "receive" | "more" | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const network = holding.networkLabel || "Сеть неизвестна";
  const restrictions = holdingRestrictions(account, holding, routes, hidden);
  const moreRoutes = routes.filter(route => route.action === "buy" || route.action === "swap");
  const choices = choiceAction === "more" ? moreRoutes : routes.filter(route => route.action === choiceAction);
  const openRoute = (route: ProductActionRoute) => {
    if (route.action === "withdraw") return;
    const origin: AccountsActionOrigin = { kind: "holding-action", holdingId: holding.id,
      action: route.action, routeKey: productRouteKey(route) };
    setUnavailable(onOpenAction(route, origin) === false);
  };

  return <li className={styles.holding} data-expanded={expanded}>
    <button type="button" id={launcherId} className={styles.holdingButton}
      onClick={() => { setChoiceAction(null); setUnavailable(false); onToggle(); }}
      aria-label={`${routes.length > 0 ? "Действия" : "Сведения"}: ${holding.name} · ${holding.symbol} · ${network}`}
      aria-describedby={`${valuesId}${restrictions.length > 0 ? ` ${restrictionId}` : ""}`}
      aria-expanded={expanded} aria-controls={contentId} data-product-holding-id={holding.id}>
      <CurrencyLogo assetId={holding.assetId} className={styles.currencyIcon} />
      <span className={styles.holdingCopy}><strong>{holding.name}</strong><span>{holding.symbol} · {network}</span></span>
      <span id={valuesId} className={styles.holdingBalance}>
        <span role="group" aria-label={`Количество ${holding.symbol} · ${network}`}>
          <bdi>{holdingQuantityLabel(holding.quantity, holding.symbol, hidden)}</bdi>
        </span>
        <span className={styles.holdingEstimate}><bdi>{hidden ? "••••" : `≈ ${formatFiatMinor(holding.fiatMinor)}`}</bdi></span>
      </span>
      <span className={styles.holdingAffordance}>{routes.length > 0 ? "Действия" : "Сведения"}<DisclosureChevron expanded={expanded} /></span>
    </button>
    {restrictions.length > 0 && <p id={restrictionId} className={styles.restriction}>
      {restrictions.map((reason, index) => <span key={reason}>{index > 0 && " "}{reason}</span>)}
    </p>}
    <DisclosureMotion open={expanded} id={contentId} launcherId={launcherId}>
      <div className={styles.holdingContent}>
        <dl className={styles.available}>
          <div><dt>Доступно</dt><dd><span role="group" aria-label={`Доступное количество ${holding.symbol} · ${network}`}>
            <bdi>{holdingQuantityLabel(holding.availableQuantity, holding.symbol, hidden)}</bdi>
          </span></dd></div>
        </dl>
        {routes.length > 0 && <div className={styles.holdingActions} role="group" aria-label={`Операции: ${holding.symbol} · ${network}`}>
          {(["send", "receive"] as const).map(action => {
            const actionRoutes = routes.filter(route => route.action === action);
            if (actionRoutes.length === 0) return null;
            const route = actionRoutes[0]!;
            const multiple = actionRoutes.length > 1;
            return <button key={action} type="button" id={`${variantsId}-${action}`} className={styles.primaryAction}
              aria-label={multiple ? `${actionLabels[action]} ${holding.symbol} · ${account.label} · ${network}: выбрать способ`
                : routeLabel(route)}
              aria-expanded={multiple ? choiceAction === action : undefined} aria-controls={multiple ? variantsId : undefined}
              data-product-holding-action-id={holding.id} data-product-holding-action={action}
              data-product-account-route-key={multiple ? undefined : productRouteKey(route)}
              onClick={() => { setUnavailable(false); if (multiple) setChoiceAction(choiceAction === action ? null : action); else openRoute(route); }}>
              <ActionIcon action={action} />{actionLabels[action]}{multiple && <DisclosureChevron expanded={choiceAction === action} />}
            </button>;
          })}
          {moreRoutes.length > 0 && <button type="button" id={`${variantsId}-more`} className={styles.moreAction}
            aria-label={`Ещё операции ${holding.symbol} · ${account.label} · ${network}`}
            aria-expanded={choiceAction === "more"} aria-controls={variantsId}
            data-product-holding-action-id={holding.id} data-product-holding-action="more"
            onClick={() => { setUnavailable(false); setChoiceAction(choiceAction === "more" ? null : "more"); }}>
            <MoreIcon />Ещё<DisclosureChevron expanded={choiceAction === "more"} />
          </button>}
        </div>}
        <DisclosureMotion open={expanded && choiceAction !== null && choices.length > 0} id={variantsId}
          launcherId={`${variantsId}-${choiceAction ?? "send"}`}>
          <div className={styles.actionList} role="group" aria-label="Выбор способа операции">
            {choices.map(route => <AccountRoute key={productRouteKey(route)} route={route} onOpen={openRoute} />)}
          </div>
        </DisclosureMotion>
        {unavailable && <p className={styles.hint} role="status">Эта операция сейчас недоступна.</p>}
        <button type="button" className={styles.details} aria-label={`Подробнее: ${holding.name} · ${holding.symbol} · ${network}`}
          data-product-holding-detail-id={holding.id} onClick={() => onOpenHolding(holding.id)}>
          Подробнее<Chevron />
        </button>
      </div>
    </DisclosureMotion>
  </li>;
}

function AccountEntry({ entry, routes, open, onToggle, onOpenAction }: {
  entry: "receive" | "other"; routes: readonly ProductActionRoute[]; open: boolean; onToggle(): void;
} & Pick<ProductAccountsWorkspaceProps, "onOpenAction">) {
  const contentId = useId(), launcherId = `${contentId}-trigger`;
  const [unavailable, setUnavailable] = useState(false);
  if (routes.length === 0) return null;
  const label = entry === "receive" ? "Получить на счёт" : "Другие операции";
  const openRoute = (route: ProductActionRoute) => {
    if (route.action === "withdraw") return;
    const origin: AccountsActionOrigin = { kind: "account-action", entry,
      action: route.action, routeKey: productRouteKey(route) };
    setUnavailable(onOpenAction(route, origin) === false);
  };
  return <div className={styles.accountEntry}>
    <button type="button" id={launcherId} className={styles.accountEntryButton} aria-label={label}
      aria-expanded={open} aria-controls={contentId} data-product-account-entry={entry}
      onClick={() => { setUnavailable(false); onToggle(); }}>
      {entry === "receive" ? <ActionIcon action="receive" /> : <MoreIcon />}
      <span>{label}<small>{entry === "receive" ? "Выберите валюту и сеть" : "Для других валют и сетей"}</small></span>
      <DisclosureChevron expanded={open} />
    </button>
    <DisclosureMotion open={open} id={contentId} launcherId={launcherId}>
      <div className={styles.actionList} role="group" aria-label={entry === "receive" ? "Получение на счёт" : "Другие операции счёта"}>
        {routes.map(route => <AccountRoute key={productRouteKey(route)} route={route} onOpen={openRoute} />)}
      </div>
      {unavailable && <p className={styles.hint} role="status">Эта операция сейчас недоступна.</p>}
    </DisclosureMotion>
  </div>;
}

function holdingRestrictions(account: ProductAccount, holding: ProductHolding, routes: readonly ProductActionRoute[], hidden: boolean): string[] {
  if (account.status !== "active") return [accountOperationsUnavailable(account)];
  const reasons: string[] = [];
  if (routes.length === 0) reasons.push("Операции сейчас недоступны.");
  else {
    if (!routes.some(route => route.action === "send")) reasons.push("Отправка недоступна.");
    const receive = routes.filter(route => route.action === "receive");
    if (receive.length === 0) reasons.push("Получение недоступно.");
    else if (receive.every(route => route.action === "receive" && route.receiveMode === "internal-transfer")) reasons.push("Получение между счетами.");
  }
  // This is a supplied balance hint, never authorization to open a permitted preparation.
  if (!hidden && holding.availableQuantity !== undefined && /^0+(?:\.0+)?$/.test(holding.availableQuantity)) {
    reasons.push("Доступных средств пока нет.");
  }
  return reasons;
}

const actionLabels = { send: "Отправить", receive: "Получить", buy: "Купить", swap: "Обмен" } as const;
const prepareLabels = { send: "Подготовить отправку", receive: "Подготовить получение", buy: "Подготовить покупку",
  swap: "Подготовить обмен" } as const;
const actionPaths = { send: "M6 18 18 6M7 6h11v11", receive: "M18 6 6 18M6 7v11h11",
  buy: "M12 4v16M4 12h16", swap: "M4 8h16m-4-4 4 4-4 4M20 16H4m4-4-4 4 4 4" } as const;

function routeLabel(route: ProductActionRoute): string {
  if (route.action === "withdraw") return "";
  const mode = route.action === "receive"
    ? route.receiveMode === "internal-transfer" ? "Перевод между счетами" : "Внешнее получение" : null;
  return `${prepareLabels[route.action]} ${route.symbol} · ${route.accountLabel} · ${route.networkLabel || "Сеть неизвестна"}${mode ? ` · ${mode}` : ""}`;
}

function AccountRoute({ route, onOpen }: { route: ProductActionRoute; onOpen(route: ProductActionRoute): void }) {
  if (route.action === "withdraw") return null;
  const mode = route.action === "receive"
    ? route.receiveMode === "internal-transfer" ? "Перевод между счетами" : "Внешнее получение" : null;
  const network = route.networkLabel || "Сеть неизвестна";
  return <button type="button" className={styles.action} onClick={() => onOpen(route)}
    aria-label={routeLabel(route)}
    data-product-account-route-key={productRouteKey(route)}>
    <ActionIcon action={route.action} />
    <span className={styles.actionCopy}><strong>{actionLabels[route.action]}</strong>
      <span>{route.symbol} · {network}{mode && <span className={styles.receiveMode}>{mode}</span>}</span></span>
    <Chevron />
  </button>;
}

function ActionIcon({ action }: { action: AccountsActionOrigin["action"] }) {
  return <svg className={styles.actionIcon} viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d={actionPaths[action]} /></svg>;
}

function MoreIcon() {
  return <svg className={styles.actionIcon} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" />
  </svg>;
}

function DisclosureChevron({ expanded }: { expanded: boolean }) {
  return <svg className={`${styles.chevron} ${disclosureStyles.chevron}`} data-mono-disclosure-chevron="" data-expanded={expanded}
    viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="m4 6 4 4 4-4" /></svg>;
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
