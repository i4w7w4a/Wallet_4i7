"use client";

import { useId } from "react";
import type { ProductProfileAction, ProductProfileDetails } from "./types";
import { ProfilePanel } from "./profile-panel";
import styles from "../product-profile.module.css";

export type ProfileSecurityAction = Exclude<ProductProfileAction, "edit-contacts">;
const verificationLabels: Record<ProductProfileDetails["verification"], string> = {
  unknown: "Данные не подключены", "not-started": "Не начата", pending: "На проверке", verified: "Подтверждена", rejected: "Не пройдена",
};
const twoFactorLabels: Record<ProductProfileDetails["twoFactor"], string> = {
  unknown: "Данные не подключены", disabled: "Выключена", enabled: "Включена",
};
const addressLabels: Record<ProductProfileDetails["addressAllowlist"], string> = {
  unknown: "Данные не подключены", disabled: "Выключен", enabled: "Включён",
};
const passwordLabels = { unknown: "Сведения не подключены", set: "Задан", "not-set": "Не задан" };

export const profileSecurityEntries = [
  { action: "manage-verification", title: "Проверка личности", actionLabel: "Открыть проверку личности",
    explanation: "Здесь появятся требования к проверке личности и её текущий этап. Проверка начнётся только после подключения сервиса; сейчас документы не собираются." },
  { action: "manage-2fa", title: "Двухфакторная защита", actionLabel: "Настроить двухфакторную защиту",
    explanation: "В подключённом сценарии здесь можно будет настроить второй фактор и проверить его состояние. В этой демонстрации коды и ключи защиты не запрашиваются." },
  { action: "manage-password", title: "Пароль", actionLabel: "Изменить пароль",
    explanation: "Изменение пароля будет доступно в подключённом защищённом сценарии. Сейчас пароль и другие секреты вводить не нужно." },
  { action: "manage-addresses", title: "Разрешённые адреса", actionLabel: "Управлять разрешёнными адресами",
    explanation: "В подключённом сценарии здесь можно будет просмотреть и изменить разрешённые адреса. Эта демонстрация не вводит ограничений на операции и не меняет список." },
] as const satisfies readonly { action: ProfileSecurityAction; title: string; actionLabel: string; explanation: string }[];

export function profileSecurityStatus(action: ProfileSecurityAction, details: ProductProfileDetails): string {
  if (action === "manage-verification") return verificationLabels[details.verification];
  if (action === "manage-2fa") return twoFactorLabels[details.twoFactor];
  if (action === "manage-addresses") return addressLabels[details.addressAllowlist];
  return passwordLabels[details.password ?? "unknown"];
}

export function ProfileSecurityDetail({ action, details, onBack }: {
  action: ProfileSecurityAction; details: ProductProfileDetails; onBack(): void;
}) {
  const reasonId = useId();
  const entry = profileSecurityEntries.find(entry => entry.action === action)!;
  return <ProfilePanel title={entry.title} onBack={onBack}>
    <dl className={styles.details}><div><dt>Текущее состояние</dt><dd>{profileSecurityStatus(action, details)}</dd></div></dl>
    <p className={styles.panelCopy}>{entry.explanation}</p>
    <p className={styles.note} id={reasonId}>Управление не подключено. Открытие этого экрана не меняет защиту аккаунта.</p>
    <button type="button" className={styles.primaryAction} disabled aria-describedby={reasonId}>{entry.actionLabel}</button>
  </ProfilePanel>;
}
