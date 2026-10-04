"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { WalletProfile } from "@wallet/core";
import { createDemoProfileResource, isProfileLinkAllowed, type ProductProfileActions,
  type ProductProfileDetails, type ProductProfileResource } from "./profile";
import { ProductHelp, type ProductHelpActions, type ProductHelpTopicId } from "./product-help";
import { DisclosureMotion } from "./motion/disclosure-motion";
import styles from "./product-profile.module.css";

export type ProductProfileSection = "personal" | "settings" | "security" | "help";
export type ProductProfileOpenSectionRequest = { section: ProductProfileSection; revision: number };

export type ProductProfileProps = {
  profile: WalletProfile;
  balanceHidden: boolean;
  onBalanceHiddenChange: (hidden: boolean) => void;
  resource?: ProductProfileResource;
  actions?: ProductProfileActions;
  helpActions?: ProductHelpActions;
  onRetry?(): void;
  theme?: "dark" | "light";
  onThemeChange?(theme: "dark" | "light"): void;
  /** A new revision opens an existing disclosure; manual toggles remain profile-owned. */
  openSectionRequest?: ProductProfileOpenSectionRequest;
};

const verificationLabels: Record<ProductProfileDetails["verification"], string> = {
  unknown: "Данные не подключены", "not-started": "Не начата", pending: "На проверке",
  verified: "Подтверждена", rejected: "Не пройдена",
};
const twoFactorLabels: Record<ProductProfileDetails["twoFactor"], string> = {
  unknown: "Данные не подключены", disabled: "Выключена", enabled: "Включена",
};
const addressLabels: Record<ProductProfileDetails["addressAllowlist"], string> = {
  unknown: "Данные не подключены", disabled: "Выключен", enabled: "Включён",
};
const securityActionLabels = [
  ["manage-verification", "Открыть проверку личности"],
  ["manage-2fa", "Настроить двухфакторную защиту"],
  ["manage-password", "Изменить пароль"],
  ["manage-addresses", "Управлять разрешёнными адресами"],
] as const;

