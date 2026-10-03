"use client";

import { useId, useState, type ReactNode } from "react";
import type { WalletProfile } from "@wallet/core";
import styles from "./product-account-sections.module.css";

export type ProductProfileProps = {
  profile: WalletProfile;
  balanceHidden: boolean;
  onBalanceHiddenChange: (hidden: boolean) => void;
};

type ProfileGroup = "settings" | "security" | "help";

export function ProductProfile({ profile, balanceHidden, onBalanceHiddenChange }: ProductProfileProps) {
  const titleId = useId();
  const groupIdPrefix = useId();
  const [openGroup, setOpenGroup] = useState<ProfileGroup | null>(null);

  function disclosure(group: ProfileGroup, label: string, summary: string, content: ReactNode) {
    const expanded = openGroup === group;
    const detailsId = `${groupIdPrefix}-${group}`;
    const summaryId = `${detailsId}-summary`;
    return <div className={styles.group}>
      <button type="button" className={styles.groupButton} aria-expanded={expanded}
        aria-label={label} aria-describedby={summaryId}
        aria-controls={detailsId} onClick={() => setOpenGroup(expanded ? null : group)}>
        <span className={styles.groupCopy}><strong>{label}</strong><small id={summaryId}>{summary}</small></span>
        <svg className={styles.rowChevron} viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="m6 4 4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div className={styles.groupDetails} id={detailsId} hidden={!expanded}>{expanded && content}</div>
    </div>;
  }

  return <section className={styles.section} aria-labelledby={titleId}>
    <div className={styles.heading}>
      <h1 id={titleId}>Профиль</h1>
      <span className={styles.demoBadge}>Демо</span>
    </div>
    <div className={styles.identity}>
      <span className={styles.avatar} aria-hidden="true">{profile.name.trim().slice(0, 1).toLocaleUpperCase("ru-RU")}</span>
      <div><strong>{profile.name}</strong></div>
    </div>
    <div className={styles.identityCode}>
      <span>Идентификатор демо-профиля</span><strong>{profile.shortAddress}</strong>
    </div>
    <p className={styles.identityNote}>Не используется для получения средств.</p>
    <button type="button" className={styles.privacyButton} aria-pressed={balanceHidden}
      aria-label={balanceHidden ? "Показать суммы" : "Скрыть суммы"}
      onClick={() => onBalanceHiddenChange(!balanceHidden)}>
      <span>Скрывать суммы</span>
      <span className={styles.privacyState}>
        <strong>{balanceHidden ? "Включено" : "Выключено"}</strong>
        <span className={styles.privacyToggle} data-checked={balanceHidden} aria-hidden="true" />
      </span>
    </button>
    <div className={styles.groups}>
      {disclosure("settings", "Настройки", "Язык и валюта", <>
        <div className={styles.detailLine}><span>Язык интерфейса</span><strong>Русский</strong></div>
        <div className={styles.detailLine}><span>Валюта оценки</span><strong>USD</strong></div>
        <p className={styles.groupNote}>Выбор языка и валюты пока недоступен.</p>
      </>)}
      {disclosure("security", "Безопасность", "Не подключено", <>
        <div className={styles.detailLine}><span>Двухфакторная защита</span><strong>Неизвестно</strong></div>
        <div className={styles.detailLine}><span>Проверка личности</span><strong>Неизвестно</strong></div>
        <p className={styles.groupNote}>Данные о защите не подключены.</p>
      </>)}
      {disclosure("help", "Помощь", "Поддержка и документы", <p className={styles.groupNote}>
        Поддержка и документы пока недоступны.
      </p>)}
    </div>
  </section>;
}
