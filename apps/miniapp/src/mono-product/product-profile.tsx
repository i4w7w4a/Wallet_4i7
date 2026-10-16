"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { WalletProfile } from "@wallet/core";
import { useProfileDemoSession, ProductRiskTest, type ProfileDemoSession, type ProductRiskQuestion,
  type ProductProfileActions, type ProductProfileResource } from "./profile";
import { ProfileContactEditor } from "./profile/contact-editor";
import { ProfileSecurityDetail, profileSecurityEntries, profileSecurityStatus, type ProfileSecurityAction } from "./profile/security-detail";
import type { ProductHelpActions } from "./product-help";
import type { ProductBalanceDynamicsControl } from "./product-profile-content";
import { ProfileQuickMenu, type ProfileQuickMenuDetail } from "./profile-quick-menu/profile-quick-menu";
export { ProductProfileSettingsContent, ProductProfileHelpContent, ProductProfileDocumentsContent } from "./product-profile-content";
import { DisclosureMotion } from "./motion/disclosure-motion";
import { ProfileSectionIcon } from "./profile-section-icons";
import styles from "./product-profile.module.css";

export type ProductProfileSection = "personal" | "settings" | "security" | "help";
export type ProductProfileOpenSectionRequest = { section: ProductProfileSection; revision: number; target?: "documents" };

export type ProductProfileProps = {
  profile: WalletProfile;
  balanceHidden: boolean;
  onBalanceHiddenChange: (hidden: boolean) => void;
  resource?: ProductProfileResource;
  /** Host-owned memory, mounted above conditional Profile navigation. */
  session?: ProfileDemoSession;
  /** Same supplied portrait source as the host's header; null requests an honest fallback. */
  avatarSrc?: string | null;
  riskQuestions?: readonly ProductRiskQuestion[];
  actions?: ProductProfileActions;
  helpActions?: ProductHelpActions;
  onRetry?(): void;
  theme?: "dark" | "light";
  onThemeChange?(theme: "dark" | "light"): void;
  balanceDynamics?: ProductBalanceDynamicsControl;
  /** Personal/security open disclosures; legacy settings/help requests reuse the compact Menu detail. */
  openSectionRequest?: ProductProfileOpenSectionRequest;
  /** Existing host guard is reused for legacy compact destinations. */
  onRequestDetail?(target: ProfileQuickMenuDetail): boolean;
};

type InlinePanel = { kind: "contacts" | "risk" | ProfileSecurityAction; sourceKey: string };