export function ProductProfile({ profile, balanceHidden, onBalanceHiddenChange, resource, actions, helpActions,
  onRetry, openSectionRequest }: ProductProfileProps) {
  const titleId = useId();
  const groupIdPrefix = useId();
  const requestedSection = openSectionRequest?.section;
  const requestedRevision = openSectionRequest?.revision;
  const [openGroup, setOpenGroup] = useState<ProductProfileSection | null>(requestedSection ?? null);
  const [openHelpTopic, setOpenHelpTopic] = useState<ProductHelpTopicId | null>(null);
  const [consumedRequest, setConsumedRequest] = useState(requestedRevision);
  const requestTarget = useRef<HTMLButtonElement>(null);
  if (requestedSection && consumedRequest !== requestedRevision) {
    setConsumedRequest(requestedRevision);
    setOpenGroup(requestedSection);
  }
  useEffect(() => {
    // Run after the host's section scroll reset so the requested disclosure can become visible.
    if (requestedSection) requestTarget.current?.focus();
  }, [requestedRevision, requestedSection]);
  const current = resource ?? createDemoProfileResource();
  const details = current.status === "ready" ? current.data : null;
  const securityActions = securityActionLabels.filter(([action]) => actions?.[action]);
  const support = details?.support && isProfileLinkAllowed(details.support.href) ? details.support : null;
  const documents = details?.documents.filter(document => isProfileLinkAllowed(document.href)) ?? [];
  const unavailableCopy = current.status === "loading" ? "Загружаем данные…" : "Данные профиля пока недоступны.";
  const securitySummary = details
    ? details.verification === "unknown" && details.twoFactor === "unknown" && details.addressAllowlist === "unknown"
      ? "Данные не подключены" : "Проверка личности и доступ"
    : current.status === "loading" ? "Загрузка данных" : "Данные недоступны";

  function disclosure(group: ProductProfileSection, label: string, summary: string, content: ReactNode) {
    const expanded = openGroup === group;
    const detailsId = `${groupIdPrefix}-${group}`;
    const summaryId = `${detailsId}-summary`;
    const triggerId = `${detailsId}-trigger`;
    return <div className={styles.group}>
      <h2 className={styles.groupHeading}><button type="button" id={triggerId} className={styles.groupButton} aria-expanded={expanded}
        ref={requestedSection === group ? requestTarget : undefined}
        aria-label={label} aria-describedby={summaryId}
        aria-controls={detailsId} onClick={() => setOpenGroup(expanded ? null : group)}>
        <span className={styles.groupCopy}><strong>{label}</strong><small id={summaryId}>{summary}</small></span>
        <svg className={styles.chevron} viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
          <path d="m6 4 4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button></h2>
      <DisclosureMotion open={expanded} id={detailsId} launcherId={triggerId} role="region" labelledBy={triggerId}>
        <div className={styles.groupDetails}>{content}</div>
      </DisclosureMotion>
    </div>;
  }

  return <section className={styles.profile} aria-labelledby={titleId}>
    <h1 className={styles.title} id={titleId}>Профиль</h1>
    <div className={styles.identity}>
      <span className={styles.avatar} aria-hidden="true">{profile.name.trim().slice(0, 1).toLocaleUpperCase("ru-RU")}</span>
      <div className={styles.identityCopy}>
        <strong className={styles.name}>{profile.name}</strong>
        <span className={styles.identityLabel}>Идентификатор демо-профиля</span>
        <span className={styles.identityCode}>{profile.shortAddress}</span>
      </div>
    </div>
    <p className={styles.identityNote}>Не используется для получения средств.</p>

    <div className={styles.preferences}>
      <button type="button" className={`${styles.preferenceRow} ${styles.privacyButton}`} aria-pressed={balanceHidden}
        aria-label={balanceHidden ? "Показать суммы" : "Скрыть суммы"}
        onClick={() => onBalanceHiddenChange(!balanceHidden)}>
        <span>Скрывать суммы</span>
        <span className={styles.privacyState}>
          <span>{balanceHidden ? "Включено" : "Выключено"}</span>
          <span className={styles.privacyToggle} data-checked={balanceHidden} aria-hidden="true" />
        </span>
      </button>
    </div>

    {current.status === "loading" && <p className={styles.resourceNote} role="status">Загружаем данные профиля…</p>}
    {current.status === "error" && <div className={styles.resourceError}>
      <p role="alert">Не удалось загрузить данные профиля.</p>
      {current.retryable && onRetry && <button className={styles.textAction} type="button" onClick={onRetry}>Повторить</button>}
    </div>}

    <div className={styles.groups}>
      {disclosure("personal", "Личные данные", "Почта и телефон", details ? <>
        <dl className={styles.details}>
          <div><dt>Эл. почта</dt><dd>{details.email?.trim() || "Не указано"}</dd></div>
          <div><dt>Телефон</dt><dd>{details.phone?.trim() || "Не указано"}</dd></div>
        </dl>
        {actions?.["edit-contacts"] ? <button type="button" className={styles.textAction}
          onClick={() => actions["edit-contacts"]?.()}>Изменить контакты</button>
          : <p className={styles.note}>Изменение контактов здесь пока недоступно.</p>}
      </> : <p className={styles.note}>{unavailableCopy}</p>)}

      {disclosure("settings", "Настройки", "Язык и валюта оценки", details ? <>
        <dl className={styles.details}>
          <div><dt>Язык интерфейса</dt><dd>{details.languageLabel}</dd></div>
          <div><dt>Валюта оценки</dt><dd>{details.valuationCurrencyLabel}</dd></div>
        </dl>
        <p className={styles.note}>Изменение языка и валюты здесь пока недоступно.</p>
      </> : <p className={styles.note}>{unavailableCopy}</p>)}

      {disclosure("security", "Безопасность", securitySummary, details ? <>
        <dl className={styles.details}>
          <div><dt>Проверка личности</dt><dd data-unknown={details.verification === "unknown"}>{verificationLabels[details.verification]}</dd></div>
          <div><dt>Двухфакторная защита</dt><dd data-unknown={details.twoFactor === "unknown"}>{twoFactorLabels[details.twoFactor]}</dd></div>
          <div><dt>Список разрешённых адресов</dt><dd data-unknown={details.addressAllowlist === "unknown"}>{addressLabels[details.addressAllowlist]}</dd></div>
        </dl>
        {securityActions.length > 0 ? <div className={styles.actions}>
          {securityActions.map(([action, label]) => <button key={action} className={styles.textAction} type="button"
            onClick={() => actions?.[action]?.()}>{label}</button>)}
        </div> : <p className={styles.note}>Управление защитой здесь пока недоступно.</p>}
      </> : <p className={styles.note}>{unavailableCopy}</p>)}

      {disclosure("help", "Помощь и документы", "Как устроены операции", <>
        <ProductHelp openTopic={openHelpTopic} onOpenTopicChange={setOpenHelpTopic} actions={helpActions} />
        {details ? <div className={styles.links}>
          {support ? <ProfileLink href={support.href}>{support.label || "Поддержка"}</ProfileLink>
            : <p className={styles.note}>Контакт поддержки пока не указан.</p>}
          {documents.map(document => <ProfileLink key={document.id} href={document.href}>{document.title || "Документ"}</ProfileLink>)}
          {documents.length === 0 && <p className={styles.note}>Документы пока не подключены.</p>}
        </div> : <p className={styles.note}>{unavailableCopy}</p>}
      </>)}
    </div>
  </section>;
}

function ProfileLink({ href, children }: { href: string; children: ReactNode }) {
  return <a className={styles.link} href={href} target="_blank" rel="noopener noreferrer">
    <span>{children}</span>
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
      <path d="M4 12 12 4M5 4h7v7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </a>;
}
