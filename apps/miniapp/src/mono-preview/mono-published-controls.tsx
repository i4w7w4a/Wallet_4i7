"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { normalizeMonoAppearanceEnvelope, type MonoAppearanceEnvelope } from "./mono-preset-envelope";
import type { MonoPublishedSlot } from "./mono-published-contract";
import styles from "./mono-published-controls.module.css";

type Props = {
  slot: MonoPublishedSlot;
  disabled?: boolean;
  getSnapshot: () => Promise<MonoAppearanceEnvelope | null>;
};
type Remote = { slot: MonoPublishedSlot; revision: number; published: boolean; loading: boolean; error: boolean };
type Session = { authenticated: boolean; csrfToken: string | null };

const inactiveSession: Session = { authenticated: false, csrfToken: null };

export function MonoPublishedPresetControls(props: Props) {
  return <PublishedControls key={props.slot} {...props} />;
}

function PublishedControls({ slot, disabled = false, getSnapshot }: Props) {
  const alive = useRef(false);
  const readEpoch = useRef(0);
  const sessionEpoch = useRef(0);
  const disabledNow = useRef(disabled);
  const [remote, setRemote] = useState<Remote>({ slot, revision: 0, published: false, loading: true, error: false });
  const [session, setSession] = useState<Session>(inactiveSession);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [status, setStatus] = useState("Проверяю публикацию…");
  const path = `/p/${slot}`;

  useEffect(() => { disabledNow.current = disabled; }, [disabled]);

  const readRemote = useCallback(async (epoch: number): Promise<void> => {
    const response = await fetch(`/api/mono-published/${slot}`, { cache: "no-store", credentials: "same-origin" });
    if (!alive.current || readEpoch.current !== epoch) return;
    if (response.status === 404) {
      setRemote({ slot, revision: 0, published: false, loading: false, error: false });
      setStatus("Публичный адрес ещё не заполнен.");
      return;
    }
    if (!response.ok) throw new Error("Не удалось проверить публикацию.");
    const value: unknown = await response.json();
    if (!alive.current || readEpoch.current !== epoch) return;
    if (!value || typeof value !== "object" || (value as { slot?: unknown }).slot !== slot ||
        !Number.isSafeInteger((value as { revision?: unknown }).revision)) throw new Error("Неверный ответ публикации.");
    setRemote({ slot, revision: (value as { revision: number }).revision,
      published: true, loading: false, error: false });
    setStatus(`Опубликована ревизия ${(value as { revision: number }).revision}.`);
  }, [slot]);

  useEffect(() => {
    alive.current = true;
    const epoch = ++readEpoch.current;
    const authEpoch = ++sessionEpoch.current;
    void readRemote(epoch).catch(() => {
      if (alive.current && readEpoch.current === epoch) {
        setRemote({ slot, revision: 0, published: false, loading: false, error: true });
        setStatus("Публикация временно недоступна.");
      }
    });
    void fetch("/api/mono-published/session", { cache: "no-store", credentials: "same-origin" })
      .then(async response => response.ok ? response.json() as Promise<unknown> : null)
      .then(value => {
        if (!alive.current || sessionEpoch.current !== authEpoch) return;
        const authenticated = !!value && typeof value === "object" &&
          (value as { authenticated?: unknown }).authenticated === true &&
          typeof (value as { csrfToken?: unknown }).csrfToken === "string";
        setSession(authenticated ? { authenticated: true,
          csrfToken: (value as { csrfToken: string }).csrfToken } : inactiveSession);
      }).catch(() => { if (alive.current && sessionEpoch.current === authEpoch) setSession(inactiveSession); });
    return () => { alive.current = false; };
  }, [readRemote, slot]);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !password) return;
    const authEpoch = ++sessionEpoch.current;
    setBusy(true);
    setStatus("Проверяю вход…");
    try {
      const response = await fetch("/api/mono-published/session", {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "content-type": "application/json" }, body: JSON.stringify({ password }),
      });
      if (!alive.current || sessionEpoch.current !== authEpoch) return;
      if (!response.ok) {
        setStatus(response.status === 429 ? "Вход временно ограничен. Повторите позже." :
          response.status === 503 ? "Публикация не настроена на сервере." : "Неверный пароль публикации.");
        setPassword("");
        return;
      }
      const value: unknown = await response.json();
      if (!alive.current || sessionEpoch.current !== authEpoch) return;
      if (!value || typeof value !== "object" || typeof (value as { csrfToken?: unknown }).csrfToken !== "string")
        throw new Error("Неверный ответ входа.");
      setSession({ authenticated: true, csrfToken: (value as { csrfToken: string }).csrfToken });
      setPasswordOpen(false);
      setPassword("");
      setStatus("Вход подтверждён. Публикация выполняется отдельной кнопкой.");
    } catch { if (alive.current && sessionEpoch.current === authEpoch) {
      setPassword(""); setStatus("Не удалось связаться с сервером публикации.");
    } }
    finally { if (alive.current && sessionEpoch.current === authEpoch) setBusy(false); }
  }

  async function publish() {
    if (disabled || busy || remote.loading || remote.error || remote.slot !== slot || conflict) return;
    if (!session.authenticated || !session.csrfToken) { setPasswordOpen(true); return; }
    const expectedRevision = remote.revision, csrfToken = session.csrfToken;
    setBusy(true);
    setStatus("Подготавливаю принятый снимок…");
    try {
      const source = await getSnapshot();
      if (!alive.current || disabledNow.current) return;
      if (!source) { setStatus("Есть незавершённая проба или сохранение. Сначала завершите её."); return; }
      const snapshot = normalizeMonoAppearanceEnvelope(source);
      if (!alive.current || disabledNow.current) return;
      const response = await fetch(`/api/mono-published/${slot}`, {
        method: "PUT", credentials: "same-origin", cache: "no-store",
        headers: { "content-type": "application/json", "x-mono-csrf": csrfToken },
        body: JSON.stringify({ expectedRevision, snapshot }),
      });
      if (!alive.current) return;
      if (response.status === 409) {
        setConflict(true); setStatus("Адрес изменён в другом окне. Обновите статус перед новой публикацией."); return;
      }
      if (response.status === 401 || response.status === 403) {
        setSession(inactiveSession); setPasswordOpen(true); setStatus("Сессия закончилась. Войдите снова."); return;
      }
      if (!response.ok) { setStatus(response.status === 413 ? "Снимок слишком велик." :
        response.status === 422 ? "Снимок не прошёл проверку." : "Сервер не сохранил публикацию."); return; }
      const value: unknown = await response.json();
      if (!alive.current) return;
      if (!value || typeof value !== "object" || (value as { slot?: unknown }).slot !== slot ||
          !Number.isSafeInteger((value as { revision?: unknown }).revision)) throw new Error("Неверный ответ публикации.");
      const revision = (value as { revision: number }).revision;
      setRemote({ slot, revision, published: true, loading: false, error: false });
      setStatus(`Опубликована ревизия ${revision}. Адрес остался прежним.`);
    } catch { if (alive.current) setStatus("Публикация не выполнена. Проверьте снимок и соединение."); }
    finally { if (alive.current) setBusy(false); }
  }

  async function copy() {
    const link = new URL(path, window.location.origin).href;
    try {
      await navigator.clipboard.writeText(link);
      if (alive.current) setStatus("Публичная ссылка скопирована.");
    } catch { if (alive.current) setStatus(`Ссылка: ${link}`); }
  }

  async function refresh() {
    const epoch = ++readEpoch.current;
    setConflict(false);
    setRemote(before => ({ ...before, loading: true }));
    try { await readRemote(epoch); }
    catch {
      if (alive.current && readEpoch.current === epoch) {
        setRemote(before => ({ ...before, loading: false, error: true }));
        setStatus("Не удалось обновить статус публикации.");
      }
    }
  }

  return <section className={styles.root} aria-label={`Публикация пресета ${slot}`}>
    <div className={styles.heading}><strong>Адрес {slot}</strong><code>{path}</code></div>
    <div className={styles.actions}>
      {remote.published && remote.slot === slot && <>
        <a className={styles.iconAction} href={path} target="_blank" rel="noopener noreferrer"
          aria-label="Открыть готовый кошелёк" title="Открыть готовый кошелёк"><span aria-hidden="true">↗</span></a>
        <button className={styles.iconAction} type="button" onClick={() => void copy()}
          aria-label="Скопировать ссылку" title="Скопировать ссылку"><span aria-hidden="true">⧉</span></button>
      </>}
      <button className={styles.publish} type="button"
        disabled={disabled || busy || remote.loading || remote.error || remote.slot !== slot || conflict}
        onClick={() => void publish()}>{remote.published ? "Обновить" : "Опубликовать"}</button>
      {(conflict || remote.error) && <button className={styles.iconAction} type="button"
        onClick={() => void refresh()} aria-label="Обновить статус" title="Обновить статус">
        <span aria-hidden="true">↻</span></button>}
    </div>
    {passwordOpen && <form className={styles.login} onSubmit={event => void login(event)}>
      <label>Пароль публикации<input type="password" autoComplete="current-password" value={password}
        onChange={event => setPassword(event.target.value)} maxLength={512} /></label>
      <button type="submit" disabled={busy || !password}>Войти для публикации</button>
    </form>}
    <p role="status" aria-live="polite" className={styles.status}>{status}</p>
  </section>;
}
