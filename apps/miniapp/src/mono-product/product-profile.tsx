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

  function disclosure(group: ProfileGroup, label: string, content: ReactNode) {
    const expanded = openGroup === group;
    const detailsId = `${groupIdPrefix}-${group}`;
    return <div className={styles.group}>
      <button type="button" className={styles.groupButton} aria-expanded={expanded}
        aria-controls={detailsId} onClick={() => setOpenGroup(expanded ? null : group)}>
        <span>{label}</span><span aria-hidden="true">{expanded ? "−" : "+"}</span>
      </button>
      <div className={styles.groupDetails} id={detailsId} hidden={!expanded}>{expanded && content}</div>
    </div>;
  }

  return <section className={styles.section} aria-labelledby={titleId}>
    <div className={styles.heading}>
      <div>
        <p className={styles.eyebrow}>АККАУНТ / DEMO</p>
        <h1 id={titleId}>Профиль</h1>
      </div>
      <span className={styles.demoBadge}>Демо</span>
    </div>
    <div className={styles.identity}>
      <span className={styles.avatar} aria-hidden="true">{profile.name.trim().slice(0, 1).toLocaleUpperCase("ru-RU")}</span>
      <div><strong>{profile.name}</strong><small>Демонстрационный профиль</small></div>
    </div>
    <div className={styles.identityCode}>
      <span>Идентификатор демо-профиля</span><strong>{profile.shortAddress}</strong>
    </div>
    <p className={styles.identityNote}>Это пример идентификатора, не адрес для получения средств.</p>
    <button type="button" className={styles.privacyButton} aria-pressed={balanceHidden}
      aria-label={balanceHidden ? "Показать суммы" : "Скрыть суммы"}
      onClick={() => onBalanceHiddenChange(!balanceHidden)}>
      <span>Скрывать суммы</span><strong>{balanceHidden ? "Включено" : "Выключено"}</strong>
    </button>
    <div className={styles.groups}>
      {disclosure("settings", "Настройки", <>
        <div className={styles.detailLine}><span>Язык интерфейса</span><strong>Русский</strong></div>
        <div className={styles.detailLine}><span>Валюта оценки</span><strong>USD</strong></div>
        <p className={styles.groupNote}>Текущая конфигурация демо. Выбор языка и валюты пока недоступен.</p>
      </>)}
      {disclosure("security", "Безопасность", <p className={styles.groupNote}>
        Сведения о двухфакторной защите и проверке личности пока не подключены. Их статус здесь неизвестен.
      </p>)}
      {disclosure("help", "Помощь", <p className={styles.groupNote}>
        Связь с поддержкой и документы пока не подключены.
      </p>)}
    </div>
  </section>;
}
