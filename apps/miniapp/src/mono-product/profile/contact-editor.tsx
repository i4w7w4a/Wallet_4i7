"use client";

import { useId, useLayoutEffect, useRef, useState } from "react";
import type { ProfileContactValues } from "./types";
import { ProfilePanel } from "./profile-panel";
import styles from "../product-profile.module.css";

const fields = [
  { key: "displayName", label: "Имя", type: "text", autoComplete: "name", maxLength: 80 },
  { key: "email", label: "Эл. почта", type: "email", autoComplete: "email", maxLength: 254 },
  { key: "phone", label: "Телефон", type: "tel", autoComplete: "tel", maxLength: 40 },
  { key: "telegram", label: "Telegram", type: "text", autoComplete: "off", maxLength: 33 },
  { key: "additionalEmail", label: "Дополнительная эл. почта", type: "email", autoComplete: "email", maxLength: 254 },
] as const;
type Field = keyof ProfileContactValues;
type Errors = Partial<Record<Field, string>>;

function validate(values: ProfileContactValues): Errors {
  const errors: Errors = {};
  if (values.displayName.length > 80 || /[\u0000-\u001f\u007f]/.test(values.displayName)) {
    errors.displayName = "Используйте до 80 символов без управляющих знаков.";
  }
  for (const field of ["email", "additionalEmail"] as const) {
    const value = values[field].trim();
    if (value && (value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))) {
      errors[field] = "Проверьте адрес: нужны имя, @ и домен. Не больше 254 символов.";
    }
  }
  const phone = values.phone.trim(), digits = phone.replace(/\D/g, "");
  if (phone && (!/^\+?[0-9 ()-]+$/.test(phone) || digits.length < 7 || digits.length > 15 || phone.length > 40)) {
    errors.phone = "Используйте от 7 до 15 цифр; допустимы +, пробелы, скобки и дефисы.";
  }
  const telegram = values.telegram.trim();
  if (telegram && !/^@?[A-Za-z][A-Za-z0-9_]{4,31}$/.test(telegram)) {
    errors.telegram = "Укажите имя Telegram из 5–32 букв, цифр или _, можно с @. Ссылка не нужна.";
  }
  return errors;
}

export function ProfileContactEditor({ values, onSave, onCancel }: {
  values: ProfileContactValues; onSave(values: ProfileContactValues): void; onCancel(): void;
}) {
  const prefix = useId();
  const noteId = `${prefix}-note`;
  const [draft, setDraft] = useState(() => ({ ...values }));
  const [errors, setErrors] = useState<Errors>({});
  const inputs = useRef<Partial<Record<Field, HTMLInputElement | null>>>({});
  const summary = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => { inputs.current.displayName?.focus({ preventScroll: true }); }, []);
  useLayoutEffect(() => { if (Object.keys(errors).length > 1) summary.current?.focus({ preventScroll: true }); }, [errors]);
  const invalidFields = fields.filter(field => errors[field.key]);
  return <ProfilePanel title="Личные контакты" onBack={onCancel} focusBack={false}>
    <p className={styles.note} id={noteId}>Все поля можно оставить пустыми. Сохранение действует только в этой демонстрационной сессии и не подтверждает владение контактами.</p>
    <form className={styles.contactForm} data-profile-contact-editor noValidate onSubmit={event => {
      event.preventDefault();
      const nextErrors = validate(draft);
      setErrors(nextErrors);
      const invalid = fields.filter(field => nextErrors[field.key]);
      if (invalid.length) {
        if (invalid.length === 1) inputs.current[invalid[0].key]?.focus();
        return;
      }
      onSave({ displayName: draft.displayName.trim(), email: draft.email.trim(), phone: draft.phone.trim(),
        telegram: draft.telegram.trim(), additionalEmail: draft.additionalEmail.trim() });
    }}>
      {invalidFields.length > 1 && <div className={styles.errorSummary} role="alert" tabIndex={-1} ref={summary}>
        <p>Проверьте отмеченные поля:</p>
        <ul>{invalidFields.map(field => <li key={field.key}><a href={`#${prefix}-${field.key}`} onClick={event => {
          event.preventDefault(); inputs.current[field.key]?.focus();
        }}>{field.label}</a></li>)}</ul>
      </div>}
      {fields.map(field => <div className={styles.formField} key={field.key}>
        <label htmlFor={`${prefix}-${field.key}`}>{field.label}</label>
        <input id={`${prefix}-${field.key}`} ref={node => { inputs.current[field.key] = node; }}
          type={field.type} autoComplete={field.autoComplete} maxLength={field.maxLength}
          value={draft[field.key]} spellCheck={false} aria-invalid={errors[field.key] ? true : undefined}
          aria-describedby={`${noteId}${errors[field.key] ? ` ${prefix}-${field.key}-error` : ""}`}
          onChange={event => setDraft(current => ({ ...current, [field.key]: event.target.value }))} />
        {errors[field.key] && <p className={styles.fieldError} id={`${prefix}-${field.key}-error`}>{errors[field.key]}</p>}
      </div>)}
      <div className={styles.formActions}>
        <button type="submit" className={styles.primaryAction}>Сохранить</button>
        <button type="button" className={styles.textAction} onClick={onCancel}>Отмена</button>
      </div>
    </form>
  </ProfilePanel>;
}