export function ProductProfile({ profile: sourceProfile, resource, session, avatarSrc, riskQuestions = [], actions, helpActions, onRetry, openSectionRequest,
  onRequestDetail, balanceDynamics }: ProductProfileProps) {
  const localSession = useProfileDemoSession({ profile: sourceProfile, resource, avatarSrc });
  const currentSession = session ?? localSession;
  const profile = currentSession.profile;
  const titleId = useId();
  const groupIdPrefix = useId();
  const requestedSection = openSectionRequest?.section;
  const requestedRevision = openSectionRequest?.revision;
  const [openGroup, setOpenGroup] = useState<"personal" | "security" | null>(null);
  const [legacyDetail, setLegacyDetail] = useState<ProfileQuickMenuDetail | null>(null);
  const [panel, setPanel] = useState<InlinePanel | null>(null);
  const activePanel = panel?.sourceKey === currentSession.sourceKey ? panel : null;
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const panelLauncher = useRef<HTMLButtonElement | null>(null);
  const returnTarget = useRef<HTMLButtonElement | null>(null);
  const consumedRequest = useRef<number | undefined>(undefined);
  const requestTarget = useRef<HTMLButtonElement>(null);
  const titleTarget = useRef<HTMLHeadingElement>(null);
  const menuId = useId();
  const current = currentSession.resource;
  const legacySource = useRef<{ resource: ProductProfileResource; profile: WalletProfile } | null>(null);
  const details = current.status === "ready" ? current.data : null;
  useLayoutEffect(() => {
    if (panel && !activePanel) {
      setPanel(null); panelLauncher.current = null; titleTarget.current?.focus({ preventScroll: true });
    } else if (!activePanel && returnTarget.current) {
      const target = returnTarget.current; returnTarget.current = null;
      if (target.isConnected) target.focus({ preventScroll: true });
    }
  }, [panel, activePanel]);
  function openPanel(kind: InlinePanel["kind"], launcher: HTMLButtonElement) {
    panelLauncher.current = launcher;
    setPanel({ kind, sourceKey: currentSession.sourceKey });
  }
  function closePanel() {
    returnTarget.current = panelLauncher.current; setPanel(null); panelLauncher.current = null;
  }
  useEffect(() => {
    if (!requestedSection || requestedRevision === consumedRequest.current) return;
    consumedRequest.current = requestedRevision;
    if (requestedSection === "personal" || requestedSection === "security") {
      setLegacyDetail(null); setPanel(null); setOpenGroup(requestedSection); requestTarget.current?.focus();
      return;
    }
    const target = requestedSection === "settings" ? "language" : openSectionRequest?.target === "documents" ? "documents" : "help";
    if (onRequestDetail && !onRequestDetail(target)) return;
    legacySource.current = { resource: current, profile }; setLegacyDetail(target);
  }, [requestedSection, requestedRevision, openSectionRequest?.target, onRequestDetail, current, profile]);
  useEffect(() => {
    if (legacyDetail && legacySource.current &&
      (legacySource.current.resource !== current || legacySource.current.profile !== profile)) {
      setLegacyDetail(null); legacySource.current = null;
    }
  }, [legacyDetail, current, profile]);
  function dismissLegacyDetail() {
    if (legacyDetail && onRequestDetail && !onRequestDetail(legacyDetail)) return;
    setLegacyDetail(null); legacySource.current = null;
    titleTarget.current?.focus({ preventScroll: true });
  }
  const unavailableCopy = current.status === "loading" ? "Загружаем данные…" : "Данные профиля пока недоступны.";
  const securitySummary = details
    ? details.verification === "unknown" && details.twoFactor === "unknown" && details.addressAllowlist === "unknown"
      ? "Данные не подключены" : "Проверка личности и доступ"
    : current.status === "loading" ? "Загрузка данных" : "Данные недоступны";

  function disclosure(group: "personal" | "security", label: string, summary: string, content: ReactNode) {
    const expanded = openGroup === group;
    const detailsId = `${groupIdPrefix}-${group}`;
    const summaryId = `${detailsId}-summary`;
    const triggerId = `${detailsId}-trigger`;
    return <div className={styles.group}>
      <h2 className={styles.groupHeading}><button type="button" id={triggerId} className={styles.groupButton} aria-expanded={expanded}
        ref={requestedSection === group ? requestTarget : undefined}
        aria-label={label} aria-describedby={summaryId}
        aria-controls={detailsId} onClick={() => setOpenGroup(expanded ? null : group)}>
        <ProfileSectionIcon section={group} />
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
    <h1 ref={titleTarget} tabIndex={-1} data-profile-title className={styles.title} id={titleId}>Профиль</h1>
    <div className={styles.identity} data-profile-identity>
      <ProfilePortrait key={(avatarSrc === undefined ? currentSession.avatarSrc : avatarSrc) ?? ""}
        src={avatarSrc === undefined ? currentSession.avatarSrc : avatarSrc} name={profile.name} />
      <div className={styles.identityCopy}>
        <strong className={styles.name}>{profile.name.trim() || "Имя не указано"}</strong>
        <span className={styles.identityLabel}>Идентификатор демо-профиля</span>
        <span className={styles.identityCode}>{profile.shortAddress}</span>
      </div>
    </div>
    <p className={styles.identityNote}>Не используется для получения средств.</p>

    {current.status === "loading" && <p className={styles.resourceNote} role="status">Загружаем данные профиля…</p>}
    {current.status === "error" && <div className={styles.resourceError}>
      <p role="alert">Не удалось загрузить данные профиля.</p>
      {current.retryable && onRetry && <button className={styles.textAction} type="button" onClick={onRetry}>Повторить</button>}
    </div>}

    <div className={styles.groups} data-profile-groups hidden={Boolean(activePanel)} inert={Boolean(legacyDetail)} aria-hidden={legacyDetail ? true : undefined}>
      {disclosure("personal", "Личные данные", "Контакты и имя", details ? <>
        <dl className={styles.details}>
          <div><dt>Эл. почта</dt><dd>{details.email?.trim() || "Не указано"}</dd></div>
          <div><dt>Телефон</dt><dd>{details.phone?.trim() || "Не указано"}</dd></div>
          <div><dt>Telegram</dt><dd>{details.telegram?.trim() || "Не указано"}</dd></div>
          <div><dt>Дополнительная эл. почта</dt><dd>{details.additionalEmail?.trim() || "Не указано"}</dd></div>
        </dl>
        <button type="button" className={styles.textAction} aria-label="Изменить контакты"
          onClick={event => actions?.["edit-contacts"] ? actions["edit-contacts"]() : openPanel("contacts", event.currentTarget)}>Изменить</button>
        {savedNotice === currentSession.sourceKey && <p className={styles.note} role="status">Сохранено только в демонстрационной сессии. Владение контактами не подтверждено.</p>}
      </> : <p className={styles.note}>{unavailableCopy}</p>)}

      {disclosure("security", "Безопасность", securitySummary, details ? <>
        <div className={styles.securityEntries}>
          {profileSecurityEntries.map(entry => <button key={entry.action} className={styles.securityRow} type="button" aria-label={entry.actionLabel}
            onClick={event => actions?.[entry.action] ? actions[entry.action]!() : openPanel(entry.action, event.currentTarget)}>
            <span className={styles.groupCopy}><strong>{entry.title}</strong><small>{profileSecurityStatus(entry.action, details)}</small></span>
            <ProfileChevron />
          </button>)}
        </div>
      </> : <p className={styles.note}>{unavailableCopy}</p>)}
      <div className={styles.group}>
        <h2 className={styles.groupHeading}><button type="button" className={styles.groupButton} aria-label="Тест о рисках"
          onClick={event => openPanel("risk", event.currentTarget)}>
          <svg className={styles.sectionIcon} width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
            <rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6M9 12h6M9 16h4" />
          </svg>
          <span className={styles.groupCopy}><strong>Тест о рисках</strong><small>{riskQuestions.length ? "Вопросы и просмотр ответов" : "Материалы подготавливаются"}</small></span>
          <ProfileChevron />
        </button></h2>
      </div>
    </div>
    {activePanel?.kind === "contacts" && details && <ProfileContactEditor key={currentSession.sourceKey} values={currentSession.contacts}
      onCancel={closePanel} onSave={values => { currentSession.saveContacts(values); setSavedNotice(currentSession.sourceKey); closePanel(); }} />}
    {activePanel?.kind === "risk" && <ProductRiskTest key={currentSession.sourceKey} questions={riskQuestions}
      answers={currentSession.riskAnswers} onSaveAnswers={currentSession.saveRiskAnswers} onBack={closePanel} />}
    {activePanel && activePanel.kind !== "contacts" && activePanel.kind !== "risk" && details &&
      <ProfileSecurityDetail action={activePanel.kind} details={details} onBack={closePanel} />}
    {legacyDetail && <ProfileQuickMenu key={requestedRevision} id={menuId} open inline anchorRef={titleTarget}
      initialDetail={legacyDetail} initialBackLabel="Назад в профиль" resource={current} helpActions={helpActions}
      balanceDynamics={balanceDynamics}
      theme="dark" balanceHidden={false} onBalanceHiddenChange={() => {}} onDismiss={dismissLegacyDetail}
      onBackRequest={() => !onRequestDetail || onRequestDetail(legacyDetail)} />}
  </section>;
}

function ProfileChevron() {
  return <svg className={styles.chevron} viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
    <path d="m6 4 4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}

function ProfilePortrait({ src, name }: { src?: string | null; name: string }) {
  const [status, setStatus] = useState<"pending" | "ready" | "failed">("pending");
  const initial = Array.from(name.trim())[0]?.toLocaleUpperCase("ru-RU");
  return <span className={styles.avatar} aria-hidden="true">
    <span hidden={status === "ready"}>{initial || <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" focusable="false">
      <circle cx="12" cy="8" r="3.3" /><path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
    </svg>}</span>
    {src?.trim() && status !== "failed" &&
      // eslint-disable-next-line @next/next/no-img-element
      <img className={styles.avatarImage} src={src.trim()} alt="" width="44" height="44" hidden={status !== "ready"}
        draggable={false} decoding="async" onLoad={() => setStatus("ready")} onError={() => setStatus("failed")} />}
  </span>;
}
