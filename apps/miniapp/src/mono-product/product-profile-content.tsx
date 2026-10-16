"use client";

import { useId, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { isProfileLinkAllowed, type ProductProfileResource } from "./profile";
import { ProfilePanel } from "./profile/profile-panel";
import { ProductHelp, type ProductHelpActions, type ProductHelpTopicId } from "./product-help";
import styles from "./product-profile.module.css";

function unavailableProfileCopy(resource: ProductProfileResource) {
  return resource.status === "loading" ? "Загружаем данные…" : "Данные профиля пока недоступны.";
}

/** Host-owned display preference; independent of profile data, theme and financial commands. */
export type ProductBalanceDynamicsControl = {
  enabled: boolean;
  onChange(enabled: boolean): void;
  disabled?: boolean;
};

/** Profile and compact Menu share the same settings content and optional host display control. */
export function ProductProfileSettingsContent({ resource, balanceDynamics }: {
  resource: ProductProfileResource; balanceDynamics?: ProductBalanceDynamicsControl;
}) {
  const statusId = useId();
  const displayControl = balanceDynamics && <button type="button" role="switch"
    className={`${styles.preferenceRow} ${styles.privacyButton}`} aria-label="Динамика баланса"
    aria-checked={balanceDynamics.enabled} aria-describedby={statusId} disabled={balanceDynamics.disabled}
    onClick={() => balanceDynamics.onChange(!balanceDynamics.enabled)}>
    <span>Динамика баланса</span>
    <span className={styles.privacyState}><span id={statusId}>{balanceDynamics.enabled ? "Включена" : "Выключена"}</span>
      <span className={styles.privacyToggle} data-checked={balanceDynamics.enabled} aria-hidden="true" />
    </span>
  </button>;
  return resource.status === "ready" ? <div className={styles.sharedContent}>
    <dl className={styles.details}>
      <div><dt>Язык интерфейса</dt><dd>{resource.data.languageLabel}</dd></div>
      <div><dt>Валюта оценки</dt><dd>{resource.data.valuationCurrencyLabel}</dd></div>
    </dl>
    <p className={styles.note}>Выбор языка и валюты пока не подключён. Валюта оценки не выполняет обмен.</p>
    {displayControl}
  </div> : displayControl ? <div className={styles.sharedContent}>
    <p className={styles.note}>{unavailableProfileCopy(resource)}</p>{displayControl}
  </div> : <p className={styles.note}>{unavailableProfileCopy(resource)}</p>;
}

export function ProductProfileDocumentsContent({ resource, titleRef, hideHeading = false }: {
  resource: ProductProfileResource; titleRef?: RefObject<HTMLHeadingElement | null>; hideHeading?: boolean;
}) {
  const titleId = useId();
  const [selected, setSelected] = useState<{ id: string; title: string; source: ProductProfileResource } | null>(null);
  const activeDocument = selected?.source === resource && resource.status === "ready" ? selected : null;
  const rows = useRef<Record<string, HTMLButtonElement | null>>({});
  const returnRow = useRef<string | null>(null);
  const documents = resource.status === "ready" ? resource.data.documents.filter(document => isProfileLinkAllowed(document.href)) : [];
  const placeholders = [
    { id: "terms", title: "Условия использования" },
    { id: "privacy", title: "Политика конфиденциальности" },
  ].filter(placeholder => !documents.some(document => document.id === placeholder.id));
  useLayoutEffect(() => {
    if (selected && !activeDocument) setSelected(null);
    if (!activeDocument && returnRow.current) {
      rows.current[returnRow.current]?.focus({ preventScroll: true }); returnRow.current = null;
    }
  }, [selected, activeDocument]);
  function closeDocument() {
    returnRow.current = activeDocument?.id ?? null; setSelected(null);
  }
  return <section className={styles.sharedContent} aria-labelledby={hideHeading ? undefined : titleId} aria-label={hideHeading ? "Документы сервиса" : undefined} data-profile-service-documents>
    {!hideHeading && <h3 id={titleId} ref={titleRef} tabIndex={-1} className={styles.contentHeading}>Документы сервиса</h3>}
    {resource.status === "ready" ? <div className={styles.links} hidden={Boolean(activeDocument)}>
      {documents.map(document => <ProfileLink key={document.id} href={document.href}>{document.title || "Документ сервиса"}</ProfileLink>)}
      {documents.length === 0 && <p className={styles.note}>Документы сервиса пока не подключены</p>}
      {placeholders.map(document => <button type="button" className={styles.documentRow} key={document.id}
        ref={node => { rows.current[document.id] = node; }} aria-label={document.title}
        onClick={() => setSelected({ ...document, source: resource })}>
        <span className={styles.groupCopy}><strong>{document.title}</strong><small>Материал подготавливается</small></span>
        <svg className={styles.chevron} viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
          <path d="m6 4 4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>)}
    </div> : <p className={styles.note}>{unavailableProfileCopy(resource)}</p>}
    {activeDocument && <ProfilePanel title={activeDocument.title} onBack={closeDocument} backLabel="Назад к документам">
      <p className={styles.panelCopy}>Материал пока подготавливается. После предоставления документа здесь будет доступна его актуальная версия.</p>
      <p className={styles.note}>Содержание документа не добавлено. Просмотр этого экрана не означает согласие с условиями.</p>
    </ProfilePanel>}
  </section>;
}

export function ProductProfileHelpContent({ resource, helpActions, openTopic, onOpenTopicChange, documentsTitleRef }: {
  resource: ProductProfileResource; helpActions?: ProductHelpActions;
  openTopic?: ProductHelpTopicId | null; onOpenTopicChange?(topic: ProductHelpTopicId | null): void;
  documentsTitleRef?: RefObject<HTMLHeadingElement | null>;
}) {
  const [localTopic, setLocalTopic] = useState<ProductHelpTopicId | null>(null);
  const support = resource.status === "ready" && resource.data.support && isProfileLinkAllowed(resource.data.support.href)
    ? resource.data.support : null;
  return <div className={styles.sharedContent}>
    <ProductHelp openTopic={openTopic === undefined ? localTopic : openTopic}
      onOpenTopicChange={onOpenTopicChange ?? setLocalTopic} actions={helpActions} />
    <div className={styles.links}>
      {resource.status !== "ready" ? <p className={styles.note}>{unavailableProfileCopy(resource)}</p>
        : support ? <ProfileLink href={support.href}>{support.label || "Поддержка"}</ProfileLink>
          : <p className={styles.note}>Контакт поддержки пока не указан.</p>}
    </div>
    <ProductProfileDocumentsContent resource={resource} titleRef={documentsTitleRef} />
  </div>;
}

function ProfileLink({ href, children }: { href: string; children: ReactNode }) {
  return <a className={styles.link} href={href} target="_blank" rel="noopener noreferrer">
    <span>{children}</span>
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
      <path d="M4 12 12 4M5 4h7v7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </a>;
}
